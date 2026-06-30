import { useEffect, useMemo, useState } from 'react';

const ACCENTS = {
  teal: 'var(--ssc-teal)',
  orange: 'var(--ssc-orange)',
  red: 'var(--ssc-danger)',
  green: 'var(--ssc-success)',
  amber: 'var(--ssc-warning)',
  violet: 'var(--ssc-violet)',
};

const LOADER_VARIANTS = {
  'quiz-history': {
    title: 'Preparing your quiz history...',
    subtitle: 'Collecting attempts, scores and review data',
    steps: [
      'Fetching quiz sessions',
      'Organizing results',
      'Preparing filters',
      'Checking weak areas',
      'Finalizing history view',
    ],
    tipLabel: 'Revision Tip',
    tip: 'Review wrong questions first. They usually give the fastest improvement.',
    accent: ACCENTS.teal,
    tone: 'teal',
    icon: 'quiz',
  },
  'saved-questions': {
    title: 'Preparing your saved revision bank...',
    subtitle: 'Gathering saved questions for quick review',
    steps: [
      'Fetching saved questions',
      'Grouping by subject',
      'Preparing filters',
      'Calculating saved counts',
      'Finalizing saved list',
    ],
    tipLabel: 'Smart Tip',
    tip: 'Saved questions are best used for quick recall revision before mock tests.',
    accent: ACCENTS.orange,
    tone: 'orange',
    icon: 'saved',
  },
  'repeated-mistakes': {
    title: 'Finding your repeated mistakes...',
    subtitle: 'Identifying weak questions you should revisit',
    steps: [
      'Scanning wrong attempts',
      'Detecting repeated mistakes',
      'Grouping weak areas',
      'Preparing review set',
      'Finalizing mistake list',
    ],
    tipLabel: 'Revision Tip',
    tip: 'Repeated mistakes usually reveal concept gaps. Review explanations before reattempting.',
    accent: ACCENTS.red,
    tone: 'red',
    icon: 'mistake',
  },
  'coins-history': {
    title: 'Loading your coins journey...',
    subtitle: 'Checking earned coins, milestones and activity',
    steps: [
      'Fetching coin entries',
      'Calculating totals',
      'Preparing recent sessions',
      'Checking level progress',
      'Finalizing coin history',
    ],
    tipLabel: 'Keep it up!',
    tip: 'Earn more coins by practicing daily and improving your accuracy.',
    accent: ACCENTS.amber,
    tone: 'amber',
    icon: 'coins',
  },
  'streak-history': {
    title: 'Checking your learning streak...',
    subtitle: 'Reviewing consistency, milestones and rewards',
    steps: [
      'Fetching streak activity',
      'Checking current streak',
      'Finding best streak',
      'Preparing milestone progress',
      'Finalizing streak history',
    ],
    tipLabel: 'Stay consistent!',
    tip: 'Small daily progress leads to long term success.',
    accent: ACCENTS.violet,
    tone: 'violet',
    icon: 'streak',
  },
  reports: {
    title: 'Building your performance report...',
    subtitle: 'Analyzing attempts, weak areas and patterns',
    steps: [
      'Loading attempt data',
      'Analyzing performance',
      'Finding weak areas',
      'Preparing recommendations',
      'Finalizing report',
    ],
    tipLabel: 'Exam Tip',
    tip: 'Consistent review of weak areas improves your next mock score.',
    accent: ACCENTS.teal,
    tone: 'teal',
    icon: 'report',
  },
  'subject-history': {
    title: 'Preparing subject history...',
    subtitle: 'Reviewing your subject-level performance',
    steps: [
      'Fetching subject attempts',
      'Organizing by subject',
      'Preparing filters',
      'Checking weak topics',
      'Finalizing subject view',
    ],
    tipLabel: 'Smart Tip',
    tip: 'Subject filters help you revise one area at a time.',
    accent: ACCENTS.teal,
    tone: 'teal',
    icon: 'subject',
  },
  'topic-history': {
    title: 'Preparing topic-wise review...',
    subtitle: 'Collecting topic attempts and weak points',
    steps: [
      'Fetching topic attempts',
      'Organizing topic trends',
      'Preparing filters',
      'Checking weak areas',
      'Finalizing topic review',
    ],
    tipLabel: 'Smart Tip',
    tip: 'Topic review is best for focused last-mile revision.',
    accent: ACCENTS.orange,
    tone: 'orange',
    icon: 'topic',
  },
  'review-session': {
    title: 'Preparing your quiz review...',
    subtitle: 'Loading question details and answer history',
    steps: [
      'Fetching session data',
      'Organizing questions',
      'Building answer review',
      'Checking weak areas',
      'Finalizing review',
    ],
    tipLabel: 'Revision Tip',
    tip: 'Read the explanation before reattempting a missed question.',
    accent: ACCENTS.teal,
    tone: 'teal',
    icon: 'quiz',
  },
};

const FILTER_OVERRIDES = {
  wrong: {
    title: 'Preparing wrong answer review...',
    subtitle: 'Finding mistakes you should revise again',
    steps: [
      'Scanning wrong attempts',
      'Matching repeated questions',
      'Grouping weak topics',
      'Preparing review set',
      'Finalizing wrong list',
    ],
    tipLabel: 'Smart Tip',
    tip: 'Wrong answers often reveal concept gaps. Review explanation before reattempting.',
    accent: ACCENTS.red,
    tone: 'red',
    icon: 'wrong',
  },
  correct: {
    title: 'Preparing correct question review...',
    subtitle: 'Collecting questions you answered correctly',
    steps: [
      'Fetching correct attempts',
      'Organizing by subject',
      'Organizing by topic',
      'Preparing filters',
      'Finalizing correct list',
    ],
    tipLabel: 'Exam Tip',
    tip: 'Consistency in correct attempts builds strong accuracy in exams.',
    accent: ACCENTS.green,
    tone: 'green',
    icon: 'correct',
  },
  skipped: {
    title: 'Preparing skipped question review...',
    subtitle: 'Collecting questions you left unanswered',
    steps: [
      'Fetching skipped attempts',
      'Organizing by subject',
      'Organizing by topic',
      'Preparing filters',
      'Finalizing skipped list',
    ],
    tipLabel: 'Revision Tip',
    tip: 'Do not ignore skipped questions. They may be your scoring opportunities.',
    accent: ACCENTS.amber,
    tone: 'amber',
    icon: 'skipped',
  },
  saved: {
    title: 'Preparing saved question review...',
    subtitle: 'Gathering saved questions for quick review',
    steps: [
      'Fetching saved questions',
      'Grouping by subject',
      'Grouping by topic',
      'Preparing filters',
      'Finalizing saved list',
    ],
    tipLabel: 'Smart Tip',
    tip: 'Saved questions are best used for quick recall revision before mock tests.',
    accent: ACCENTS.orange,
    tone: 'orange',
    icon: 'saved',
  },
  repeated: {
    title: 'Finding your repeated mistakes...',
    subtitle: 'Identifying weak questions you should revisit',
    steps: [
      'Scanning wrong attempts',
      'Detecting repeated mistakes',
      'Grouping weak areas',
      'Preparing review set',
      'Finalizing mistake list',
    ],
    tipLabel: 'Revision Tip',
    tip: 'Repeated mistakes usually reveal concept gaps. Review explanations before reattempting.',
    accent: ACCENTS.red,
    tone: 'red',
    icon: 'mistake',
  },
  never_correct: {
    title: 'Preparing never-correct review...',
    subtitle: 'Collecting questions you never got right',
    steps: [
      'Scanning attempts',
      'Finding never-correct items',
      'Grouping weak topics',
      'Preparing review set',
      'Finalizing review list',
    ],
    tipLabel: 'Revision Tip',
    tip: 'Start with never-correct questions to recover marks faster.',
    accent: ACCENTS.red,
    tone: 'red',
    icon: 'wrong',
  },
};

const RANGE_COPY = {
  '7d': {
    title: 'Preparing your last 7 days activity...',
    subtitle: 'Collecting your recent quiz history',
  },
  '30d': {
    title: 'Preparing your last 30 days activity...',
    subtitle: 'Collecting attempts from this month',
  },
  custom: {
    title: 'Preparing your custom history range...',
    subtitle: 'Collecting your selected date range data',
  },
};

function toneSoft(tone) {
  return {
    teal: 'rgba(14,165,164,0.10)',
    orange: 'rgba(255,106,0,0.10)',
    red: 'rgba(239,68,68,0.10)',
    green: 'rgba(16,185,129,0.10)',
    amber: 'rgba(245,158,11,0.12)',
    violet: 'rgba(139,92,246,0.11)',
  }[tone] || 'rgba(14,165,164,0.10)';
}

function hashPercent(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getContextConfig({ variant, filter, subject, topic, timeRange, title, subtitle, steps, tip, accent }) {
  const base = { ...(LOADER_VARIANTS[variant] || LOADER_VARIANTS['quiz-history']) };
  const filterConfig = filter && FILTER_OVERRIDES[filter] ? FILTER_OVERRIDES[filter] : null;
  const rangeConfig = timeRange && RANGE_COPY[timeRange] ? RANGE_COPY[timeRange] : null;
  const next = { ...base, ...(filterConfig || {}) };

  if (rangeConfig && !filterConfig) {
    next.title = rangeConfig.title;
    next.subtitle = rangeConfig.subtitle;
  }
  if (topic) {
    next.title = `Preparing ${topic} review...`;
    next.subtitle = `Collecting questions for ${topic} review`;
    next.icon = 'topic';
    next.tone = 'orange';
    next.accent = ACCENTS.orange;
  } else if (subject) {
    next.title = `Preparing ${subject} history...`;
    next.subtitle = `Collecting attempts and progress for ${subject}`;
    next.icon = 'subject';
  }

  return {
    ...next,
    title: title || next.title,
    subtitle: subtitle || next.subtitle,
    steps: steps?.length ? steps : next.steps,
    tip: typeof tip === 'string' ? tip : (tip?.copy || next.tip),
    tipLabel: tip?.label || next.tipLabel,
    accent: accent || next.accent,
  };
}

function Illustration({ type, accent, tone }) {
  const bg = toneSoft(tone);
  const common = { stroke: accent, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };

  if (type === 'saved') {
    return (
      <div className="shl-illustration" style={{ background: bg }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <path {...common} d="M25 18h22a3 3 0 0 1 3 3v34l-14-8-14 8V21a3 3 0 0 1 3-3z" fill="rgba(14,165,164,0.12)" />
          <path {...common} d="M30 27h12M30 34h9" />
        </svg>
      </div>
    );
  }
  if (type === 'mistake' || type === 'wrong') {
    return (
      <div className="shl-illustration" style={{ background: bg }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <path d="M36 16 56 52H16L36 16z" fill="rgba(239,68,68,0.12)" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
          <path {...common} d="M36 29v11M36 48h.01" />
        </svg>
      </div>
    );
  }
  if (type === 'correct') {
    return (
      <div className="shl-illustration" style={{ background: bg }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="21" fill="rgba(16,185,129,0.14)" stroke={accent} strokeWidth="2" />
          <path {...common} d="M25 37l8 8 15-18" />
        </svg>
      </div>
    );
  }
  if (type === 'skipped') {
    return (
      <div className="shl-illustration" style={{ background: bg }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="21" fill="rgba(245,158,11,0.12)" stroke={accent} strokeWidth="2" />
          <path {...common} d="M36 24v13l9 5" />
        </svg>
      </div>
    );
  }
  if (type === 'coins') {
    return (
      <div className="shl-illustration" style={{ background: bg }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <ellipse cx="30" cy="42" rx="12" ry="5" fill="rgba(245,158,11,0.18)" stroke={accent} strokeWidth="2" />
          <path {...common} d="M18 34c0 3 5 5 12 5s12-2 12-5M18 34c0-3 5-5 12-5s12 2 12 5v8" />
          <ellipse cx="44" cy="26" rx="11" ry="5" fill="rgba(245,158,11,0.18)" stroke={accent} strokeWidth="2" />
          <path {...common} d="M33 26v12M55 26v20c0 3-5 5-11 5-4 0-8-1-10-3" />
        </svg>
      </div>
    );
  }
  if (type === 'streak') {
    return (
      <div className="shl-illustration" style={{ background: bg }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <path d="M36 57c-10 0-18-7-18-17 0-8 5-13 10-18 1 7 7 9 7 16 5-5 7-12 5-20 9 6 14 13 14 22 0 10-8 17-18 17z" fill="rgba(139,92,246,0.15)" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
          <path {...common} d="M35 56c-4-3-6-6-6-10 0-3 2-6 5-8 0 5 5 6 5 12 2-2 3-4 3-7 3 3 4 5 4 8 0 4-4 7-11 5z" />
        </svg>
      </div>
    );
  }
  if (type === 'report') {
    return (
      <div className="shl-illustration" style={{ background: bg }}>
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <path {...common} d="M21 52V22a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3v30H21z" fill="rgba(14,165,164,0.10)" />
          <path {...common} d="M29 45V34M36 45V27M43 45v-8M28 53h16" />
        </svg>
      </div>
    );
  }

  return (
    <div className="shl-illustration" style={{ background: bg }}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <path d="M22 19h25a4 4 0 0 1 4 4v29H22V19z" fill="rgba(14,165,164,0.10)" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
        <path {...common} d="M29 29h13M29 37h11M29 45h8" />
        <circle cx="49" cy="48" r="9" fill="#fff" stroke="#0B376D" strokeWidth="2" />
        <path d="m55 55 6 6" stroke="#0B376D" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M16 42c-4-8 1-17 9-20" stroke="rgba(14,165,164,0.28)" strokeWidth="6" strokeLinecap="round" />
        <path d="M54 23c5 4 7 11 4 18" stroke="rgba(14,165,164,0.24)" strokeWidth="6" strokeLinecap="round" />
        <path d="M57 17v5M54.5 19.5h5" stroke="#F6B331" strokeWidth="2" strokeLinecap="round" />
        <path d="M15 28v4M13 30h4" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function SmartHistoryLoader({
  variant = 'quiz-history',
  filter = 'all',
  subject = '',
  topic = '',
  timeRange = '',
  compact = false,
  delay = 320,
  title = '',
  subtitle = '',
  steps = null,
  tip = null,
  accent = '',
  isLoading = true,
  isReady = false,
  className = '',
}) {
  const [showRich, setShowRich] = useState(false);
  const [progress, setProgress] = useState(15);

  const config = useMemo(
    () => getContextConfig({ variant, filter, subject, topic, timeRange, title, subtitle, steps, tip, accent }),
    [variant, filter, subject, topic, timeRange, title, subtitle, steps, tip, accent]
  );

  useEffect(() => {
    setShowRich(false);
    const timer = window.setTimeout(() => setShowRich(true), delay);
    return () => window.clearTimeout(timer);
  }, [variant, filter, subject, topic, timeRange, title, subtitle, delay]);

  useEffect(() => {
    const seed = `${variant}-${filter || ''}-${subject || ''}-${topic || ''}-${timeRange || ''}`;
    const start = 12 + (hashPercent(seed) % 7);
    setProgress(start);

    if (isReady || !isLoading) {
      const completeTimer = window.setTimeout(() => setProgress(100), 80);
      return () => window.clearTimeout(completeTimer);
    }

    let value = start;
    const interval = window.setInterval(() => {
      setProgress(current => {
        const cap = 88 + (hashPercent(`${seed}-cap`) % 5);
        const increment = current < 30 ? 7 : current < 58 ? 5 : current < 78 ? 3 : 1;
        value = Math.min(cap, current + increment);
        return value;
      });
    }, 360);

    return () => window.clearInterval(interval);
  }, [variant, filter, subject, topic, timeRange, isLoading, isReady]);

  const activeStep = useMemo(() => {
    if (progress <= 25) return 0;
    if (progress <= 45) return 1;
    if (progress <= 65) return 2;
    if (progress <= 85) return 3;
    return 4;
  }, [progress]);

  const wrapperClass = `smart-history-loader ${compact ? 'compact' : ''} ${showRich ? 'rich' : 'skeleton'} ${className}`.trim();

  if (!showRich) {
    return (
      <div className={wrapperClass}>
        <style>{styles}</style>
        <div className="shl-preview-card" aria-label="Loading history data">
          <div className="shl-skeleton-illustration" />
          <div className="shl-skeleton-title" />
          <div className="shl-skeleton-copy" />
          <div className="shl-skeleton-progress" />
          <div className="shl-skeleton-steps">
            {Array.from({ length: 5 }).map((_, index) => <span key={index} />)}
          </div>
          <div className="shl-skeleton-tip" />
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} aria-live="polite">
      <style>{styles}</style>
      <section className="shl-preview-card" style={{ '--shl-accent': config.accent, '--shl-soft': toneSoft(config.tone) }}>
        <Illustration type={config.icon} accent={config.accent} tone={config.tone} />

        <div className="shl-copy">
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
        </div>

        <div className="shl-progress-row">
          <div className="shl-progress-track">
            <div className="shl-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{Math.round(progress)}%</span>
        </div>

        <div className="shl-steps" aria-label="Processing steps">
          {config.steps.slice(0, 5).map((step, index) => {
            const state = index < activeStep ? 'done' : index === activeStep ? 'active' : 'upcoming';
            return (
              <div key={step} className={`shl-step ${state}`}>
                <span className="shl-step-dot">{state === 'done' ? <CheckIcon /> : null}</span>
                <p>{step}</p>
              </div>
            );
          })}
        </div>

        <div className="shl-tip">
          <span className="shl-tip-icon" aria-hidden="true">
            <TipIcon />
          </span>
          <div>
            <p className="shl-tip-label">{config.tipLabel}</p>
            <p className="shl-tip-copy">{config.tip}</p>
          </div>
        </div>

        <div className="shl-dots" aria-hidden="true">
          <span />
          <span className="active" />
          <span />
        </div>
      </section>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TipIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.7.5-1.1 1.2-1.3 2H9.8c-.2-.8-.6-1.5-1.3-2z" />
    </svg>
  );
}

const styles = `
.smart-history-loader{
  width:100%;
  max-width:430px;
  margin:0 auto;
  padding:0 0 calc(10px + env(safe-area-inset-bottom));
  box-sizing:border-box;
}
.smart-history-loader.compact{padding-bottom:0}
.shl-preview-card{
  width:100%;
  background:var(--ssc-surface);
  border:1px solid var(--ssc-border-soft);
  border-radius:24px;
  box-shadow:var(--ssc-shadow-card);
  padding:15px 18px 12px;
  box-sizing:border-box;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  gap:11px;
  overflow:hidden;
}
.shl-illustration{
  width:86px;
  height:86px;
  border-radius:999px;
  margin:0 auto -1px;
  display:flex;
  align-items:center;
  justify-content:center;
  position:relative;
  flex:0 0 auto;
}
.shl-illustration svg{width:76px;height:76px;display:block}
.shl-copy{text-align:center;margin-top:-1px}
.shl-copy h2{
  color:var(--ssc-text-primary);
  font-size:17px;
  font-weight:950;
  line-height:1.18;
  margin:0;
  letter-spacing:0;
}
.shl-copy p{
  color:var(--ssc-text-secondary);
  font-size:12px;
  font-weight:700;
  line-height:1.38;
  margin:7px auto 0;
  max-width:300px;
}
.shl-progress-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) 36px;
  align-items:center;
  gap:12px;
  padding:1px 0 2px;
}
.shl-progress-track{
  height:6px;
  background:#E4EBF2;
  border-radius:999px;
  overflow:hidden;
}
.shl-progress-fill{
  height:100%;
  border-radius:999px;
  background:var(--shl-accent);
  transition:width .34s ease;
}
.shl-progress-row span{
  color:var(--shl-accent);
  font-size:12px;
  font-weight:950;
  text-align:right;
  line-height:1;
}
.shl-steps{
  border:1px solid var(--ssc-border-soft);
  border-radius:15px;
  padding:9px 12px;
  display:grid;
  gap:7px;
}
.shl-step{
  display:flex;
  align-items:center;
  min-height:18px;
  gap:10px;
}
.shl-step-dot{
  width:15px;
  height:15px;
  border-radius:999px;
  border:1.5px solid #A8B7C8;
  box-sizing:border-box;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  background:#fff;
}
.shl-step.active .shl-step-dot,.shl-step.done .shl-step-dot{
  background:var(--shl-accent);
  border-color:var(--shl-accent);
  box-shadow:0 5px 12px color-mix(in srgb, var(--shl-accent) 24%, transparent);
}
.shl-step.active .shl-step-dot::after{
  content:'';
  width:4px;
  height:4px;
  border-radius:999px;
  background:white;
}
.shl-step p{
  margin:0;
  color:var(--ssc-text-secondary);
  font-size:12px;
  font-weight:800;
  line-height:1.15;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.shl-step.active p,.shl-step.done p{
  color:var(--ssc-text-primary);
}
.shl-tip{
  display:flex;
  gap:10px;
  align-items:flex-start;
  border:1px solid var(--ssc-border-soft);
  border-radius:14px;
  padding:10px 12px;
  background:linear-gradient(90deg,var(--shl-soft),rgba(255,255,255,.84));
}
.shl-tip-icon{
  width:24px;
  height:24px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  color:var(--shl-accent);
  background:rgba(255,255,255,.62);
}
.shl-tip-label{
  margin:0 0 3px;
  color:var(--shl-accent);
  font-size:11px;
  font-weight:950;
  line-height:1.1;
}
.shl-tip-copy{
  margin:0;
  color:var(--ssc-text-secondary);
  font-size:11px;
  font-weight:700;
  line-height:1.32;
}
.shl-dots{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  height:10px;
  margin-top:-2px;
}
.shl-dots span{
  width:6px;
  height:6px;
  border-radius:999px;
  background:#C8D4E1;
}
.shl-dots .active{
  width:16px;
  background:var(--shl-accent);
}
.shl-skeleton-illustration{
  width:78px;height:78px;border-radius:999px;margin:0 auto;background:linear-gradient(90deg,#EEF6F5,#F8FCFC,#EEF6F5);background-size:220% 100%;animation:shl-skeleton 1.1s ease-in-out infinite;
}
.shl-skeleton-title,.shl-skeleton-copy,.shl-skeleton-progress,.shl-skeleton-tip,.shl-skeleton-steps span{
  background:linear-gradient(90deg,#E9F1F4,#F8FCFC,#E9F1F4);background-size:220% 100%;animation:shl-skeleton 1.1s ease-in-out infinite;border-radius:999px;
}
.shl-skeleton-title{height:18px;width:76%;margin:0 auto}
.shl-skeleton-copy{height:12px;width:68%;margin:0 auto}
.shl-skeleton-progress{height:6px;width:100%}
.shl-skeleton-steps{border:1px solid var(--ssc-border-soft);border-radius:15px;padding:10px 12px;display:grid;gap:8px}
.shl-skeleton-steps span{height:13px;width:88%}
.shl-skeleton-steps span:nth-child(2){width:72%}.shl-skeleton-steps span:nth-child(3){width:78%}.shl-skeleton-steps span:nth-child(4){width:74%}.shl-skeleton-steps span:nth-child(5){width:82%}
.shl-skeleton-tip{height:52px;width:100%;border-radius:14px}
@keyframes shl-skeleton{0%{background-position:120% 0}100%{background-position:-120% 0}}
@media(max-height:720px){
  .shl-preview-card{padding:12px 16px 10px;gap:8px;border-radius:22px}
  .shl-illustration{width:70px;height:70px}
  .shl-illustration svg{width:62px;height:62px}
  .shl-copy h2{font-size:15px}
  .shl-copy p{font-size:11px;margin-top:5px}
  .shl-steps{gap:5px;padding:8px 11px}
  .shl-step{min-height:16px}
  .shl-step p{font-size:11px}
  .shl-tip{padding:8px 10px}
  .shl-tip-copy{font-size:10px;line-height:1.25}
}
@media(max-width:360px){
  .shl-preview-card{padding-left:14px;padding-right:14px}
  .shl-copy h2{font-size:15px}
  .shl-progress-row{grid-template-columns:minmax(0,1fr) 32px;gap:9px}
}
@media(min-width:720px){
  .smart-history-loader{max-width:430px}
}
`;
