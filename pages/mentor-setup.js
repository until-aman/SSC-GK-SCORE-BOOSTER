import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import MentorMessage from '@/components/MentorMessage';
import MentorSetupStep from '@/components/MentorSetupStep';
import SubjectStatusPicker, { SUBJECTS } from '@/components/SubjectStatusPicker';
import { MENTOR_COPY, SUBJECT_STATUS } from '@/lib/mentorCopy';
import { generateTodaysPlan } from '@/lib/mentorPlanEngine';

const EXAM_OPTIONS = [
  'SSC CGL',
  'SSC CHSL',
  'SSC CPO',
  'SSC MTS',
  'SSC GD',
  'Other SSC Exam',
];

const DAYS_OPTIONS = [
  { value: '0-15', label: '0 - 15 days', sublabel: 'Exam is very close' },
  { value: '16-30', label: '16 - 30 days' },
  { value: '31-45', label: '31 - 45 days' },
  { value: '46-60', label: '46 - 60 days' },
  { value: '60+', label: '60+ days' },
  { value: "I don't know yet", label: "I don't know yet", sublabel: "We'll use a 45-day plan" },
];

const TIME_OPTIONS = ['15-20 min', '30 min', '45 min', '1 hour', '1.5+ hours'];

const PACE_OPTIONS = [
  { value: 'Light', icon: '🐢', detail: 'Slow and steady, less pressure' },
  { value: 'Balanced', icon: '⚖️', detail: 'Consistent daily effort' },
  { value: 'Aggressive', icon: '🔥', detail: 'Maximum coverage, fast pace' },
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

function OptionCard({ selected, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        selected
          ? 'border-orange-500 bg-orange-500/10 text-white'
          : 'border-white/[0.06] bg-slate-800 text-slate-200 hover:border-orange-500'
      }`}
    >
      <span className="block text-sm font-semibold">{title}</span>
      {subtitle ? <span className="mt-1 block text-xs text-slate-400">{subtitle}</span> : null}
    </button>
  );
}

export default function MentorSetupPage() {
  const router = useRouter();
  const { status } = useSession();
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

  const updateForm = patch => {
    setError(null);
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const canContinue =
    (step === 1 && Boolean(formData.examTarget)) ||
    (step === 2 && Boolean(formData.daysLeftRange)) ||
    (step === 3 && Boolean(formData.dailyGKTime) && Boolean(formData.pace)) ||
    step === 4 ||
    step === 5;

  const handleNext = () => {
    if (step < 5) {
      setStep(current => current + 1);
    }
  };

  const handleBack = () => {
    if (step > 1 && step < 5) {
      setStep(current => current - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
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
      const today = new Date().toISOString().split('T')[0];
      const plan = generateTodaysPlan(
        { ...formData, topicsCompleted: {}, topicStrength: {}, onboardingCompletedAt: new Date().toISOString() },
        [],
        { repeatedMistakesPreview: [] },
        { subjects: {} }
      );
      localStorage.setItem('mentor_onboarded', 'true');
      localStorage.setItem('mentor_profile_cache', JSON.stringify({
        ...formData,
        topicsCompleted: {},
        topicStrength: {},
      }));
      localStorage.setItem('mentor_today_plan', JSON.stringify({ date: today, plan }));
      router.push('/mentor');
    } catch (e) {
      setError('Plan could not be saved. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
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
      onBack={handleBack}
      onContinue={step === 5 ? handleSubmit : handleNext}
      continueLabel={step === 5 ? 'Start My Plan' : 'Continue'}
      continueDisabled={!canContinue}
      submitting={submitting}
      showBack={step > 1 && step < 5}
    >
      {step === 1 ? (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Exam Target</h1>
          <MentorMessage message={MENTOR_COPY.SETUP_WELCOME} />
          <div className="space-y-3">
            {EXAM_OPTIONS.map(option => (
              <OptionCard
                key={option}
                title={option}
                selected={formData.examTarget === option}
                onClick={() => updateForm({ examTarget: option })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Days Left</h1>
          <MentorMessage message={MENTOR_COPY.SETUP_DAYS_LEFT} />
          <div className="space-y-3">
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
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold">Study Preferences</h1>
          <MentorMessage message={MENTOR_COPY.SETUP_TIME_PACE} />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">Daily GK Time</h2>
            {TIME_OPTIONS.map(option => (
              <OptionCard
                key={option}
                title={option}
                selected={formData.dailyGKTime === option}
                onClick={() => updateForm({ dailyGKTime: option })}
              />
            ))}
          </div>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">Pace</h2>
            {PACE_OPTIONS.map(option => (
              <OptionCard
                key={option.value}
                title={`${option.icon} ${option.value}`}
                subtitle={option.detail}
                selected={formData.pace === option.value}
                onClick={() => updateForm({ pace: option.value })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Subject Status</h1>
          <MentorMessage message={MENTOR_COPY.SETUP_SUBJECT_STATUS} />
          <SubjectStatusPicker
            value={formData.subjectStatus}
            onChange={subjectStatus => updateForm({ subjectStatus })}
          />
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Plan Preview</h1>
          <MentorMessage message={MENTOR_COPY.SETUP_PLAN_READY} variant="success" />
          <div className="rounded-2xl border border-white/[0.06] bg-slate-800 p-4">
            <p className="text-sm font-semibold text-white">{formData.examTarget}</p>
            <p className="mt-1 text-xs text-slate-400">
              {formData.daysLeftRange} · {formData.pace} · {formData.dailyGKTime}
            </p>
          </div>
          <div className="space-y-3">
            {previewPlan.tasks.slice(0, 3).map(task => (
              <div key={task.taskId} className="rounded-2xl border border-white/[0.06] bg-slate-800 p-4">
                <p className="text-sm font-semibold text-white">{task.displayName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {task.ctaLabel} · {task.estimatedMinutes} min
                </p>
              </div>
            ))}
          </div>
          <MentorMessage message={getDaysClosingLine(formData.daysLeftRange)} />
          {error ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </section>
      ) : null}
    </MentorSetupStep>
  );
}
