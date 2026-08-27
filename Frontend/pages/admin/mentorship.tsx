import { useState, useEffect, useCallback, ChangeEvent } from 'react';
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
  updateMentorAvailabilityRule,
  deleteMentorAvailabilityRule,
  updateMentorProfile,
  setMentorPublished,
  uploadMentorCv,
  uploadMentorAvatar,
  translateMentorProfile,
  getAdminMentorshipBookings,
  attachBookingRecording,
  resolveMentorshipDispute,
  MentorshipGig,
  MentorshipHelpRequest,
  MentorProfile,
  MentorAvailabilityRule,
  AdminMentorshipBooking,
} from '../../src/services/adminMentorshipService';

// Curated checklist, not a DB enum (see mentorLanguages' schema comment) —
// values are stored/displayed exactly as written here (mixed-script by
// design, matching how each language names itself).
const LANGUAGE_OPTIONS = ['ქართული', 'English', 'Русский', 'Deutsch'];

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Display/grouping order — Monday first, matching how the admin thinks
// about a work week — while dayOfWeek values themselves stay 0=Sunday..
// 6=Saturday to match the DB/backend convention unchanged.
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [timeForm, setTimeForm] = useState({ startTime: '18:00', endTime: '22:00' });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    mentorTitle: '',
    mentorTitleEn: '',
    mentorHourlyRateGel: '',
    mentorSkills: '',
    mentorLanguages: [] as string[],
    bio: '',
    bioEn: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'ka' | 'en'>('ka');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const selectedMentor = mentors.find((m) => m.id === selectedMentorId);

  const handleTogglePublish = async () => {
    if (!selectedMentor) return;
    setTogglingPublish(true);
    setPublishError(null);
    try {
      const updated = await setMentorPublished(selectedMentor.id, !selectedMentor.mentorPublished);
      setMentors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      setPublishError('Could not update publish status.');
    } finally {
      setTogglingPublish(false);
    }
  };

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
      mentorTitleEn: mentor.mentorTitleEn ?? '',
      mentorHourlyRateGel: mentor.mentorHourlyRate != null ? String(mentor.mentorHourlyRate / 100) : '',
      mentorSkills: mentor.mentorSkills.join(', '),
      mentorLanguages: mentor.mentorLanguages,
      bio: mentor.bio ?? '',
      bioEn: mentor.bioEn ?? '',
    });
    setProfileSaved(false);
    setActiveLangTab('ka');
    setTranslateError(null);
  }, [selectedMentorId, mentors]);

  const toggleLanguage = (lang: string) => {
    setProfileForm((f) => ({
      ...f,
      mentorLanguages: f.mentorLanguages.includes(lang)
        ? f.mentorLanguages.filter((l) => l !== lang)
        : [...f.mentorLanguages, lang],
    }));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const updated = await updateMentorProfile(selectedMentorId, {
        mentorTitle: profileForm.mentorTitle.trim() || undefined,
        mentorTitleEn: profileForm.mentorTitleEn.trim() || undefined,
        mentorHourlyRate: profileForm.mentorHourlyRateGel
          ? Math.round(Number(profileForm.mentorHourlyRateGel) * 100)
          : undefined,
        mentorSkills: profileForm.mentorSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mentorLanguages: profileForm.mentorLanguages,
        bio: profileForm.bio.trim() || undefined,
        bioEn: profileForm.bioEn.trim() || undefined,
      });
      setMentors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setProfileSaved(true);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAutoTranslate = async () => {
    setTranslateError(null);
    if (profileForm.mentorTitle.trim().length < 2 || profileForm.bio.trim().length < 5) {
      setTranslateError('Fill in the Georgian Title and Bio before translating.');
      return;
    }
    setTranslating(true);
    try {
      const translated = await translateMentorProfile({ title: profileForm.mentorTitle.trim(), bio: profileForm.bio.trim() });
      setProfileForm((f) => ({ ...f, mentorTitleEn: translated.titleEn, bioEn: translated.bioEn }));
      setActiveLangTab('en');
    } catch (err: any) {
      setTranslateError(err?.response?.data?.message ?? 'Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const handleUploadCv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMentorId) return;
    setCvError(null);
    setUploadingCv(true);
    try {
      const updated = await uploadMentorCv(selectedMentorId, file);
      setMentors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: any) {
      setCvError(err?.response?.data?.message || 'CV upload failed. Please try again.');
    } finally {
      setUploadingCv(false);
      e.target.value = '';
    }
  };

  const handleUploadAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMentorId) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const updated = await uploadMentorAvatar(selectedMentorId, file);
      setMentors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: any) {
      setAvatarError(err?.response?.data?.message || 'Avatar upload failed. Please try again.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
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
    setEditingRuleId(null);
    setSelectedDays([1]);
    setError(null);
  }, [selectedMentorId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const toggleDay = (day: number) => {
    if (editingRuleId) {
      // Editing one specific rule — a single day, not a bulk fan-out.
      setSelectedDays([day]);
      return;
    }
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const resetForm = () => {
    setEditingRuleId(null);
    setSelectedDays([1]);
    setTimeForm({ startTime: '18:00', endTime: '22:00' });
    setError(null);
  };

  const handleEditRule = (rule: MentorAvailabilityRule) => {
    setEditingRuleId(rule.id);
    setSelectedDays([rule.dayOfWeek]);
    setTimeForm({ startTime: minutesToTime(rule.startMinute), endTime: minutesToTime(rule.endMinute) });
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    const startMinute = timeToMinutes(timeForm.startTime);
    const endMinute = timeToMinutes(timeForm.endTime);
    if (!timeForm.startTime || !timeForm.endTime) return setError('Please set both a start and end time.');
    if (endMinute <= startMinute) {
      return setError(
        `End time (${timeForm.endTime}) must be after start time (${timeForm.startTime}). Overnight ranges spanning midnight aren't supported — split them into two slots instead.`
      );
    }
    if (selectedDays.length === 0) return setError('Select at least one day.');

    setSaving(true);
    try {
      if (editingRuleId) {
        await updateMentorAvailabilityRule(editingRuleId, { dayOfWeek: selectedDays[0], startMinute, endMinute });
      } else {
        // Bulk-create: one rule per checked day, same time range on each.
        await Promise.all(
          selectedDays.map((dayOfWeek) => createMentorAvailabilityRule(selectedMentorId, { dayOfWeek, startMinute, endMinute }))
        );
      }
      await loadRules();
      resetForm();
    } catch {
      setError(editingRuleId ? 'Unable to update the slot. Please try again.' : 'Unable to add the slot(s). Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    await deleteMentorAvailabilityRule(ruleId);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    if (editingRuleId === ruleId) resetForm();
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
              {m.name} ({m.email}) {m.mentorPublished ? '— Published' : '— Not Published'}
            </option>
          ))}
        </select>

        {selectedMentor && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-gray-700">Public directory visibility</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedMentor.mentorPublished
                  ? 'This mentor is live on the public /mentors page.'
                  : 'Hidden from the public /mentors page until published.'}
              </p>
              {publishError && <p className="text-xs text-red-600 mt-1">{publishError}</p>}
            </div>
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={togglingPublish}
              className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg border disabled:opacity-60 ${
                selectedMentor.mentorPublished
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'border-transparent text-white bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {togglingPublish ? '…' : selectedMentor.mentorPublished ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Avatar / Profile Photo (PNG or JPG)</label>
          <div className="flex items-center gap-3">
            {selectedMentor?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedMentor.avatarUrl}
                alt={selectedMentor.name}
                className="w-14 h-14 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
                {selectedMentor?.name.charAt(0).toUpperCase() ?? '?'}
              </div>
            )}
            <label className="inline-block text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-100">
              <input type="file" accept="image/png,image/jpeg" onChange={handleUploadAvatar} disabled={uploadingAvatar || !selectedMentorId} className="hidden" />
              {uploadingAvatar ? 'Uploading…' : selectedMentor?.avatarUrl ? 'Replace Photo' : 'Upload Photo'}
            </label>
          </div>
          {avatarError && <p className="text-xs text-red-600 mt-1.5">{avatarError}</p>}
        </div>

        <div className="flex items-center justify-between border-b border-gray-200 mb-3">
          <div className="flex gap-1">
            {(['ka', 'en'] as const).map((tabLang) => (
              <button
                key={tabLang}
                type="button"
                onClick={() => setActiveLangTab(tabLang)}
                className={`px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                  activeLangTab === tabLang ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tabLang === 'ka' ? '🇬🇪 ქართული' : '🇬🇧 English'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAutoTranslate}
            disabled={translating}
            className="mb-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg disabled:opacity-60"
          >
            {translating ? 'Translating…' : '✨ Auto-Translate to English'}
          </button>
        </div>
        {translateError && <p className="text-xs text-red-600 mb-3">{translateError}</p>}

        {activeLangTab === 'ka' ? (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Title / Position (KA)</label>
            <input
              value={profileForm.mentorTitle}
              onChange={(e) => setProfileForm({ ...profileForm, mentorTitle: e.target.value })}
              placeholder="e.g. უფროსი პროდუქტის დიზაინერი"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Title / Position (EN)</label>
            <input
              value={profileForm.mentorTitleEn}
              onChange={(e) => setProfileForm({ ...profileForm, mentorTitleEn: e.target.value })}
              placeholder="e.g. Senior Product Designer"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Hourly Rate (GEL / ₾)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={profileForm.mentorHourlyRateGel}
            onChange={(e) => setProfileForm({ ...profileForm, mentorHourlyRateGel: e.target.value })}
            className="w-full sm:w-1/2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
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
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Spoken Languages / საუბრის ენები</label>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGE_OPTIONS.map((langOption) => (
              <button
                key={langOption}
                type="button"
                onClick={() => toggleLanguage(langOption)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                  profileForm.mentorLanguages.includes(langOption)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {langOption}
              </button>
            ))}
          </div>
        </div>
        {activeLangTab === 'ka' ? (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Bio (KA)</label>
            <textarea
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Bio (EN)</label>
            <textarea
              value={profileForm.bioEn}
              onChange={(e) => setProfileForm({ ...profileForm, bioEn: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-700 mb-1">CV / Resume (PDF or DOCX)</label>
          <div className="flex items-center gap-3">
            {selectedMentor?.cvUrl && (
              <a
                href={selectedMentor.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
              >
                View current CV
              </a>
            )}
            <label className="inline-block text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-100">
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleUploadCv} disabled={uploadingCv || !selectedMentorId} className="hidden" />
              {uploadingCv ? 'Uploading…' : selectedMentor?.cvUrl ? 'Replace CV' : 'Upload CV'}
            </label>
          </div>
          {cvError && <p className="text-xs text-red-600 mt-1.5">{cvError}</p>}
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

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">No availability set yet for this mentor.</p>
        ) : (
          <div className="space-y-4 mb-5">
            {DAY_DISPLAY_ORDER.filter((day) => rules.some((r) => r.dayOfWeek === day)).map((day) => (
              <div key={day}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{DAY_LABELS[day]}</p>
                <div className="space-y-1.5">
                  {rules
                    .filter((r) => r.dayOfWeek === day)
                    .sort((a, b) => a.startMinute - b.startMinute)
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 border ${
                          editingRuleId === rule.id ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent'
                        }`}
                      >
                        <span className="text-gray-800 font-medium">
                          {minutesToTime(rule.startMinute)} – {minutesToTime(rule.endMinute)}
                        </span>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => handleEditRule(rule)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                            შეცვლა
                          </button>
                          <button type="button" onClick={() => handleDeleteRule(rule.id)} className="text-xs font-medium text-red-500 hover:text-red-700">
                            წაშლა
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            {editingRuleId ? 'Edit slot' : 'Add slot(s)'}
          </p>

          {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            {editingRuleId ? 'Day' : 'Days (select one or more)'}
          </label>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {DAY_DISPLAY_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`text-xs font-bold px-3 py-2 rounded-full border transition-colors ${
                  selectedDays.includes(day)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {DAY_SHORT[day]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
              <input
                type="time"
                value={timeForm.startTime}
                onChange={(e) => setTimeForm({ ...timeForm, startTime: e.target.value })}
                className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
              <input
                type="time"
                value={timeForm.endTime}
                onChange={(e) => setTimeForm({ ...timeForm, endTime: e.target.value })}
                className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
              />
            </div>
            {timeForm.startTime && timeForm.endTime && (
              <p className="text-xs text-gray-400 pb-2.5">
                {timeForm.startTime} – {timeForm.endTime}
                {selectedDays.length > 1 && !editingRuleId ? ` on ${selectedDays.length} days` : ''}
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !selectedMentorId}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingRuleId ? 'Update slot' : 'Add slot(s)'}
            </button>
            {editingRuleId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralHelpRequests() {
  const [requests, setRequests] = useState<MentorshipHelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

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
    setResolveError(null);
    try {
      await resolveMentorshipRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setResolveError('Could not mark this request as resolved. Please try again.');
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
      {resolveError && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700">{resolveError}</div>
      )}
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

const BOOKING_STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};
const BOOKING_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Confirmed',
  PENDING: 'Pending',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

function RecordingCell({ booking, onUpdated }: { booking: AdminMentorshipBooking; onUpdated: (b: AdminMentorshipBooking) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(booking.recordingUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await attachBookingRecording(booking.id, value.trim());
      onUpdated(updated);
      setEditing(false);
    } catch {
      setError('Invalid URL or save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 min-w-[200px]">
        <div className="flex gap-1">
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://drive.google.com/... or Bunny CDN URL"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            autoFocus
          />
          <button
            type="button"
            disabled={saving || !value.trim()}
            onClick={handleSave}
            className="text-xs font-medium px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs font-medium px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    );
  }

  if (booking.recordingUrl) {
    return (
      <div className="flex items-center gap-2">
        <a href={booking.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
          Watch
        </a>
        <button
          type="button"
          onClick={() => {
            setValue(booking.recordingUrl ?? '');
            setEditing(true);
          }}
          className="text-[11px] text-gray-400 hover:text-gray-600"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
      + Attach recording
    </button>
  );
}

// Escrow status + dispute resolution — the student's own confirm/dispute
// actions (mentorship-sessions.tsx) and the 24h auto-release sweep
// (Backend's mentorshipEscrowService.ts) drive escrowStatus for most
// bookings; this cell's own actions only matter once a dispute is open
// (disputeRaisedAt set, disputeResolvedAt not) and an admin needs to
// decide release-vs-refund.
function EscrowCell({ booking, onUpdated }: { booking: AdminMentorshipBooking; onUpdated: (b: AdminMentorshipBooking) => void }) {
  const [resolving, setResolving] = useState<'RELEASE' | 'REFUND' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (resolution: 'RELEASE' | 'REFUND') => {
    if (!window.confirm(resolution === 'RELEASE' ? 'Release these funds to the mentor?' : 'Refund these funds (no mentor credit)?')) return;
    setResolving(resolution);
    setError(null);
    try {
      const updated = await resolveMentorshipDispute(booking.id, resolution);
      onUpdated(updated);
    } catch {
      setError('Resolution failed.');
    } finally {
      setResolving(null);
    }
  };

  const disputePending = !!booking.disputeRaisedAt && !booking.disputeResolvedAt;

  return (
    <div className="min-w-[160px]">
      <span
        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
          booking.escrowStatus === 'RELEASED'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : booking.escrowStatus === 'REFUNDED'
              ? 'bg-gray-100 text-gray-500 border-gray-200'
              : booking.escrowStatus === 'HELD_IN_ESCROW'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-gray-50 text-gray-400 border-gray-200'
        }`}
      >
        {booking.escrowStatus ?? 'NOT CAPTURED'}
      </span>
      {disputePending && (
        <div className="mt-1.5">
          <p className="text-[10px] text-red-600 font-semibold mb-1">⚠ Dispute open</p>
          {booking.disputeReason && <p className="text-[10px] text-gray-500 mb-1 max-w-[180px]">{booking.disputeReason}</p>}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={resolving !== null}
              onClick={() => handleResolve('RELEASE')}
              className="text-[10px] font-medium px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {resolving === 'RELEASE' ? '…' : 'Release'}
            </button>
            <button
              type="button"
              disabled={resolving !== null}
              onClick={() => handleResolve('REFUND')}
              className="text-[10px] font-medium px-2 py-1 rounded bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-60"
            >
              {resolving === 'REFUND' ? '…' : 'Refund'}
            </button>
          </div>
          {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
        </div>
      )}
      {booking.disputeResolvedAt && (
        <p className="text-[10px] text-gray-400 mt-1">Resolved: {booking.disputeResolution}</p>
      )}
    </div>
  );
}

// Every paid session across the platform — loads current data on mount and
// via manual refresh (no push/websocket infrastructure exists anywhere in
// this codebase; adding one would be new architecture, not a small
// addition to this one page).
function BookingsSection() {
  const [bookings, setBookings] = useState<AdminMentorshipBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setBookings(await getAdminMentorshipBookings());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mentorship Bookings</h2>
          <p className="text-sm text-gray-500 mt-1">Every paid session — mentor, student, time, and Google Meet sync status.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="shrink-0 rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load bookings.</p>
      ) : loading && bookings.length === 0 ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-500">No mentorship bookings yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Mentor</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Meet Link</th>
                <th className="px-4 py-3 font-medium">Recording</th>
                <th className="px-4 py-3 font-medium">Escrow</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        BOOKING_STATUS_BADGE[b.bogPayment.status] ?? BOOKING_STATUS_BADGE.PENDING
                      }`}
                    >
                      {BOOKING_STATUS_LABEL[b.bogPayment.status] ?? b.bogPayment.status}
                    </span>
                    {b.calendarSyncError && (
                      <span className="block mt-1 text-[10px] text-red-500" title={b.calendarSyncError}>
                        Calendar sync failed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {b.mentor.name}
                    <span className="block text-[11px] text-gray-400">{b.mentor.email}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {b.student.name}
                    <span className="block text-[11px] text-gray-400">{b.student.email}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(b.scheduledAt).toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi' })}
                  </td>
                  <td className="px-4 py-3">
                    {b.googleMeetLink ? (
                      <a href={b.googleMeetLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                        Join link
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RecordingCell
                      booking={b}
                      onUpdated={(updated) => setBookings((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EscrowCell
                      booking={b}
                      onUpdated={(updated) => setBookings((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <BookingsSection />
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
