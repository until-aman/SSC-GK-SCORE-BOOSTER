import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';
import MentorMessage from '@/components/MentorMessage';
import SubjectStatusPicker, { SUBJECTS } from '@/components/SubjectStatusPicker';
import TopicStatusPicker from '@/components/TopicStatusPicker';
import { MENTOR_COPY, SUBJECT_DISPLAY_NAMES, SUBJECT_STATUS, TOPIC_STATUS } from '@/lib/mentorCopy';

const EXAM_OPTIONS = ['SSC CGL', 'SSC CHSL', 'SSC CPO', 'SSC MTS', 'SSC GD', 'Other SSC Exam'];
const DAYS_OPTIONS = ['0-15', '16-30', '31-45', '46-60', '60+', "I don't know yet"];
const TIME_OPTIONS = ['15-20 min', '30 min', '45 min', '1 hour', '1.5+ hours'];
const PACE_OPTIONS = ['Light', 'Balanced', 'Aggressive'];

function OptionButton({ selected, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
        selected
          ? 'border-teal-400 bg-teal-500/15 text-white'
          : 'border-slate-800 bg-slate-900 text-slate-300'
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

export default function MentorSetupEditPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [topicsData, setTopicsData] = useState({ subjects: {} });
  const [openSubjects, setOpenSubjects] = useState({});
  const [formData, setFormData] = useState(null);

  useEffect(() => {
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
    try {
      const payload = {
        ...formData,
        topicsCompleted: buildTopicsCompleted(formData.topicStrength),
      };
      const res = await fetch('/api/mentor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      localStorage.setItem('mentor_profile_cache', JSON.stringify(payload));
      localStorage.setItem('mentor_onboarded', 'true');
      setShowConfirm(true);
    } catch (err) {
      setError('Preparation details could not be saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return <Loader fullScreen label="Loading details..." />;
  }

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
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
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-red-200">{error}</div>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-10 pt-5 text-white">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
          >
            Back
          </button>
          <h1 className="text-xl font-bold">Edit Preparation Details</h1>
        </div>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-white">Exam and Timeline</h2>
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

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-white">Study Preferences</h2>
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
          <h2 className="text-sm font-semibold text-white">Subject Status</h2>
          <SubjectStatusPicker
            value={formData.subjectStatus}
            onChange={subjectStatus => updateForm({ subjectStatus })}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Topic Coverage</h2>
          {activeSubjects.length ? activeSubjects.map(subjectId => {
            const subject = topicsData.subjects?.[subjectId];
            return (
              <div key={subjectId} className="rounded-xl border border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setOpenSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }))}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-semibold text-white">
                    {subject?.subjectName || SUBJECT_DISPLAY_NAMES[subjectId] || subjectId}
                  </span>
                  <span className="text-xs text-slate-500">{openSubjects[subjectId] ? 'Hide' : 'Show'}</span>
                </button>
                {openSubjects[subjectId] ? (
                  <div className="border-t border-slate-800 p-3">
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
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:bg-slate-800 disabled:text-slate-500"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-4">
            <MentorMessage message={MENTOR_COPY.EDIT_PROFILE_SAVED} variant="success" />
            <div className="mt-3">
              <MentorMessage message="Kya aap aaj se naya plan generate karna chahte hain? Plan updated timeline ke hisaab se adjust ho jayega." />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('mentor_today_plan');
                  router.push('/mentor');
                }}
                className="rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white"
              >
                Update Plan
              </button>
              <button
                type="button"
                onClick={() => router.push('/mentor')}
                className="rounded-xl border border-slate-700 py-3 text-sm font-semibold text-slate-200"
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
