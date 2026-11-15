/**
 * @fileoverview Interactive Live Classroom Workspace & Multi-Screen Trainer Grid.
 * - Students can share their screen/studio in real time (`getDisplayMedia`).
 * - Trainers see all active student screens in a live gallery grid, can inspect
 *   any screen full-size, record the session, and auto-email the recording to students.
 */

import { useEffect, useRef, useState } from 'react';
import { MonitorUp, MonitorOff, Video, Square, MailCheck, Maximize2, X, Users } from 'lucide-react';
import {
  pushStudentScreenFrame,
  stopStudentScreenShare,
  fetchClassroomState,
  saveRecordingAndNotifyStudents,
  StudentScreenFrame,
  ClassroomRecordingRecord,
} from '../../services/liveClassroomService';

interface LiveClassroomGridProps {
  trainingId: string;
  studentName?: string;
  isTrainerView?: boolean;
  lang?: string;
}

export default function LiveClassroomGrid({
  trainingId,
  studentName,
  isTrainerView = false,
  lang = 'ka',
}: LiveClassroomGridProps) {
  const isKa = lang === 'ka';
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [screens, setScreens] = useState<StudentScreenFrame[]>([]);
  const [recordings, setRecordings] = useState<ClassroomRecordingRecord[]>([]);
  const [focusedScreen, setFocusedScreen] = useState<StudentScreenFrame | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const shareStreamRef = useRef<MediaStream | null>(null);
  const shareTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Poll active screens and recordings every 3 seconds
  useEffect(() => {
    if (!trainingId) return;
    let mounted = true;
    const load = async () => {
      try {
        const state = await fetchClassroomState(trainingId);
        if (!mounted) return;
        setScreens(state.screens);
        setRecordings(state.recordings);
      } catch {}
    };
    load();
    const interval = window.setInterval(load, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [trainingId]);

  const stopScreenSharing = async () => {
    if (shareTimerRef.current) {
      window.clearInterval(shareTimerRef.current);
      shareTimerRef.current = null;
    }
    shareStreamRef.current?.getTracks().forEach((t) => t.stop());
    shareStreamRef.current = null;
    setSharing(false);
    try {
      await stopStudentScreenShare(trainingId);
    } catch {}
  };

  const startScreenSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      shareStreamRef.current = stream;
      setSharing(true);

      const videoEl = document.createElement('video');
      videoEl.srcObject = stream;
      videoEl.muted = true;
      await videoEl.play();

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      const captureAndPush = async () => {
        if (!ctx || videoEl.readyState < 2) return;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.65);
        try {
          await pushStudentScreenFrame(trainingId, {
            imageDataUrl,
            studentName,
            activeTool: 'Live Workspace',
          });
        } catch {}
      };

      await captureAndPush();
      shareTimerRef.current = window.setInterval(captureAndPush, 3000);

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopScreenSharing();
      });
    } catch {
      setStatusBanner(
        isKa
          ? 'ეკრანის გაზიარება გაუქმდა ან ბრაუზერმა არ მისცა ნებართვა.'
          : 'Screen share cancelled or permission denied.'
      );
    }
  };

  const startMeetingRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const localPlaybackUrl = URL.createObjectURL(blob);
        try {
          const saved = await saveRecordingAndNotifyStudents(trainingId, localPlaybackUrl);
          setRecordings((prev) => [saved, ...prev]);
          setStatusBanner(
            isKa
              ? `✓ შეხვედრის ჩანაწერი შენახულია და ავტომატურად გაეგზავნა ${saved.emailedToCount} სტუდენტს მეილზე.`
              : `✓ Recording saved and automatically emailed to ${saved.emailedToCount} enrolled students.`
          );
        } catch {}
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
    } catch {
      setStatusBanner(isKa ? 'ჩაწერის დაწყება ვერ მოხერხდა.' : 'Could not start recording.');
    }
  };

  const stopMeetingRecording = () => {
    recorderRef.current?.stop();
  };

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) window.clearInterval(shareTimerRef.current);
      shareStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Control Toolbar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
            <Users className="w-3.5 h-3.5" />
            {screens.length} {isKa ? 'აქტიური ეკრანი' : 'Live Screens'}
          </span>
          <span className="text-xs text-slate-400">
            {isTrainerView
              ? isKa
                ? 'ტრენერის ხედი: ხედავთ ყველა სტუდენტის სამუშაო ეკრანს'
                : 'Trainer View: Monitoring all student workspaces'
              : isKa
                ? 'სტუდენტის ხედი: გააზიარეთ ეკრანი პრაქტიკის დროს'
                : 'Student View: Share your workspace screen'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!sharing ? (
            <button
              type="button"
              onClick={startScreenSharing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer border-none"
            >
              <MonitorUp className="w-4 h-4" />
              {isKa ? 'ეკრანის გაზიარება' : 'Share My Screen'}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScreenSharing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer border-none"
            >
              <MonitorOff className="w-4 h-4" />
              {isKa ? 'გაზიარების შეწყვეტა' : 'Stop Sharing'}
            </button>
          )}

          {!recording ? (
            <button
              type="button"
              onClick={startMeetingRecording}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer border-none"
            >
              <Video className="w-4 h-4" />
              {isKa ? 'შეხვედრის ჩაწერა' : 'Record Session'}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopMeetingRecording}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer border-none animate-pulse"
            >
              <Square className="w-4 h-4" />
              {isKa ? 'ჩაწერის დასრულება & მეილზე გაგზავნა' : 'Stop & Email Recording'}
            </button>
          )}
        </div>
      </div>

      {statusBanner && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button type="button" onClick={() => setStatusBanner(null)} className="bg-transparent border-none text-emerald-300 cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* Multi-Screen Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {screens.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center text-xs text-slate-400">
            {isKa
              ? 'ამ წუთას არცერთ სტუდენტს არ აქვს ეკრანი გაზიარებული. დააჭირეთ „ეკრანის გაზიარებას“ ტესტირებისთვის.'
              : 'No student screens shared yet. Click "Share My Screen" to broadcast your workspace.'}
          </div>
        ) : (
          screens.map((scr) => (
            <div
              key={scr.userId}
              onClick={() => setFocusedScreen(scr)}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 hover:border-cyan-500/50 bg-slate-900 cursor-pointer transition-all"
            >
              <img src={scr.imageDataUrl} alt={scr.studentName} className="w-full aspect-video object-cover bg-black" />
              <div className="p-3 flex items-center justify-between text-xs bg-slate-950/90">
                <div>
                  <p className="font-bold text-white">{scr.studentName}</p>
                  <p className="text-[11px] text-slate-400">{scr.studentEmail}</p>
                </div>
                <Maximize2 className="w-4 h-4 text-cyan-400 opacity-75 group-hover:opacity-100" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Saved Recordings Archive */}
      {recordings.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <MailCheck className="w-4 h-4" />
            {isKa ? 'შეხვედრის ჩანაწერები (ავტომატურად გაგზავნილია მეილზე)' : 'Session Recordings (Auto-Emailed)'}
          </h3>
          <div className="space-y-2">
            {recordings.map((rec) => (
              <div key={rec.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs">
                <div>
                  <p className="font-bold text-white">{rec.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(rec.createdAt).toLocaleString()} · {isKa ? `გაეგზავნა ${rec.emailedToCount} სტუდენტს` : `Emailed to ${rec.emailedToCount} students`}
                  </p>
                </div>
                <a href={rec.recordingUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-cyan-600/20 border border-cyan-500/40 px-3 py-1 font-bold text-cyan-300 hover:bg-cyan-600/30">
                  {isKa ? 'ჩანაწერის ნახვა' : 'Watch Recording'}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Student Screen Inspection Modal */}
      {focusedScreen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setFocusedScreen(null)}>
          <div className="max-w-5xl w-full rounded-2xl border border-cyan-500/40 bg-slate-950 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-xs">
              <span className="font-bold text-white">{focusedScreen.studentName} ({focusedScreen.studentEmail})</span>
              <button type="button" onClick={() => setFocusedScreen(null)} className="bg-transparent border-none text-slate-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={focusedScreen.imageDataUrl} alt={focusedScreen.studentName} className="w-full max-h-[80vh] object-contain bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}