import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET } from '../utils/env';
import { GeneratedQuestion } from './aiExamService';

// The exam session token is a signed JWT (tamper-evident, carries its own
// expiry = the exam timer) whose payload embeds the answer key. A plain JWT
// is only base64-encoded, not encrypted, so the answer key itself is
// AES-256-GCM encrypted before being placed in the payload — otherwise a
// student could just base64-decode their own token and read the correct
// answers straight out of it.
function getCipherKey(): Buffer {
  return crypto.createHash('sha256').update(JWT_SECRET).digest();
}

function encryptAnswerKey(questions: GeneratedQuestion[]): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(questions), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptAnswerKey(payload: string): GeneratedQuestion[] {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getCipherKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

interface ExamSessionJwtPayload {
  userId: string;
  courseId: string;
  examId: string;
  answerKeyEnc: string;
}

export class ExamSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExamSessionError';
  }
}

export function createExamSessionToken(params: {
  userId: string;
  courseId: string;
  examId: string;
  questions: GeneratedQuestion[];
  durationMinutes: number;
}): string {
  const payload: ExamSessionJwtPayload = {
    userId: params.userId,
    courseId: params.courseId,
    examId: params.examId,
    answerKeyEnc: encryptAnswerKey(params.questions),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${params.durationMinutes}m` });
}

export function verifyExamSessionToken(token: string): {
  userId: string;
  courseId: string;
  examId: string;
  questions: GeneratedQuestion[];
} {
  let decoded: ExamSessionJwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as ExamSessionJwtPayload;
  } catch {
    throw new ExamSessionError('Your exam session has expired or is invalid. Please start a new attempt.');
  }
  try {
    const questions = decryptAnswerKey(decoded.answerKeyEnc);
    return { userId: decoded.userId, courseId: decoded.courseId, examId: decoded.examId, questions };
  } catch {
    throw new ExamSessionError('Your exam session is corrupted. Please start a new attempt.');
  }
}
