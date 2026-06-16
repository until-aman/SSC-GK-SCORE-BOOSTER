import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import MentorMessage from '@/components/MentorMessage';
import MentorSetupStep from '@/components/MentorSetupStep';
import SubjectStatusPicker, { SUBJECTS } from '@/components/SubjectStatusPicker';
import { MENTOR_COPY, SUBJECT_STATUS, getISTDateKey } from '@/lib/mentorCopy';
import { generateTodaysPlan } from '@/lib/mentorPlanEngine';

const EXAM_OPTIONS = [
  { value: 'SSC CGL', icon: '◎' },
  { value: 'SSC CHSL', icon: '♜' },
  { value: 'SSC CPO', icon: '♛' },
  { value: 'SSC MTS', icon: '●' },
  { value: 'SSC GD', icon: '✦' },
  { value: 'Other SSC Exam', icon: '◈' },
];

const DAYS_OPTIONS = [
  { value: '0-15', label: '< 15 days', sublabel: 'Very close' },
  { value: '16-30', label: '16-30', sublabel: 'Final push' },
  { value: '31-45', label: '31-45', sublabel: 'Focused plan' },
  { value: '46-60', label: '46-60', sublabel: 'Steady prep' },
  { value: '60+', label: '60+', sublabel: 'Build base' },
  { value: "I don't know yet", label: "I don't know", sublabel: 'Use 45 days' },
];

const TIME_OPTIONS = ['15-20 min', '30 min', '45 min', '1 hour', '1.5+ hours'];

const PACE_OPTIONS = [
  { value: 'Light', icon: '◌', detail: 'Slow and steady' },
  { value: 'Balanced', icon: '↗', detail: 'Consistent daily effort' },
  { value: 'Aggressive', icon: '⚡', detail: 'Fast coverage' },
];

function getDefaultSubjectStatus() {
  return SUBJECTS.reduce((acc, subjectId) => {
    acc[subjectId] = SUBJECT_STATUS.NOT_STARTED;
    return acc;
  }, {});
}

function getDaysClosingLine(daysLeftRange) {
  if (daysLeftRange === '0-15') return MENTOR_COPY.DAYS_VERY_CLOSE;
  if (daysLeftRange === '16-30') return MENTOR_COPY.DAYS_CLOSE;
  if (daysLeftRange === '31-45' || daysLeftRange === '46-60') return MENTOR_COPY.DAYS_MODERATE;
  return MENTOR_COPY.DAYS_PLENTY;
}

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(cookie => cookie.trim().startsWith('userMode=guest'));
}

function buildLocalSnapshot(profile, plan) {
  const tasks = plan?.tasks || [];
  const activeTasks = tasks.filter(task => task.status === 'active').slice(0, 3);
  const completedToday = tasks.filter(task => task.status === 'completed');
  const deferredTasks = tasks.filter(task => task.status === 'snoozed');
  const total = activeTasks.length + completedToday.length + deferredTasks.length;
  return {
    exists: true,
    profile,
    plan,
    activeTasks,
    completedToday,
    deferredTasks,
    progress: {
      completed: completedToday.length,
      total,
      percent: total ? Math.round((completedToday.length / total) * 100) : 0,
    },
    mentorMessage: MENTOR_COPY.MORNING_GREETING,
    lastSyncAt: new Date().toISOString(),
  };
}

function OptionCard({ selected, title, subtitle, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[18px] border bg-white p-3 text-center shadow-[var(--ssc-shadow-card)] transition-all ${
        selected
          ? 'border-ssc-teal bg-[#E8F8F6] text-ssc-text-primary ring-1 ring-ssc-teal'
          : 'border-ssc-border-soft text-ssc-text-primary hover:border-ssc-teal'
      }`}
    >
      {icon ? (
        <span className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border ${selected ? 'border-ssc-teal bg-white text-ssc-teal' : 'border-[#DDE8F0] bg-[#F8FEFD] text-ssc-text-muted'} text-lg font-black`}>
          {icon}
        </span>
      ) : null}
      <span className="block text-sm font-black">{title}</span>
      {subtitle ? <span className="mt-1 block text-xs font-semibold text-ssc-text-secondary">{subtitle}</span> : null}
    </button>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="font-display text-xl font-black leading-tight text-ssc-text-primary">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs font-semibold leading-relaxed text-ssc-text-secondary">{subtitle}</p> : null}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs font-bold text-ssc-text-secondary">{label}</span>
      <span className="text-right text-sm font-black text-ssc-text-primary">{value || 'Not set'}</span>
    </div>
  );
}

export default function MentorSetupPage() {
  const router = useRouter();
  const { status } = useSession();
  const [guestMode, setGuestMode] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    examTarget: '',
    daysLeftRange: '',
    customDaysLeft: null,
    dailyGKTime: '',
    pace: '',
    subjectStatus: getDefaultSubjectStatus(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const previewPlan = useMemo(() => generateTodaysPlan(
    { ...formData, topicsCompleted: {}, topicStrength: {}, onboardingCompletedAt: new Date().toISOString() },
    [],
    { repeatedMistakesPreview: [] },
    { subjects: {} }
  ), [formData]);

  useEffect(() => {
    setGuestMode(isGuestMode());
  }, []);

  const updateForm = patch => {
    setError(null);
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const canContinue =
    (step === 1 && Boolean(formData.examTarget) && Boolean(formData.daysLeftRange)) ||
    (step === 2 && Boolean(formData.dailyGKTime) && Boolean(formData.pace)) ||
    step === 3;

  const handleNext = () => {
    if (step < 3) setStep(current => current + 1);
  };

  const handleBack = () => {
    if (step > 1 && step < 3) setStep(current => current - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (status === 'authenticated') {
        const res = await fetch('/api/mentor/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examTarget: formData.examTarget,
            daysLeftRange: formData.daysLeftRange,
            customDaysLeft: null,
            dailyGKTime: formData.dailyGKTime,
            pace: formData.pace,
            goals: [],
            subjectStatus: formData.subjectStatus,
            topicsCompleted: {},
            topicStrength: {},
          }),
        });
        if (!res.ok) throw new Error('Save failed');
      }
      const onboardingCompletedAt = new Date().toISOString();
      const today = getISTDateKey();
      const plan = generateTodaysPlan(
        { ...formData, topicsCompleted: {}, topicStrength: {}, onboardingCompletedAt },
        [],
        { repeatedMistakesPreview: [] },
        { subjects: {} }
      );
      localStorage.setItem('mentor_onboarded', 'true');
      const profile = {
        ...formData,
        topicsCompleted: {},
        topicStrength: {},
        onboardingCompletedAt,
      };
      localStorage.setItem('mentor_profile_cache', JSON.stringify(profile));
      localStorage.setItem('mentor_today_plan', JSON.stringify({ date: today, plan }));
      localStorage.setItem(`mentor_snapshot_v2:${status === 'authenticated' ? 'account' : 'guest'}:${today}`, JSON.stringify(buildLocalSnapshot(profile, plan)));
      router.push('/mentor');
    } catch (e) {
      setError('Plan could not be saved. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen bg-[var(--ssc-bg)]" />;
  }

  if (status !== 'authenticated' && !guestMode) {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] px-4 py-10 text-ssc-text-primary">
        <GoogleSignInCard
          title="Sign in to build your GK plan"
          subtitle="Your mentor plan is saved to your account."
          buttonText="Continue with Google"
          callbackUrl="/mentor-setup"
        />
      </div>
    );
  }

  return (
    <MentorSetupStep
      currentStep={step}
      totalSteps={3}
      onBack={handleBack}
      onContinue={step === 3 ? handleSubmit : handleNext}
      continueLabel={step === 3 ? 'Create My Plan' : step === 2 ? 'Save & Continue' : 'Continue'}
      continueDisabled={!canContinue}
      submitting={submitting}
      showBack={step > 1 && step < 3}
      title={step === 3 ? 'Your Mentor Plan' : 'Set up Mentor'}
    >
      {step === 1 ? (
        <section className="space-y-5">
          <SectionTitle title="Which exam are you preparing for?" subtitle={MENTOR_COPY.SETUP_WELCOME} />
          <div className="grid grid-cols-2 gap-2.5">
            {EXAM_OPTIONS.map(option => (
              <OptionCard
                key={option.value}
                title={option.value}
                icon={option.icon}
                selected={formData.examTarget === option.value}
                onClick={() => updateForm({ examTarget: option.value })}
              />
            ))}
          </div>

          <div className="border-t border-ssc-border-soft pt-5">
            <SectionTitle title="How many days are left for your exam?" subtitle={MENTOR_COPY.SETUP_DAYS_LEFT} />
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {DAYS_OPTIONS.map(option => (
                <OptionCard
                  key={option.value}
                  title={option.label}
                  subtitle={option.sublabel}
                  selected={formData.daysLeftRange === option.value}
                  onClick={() => updateForm({ daysLeftRange: option.value })}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5">
          <SectionTitle title="What is your current preparation stage?" subtitle={MENTOR_COPY.SETUP_TIME_PACE} />
          <div className="grid grid-cols-3 gap-2.5">
            {PACE_OPTIONS.map(option => (
              <OptionCard
                key={option.value}
                title={option.value}
                subtitle={option.detail}
                icon={option.icon}
                selected={formData.pace === option.value}
                onClick={() => updateForm({ pace: option.value })}
              />
            ))}
          </div>

          <div className="rounded-[20px] border border-ssc-border-soft bg-white p-4 shadow-[var(--ssc-shadow-card)]">
            <h3 className="text-sm font-black text-ssc-text-primary">Daily GK Time</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {TIME_OPTIONS.map(option => (
                <OptionCard
                  key={option}
                  title={option}
                  selected={formData.dailyGKTime === option}
                  onClick={() => updateForm({ dailyGKTime: option })}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="How confident are you in each subject?" subtitle={MENTOR_COPY.SETUP_SUBJECT_STATUS} />
            <SubjectStatusPicker
              value={formData.subjectStatus}
              onChange={subjectStatus => updateForm({ subjectStatus })}
            />
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <div className="rounded-[20px] border border-ssc-border-soft bg-white p-4 shadow-[var(--ssc-shadow-card)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-black text-ssc-text-primary">Your Preparation Summary</h2>
              <button type="button" onClick={() => setStep(1)} className="text-xs font-black text-ssc-teal">Edit</button>
            </div>
            <SummaryRow label="Exam Goal" value={formData.examTarget} />
            <SummaryRow label="Days Left" value={formData.daysLeftRange} />
            <SummaryRow label="Daily Study Time" value={formData.dailyGKTime} />
            <SummaryRow label="Current Stage" value={formData.pace} />
          </div>

          <div className="rounded-[20px] border border-ssc-border-soft bg-white p-4 shadow-[var(--ssc-shadow-card)]">
            <h2 className="font-display text-base font-black text-ssc-text-primary">Your Daily Plan Preview</h2>
            <div className="mt-3 space-y-3">
              {previewPlan.tasks.slice(0, 3).map((task, index) => (
                <div key={task.taskId} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-[#F8D9A0] bg-[#FFF7E6] text-sm font-black text-[#EA580C]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-ssc-text-primary">{task.displayName}</p>
                    <p className="mt-0.5 text-xs font-semibold text-ssc-text-secondary">
                      {task.ctaLabel} · {task.estimatedMinutes} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <MentorMessage message={MENTOR_COPY.SETUP_PLAN_READY} variant="success" />
          <MentorMessage message={getDaysClosingLine(formData.daysLeftRange)} />
          {error ? (
            <div className="rounded-2xl border border-[#FBCACA] bg-[#FEECEC] p-3 text-sm font-semibold text-[#DC2626]">
              {error}
            </div>
          ) : null}
        </section>
      ) : null}
    </MentorSetupStep>
  );
}
