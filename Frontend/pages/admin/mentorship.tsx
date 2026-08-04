import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getMentorshipQueue,
  dismissMentorshipRequest,
  getMentorshipRequests,
  resolveMentorshipRequest,
  getMentors,
  getMentorAvailability,
  createMentorAvailabilityRule,
  deleteMentorAvailabilityRule,
  updateMentorProfile,
  MentorshipGig,
  MentorshipHelpRequest,
  MentorProfile,
  MentorAvailabilityRule,
} from '../../src/services/adminMentorshipService';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function MentorAvailabilitySection() {
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [rules, setRules] = useState<MentorAvailabilityRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: '18:00', endTime: '22:00' });

  const [profileForm, setProfileForm] = useState({ mentorTitle: '', mentorHourlyRateGel: '', mentorSkills: '', bio: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const loadMentors = useCallback(async () => {
    const data = await getMentors();
    setMentors(data);
    setSelectedMentorId((prev) => prev || (data.length > 0 ? data[0].id : ''));
  }, []);

  useEffect(() => {
    loadMentors();
  }, [loadMentors]);

  useEffect(() => {
    const mentor = mentors.find((m) => m.id === selectedMentorId);
    if (!mentor) return;
    setProfileForm({
      mentorTitle: mentor.mentorTitle ?? '',
      mentorHourlyRateGel: mentor.mentorHourlyRate != null ? String(mentor.mentorHourlyRate / 100) : '',
      mentorSkills: mentor.mentorSkills.join(', '),
      bio: mentor.bio ?? '',
    });
    setProfileSaved(false);
  }, [selectedMentorId, mentors]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const updated = await updateMentorProfile(selectedMentorId, {
        mentorTitle: profileForm.mentorTitle.trim() || undefined,
        mentorHourlyRate: profileForm.mentorHourlyRateGel
          ? Math.round(Number(profileForm.mentorHourlyRateGel) * 100)
          : undefined,
        mentorSkills: profileForm.mentorSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        bio: profileForm.bio.trim() || undefined,
      });
      setMentors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setProfileSaved(true);
    } finally {
      setSavingProfile(false);
    }
  };

  const loadRules = useCallback(async () => {
    if (!selectedMentorId) return;
    setLoading(true);
    try {
      setRules(await getMentorAvailability(selectedMentorId));
    } finally {
      setLoading(false);
    }
  }, [selectedMentorId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleAddRule = async () => {
    setError(null);
    const startMinute = timeToMinutes(form.startTime);
    const endMinute = timeToMinutes(form.endTime);
    if (endMinute <= startMinute) return setError('End time must be after start time.');
    setSaving(true);
    try {
      await createMentorAvailabilityRule(selectedMentorId, { dayOfWeek: form.dayOfWeek, startMinute, endMinute });
      await loadRules();
    } catch {
      setError('Unable to add the rule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    await deleteMentorAvailabilityRule(ruleId);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  return (
    <div className="mb-10">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Mentor Availability (Google Calendar bookings)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Recurring weekly slots (Asia/Tbilisi time) a mentor can be booked for a paid session. Enforced server-side
          at checkout, and used to create the Google Calendar invite once payment completes.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-2xl">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Mentor</label>
        <select
          value={selectedMentorId}
          onChange={(e) => setSelectedMentorId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm mb-5"
        >
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>

        <div className="grid sm:grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title / Position</label>
            <input
              value={profileForm.mentorTitle}
              onChange={(e) => setProfileForm({ ...profileForm, mentorTitle: e.target.value })}
              placeholder="e.g. Senior Product Designer"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hourly Rate (GEL / ₾)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={profileForm.mentorHourlyRateGel}
              onChange={(e) => setProfileForm({ ...profileForm, mentorHourlyRateGel: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Core Skills (comma-separated)</label>
          <input
            value={profileForm.mentorSkills}
            onChange={(e) => setProfileForm({ ...profileForm, mentorSkills: e.target.value })}
            placeholder="Figma, UX Research, Design Systems"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            value={profileForm.bio}
            onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile || !selectedMentorId}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
          >
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
          {profileSaved && <span className="text-xs text-emerald-600">Saved.</span>}
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">No availability set yet for this mentor.</p>
        ) : (
          <div className="space-y-1.5 mb-4">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-800">
                  {DAY_LABELS[rule.dayOfWeek]}, {minutesToTime(rule.startMinute)}–{minutesToTime(rule.endMinute)}
                </span>
                <button type="button" onClick={() => handleDeleteRule(rule.id)} className="text-xs text-red-500 hover:text-red-700">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Day</label>
            <select
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
              className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            >
              {DAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAddRule}
            disabled={saving || !selectedMentorId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add slot'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneralHelpRequests() {
  const [requests, setRequests] = useState<MentorshipHelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getMentorshipRequests());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try {
      await resolveMentorshipRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-10">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">General Help / Mentorship Requests</h2>
        <p className="text-sm text-gray-500 mt-1">
          Submitted via the graduate-only &quot;დახმარება / მენტორობა&quot; button on the student Dashboard.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-500">No open general help requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-semibold text-gray-900">{r.user.name}</span>
                <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{r.user.email}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{r.message}</p>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => handleResolve(r.id)}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-800 disabled:opacity-60"
              >
                Mark as resolved
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminMentorshipDashboard() {
  const [queue, setQueue] = useState<MentorshipGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await getMentorshipQueue());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDismiss = async (gigId: string) => {
    setBusyId(gigId);
    try {
      await dismissMentorshipRequest(gigId);
      setQueue((prev) => prev.filter((g) => g.id !== gigId));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Mentorship Queue | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <MentorAvailabilitySection />
        <GeneralHelpRequests />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Mentorship Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Students who requested help, and first-time freelancers flagged for extra support.</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-gray-500">No open mentor-help requests.</p>
        ) : (
          <div className="space-y-3">
            {queue.map((gig) => (
              <div key={gig.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold text-gray-900">{gig.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {gig.isFirstOrder && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-cyan-50 text-cyan-700 border-cyan-200">
                        First Order
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                      {gig.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  Freelancer: {gig.assignedFreelancer?.name} ({gig.assignedFreelancer?.email})
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Requested help {gig.mentorHelpRequestedAt && new Date(gig.mentorHelpRequestedAt).toLocaleString()}
                </p>

                {expandedId === gig.id && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                    <p className="text-gray-700 mb-2">{gig.description}</p>
                    {gig.deliveryComment && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 mt-2">Draft submission:</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{gig.deliveryComment}</p>
                      </>
                    )}
                    {gig.deliveryLinks.map((link) => (
                      <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="block text-xs text-indigo-600 hover:underline mt-1">
                        {link}
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === gig.id ? null : gig.id)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {expandedId === gig.id ? 'Hide details' : 'Inspect draft'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === gig.id}
                    onClick={() => handleDismiss(gig.id)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-60"
                  >
                    Mark as handled
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminMentorshipPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <AdminMentorshipDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
