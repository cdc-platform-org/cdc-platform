/**
 * @fileoverview Live Interactive Classroom & Multi-Screen Monitoring Service.
 * Manages real-time student screen-share frames for the trainer's gallery grid,
 * stores completed session recordings, and dispatches automatic recording emails
 * to all enrolled students upon session completion.
 */

import { Resend } from 'resend';
import { randomUUID } from 'crypto';
import { uploadPrivateBlob, getSignedBlobUrl } from './integrations/privateBlobStorage';
import { prisma } from '../lib/prisma';
import { RESEND_API_KEY, EMAIL_FROM } from '../utils/env';

export interface StudentScreenFrame {
  userId: string;
  studentName: string;
  studentEmail: string;
  imageDataUrl: string;
  activeTool?: string;
  updatedAt: number;
}

export interface ClassroomRecordingRecord {
  id: string;
  trainingId: string;
  title: string;
  recordingUrl: string;
  recordedBy: string;
  createdAt: string;
  emailedToCount: number;
}

const activeScreensByTraining = new Map<string, Map<string, StudentScreenFrame>>();


export function upsertStudentScreenFrame(
  trainingId: string,
  frame: Omit<StudentScreenFrame, 'updatedAt'>
): StudentScreenFrame {
  let room = activeScreensByTraining.get(trainingId);
  if (!room) {
    room = new Map<string, StudentScreenFrame>();
    activeScreensByTraining.set(trainingId, room);
  }
  const entry: StudentScreenFrame = { ...frame, updatedAt: Date.now() };
  room.set(frame.userId, entry);
  return entry;
}

export function removeStudentScreenFrame(trainingId: string, userId: string): void {
  activeScreensByTraining.get(trainingId)?.delete(userId);
}

export function getActiveClassroomScreens(trainingId: string): StudentScreenFrame[] {
  const room = activeScreensByTraining.get(trainingId);
  if (!room) return [];
  const cutoff = Date.now() - 30_000;
  const active: StudentScreenFrame[] = [];
  for (const [uid, frame] of room.entries()) {
    if (frame.updatedAt < cutoff) {
      room.delete(uid);
    } else {
      active.push(frame);
    }
  }
  return active;
}

export async function finalizeRecordingAndNotifyStudents(params: {
  trainingId: string;
  recordingUrl: string;
  recordedBy: string;
}): Promise<ClassroomRecordingRecord> {
  const { trainingId, recordingUrl, recordedBy } = params;

  const training = await prisma.liveTraining.findUnique({
    where: { id: trainingId },
    include: {
      enrollments: {
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        include: { user: { select: { email: true, name: true } } },
      },
    },
  });

  if (!training) throw new Error('Training not found.');
  if (!recordingUrl.startsWith('cdcblob://classroom-recordings/')) {
    const url = new URL(recordingUrl);
    if (url.protocol !== 'https:') throw new Error('A persistent HTTPS recording URL is required.');
  }
  const title = training.title;
  const recipients = [...new Set(training.enrollments.map((e) => e.user.email).filter(Boolean))];
  // Persist before email: notification failure must never lose the recording.
  const record = await prisma.liveClassroomRecording.create({
    data: { trainingId, title, recordingUrl, recordedBy },
  });
  const classroomUrl = `${(process.env.FRONTEND_URL || 'https://cdc.org.ge').replace(/\/$/, '')}/dashboard/live-classroom/${encodeURIComponent(trainingId)}`;
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  let emailedToCount = 0;
  if (recipients.length && RESEND_API_KEY) {
    const resend = new Resend(RESEND_API_KEY);
    // Resend limits the combined to/cc/bcc list to 50 recipients.
    for (let i = 0; i < recipients.length; i += 49) {
      const batch = recipients.slice(i, i + 49);
      try {
        const result = await resend.emails.send({
          from: EMAIL_FROM,
          to: EMAIL_FROM.match(/<([^>]+)>/)?.[1] || EMAIL_FROM,
          bcc: batch,
          subject: `🎥 შეხვედრის ჩანაწერი: ${title}`,
          html: `<h2>შეხვედრის ჩანაწერი მზად არის</h2><p>${escapeHtml(title)}</p><p><a href="${escapeHtml(classroomUrl)}">ჩანაწერის ნახვა / View recording</a></p>`,
        });
        if (result.error || !result.data?.id) {
          console.error('[live-classroom] Recording email rejected:', result.error?.name || 'No message ID');
        } else {
          emailedToCount += batch.length;
        }
      } catch (error) {
        console.error('[live-classroom] Recording email failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }
  await prisma.liveClassroomRecording.update({ where: { id: record.id }, data: { emailedToCount } });
  return {
    ...record, emailedToCount, createdAt: record.createdAt.toISOString(),
    recordingUrl: await resolveRecordingUrl(recordingUrl),
  };
}

export async function uploadClassroomRecording(trainingId: string, buffer: Buffer, contentType: string): Promise<string> {
  const key = `classroom-recordings/${trainingId.replace(/[^a-zA-Z0-9-]/g, '-')}/${randomUUID()}.webm`;
  await uploadPrivateBlob(key, buffer, contentType);
  return `cdcblob://${key}`;
}

async function resolveRecordingUrl(url: string): Promise<string> {
  return url.startsWith('cdcblob://classroom-recordings/') ? getSignedBlobUrl(url.slice('cdcblob://'.length), 15) : url;
}

export async function getClassroomRecordings(trainingId: string): Promise<ClassroomRecordingRecord[]> {
  const records = await prisma.liveClassroomRecording.findMany({ where: { trainingId }, orderBy: { createdAt: 'desc' } });
  return Promise.all(records.map(async (record) => ({
    ...record, createdAt: record.createdAt.toISOString(), recordingUrl: await resolveRecordingUrl(record.recordingUrl),
  })));
}
