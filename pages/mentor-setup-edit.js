import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';
import MentorMessage from '@/components/MentorMessage';
import SubjectStatusPicker, { SUBJECTS } from '@/components/SubjectStatusPicker';
import TopicStatusPicker from '@/components/TopicStatusPicker';
import { MENTOR_COPY, SUBJECT_DISPLAY_NAMES, SUBJECT_STATUS, TOPIC_STATUS, getISTDateKey } from '@/lib/mentorCopy';
import { generateTodaysPlan } from '@/lib/mentorPlanEngine';
import { getUserCacheScope } from '@/lib/userCacheScope';

const EXAM_OPTIONS = ['SSC CGL', 'SSC CHSL', 'SSC CPO', 'SSC MTS', 'SSC GD', 'Other SSC Exam'];
const DAYS_OPTIONS = ['0-15', '16-30', '31-45', '46-60', '60+', "I don't know yet"];
const TIME_OPTIONS = ['15-20 min', '30 min', '45 min', '1 hour', '1.5+ hours'];
const PACE_OPTIONS = ['Light', 'Balanced', 'Aggressive'];

// Remove every Mentor snapshot/plan cache so a superseded plan can never be
// rehydrated on the Mentor tab after the plan is updated.
function clearAllMentorCaches() {
  if (typeof window === 'undefined') return;
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('mentor_snapshot_') || key === 'mentor_today_plan' || key === 'mentor_profile_cache') {
        drop.push(key);
      }
    }
    drop.forEach(key => localStorage.removeItem(key));
  } catch {}
}

function OptionButton({ selected, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-sm font-black transition-all ${
        selected
          ? 'border-ssc-teal bg-[#E8F8F6] text-ssc-text-primary ring-1 ring-ssc-teal'
          : 'border-ssc-border-soft bg-white text-ssc-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

function buildTopicsCompleted(topicStrength) {
  const result = {};
  for (const [subjectId, topics] of Object.entries(topicStrength || {})) {
    const completed = Object.entries(topics)
      .filter(([, status]) => status && status !== TOPIC_STATUS.NOT_STARTED)
      .map(([topicName]) => topicName);
    if (completed.length) result[subjectId] = completed;
  }
  return result;
}

function buildLocalPlanSnapshot(profile, plan) {
  const tasks = plan?.tasks || [];
  const activeTasks = tasks.filter(task => task.status === 'active').slice(0, 3);
  const completedToday = tasks.filter(task => task.status === 'completed');
  const deferredTasks = tasks.filter(task => task.status === 'snoozed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const total = activeTasks.length + completedToday.length + deferredTasks.length;
  return {
    exists: true,
    profile,
    plan,
    activeTasks,
    completedToday,
    deferredTasks,
    pendingTasks,
    progress: {
      completed: completedToday.length,
      total,
      percent: total ? Math.round((completedToday.length / total) * 100) : 0,
    },
    mentorMessage: plan?.mentorDayMessage || MENTOR_COPY.MORNING_GREETING,
    lastSyncAt: new Date().toISOString(),
  };
}

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(cookie => cookie.trim().startsWith('userMode=guest'));
}

function normalizeComparable(value) {
  return JSON.stringify(value || {});
}

function savedProfileMatchesPayload(profile, payload) {
  if (!profile || !payload) return false;
  return (
    profile.examTarget === payload.examTarget &&
    profile.daysLeftRange === payload.daysLeftRange &&
    String(profile.customDaysLeft || '') === String(payload.customDaysLeft || '') &&
    profile.dailyGKTime === payload.dailyGKTime &&
    profile.pace === payload.pace &&
    normalizeComparable(profile.subjectStatus) === normalizeComparable(payload.subjectStatus) &&
    normalizeComparable(profile.topicsCompleted) === normalizeComparable(payload.topicsCompleted) &&
    normalizeComparable(profile.topicStrength) === normalizeComparable(payload.topicStrength)
  );
}

export default function MentorSetupEditPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [guestMode, setGuestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(false);
  const [topicsData, setTopicsData] = useState({ subjects: {} });
  const [openSubjects, setOpenSubjects] = useState({});
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    const guest = isGuestMode();
    setGuestMode(guest);
    if (status === 'unauthenticated' && guest) {
      try {
        const cachedProfile = JSON.parse(localStorage.getItem('mentor_profile_cache') || 'null');
        if (!cachedProfile) {
          router.replace('/mentor-setup');
          return;
        }
        setFormData({
          examTarget: cachedProfile.examTarget || '',
          daysLeftRange: cachedProfile.daysLeftRange || '',
          customDaysLeft: cachedProfile.customDaysLeft || null,
          dailyGKTime: cachedProfile.dailyGKTime || '',
          pace: cachedProfile.pace || '',
          goals: cachedProfile.goals || [],
          subjectStatus: cachedProfile.subjectStatus || {},
          topicsCompleted: cachedProfile.topicsCompleted || {},
          topicStrength: cachedProfile.topicStrength || {},
        });
        setTopicsData({ subjects: {} });
      } catch {
        setError('Preparation details could not be loaded. Please retry.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (status !== 'authenticated') return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, topicsRes] = await Promise.all([
          fetch('/api/mentor/profile'),
          fetch('/api/mentor/topics'),
        ]);
        const profileData = await profileRes.json();
        const topicsJson = await topicsRes.json();
        if (!profileData.exists) {
          router.replace('/mentor-setup');
          return;
        }
        if (!cancelled) {
          setFormData({
            examTarget: profileData.profile.examTarget || '',
            daysLeftRange: profileData.profile.daysLeftRange || '',
            customDaysLeft: profileData.profile.customDaysLeft || null,
            dailyGKTime: profileData.profile.dailyGKTime || '',
            pace: profileData.profile.pace || '',
            goals: profileData.profile.goals || [],
            subjectStatus: profileData.profile.subjectStatus || {},
            topicsCompleted: profileData.profile.topicsCompleted || {},
            topicStrength: profileData.profile.topicStrength || {},
          });
          setTopicsData(topicsJson || { subjects: {} });
          localStorage.setItem('mentor_profile_cache', JSON.stringify(profileData.profile));
        }
      } catch (err) {
        if (!cancelled) setError('Preparation details could not be loaded. Please retry.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [router, status]);

  const activeSubjects = useMemo(() => {
    if (!formData) return [];
    return SUBJECTS.filter(subjectId => (formData.subjectStatus?.[subjectId] || SUBJECT_STATUS.NOT_STARTED) !== SUBJECT_STATUS.NOT_STARTED);
  }, [formData]);

  const updateForm = patch => {
    setError(null);
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const updateTopicStrength = (subjectId, nextTopics) => {
    updateForm({
      topicStrength: {
        ...(formData.topicStrength || {}),
        [subjectId]: nextTopics,
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setGenError(false);
    const payload = {
      ...formData,
      topicsCompleted: buildTopicsCompleted(formData.topicStrength),
    };
    try {
      if (!guestMode) {
        const res = await fetch('/api/mentor/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Save failed');
      }
      localStorage.setItem('mentor_profile_cache', JSON.stringify(payload));
      localStorage.setItem('mentor_onboarded', 'true');
      setShowConfirm(true);
    } catch (err) {
      if (!guestMode) {
        try {
          const verifyRes = await fetch('/api/mentor/profile');
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok && verifyData.exists && savedProfileMatchesPayload(verifyData.profile, payload)) {
            localStorage.setItem('mentor_profile_cache', JSON.stringify(verifyData.profile));
            localStorage.setItem('mentor_onboarded', 'true');
            setError(null);
            setShowConfirm(true);
            return;
          }
        } catch {}
      }
      setError('Preparation details could not be saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  // Regenerate the plan after Preparation Setup is edited. Idempotent (guarded
  // by `generating`), clears all stale caches, and supersedes the old plan
  // server-side via /api/mentor/generate.
  const handleUpdatePlan = async () => {
    if (generating) return; // idempotency: ignore double taps
    setGenError(false);
    const today = getISTDateKey();

    if (guestMode) {
      const nextProfile = {
        ...formData,
        topicsCompleted: buildTopicsCompleted(formData.topicStrength),
        onboardingCompletedAt: formData.onboardingCompletedAt || new Date().toISOString(),
      };
      const plan = generateTodaysPlan(nextProfile, [], { repeatedMistakesPreview: [] }, { subjects: {} });
      const snapshot = buildLocalPlanSnapshot(nextProfile, plan);
      clearAllMentorCaches();
      localStorage.setItem('mentor_profile_cache', JSON.stringify(nextProfile));
      localStorage.setItem('mentor_today_plan', JSON.stringify({ date: today, plan }));
      localStorage.setItem(`mentor_snapshot_v3:guest:${today}`, JSON.stringify(snapshot));
      router.push('/mentor?updated=1');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/mentor/generate', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'generate failed');
      // New plan is now the active one server-side — purge every old cache and
      // seed only the fresh snapshot so the Mentor tab shows the new plan only.
      // Step 8: stamp `_cachedAt` so the Mentor freshness gate treats this as
      // fresh → no immediate GET /api/mentor/plan after navigation.
      clearAllMentorCaches();
      localStorage.setItem(`mentor_snapshot_v3:${getUserCacheScope(session)}:${today}`, JSON.stringify({ ...data, _cachedAt: Date.now() }));
      if (process.env.NODE_ENV !== 'production') console.debug('[apidiag] {"kind":"mentor","event":"mentor-generate-cache-write"}');
      router.push('/mentor?updated=1');
    } catch {
      // Edge C: profile saved but generation failed — do NOT restore old tasks.
      clearAllMentorCaches();
      setGenerating(false);
      setGenError(true);
    }
  };

  if (status === 'loading' || ((status === 'authenticated' || guestMode) && loading)) {
    return <Loader fullScreen label="Loading details..." />;
  }

  if (status !== 'authenticated' && !guestMode) {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] px-4 py-10 text-ssc-text-primary">
        <GoogleSignInCard
          title="Sign in to edit your plan"
          subtitle="Your preparation details are saved to your account."
          buttonText="Continue with Google"
          callbackUrl="/mentor-setup-edit"
        />
      </div>
    );
  }

  if (!formData) {
    return <div className="min-h-screen bg-[var(--ssc-bg)] px-4 py-10 text-[#DC2626]">{error}</div>;
  }

  return (
    <main className="min-h-screen bg-[var(--ssc-bg)] px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-5 text-ssc-text-primary">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-ssc-border-soft bg-white px-3 py-1.5 text-sm font-bold text-ssc-text-secondary"
          >
            Back
          </button>
          <h1 className="font-display text-xl font-black text-ssc-text-primary">Edit Preparation Details</h1>
        </div>

        <section className="space-y-3 rounded-[20px] border border-ssc-border-soft bg-white p-4 shadow-[var(--ssc-shadow-card)]">
          <h2 className="text-xs font-black uppercase tracking-widest text-ssc-text-muted">Exam and Timeline</h2>
          <div className="flex flex-wrap gap-2">
            {EXAM_OPTIONS.map(option => (
              <OptionButton key={option} selected={formData.examTarget === option} onClick={() => updateForm({ examTarget: option })}>
                {option}
              </OptionButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {DAYS_OPTIONS.map(option => (
              <OptionButton key={option} selected={formData.daysLeftRange === option} onClick={() => updateForm({ daysLeftRange: option })}>
                {option}
              </OptionButton>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-[20px] border border-ssc-border-soft bg-white p-4 shadow-[var(--ssc-shadow-card)]">
          <h2 className="text-xs font-black uppercase tracking-widest text-ssc-text-muted">Study Preferences</h2>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map(option => (
              <OptionButton key={option} selected={formData.dailyGKTime === option} onClick={() => updateForm({ dailyGKTime: option })}>
                {option}
              </OptionButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PACE_OPTIONS.map(option => (
              <OptionButton key={option} selected={formData.pace === option} onClick={() => updateForm({ pace: option })}>
                {option}
              </OptionButton>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-black text-ssc-text-primary">Subject Status</h2>
          <SubjectStatusPicker
            value={formData.subjectStatus}
            onChange={subjectStatus => updateForm({ subjectStatus })}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-black text-ssc-text-primary">Topic Coverage</h2>
          {activeSubjects.length ? activeSubjects.map(subjectId => {
            const subject = topicsData.subjects?.[subjectId];
            return (
              <div key={subjectId} className="rounded-[20px] border border-ssc-border-soft bg-white shadow-[var(--ssc-shadow-card)]">
                <button
                  type="button"
                  onClick={() => setOpenSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }))}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-black text-ssc-text-primary">
                    {subject?.subjectName || SUBJECT_DISPLAY_NAMES[subjectId] || subjectId}
                  </span>
                  <span className="text-xs font-bold text-ssc-teal">{openSubjects[subjectId] ? 'Hide' : 'Show'}</span>
                </button>
                {openSubjects[subjectId] ? (
                  <div className="border-t border-ssc-border-soft bg-[#F8FEFD] p-3">
                    <TopicStatusPicker
                      subjectId={subjectId}
                      topics={subject?.topics || []}
                      value={formData.topicStrength?.[subjectId] || {}}
                      onChange={updateTopicStrength}
                    />
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <MentorMessage message={MENTOR_COPY.NO_THEORY_DONE} />
          )}
        </section>

        {error ? (
          <div className="rounded-2xl border border-[#FBCACA] bg-[#FEECEC] p-3 text-sm font-semibold text-[#DC2626]">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl bg-gradient-to-r from-[#FF7A1A] to-[#F45100] py-3 text-sm font-black text-white shadow-[var(--ssc-shadow-cta)] transition-colors active:scale-[0.98] disabled:bg-ssc-disabled-bg disabled:text-ssc-disabled-text"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ssc-overlay)] px-4 pb-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[22px] border border-ssc-border-soft bg-white p-4 shadow-[var(--ssc-shadow-float)]">
            <MentorMessage message={MENTOR_COPY.EDIT_PROFILE_SAVED} variant="success" />
            <div className="mt-3">
              <MentorMessage message="Kya aap aaj se naya plan generate karna chahte hain? Plan updated timeline ke hisaab se adjust ho jayega." />
            </div>
            {genError ? (
              <div className="mt-3 rounded-2xl border border-[#FBCACA] bg-[#FEECEC] p-3 text-sm font-semibold text-[#DC2626]">
                Preparation details update ho gayi hain, lekin naya plan generate nahi ho paya.
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleUpdatePlan}
                disabled={generating}
                className="rounded-2xl bg-gradient-to-r from-[#FF7A1A] to-[#F45100] py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {generating ? 'Generating...' : genError ? 'Retry Plan Generation' : 'Update Plan'}
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => router.push('/mentor')}
                className="rounded-2xl border border-[#BDEDEA] bg-white py-3 text-sm font-black text-ssc-teal disabled:opacity-60"
              >
                Keep Old Plan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
