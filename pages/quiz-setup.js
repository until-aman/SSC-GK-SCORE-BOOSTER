import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import Loader from '@/components/ui/Loader';
import { readCache, writeCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';

const SUBJECTS = [
  'Polity', 'Geography', 'Economics',
  'Ancient History', 'Medieval History', 'Modern History',
  'Physics', 'Chemistry', 'Biology', 'Current Affairs',
  'Static GK', 'Mixed',
];

const COLORS = {
  page: '#0F172A',
  card: '#1E293B',
  border: 'rgba(148,163,184,0.16)',
  selected: '#10B981',
  selectedGlow: 'rgba(16,185,129,0.16)',
  primary: '#F8FAFC',
  secondary: '#CBD5E1',
  muted: '#94A3B8',
  disabled: '#64748B',
};

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('userMode=guest'));
}

export default function QuizSetup() {
  const { status } = useSession();
  const router = useRouter();

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [selectedCount, setSelectedCount] = useState(10);
  const [focusedField, setFocusedField] = useState('');

  const isGuest = status === 'unauthenticated' && isGuestMode();
  const isLoggedIn = status === 'authenticated';
  const isReady = !!selectedSubject && !!selectedTopic;
  const startButtonText = isReady
    ? `Start ${selectedTopic} Quiz`
    : topicsLoading
      ? 'Loading topics...'
      : selectedSubject
        ? 'Choose a topic to continue'
        : 'Choose a subject to continue';

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
      fetchTopics(subject, router.query.collection || 'general');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  async function fetchTopics(subject, col = 'general') {
    setTopicsLoading(true);
    setTopics([]);
    setSelectedTopic('');

    // Check localStorage cache first (24h TTL — topic lists rarely change)
    const cacheKey = CACHE_KEYS.TOPICS(col, subject);
    const cached = readCache(cacheKey, CACHE_TTL.ONE_DAY);
    if (cached?.isFresh && cached.data?.[subject]) {
      const topicMap = cached.data[subject];
      setTopics(Object.entries(topicMap).map(([name, count]) => ({ name, count })));
      setTopicsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/topics?subject=${encodeURIComponent(subject)}&collection=${encodeURIComponent(col)}`);
      const data = await res.json();
      // data.topics is { [subject]: { topicName: count } }
      const topicMap = (data.topics && data.topics[subject]) || data[subject] || {};
      const parsed = Object.entries(topicMap).map(([name, count]) => ({ name, count }));
      setTopics(parsed);
      // Cache the topics object for this subject
      if (Object.keys(topicMap).length > 0) {
        writeCache(cacheKey, data.topics || { [subject]: topicMap });
      }
    } catch {
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }

  function handleSubjectChange(e) {
    const val = e.target.value;
    setSelectedSubject(val);
    setSelectedTopic('');
    setTopics([]);
    if (val) fetchTopics(val, collection);
  }

  function handleStartQuiz() {
    if (!isReady) return;
    const sessionId = crypto.randomUUID();
    const params = new URLSearchParams({
      subject: selectedSubject,
      topic: selectedTopic,
      count: selectedCount,
      sessionId,
    });
    if (collection !== 'general') params.set('collection', collection);
    router.push(`/quiz?${params.toString()}`);
  }

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
          <div>
            <h1 className="font-display font-black text-2xl" style={{ color: COLORS.primary }}>Set Up Your Quiz</h1>
            <p className="text-xs mt-0.5" style={{ color: COLORS.secondary }}>Choose questions, subject & topic</p>
          </div>
        </div>

        <div className="px-4 flex flex-col gap-4">

          {/* Question count */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: COLORS.muted }}>
              Number of Questions
            </p>
            <div className="flex gap-3">
              {[
                { count: 10, title: 'Quick Practice', duration: '~3 min', icon: '⚡' },
                { count: 25, title: 'Full Practice',  duration: '~8 min', icon: '🎯' },
              ].map(({ count, title, duration, icon }) => {
                const sel = selectedCount === count;
                return (
                  <button
                    key={count}
                    onClick={() => setSelectedCount(count)}
                    className={`question-mode-card flex-1 rounded-2xl p-4 text-left ${sel ? 'question-mode-card-selected' : ''}`}
                    style={{
                      background: COLORS.card,
                      border: sel ? `1.5px solid ${COLORS.selected}` : `1px solid ${COLORS.border}`,
                      boxShadow: sel
                        ? `0 0 0 1px ${COLORS.selectedGlow}, 0 12px 28px ${COLORS.selectedGlow}`
                        : 'none',
                    }}
                  >
                    <span className="text-xl" aria-hidden="true">{icon}</span>
                    <p className="font-display font-bold text-base mt-2 leading-snug" style={{ color: COLORS.primary }}>
                      {title}
                    </p>
                    <p className="font-display font-black text-2xl mt-1" style={{ color: COLORS.primary }}>
                      {count} Questions
                    </p>
                    <p className="text-xs font-semibold mt-1" style={{ color: COLORS.muted }}>
                      {duration}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: COLORS.muted }}>
              Subject
            </label>
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={handleSubjectChange}
                onFocus={() => setFocusedField('subject')}
                onBlur={() => setFocusedField('')}
                className="w-full rounded-2xl px-4 py-4 text-sm border focus:outline-none appearance-none"
                style={{
                  background: COLORS.card,
                  color: COLORS.primary,
                  borderColor: COLORS.border,
                  boxShadow: focusedField === 'subject' ? `0 0 0 3px ${COLORS.selectedGlow}` : 'none',
                }}
              >
                <option value="">— Choose a subject —</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: COLORS.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide mb-2 block" style={{ color: COLORS.muted }}>
              Topic
            </label>
            {topicsLoading ? (
              <div className="border rounded-2xl px-4 py-4" style={{ background: COLORS.card, borderColor: COLORS.border }}>
                <p className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                  Preparing {selectedSubject || 'subject'} topics...
                </p>
                <div className="mt-4 flex flex-wrap gap-2" aria-hidden="true">
                  <span className="skeleton h-7 w-24 rounded-full" />
                  <span className="skeleton h-7 w-32 rounded-full" />
                  <span className="skeleton h-7 w-28 rounded-full" />
                </div>
                <div className="mt-4 space-y-2" aria-hidden="true">
                  <div className="skeleton h-3 w-2/3 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                  onFocus={() => setFocusedField('topic')}
                  onBlur={() => setFocusedField('')}
                  disabled={!selectedSubject}
                  className={`w-full rounded-2xl px-4 py-4 text-sm border focus:outline-none appearance-none ${
                    !selectedSubject ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  style={{
                    background: COLORS.card,
                    color: selectedSubject ? COLORS.primary : COLORS.disabled,
                    borderColor: selectedTopic ? COLORS.selected : COLORS.border,
                    borderWidth: selectedTopic ? 1.5 : 1,
                    boxShadow: selectedTopic || focusedField === 'topic' ? `0 0 0 3px ${COLORS.selectedGlow}` : 'none',
                  }}
                >
                  <option value="">— Choose a topic —</option>
                  {topics.map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.count} Q)</option>
                  ))}
                </select>
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: COLORS.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            )}
            {selectedTopic && topics.length > 0 && (
              <p className="text-xs mt-1.5 ml-1" style={{ color: COLORS.muted }}>
                {topics.find(t => t.name === selectedTopic)?.count || 0} questions available
              </p>
            )}
          </div>

          {/* Info strip */}
          {isReady && (
            <div className="border rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in-down" style={{ background: COLORS.card, borderColor: COLORS.border }}>
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: COLORS.primary }}>{selectedSubject} · {selectedTopic}</p>
                <p className="text-xs" style={{ color: COLORS.secondary }}>{selectedCount} questions · +2 per correct, −0.5 per wrong</p>
              </div>
            </div>
          )}

          {/* Start button */}
          <button
            onClick={handleStartQuiz}
            disabled={!isReady}
            className={`start-quiz-button w-full py-4 rounded-2xl font-display font-bold text-base transition-all flex items-center justify-center gap-2 ${
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
          </button>

        </div>
      </div>

    </>
  );
}
