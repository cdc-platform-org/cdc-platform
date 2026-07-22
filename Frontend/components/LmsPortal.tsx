'use client';

import { useState } from 'react';

const lessons = [
  {
    id: 'lesson-1',
    title: 'Adaptive Learning Foundations',
    duration: '18 min',
    summary: 'Build knowledge paths that respond to student progress and enterprise readiness.',
    content:
      'Dive into the architecture of personalized courses, connect nested lesson structures with progress tracking, and reinforce retention through adaptive modules.'
  },
  {
    id: 'lesson-2',
    title: 'Mentor-led Cohorts',
    duration: '14 min',
    summary: 'Coordinate mentor workflows with student portfolios, milestones, and dynamic lesson releases.',
    content:
      'Explore cohort orchestration, course scheduling, and the data pipelines that keep enterprise education aligned with customer success metrics.'
  },
  {
    id: 'lesson-3',
    title: 'Outcomes & Certification',
    duration: '11 min',
    summary: 'Map completion progress to certification triggers and enterprise reporting dashboards.',
    content:
      'Understand how to package learning outcomes, export completion analytics, and integrate certifications into sales enablement for enterprise clients.'
  }
];

export default function LmsPortal() {
  const [activeLesson, setActiveLesson] = useState(lessons[0]);

  return (
    <div className="glass-panel rounded-[32px] border border-white/10 p-8 shadow-glass">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-[320px] space-y-5">
          <div className="rounded-3xl bg-slate-950/70 p-6 ring-1 ring-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300/80">LMS Portal</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Interactive lesson content</h2>
            <p className="mt-2 text-slate-300">Navigate course modules, review progress, and preview the next mastery checkpoint.</p>
          </div>
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => setActiveLesson(lesson)}
                className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                  activeLesson.id === lesson.id
                    ? 'border-cyan-400/70 bg-cyan-500/10 text-white shadow-glow'
                    : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-300/70 hover:bg-slate-900/80'
                }`}>
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300/70">{lesson.duration}</p>
                <h3 className="mt-2 text-lg font-semibold">{lesson.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{lesson.summary}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 rounded-[32px] border border-white/10 bg-slate-950/60 p-8 shadow-glass">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-cyan-300/80">Now viewing</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{activeLesson.title}</h3>
            </div>
            <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-slate-200">{activeLesson.duration}</span>
          </div>
          <p className="mt-6 text-slate-300 leading-8">{activeLesson.content}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-900/70 p-5">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Progress</p>
              <p className="mt-3 text-3xl font-semibold text-white">72%</p>
              <p className="mt-2 text-sm text-slate-400">On track for cohort completion.</p>
            </div>
            <div className="rounded-3xl bg-slate-900/70 p-5">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Mentor signal</p>
              <p className="mt-3 text-3xl font-semibold text-white">Active</p>
              <p className="mt-2 text-sm text-slate-400">Live support available for this module.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
