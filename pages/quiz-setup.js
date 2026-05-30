import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import Loader from '@/components/ui/Loader';
import RefreshStatus from '@/components/ui/RefreshStatus';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import SectionHeader from '@/components/ui/SectionHeader';
import { fetchWithClientCache, readCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { getQuestionBank } from '@/lib/data/questionData';

// Sentinel value meaning "no topic filter — use all questions for the subject"
const ALL_TOPICS = '__ALL__';

const SUBJECTS = [
  'Polity', 'Geography', 'Economics',
  'Ancient History', 'Medieval History', 'Modern History',
  'Physics', 'Chemistry', 'Biology', 'Current Affairs',
  'Static GK', 'Mixed',
];

// Icon map for bottom sheet rows
const SUBJECT_ICON = {
  'Polity':           '⚖️',
  'Geography':        '🌍',
  'Economics':        '📈',
  'Current Affairs':  '📰',
  'Static GK':        '📚',
  'Physics':          '⚛️',
  'Chemistry':        '🧪',
  'Biology':          '🧬',
  'Ancient History':  '🏺',
  'Medieval History': '🏰',
  'Modern History':   '🗺️',
  'Mixed':            '🎯',
};

// Grouped sections shown in the subject sheet
const SUBJECT_SHEET_SECTIONS = [
  { label: 'Popular', subjects: ['Polity', 'Geography', 'Economics', 'Current Affairs', 'Static GK'] },
  { label: 'Science',  subjects: ['Physics', 'Chemistry', 'Biology'] },
  { label: 'History',  subjects: ['Ancient History', 'Medieval History', 'Modern History'] },
];

const COLORS = {
  page: 'var(--bg-app)',
  card: 'var(--bg-card)',
  border: 'rgba(148,163,184,0.16)',
  selected: '#14B8A6',
  selectedGlow: 'rgba(20,184,166,0.16)',
  primary: '#F8FAFC',
  secondary: '#CBD5E1',
  muted: '#94A3B8',
  disabled: '#64748B',
  sheetBg: '#162032',
};

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('userMode=guest'));
}

function parseTopicsFromResponse(data, subject) {
  const topicMap = (data?.topics && data.topics[subject]) || data?.[subject] || {};
  return Object.entries(topicMap).map(([name, count]) => ({ name, count }));
}

function getBootstrapTopics(subject, collection) {
  const cached = readCache(CACHE_KEYS.DASHBOARD_BOOTSTRAP, CACHE_TTL.ONE_DAY);
  if (!cached?.isFresh) return null;

  const data = cached.data || {};
  const candidates = [
    data.topics?.[subject],
    data.topicsBySubject?.[subject],
    data.collections?.[collection]?.topics?.[subject],
    data.collections?.[collection]?.topicsBySubject?.[subject],
  ];

  for (const topicMap of candidates) {
    if (topicMap && typeof topicMap === 'object' && Object.keys(topicMap).length > 0) {
      return Object.entries(topicMap).map(([name, count]) => ({ name, count }));
    }
  }
  return null;
}

/* ── Topic list row ─────────────────────────────────────────────────────── */
function TopicRow({ label, count, isSelected, isLast, onClick, bold = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-opacity active:opacity-60"
      style={{
        background: isSelected ? 'rgba(20,184,166,0.08)' : 'rgba(255,255,255,0.02)',
        borderBottom: isLast ? 'none' : '1px solid rgba(148,163,184,0.1)',
        borderLeft: isSelected ? '3px solid #14B8A6' : '3px solid transparent',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Name + count stacked */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: isSelected ? 700 : bold ? 600 : 500,
          color: isSelected ? '#14B8A6' : '#F8FAFC',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {label}
        </p>
        {count != null && count > 0 && (
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            lineHeight: '16px',
            color: isSelected ? '#14B8A6' : '#64748B',
            marginTop: 2,
          }}>
            {count} questions
          </p>
        )}
      </div>

      {/* Checkmark — aligns to first line of text */}
      {isSelected ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#14B8A6', flexShrink: 0, marginTop: 2 }}>
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      ) : (
        <div style={{ width: 16, flexShrink: 0 }} /> /* keeps rows aligned */
      )}
    </button>
  );
}

export default function QuizSetup() {
  const { status } = useSession();
  const router = useRouter();

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError, setTopicsError] = useState(false);   // true only after a fetch failure
  const [topicsMessage, setTopicsMessage] = useState('');
  const [questionBankRefreshing, setQuestionBankRefreshing] = useState(false);
  const [questionBankUpdatedAt, setQuestionBankUpdatedAt] = useState(null);

  const [selectedCount, setSelectedCount] = useState(10);

  // Bottom sheet state
  const [subjectSheetOpen, setSubjectSheetOpen] = useState(false);
  const [topicSheetOpen, setTopicSheetOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  const subjectSearchRef = useRef(null);
  const topicSearchRef = useRef(null);

  const isGuest = status === 'unauthenticated' && isGuestMode();
  const isLoggedIn = status === 'authenticated';

  // isReady as soon as subject chosen — ALL_TOPICS is truthy so CTA lights up immediately
  const isReady = !!selectedSubject && !!selectedTopic;

  // Total questions across all topics (for the "All" row count)
  const allTopicsCount = topics.reduce((sum, t) => sum + (Number(t.count) || 0), 0);

  // Human-readable label for the currently selected topic
  const selectedTopicLabel = selectedTopic === ALL_TOPICS
    ? `All ${selectedSubject} Questions`
    : selectedTopic;

  const startButtonText = isReady
    ? `Start ${selectedCount}-question Quiz`
    : topicsLoading
      ? 'Loading topics...'
      : selectedSubject
        ? 'Loading topics...'
        : 'Choose a subject to continue';

  // Lock body scroll when a sheet is open
  useEffect(() => {
    if (subjectSheetOpen || topicSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [subjectSheetOpen, topicSheetOpen]);

  // Auto-focus search when sheet opens
  useEffect(() => {
    if (subjectSheetOpen) {
      setSubjectSearch('');
      setTimeout(() => subjectSearchRef.current?.focus(), 120);
    }
  }, [subjectSheetOpen]);

  useEffect(() => {
    if (topicSheetOpen) {
      setTopicSearch('');
      setTimeout(() => topicSearchRef.current?.focus(), 120);
    }
  }, [topicSheetOpen]);

  // Redirect if not authorised
  useEffect(() => {
    if (status === 'loading') return;
    if (!isGuest && !isLoggedIn) router.replace('/');
  }, [status, isGuest, isLoggedIn, router]);

  // Safety net — Mixed bypasses quiz-setup entirely
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.subject === 'Mixed') {
      router.replace(`/quiz?subject=Mixed&topic=Mixed&count=25&collection=${router.query.collection || 'general'}`);
    }
  }, [router.isReady, router.query.subject]);

  const collection = router.isReady ? (router.query.collection || 'general') : 'general';

  // Pre-select subject from query param (e.g. from subject cards)
  useEffect(() => {
    if (!router.isReady) return;
    const { subject } = router.query;
    if (subject && SUBJECTS.includes(subject)) {
      setSelectedSubject(subject);
      setSelectedTopic(ALL_TOPICS); // default to "All" — CTA active immediately
      fetchTopics(subject, router.query.collection || 'general');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  useEffect(() => {
    if (!selectedSubject || selectedSubject === 'Mixed') {
      setQuestionBankUpdatedAt(null);
      return;
    }
    const cached = readCache(CACHE_KEYS.QUESTION_BANK(collection, selectedSubject), Infinity);
    setQuestionBankUpdatedAt(cached?.timestamp || null);
  }, [selectedSubject, collection]);

  // Load topic metadata; question bank refresh is manual.
  async function fetchTopics(subject, col = 'general', { forceRefresh = false } = {}) {
    const bootstrapTopics = !forceRefresh ? getBootstrapTopics(subject, col) : null;

    setTopicsMessage('');
    setTopicsError(false);
    // NOTE: do NOT reset selectedTopic here — callers manage that

    if (bootstrapTopics?.length) {
      setTopics(bootstrapTopics);
      setTopicsLoading(false);
      return;
    }

    const cacheKey = CACHE_KEYS.TOPICS(col, subject);
    const url = `/api/topics?subject=${encodeURIComponent(subject)}&collection=${encodeURIComponent(col)}&includeCounts=false`;
    const cached = readCache(cacheKey, CACHE_TTL.ONE_DAY);
    const cachedTopics = cached ? parseTopicsFromResponse(cached.data, subject) : [];

    if (!forceRefresh && cached?.isFresh && cachedTopics.length > 0) {
      setTopics(cachedTopics);
      setTopicsLoading(false);
      return;
    }

    if (cachedTopics.length > 0) {
      setTopics(cachedTopics);
      setTopicsLoading(false);
    } else {
      setTopics([]);
      setTopicsLoading(true);
    }

    try {
      const result = await fetchWithClientCache({
        key: cacheKey,
        url,
        maxAgeMs: CACHE_TTL.ONE_DAY,
        forceRefresh,
        onCache(entry) {
          const fresh = parseTopicsFromResponse(entry.data, subject);
          if (fresh.length > 0) {
            setTopics(fresh);
            setTopicsLoading(false);
          }
        },
      });

      const parsed = parseTopicsFromResponse(result.data, subject);
      setTopics(parsed);
      if (result.stale) {
        setTopicsMessage('Showing cached topics.');
      }
    } catch {
      setTopics([]);
      setTopicsError(true);
    } finally {
      setTopicsLoading(false);
    }
  }

  // Called when user picks a subject from the bottom sheet
  function handleSubjectSelect(val) {
    setSelectedSubject(val);
    setSelectedTopic(ALL_TOPICS); // auto-select "All" → CTA active immediately
    setTopics([]);
    setTopicsMessage('');
    setTopicsError(false);
    setSubjectSheetOpen(false);
    if (val) fetchTopics(val, collection);
  }

  // Called when user picks a topic from the bottom sheet
  function handleTopicSelect(topicValue) {
    setSelectedTopic(topicValue);
    setTopicSheetOpen(false);
  }

  function handleRetryTopics() {
    if (!selectedSubject || topicsLoading) return;
    fetchTopics(selectedSubject, collection, { forceRefresh: true });
  }

  async function handleRefreshQuestionBank() {
    if (!selectedSubject || selectedSubject === 'Mixed' || questionBankRefreshing) return;
    setQuestionBankRefreshing(true);
    try {
      const result = await getQuestionBank({
        collection,
        subject: selectedSubject,
        forceRefresh: true,
      });
      setQuestionBankUpdatedAt(result.timestamp || Date.now());
    } catch {
      const cached = readCache(CACHE_KEYS.QUESTION_BANK(collection, selectedSubject), Infinity);
      setQuestionBankUpdatedAt(cached?.timestamp || null);
    } finally {
      setQuestionBankRefreshing(false);
    }
  }

  function handleStartQuiz() {
    if (!isReady) return;
    const sessionId = crypto.randomUUID();
    // Map ALL_TOPICS sentinel → clean "All" param for the quiz API
    const topicParam = selectedTopic === ALL_TOPICS ? 'All' : selectedTopic;
    const params = new URLSearchParams({
      subject: selectedSubject,
      topic: topicParam,
      count: selectedCount,
      sessionId,
    });
    if (collection !== 'general') params.set('collection', collection);
    router.push(`/quiz?${params.toString()}`);
  }

  // Filtered subject sections for the sheet
  const filteredSubjectSections = subjectSearch.trim()
    ? [{
        label: 'Results',
        subjects: SUBJECTS.filter(s =>
          s !== 'Mixed' && s.toLowerCase().includes(subjectSearch.trim().toLowerCase())
        ),
      }]
    : SUBJECT_SHEET_SECTIONS;

  // Filtered topic rows for the sheet (search never hides the "All" row)
  const filteredTopics = topicSearch.trim()
    ? topics.filter(t => t.name.toLowerCase().includes(topicSearch.trim().toLowerCase()))
    : topics;

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.page }}>
        <Loader size="md" label="Setting up your quiz…" />
      </div>
    );
  }

  return (
    <>
      <Head><title>Set Up Your Quiz — SSC GK Score Booster</title></Head>
      <div className="min-h-screen pb-28" style={{ background: COLORS.page }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-10 pb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            style={{ background: COLORS.card, borderColor: COLORS.border, color: COLORS.primary }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <SectionHeader
            title="Set Up Your Quiz"
            subtitle="Choose your practice mode"
            titleClassName="text-slate-50"
            subtitleClassName="text-slate-300"
          />
        </div>

        <div className="px-4 flex flex-col gap-4">

          {/* Question count */}
          <div>
            <p className="t-section-label" style={{ color: COLORS.muted }}>
              Number of Questions
            </p>
            <div className="flex gap-3">
              {[
                { count: 10, title: 'Quick Practice', duration: '~3 min', icon: '⚡' },
                { count: 25, title: 'Full Practice',  duration: '~8 min', icon: '🎯' },
              ].map(({ count, title, duration, icon }) => {
                const sel = selectedCount === count;
                return (
                  <AppCard
                    as="button"
                    key={count}
                    onClick={() => setSelectedCount(count)}
                    interactive
                    className={`question-mode-card flex-1 text-left ${sel ? 'question-mode-card-selected' : ''}`}
                    style={{
                      background: COLORS.card,
                      border: sel ? `1.5px solid ${COLORS.selected}` : `1px solid ${COLORS.border}`,
                      boxShadow: sel
                        ? `0 0 0 1px ${COLORS.selectedGlow}, 0 12px 28px ${COLORS.selectedGlow}`
                        : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl" aria-hidden="true">{icon}</span>
                      {sel && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: COLORS.selected }}>
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      )}
                    </div>
                    <p className="t-card-subtitle font-display font-bold mt-2" style={{ color: COLORS.primary }}>
                      {title}
                    </p>
                    <p className="t-stat-lg font-display mt-1" style={{ color: COLORS.primary }}>
                      {count} Questions
                    </p>
                    <p className="t-badge mt-1" style={{ color: COLORS.muted }}>
                      {duration}
                    </p>
                  </AppCard>
                );
              })}
            </div>
          </div>

          {/* Subject picker trigger */}
          <div>
            <label className="t-section-label" style={{ color: COLORS.muted }}>
              Subject
            </label>
            <button
              type="button"
              onClick={() => setSubjectSheetOpen(true)}
              className="w-full rounded-2xl px-4 py-4 border flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              style={{
                background: COLORS.card,
                borderColor: selectedSubject ? COLORS.selected : COLORS.border,
                borderWidth: selectedSubject ? 1.5 : 1,
                boxShadow: selectedSubject ? `0 0 0 3px ${COLORS.selectedGlow}` : 'none',
              }}
            >
              {selectedSubject && (
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
                  {SUBJECT_ICON[selectedSubject] || '📖'}
                </span>
              )}
              <span style={{ flex: 1, fontSize: 15, lineHeight: '22px', fontWeight: selectedSubject ? 600 : 500, color: selectedSubject ? COLORS.primary : COLORS.disabled }}>
                {selectedSubject || '— Choose a subject —'}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: COLORS.muted, flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>

          {/* Topic picker trigger */}
          <div>
            <label className="t-section-label" style={{ color: COLORS.muted }}>
              Topic
            </label>

            <button
              type="button"
              onClick={() => { if (selectedSubject) setTopicSheetOpen(true); }}
              disabled={!selectedSubject}
              className={`w-full rounded-2xl px-4 py-4 border flex items-center gap-3 text-left transition-transform ${
                selectedSubject ? 'active:scale-[0.99]' : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: COLORS.card,
                borderColor: selectedTopic ? COLORS.selected : COLORS.border,
                borderWidth: selectedTopic ? 1.5 : 1,
                boxShadow: selectedTopic ? `0 0 0 3px ${COLORS.selectedGlow}` : 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 15, lineHeight: '22px', fontWeight: selectedTopic ? 600 : 500, color: selectedTopic ? COLORS.primary : COLORS.disabled }}>
                {selectedTopic
                  ? selectedTopicLabel
                  : !selectedSubject
                    ? 'Select a subject first'
                    : 'Choose topic or practice all'}
              </span>
              {/* Inline spinner while topics fetch in background */}
              {topicsLoading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: COLORS.muted, flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: COLORS.muted, flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              )}
            </button>

            {/* Question count hint */}
            {selectedTopic && !topicsLoading && (
              <p className="text-xs mt-1.5 ml-1" style={{ color: COLORS.muted }}>
                {selectedTopic === ALL_TOPICS
                  ? allTopicsCount > 0 ? `${allTopicsCount} questions available` : 'All questions for this subject'
                  : `${topics.find(t => t.name === selectedTopic)?.count || 0} questions available`}
              </p>
            )}

            {/* Stale-cache notice (non-error) */}
            {topicsMessage && !topicsError && (
              <p className="text-xs mt-1.5 ml-1" style={{ color: COLORS.muted }}>{topicsMessage}</p>
            )}

            {/* Error state — only show retry when fetch actually failed */}
            {topicsError && (
              <button
                type="button"
                onClick={handleRetryTopics}
                className="mt-2 flex items-center gap-1.5 text-xs"
                style={{ color: COLORS.selected, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Couldn&apos;t load topics. Retry
              </button>
            )}
          </div>

          {/* Info strip */}
          {isReady && (
            <div className="border rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in-down" style={{ background: COLORS.card, borderColor: COLORS.border }}>
              <span className="text-2xl">📋</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="t-card-subtitle font-semibold" style={{ color: COLORS.primary }}>
                  {selectedSubject} · {selectedTopicLabel}
                </p>
                <p className="t-badge" style={{ color: COLORS.secondary, marginTop: 2 }}>
                  {selectedCount} questions · +2 per correct, −0.5 per wrong
                </p>
              </div>
            </div>
          )}

          {isReady && selectedSubject !== 'Mixed' && (
            <div className="px-1">
              <RefreshStatus
                updatedAt={questionBankUpdatedAt}
                label={questionBankUpdatedAt ? 'Question pool saved today' : 'Question pool not saved yet'}
                isRefreshing={questionBankRefreshing}
                refreshText="Refresh questions"
                onRefresh={handleRefreshQuestionBank}
              />
            </div>
          )}

          {/* Start button */}
          <AppButton
            as="button"
            onClick={handleStartQuiz}
            disabled={!isReady}
            className={`start-quiz-button w-full py-4 flex items-center justify-center gap-2 ${
              isReady
                ? 'btn-breathe-orange active:scale-95 duration-100'
                : 'border cursor-not-allowed'
            }`}
            style={isReady ? {
              background: 'linear-gradient(90deg, #FF7A1A, #FF5A00)',
              boxShadow: '0 16px 36px rgba(255,106,0,0.30)',
              color: COLORS.primary,
            } : {
              background: COLORS.card,
              borderColor: COLORS.border,
              color: COLORS.disabled,
            }}
          >
            {startButtonText}
            {isReady && (
              <svg className="start-quiz-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </AppButton>

        </div>
      </div>

      {/* ─── Subject Bottom Sheet ──────────────────────────────────────────── */}
      {subjectSheetOpen && (
        <>
          <div
            className="sheet-overlay"
            onClick={() => setSubjectSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="sheet-panel" style={{ borderRadius: '24px 24px 0 0', overflow: 'hidden', background: COLORS.sheetBg }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.3)' }} />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-3">
              <h2 className="t-page-title font-display" style={{ color: COLORS.primary, fontSize: 20 }}>
                Choose Subject
              </h2>

              {/* Search bar */}
              <div className="relative mt-3">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: COLORS.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  ref={subjectSearchRef}
                  type="text"
                  placeholder="Search subject..."
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                  className="w-full rounded-xl pl-10 pr-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.primary,
                    fontSize: 15,
                    fontWeight: 500,
                    outline: 'none',
                  }}
                />
                {subjectSearch && (
                  <button
                    onClick={() => setSubjectSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: COLORS.muted }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Subject list — scrollable */}
            <div
              className="overflow-y-auto px-4 pb-8"
              style={{ maxHeight: '60vh', WebkitOverflowScrolling: 'touch' }}
            >
              {filteredSubjectSections.map(section => (
                section.subjects.length > 0 && (
                  <div key={section.label} className="mb-4">
                    <p className="t-section-label px-1 mb-2" style={{ color: COLORS.muted }}>
                      {section.label}
                    </p>
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                      {section.subjects.map((subj, idx) => {
                        const isSelected = selectedSubject === subj;
                        const isLast = idx === section.subjects.length - 1;
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => handleSubjectSelect(subj)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:opacity-70 transition-opacity"
                            style={{
                              background: isSelected ? 'rgba(20,184,166,0.10)' : 'rgba(255,255,255,0.03)',
                              borderBottom: isLast ? 'none' : `1px solid ${COLORS.border}`,
                            }}
                          >
                            <span style={{ fontSize: 22, lineHeight: 1, width: 28, textAlign: 'center', flexShrink: 0 }}>
                              {SUBJECT_ICON[subj] || '📖'}
                            </span>
                            <span style={{ flex: 1, fontSize: 15, fontWeight: isSelected ? 700 : 500, color: isSelected ? COLORS.selected : COLORS.primary, lineHeight: '22px' }}>
                              {subj}
                            </span>
                            {isSelected && (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: COLORS.selected, flexShrink: 0 }}>
                                <path d="M20 6 9 17l-5-5"/>
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
              {filteredSubjectSections.every(s => s.subjects.length === 0) && (
                <div className="text-center py-8">
                  <p style={{ color: COLORS.primary, fontSize: 15, fontWeight: 600 }}>No matching subject found</p>
                  <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Try a different keyword.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Topic Bottom Sheet ────────────────────────────────────────────── */}
      {topicSheetOpen && (
        <>
          <div
            className="sheet-overlay"
            onClick={() => setTopicSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="sheet-panel" style={{ borderRadius: '24px 24px 0 0', overflow: 'hidden', background: COLORS.sheetBg }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.3)' }} />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-3">
              <h2 className="t-page-title font-display" style={{ color: COLORS.primary, fontSize: 20 }}>
                Choose Topic
              </h2>
              {selectedSubject && (
                <p className="t-badge mt-1" style={{ color: COLORS.muted }}>
                  {selectedSubject}{allTopicsCount > 0 ? ` · ${allTopicsCount} questions` : ''}
                </p>
              )}

              {/* Search bar */}
              <div className="relative mt-3">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: COLORS.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  ref={topicSearchRef}
                  type="text"
                  placeholder={`Search topics in ${selectedSubject}...`}
                  value={topicSearch}
                  onChange={e => setTopicSearch(e.target.value)}
                  className="w-full rounded-xl pl-10 pr-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.primary,
                    fontSize: 15,
                    fontWeight: 500,
                    outline: 'none',
                  }}
                />
                {topicSearch && (
                  <button
                    onClick={() => setTopicSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: COLORS.muted }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Topic list — scrollable */}
            <div
              className="overflow-y-auto px-4 pb-8"
              style={{ maxHeight: '60vh', WebkitOverflowScrolling: 'touch' }}
            >

              {/* ── Full skeleton: loading and no cached topics yet ── */}
              {topicsLoading && topics.length === 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                  <div className="px-4 py-3.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.03)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: COLORS.muted, flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.muted }}>Loading topics...</span>
                  </div>
                  {[80, 120, 100, 90].map((w, i) => (
                    <div
                      key={i}
                      className="px-4 py-3.5 flex flex-col gap-2"
                      style={{ borderBottom: i < 3 ? `1px solid ${COLORS.border}` : 'none', background: 'rgba(255,255,255,0.02)' }}
                      aria-hidden="true"
                    >
                      <div className="skeleton h-4 rounded" style={{ width: `${w}px` }} />
                      <div className="skeleton h-3 rounded" style={{ width: '60px' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Stale-cache banner: loading but have cached topics to show ── */}
              {topicsLoading && topics.length > 0 && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
                  style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.20)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: COLORS.selected, flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.selected }}>
                    Showing saved topics · Updating...
                  </span>
                </div>
              )}

              {/* ── Topic rows (shown when we have topics, loading or not) ── */}
              {topics.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>

                {/* "All [Subject] Questions" — pinned first, never hidden by search */}
                {!topicSearch.trim() && (
                  <TopicRow
                    label={`All ${selectedSubject} Questions`}
                    count={allTopicsCount || null}
                    isSelected={selectedTopic === ALL_TOPICS}
                    isLast={false}
                    onClick={() => handleTopicSelect(ALL_TOPICS)}
                    bold
                  />
                )}

                {/* Specific topics */}
                {filteredTopics.length > 0
                  ? filteredTopics.map((t, idx) => (
                      <TopicRow
                        key={t.name}
                        label={t.name}
                        count={t.count ?? null}
                        isSelected={selectedTopic === t.name}
                        isLast={idx === filteredTopics.length - 1}
                        onClick={() => handleTopicSelect(t.name)}
                      />
                    ))
                  : topicSearch.trim() && (
                      <div className="text-center py-8">
                        <p style={{ color: COLORS.primary, fontSize: 15, fontWeight: 600 }}>No matching topic found</p>
                        <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Try a different keyword.</p>
                      </div>
                    )
                }
              </div>
              )}

            </div>
          </div>
        </>
      )}
    </>
  );
}
