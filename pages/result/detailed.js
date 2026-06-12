import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getAIExplanation, getAITip } from '@/lib/data/aiData';

const OPTION_KEYS = { A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD' };

// ─── Display helper ───────────────────────────────────────────────────────────
const COLLECTION_DISPLAY_NAMES = { PYQ: 'SSC PYQ', Parmar: 'Parmar SSC' };
function getDisplaySubject(subject, collection) {
  if (!subject) return subject;
  if (subject === 'Mixed' && collection && collection !== 'general') {
    return COLLECTION_DISPLAY_NAMES[collection] || collection;
  }
  return subject;
}

export default function DetailedAnalysis() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const stored = sessionStorage.getItem('quizResult');
    if (!stored) { router.push('/'); return; }
    try {
      const parsed = JSON.parse(stored);
      setResult(parsed);
      const wrong = parsed.questions.filter(q => {
        const a = parsed.answers[q.id];
        return a && a !== 'SKIPPED' && a !== q.correctOption;
      }).length;
      const skipped = parsed.questions.filter(q => {
        const a = parsed.answers[q.id];
        return !a || a === 'SKIPPED';
      }).length;
      if (wrong > 0) setFilter('Wrong');
      else if (skipped > 0) setFilter('Skipped');
    } catch { router.push('/'); }
  }, [router]);

  if (!result) return null;

  const topicMistakeCounts = {};
  let totalSkipped = 0;
  result.questions.forEach(q => {
    const a = result.answers[q.id];
    if (!a || a === 'SKIPPED') { totalSkipped++; return; }
    if (a !== q.correctOption) {
      const key = q.topic || result.topic || '';
      topicMistakeCounts[key] = (topicMistakeCounts[key] || 0) + 1;
    }
  });
  const totalQ = result.questions.length;
  const correctCount = result.questions.filter(q => result.answers[q.id] === q.correctOption).length;
  const wrongCount = result.questions.filter(q => {
    const a = result.answers[q.id];
    return a && a !== 'SKIPPED' && a !== q.correctOption;
  }).length;

  return (
    <>
      <Head><title>Detailed Analysis — SSC GK Score Booster</title></Head>
      <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>

        {/* Sticky top bar: title + stats + filter tabs */}
        <div className="sticky top-0 z-10 backdrop-blur-md" style={{ background: 'rgba(248,250,252,0.94)', borderBottom: '1px solid var(--ssc-border-soft)' }}>
          <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
            <button
              onClick={() => router.push('/result')}
              className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-80 transition-opacity flex-shrink-0"
              style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: '0 4px 14px rgba(16,32,51,0.06)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="t-page-title font-display" style={{ color: 'var(--ssc-text-primary)' }}>Detailed Analysis</h1>
            </div>
          </div>
          <div className="flex gap-2 px-4 pt-1 pb-3.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {(() => {
              const savedIds = (() => { try { return JSON.parse(localStorage.getItem('ssc_saved_questions') || '[]').map(q => q.id); } catch { return []; } })();
              const savedCount = result.questions.filter(q => savedIds.includes(q.id)).length;
              const tabs = [
                { key: 'Wrong',   label: `Wrong ${wrongCount}`,       hide: false },
                { key: 'Skipped', label: `Skipped ${totalSkipped}`,   hide: false },
                { key: 'All',     label: `All ${totalQ}`,             hide: false },
                { key: 'Saved',   label: `Saved ${savedCount}`,       hide: false },
                { key: 'Correct', label: `Correct ${correctCount}`,   hide: correctCount === 0 },
              ];
              return tabs.filter(t => !t.hide).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: '5px 14px', borderRadius: '30px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: filter === key ? '700' : '500',
                    background: filter === key ? 'var(--ssc-teal-soft)' : 'var(--ssc-surface)',
                    color: filter === key ? 'var(--ssc-teal)' : 'var(--ssc-text-secondary)',
                    border: filter === key ? '1px solid rgba(14,165,164,0.24)' : '1px solid var(--ssc-border-soft)',
                    transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              ));
            })()}
          </div>
        </div>

        {/* Question cards */}
        <div className="px-4 pt-4 flex flex-col gap-4">
          {filter === 'All' && (
            <div style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', borderRadius: 20, padding: '14px 16px', boxShadow: 'var(--ssc-shadow-card)' }}>
              <p className="t-section-label" style={{ color: 'var(--ssc-text-secondary)', marginBottom: 8 }}>Review Summary</p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                <span className="t-card-subtitle" style={{ color: 'var(--ssc-danger)' }}><strong className="t-stat-sm font-display">{wrongCount}</strong> wrong</span>
                <span className="t-card-subtitle" style={{ color: 'var(--ssc-text-muted)' }}><strong className="t-stat-sm font-display">{totalSkipped}</strong> skipped</span>
                <span className="t-card-subtitle" style={{ color: 'var(--ssc-success)' }}><strong className="t-stat-sm font-display">{correctCount}</strong> correct</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', marginBottom: 10 }}>
                {wrongCount > 0 ? 'Best next step: review your wrong answers first.' : totalSkipped > 0 ? 'Best next step: go through the skipped questions.' : 'Great job — all correct!'}
              </p>
              {(wrongCount > 0 || totalSkipped > 0) && (
                <button
                  onClick={() => setFilter(wrongCount > 0 ? 'Wrong' : 'Skipped')}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--ssc-orange-deep)', background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.22)', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {wrongCount > 0 ? `Start with Wrong Questions →` : `Review Skipped Questions →`}
                </button>
              )}
            </div>
          )}
          {(() => {
            const savedIds = (() => { try { return JSON.parse(localStorage.getItem('ssc_saved_questions') || '[]').map(q => q.id); } catch { return []; } })();
            const statusRank = q => {
              const a = result.answers[q.id];
              if (a && a !== 'SKIPPED' && a !== q.correctOption) return 0;
              if (!a || a === 'SKIPPED') return 1;
              return 2;
            };
            let filteredQuestions = result.questions.filter(q => {
              const userAnswer = result.answers[q.id];
              if (filter === 'All') return true;
              if (filter === 'Correct') return userAnswer === q.correctOption;
              if (filter === 'Wrong') return userAnswer && userAnswer !== 'SKIPPED' && userAnswer !== q.correctOption;
              if (filter === 'Skipped') return !userAnswer || userAnswer === 'SKIPPED';
              if (filter === 'Saved') return savedIds.includes(q.id);
              return true;
            });
            if (filter === 'All') filteredQuestions = [...filteredQuestions].sort((a, b) => statusRank(a) - statusRank(b));
            return (
              <>
                {filteredQuestions.map((q, idx) => (
                  <QuestionReviewCard
                    key={q.id}
                    question={q}
                    index={idx}
                    userAnswer={result.answers[q.id]}
                    subject={getDisplaySubject(result.subject, result.collection)}
                    topic={result.topic}
                    topicMistakeCount={topicMistakeCounts[q.topic || result.topic || ''] || 0}
                    totalSkipped={totalSkipped}
                  />
                ))}
                {filteredQuestions.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '48px 20px',
                    color: 'var(--ssc-text-muted)',
                    fontSize: '14px',
                  }}>
                    No {filter.toLowerCase()} questions in this quiz.
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Slim back link at bottom of list */}
        <div className="px-4 mt-6 pb-2 text-center">
          <button onClick={() => router.push('/result')} style={{ fontSize: 12, color: 'var(--ssc-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Back to Results
          </button>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      {(wrongCount > 0 || totalSkipped > 0) && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(14px)',
          borderTop: '1px solid var(--ssc-border-soft)',
          padding: '10px 16px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', margin: 0, lineHeight: 1.4 }}>
            {wrongCount > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>{wrongCount} wrong</span>}
            {wrongCount > 0 && totalSkipped > 0 && <span> · </span>}
            {totalSkipped > 0 && <span style={{ color: 'var(--ssc-text-muted)' }}>{totalSkipped} skipped</span>}
          </p>
          <button
            onClick={() => {
              setFilter(wrongCount > 0 ? 'Wrong' : 'Skipped');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))', color: 'white',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(255,90,0,0.22)',
            }}
          >
            {wrongCount > 0 ? 'Review Wrong Questions →' : 'Review Skipped Questions →'}
          </button>
        </div>
      )}
    </>
  );
}

function getQuestionReviewTip({ status, selectedOption, correctOption, hasExplanation, topicMistakeCount, totalSkipped }) {
  if (status === 'skipped') {
    if (totalSkipped >= 10) return 'You skipped many questions in this quiz. Revise the basics first, then retry the skipped questions.';
    return 'You skipped this question. Read the correct answer once and save it for revision if the fact feels new.';
  }
  if (status === 'incorrect') {
    if (hasExplanation) return 'Read the explanation once, then try to answer this again without looking at the options.';
    if (topicMistakeCount >= 3) return 'You made multiple mistakes from this topic. Revise the basics before attempting more random questions.';
    return `You selected ${selectedOption}, but the correct answer is ${correctOption}. Revise this fact once and retry it later.`;
  }
  return 'Review this question once before moving ahead.';
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'var(--ssc-teal)' : 'none'} stroke={filled ? 'var(--ssc-teal)' : 'var(--ssc-text-primary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  );
}

function QuestionReviewCard({ question, index, userAnswer, subject, topic, topicMistakeCount, totalSkipped }) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [isUnderstood, setIsUnderstood] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const isCorrect = userAnswer === question.correctOption;
  const isSkipped = !userAnswer || userAnswer === 'SKIPPED';

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ssc_saved_questions') || '[]');
      setIsSaved(saved.some(q => q.id === question.id));
      const understood = JSON.parse(localStorage.getItem('ssc_understood_questions') || '[]');
      setIsUnderstood(understood.includes(question.id));
    } catch {}
  }, [question.id]);

  async function handleExplainMore() {
    if (aiLoading || aiInsight) return;
    setAiLoading(true);
    try {
      // Step 13: cached + deduped helpers. Tip ONLY for skipped, explain ONLY
      // for wrong (unchanged applicability). Sheet explanation is the fallback.
      const { text } = isSkipped
        ? await getAITip({
            question: question.question,
            correctOption: question.correctOption,
            correctOptionText: question[OPTION_KEYS[question.correctOption]],
            sheetExplanation: question.explanation,
            subject,
            topic,
          })
        : await getAIExplanation({
            question: question.question,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            correctOption: question.correctOption,
            userOption: userAnswer,
            sheetExplanation: question.explanation,
            subject,
            topic,
          });
      if (text) setAiInsight(text);
    } catch {}
    setAiLoading(false);
  }

  function toggleSave() {
    try {
      const saved = JSON.parse(localStorage.getItem('ssc_saved_questions') || '[]');
      const updated = isSaved
        ? saved.filter(q => q.id !== question.id)
        : [...saved, { ...question, subject, topic }];
      localStorage.setItem('ssc_saved_questions', JSON.stringify(updated));
      setIsSaved(!isSaved);
    } catch {}
  }

  function toggleUnderstood() {
    try {
      const understood = JSON.parse(localStorage.getItem('ssc_understood_questions') || '[]');
      const updated = isUnderstood
        ? understood.filter(id => id !== question.id)
        : [...understood, question.id];
      localStorage.setItem('ssc_understood_questions', JSON.stringify(updated));
      setIsUnderstood(!isUnderstood);
    } catch {}
  }

  const [expanded, setExpanded] = useState(!isCorrect && !isSkipped);

  const correctAnswerText = `${question.correctOption}. ${question[OPTION_KEYS[question.correctOption]]}`;
  const statusLabel = isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect';
  const badgeStyle = isCorrect
    ? { background: 'var(--ssc-success-soft)', color: 'var(--ssc-success)', border: '1px solid rgba(18,184,134,0.18)' }
    : isSkipped
    ? { background: 'var(--ssc-warning-soft)', color: 'var(--ssc-warning)', border: '1px solid rgba(245,158,11,0.18)' }
    : { background: 'var(--ssc-danger-soft)', color: 'var(--ssc-danger)', border: '1px solid rgba(239,68,68,0.18)' };
  const cardBg = { background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' };
  const collapseBtn = { fontSize: 11, color: 'var(--ssc-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' };
  const leftBorder = isCorrect
    ? '3px solid rgba(18,184,134,0.44)'
    : isSkipped
    ? '3px solid rgba(245,158,11,0.44)'
    : '3px solid rgba(239,68,68,0.44)';

  // ── COLLAPSED (all types) ────────────────────────────────────────
  if (!expanded) {
    return (
      <div style={{ ...cardBg, borderRadius: 14, padding: '11px 14px', borderLeft: leftBorder }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ssc-text-secondary)', letterSpacing: '0.04em' }}>Q{index + 1}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>{statusLabel}</span>
        </div>
        {(subject || topic) && (
          <p className="t-badge" style={{ color: 'var(--ssc-text-muted)', margin: '0 0 6px' }}>{[subject, topic].filter(Boolean).join(' · ')}</p>
        )}
        <p style={{ fontSize: 13, color: isCorrect ? 'var(--ssc-text-secondary)' : 'var(--ssc-text-primary)', fontWeight: isCorrect ? 400 : 500, lineHeight: 1.5, marginBottom: !isCorrect ? 7 : 9 }}>
          {question.question}
        </p>
        {!isCorrect && (
          <p style={{ fontSize: 12, color: 'var(--ssc-success)', marginBottom: 9 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ssc-success)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 5 }}>Correct</span>
            {correctAnswerText}
          </p>
        )}
        <button
          onClick={() => setExpanded(true)}
          style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 9, border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', color: 'var(--ssc-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Review →
        </button>
      </div>
    );
  }

  // ── CORRECT — expanded ───────────────────────────────────────────
  if (isCorrect) {
    return (
      <div style={{ ...cardBg, borderRadius: 18, padding: '14px 16px', borderLeft: leftBorder }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ssc-text-secondary)', letterSpacing: '0.04em' }}>Q{index + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>Correct</span>
              <button onClick={() => setExpanded(false)} style={collapseBtn}>▲</button>
            </div>
          </div>
          {(subject || topic) && <p style={{ fontSize: 11, color: 'var(--ssc-text-muted)', margin: 0 }}>{[subject, topic].filter(Boolean).join(' · ')}</p>}
        </div>
        <p style={{ fontSize: 13, color: 'var(--ssc-text-primary)', fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>{question.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['A', 'B', 'C', 'D'].map(opt => {
            const isThisCorrect = question.correctOption === opt;
            return (
              <div key={opt} style={{
                fontSize: 12, padding: '10px 14px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                border: isThisCorrect ? '1px solid rgba(18,184,134,0.34)' : '1px solid var(--ssc-border-soft)',
                background: isThisCorrect ? 'var(--ssc-success-soft)' : 'var(--ssc-surface-soft)',
                color: isThisCorrect ? 'var(--ssc-success)' : 'var(--ssc-text-secondary)', fontWeight: isThisCorrect ? 600 : 400,
              }}>
                <span style={{ flex: 1 }}>{opt}. {question[OPTION_KEYS[opt]]}</span>
                {isThisCorrect && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ssc-success)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Correct</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── SKIPPED — expanded ───────────────────────────────────────────
  if (isSkipped) {
    return (
      <div style={{ ...cardBg, borderRadius: 18, padding: '14px 16px', borderLeft: leftBorder }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ssc-text-secondary)', letterSpacing: '0.04em' }}>Q{index + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>Skipped</span>
              <button onClick={() => setExpanded(false)} style={collapseBtn}>▲</button>
            </div>
          </div>
          {(subject || topic) && <p style={{ fontSize: 11, color: 'var(--ssc-text-muted)', margin: 0 }}>{[subject, topic].filter(Boolean).join(' · ')}</p>}
        </div>
        <p style={{ fontSize: 13, color: 'var(--ssc-text-primary)', fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>{question.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {['A', 'B', 'C', 'D'].map(opt => {
            const isThisCorrect = question.correctOption === opt;
            return (
              <div key={opt} style={{
                fontSize: 12, padding: '10px 14px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: isThisCorrect ? '1px solid rgba(18,184,134,0.30)' : '1px solid var(--ssc-border-soft)',
                background: isThisCorrect ? 'var(--ssc-success-soft)' : 'var(--ssc-surface-soft)',
                color: isThisCorrect ? 'var(--ssc-success)' : 'var(--ssc-text-secondary)', fontWeight: isThisCorrect ? 600 : 400,
              }}>
                <span>{opt}. {question[OPTION_KEYS[opt]]}</span>
                {isThisCorrect && <span style={{ color: 'var(--ssc-success)' }}>✓</span>}
              </div>
            );
          })}
        </div>
        {question.explanation ? (
          <div style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--ssc-info-soft)', border: '1px solid rgba(37,99,235,0.14)', borderRadius: 12 }}>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 800, color: 'var(--ssc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Explanation</span>
            <p style={{ fontSize: 12, color: 'var(--ssc-text-muted)', lineHeight: 1.6, margin: '0 0 8px' }}>{question.explanation}</p>
            <p style={{ fontSize: 11, color: 'var(--ssc-text-secondary)', margin: 0 }}>
              <span style={{ fontWeight: 700 }}>Tip:</span>{' '}
              {aiInsight || 'Try recalling this fact tomorrow without looking at the options.'}
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--ssc-warning-soft)', border: '1px solid rgba(245,158,11,0.16)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.6-1.4 4.9-3.5 6.2-.5.3-.5.8-.5 1.3V17H9v-.5c0-.5 0-1-.5-1.3A7 7 0 0112 2z"/>
              </svg>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ssc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Review Tip</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {aiInsight || getQuestionReviewTip({ status: 'skipped', selectedOption: null, correctOption: question.correctOption, hasExplanation: false, topicMistakeCount, totalSkipped })}
            </p>
            {!aiInsight && (
              <button onClick={handleExplainMore} disabled={aiLoading} style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: aiLoading ? 'var(--ssc-disabled-text)' : 'var(--ssc-teal)', background: 'none', border: 'none', cursor: aiLoading ? 'default' : 'pointer', padding: 0, fontFamily: 'inherit' }}>
                {aiLoading ? 'Loading…' : 'Need more help? Explain this →'}
              </button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={toggleSave} style={isSaved
            ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(20,184,166,0.35)', background: 'rgba(20,184,166,0.10)', color: '#14B8A6', cursor: 'pointer', fontFamily: 'inherit' }
            : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', color: 'var(--ssc-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {isSaved ? '✓ Saved' : 'Save for Revision'}
          </button>
          <button onClick={toggleUnderstood} style={isUnderstood
            ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.10)', color: '#A5B4FC', cursor: 'pointer', fontFamily: 'inherit' }
            : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', color: 'var(--ssc-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {isUnderstood ? '✓ Understood' : 'Mark as Understood'}
          </button>
        </div>
      </div>
    );
  }

  // ── WRONG — expanded ─────────────────────────────────────────────
  return (
    <div style={{ ...cardBg, borderRadius: 22, padding: '16px 18px', borderLeft: leftBorder }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ssc-text-secondary)', letterSpacing: '0.04em' }}>Q{index + 1}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>Incorrect</span>
            <button onClick={() => setExpanded(false)} style={collapseBtn}>▲</button>
            <button onClick={toggleSave} className="w-7 h-7 flex items-center justify-center rounded-full active:scale-90 transition-transform" aria-label={isSaved ? 'Unsave' : 'Save'}>
              <BookmarkIcon filled={isSaved} />
            </button>
          </div>
        </div>
        {(subject || topic) && <p style={{ fontSize: 11, color: 'var(--ssc-text-muted)', margin: 0 }}>{[subject, topic].filter(Boolean).join(' · ')}</p>}
      </div>
      <p className="font-semibold text-sm leading-snug mb-3 whitespace-pre-line" style={{ color: 'var(--ssc-text-primary)' }}>{question.question}</p>
      <div className="flex flex-col gap-2 mb-3">
        {['A', 'B', 'C', 'D'].map(opt => {
          const isThisUser    = userAnswer === opt;
          const isThisCorrect = question.correctOption === opt;
          const optionStyle = {
            fontSize: 12,
            padding: '12px 16px',
            borderRadius: 12,
            border: isThisCorrect
              ? '1px solid rgba(18,184,134,0.34)'
              : isThisUser
              ? '1px solid rgba(239,68,68,0.34)'
              : '1px solid var(--ssc-border-soft)',
            background: isThisCorrect
              ? 'var(--ssc-success-soft)'
              : isThisUser
              ? 'var(--ssc-danger-soft)'
              : 'var(--ssc-surface-soft)',
            color: isThisCorrect
              ? 'var(--ssc-success)'
              : isThisUser
              ? 'var(--ssc-danger)'
              : 'var(--ssc-text-secondary)',
            fontWeight: isThisCorrect || isThisUser ? 700 : 400,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          };
          return (
            <div key={opt} style={optionStyle}>
              <span className="flex-1">{opt}. {question[OPTION_KEYS[opt]]}</span>
              {isThisCorrect && <span className="text-[10px] font-black uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--ssc-success)' }}>Correct</span>}
              {isThisUser && !isThisCorrect && <span className="text-[10px] font-black uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--ssc-danger)' }}>Your answer</span>}
            </div>
          );
        })}
      </div>
      {question.explanation ? (
        <div className="mb-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--ssc-info-soft)', border: '1px solid rgba(37,99,235,0.14)' }}>
          <span className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--ssc-info)' }}>Explanation</span>
          <p className="text-[12px] leading-relaxed" style={{ marginBottom: 8, color: 'var(--ssc-text-secondary)' }}>{question.explanation}</p>
          <p style={{ fontSize: 11, color: 'var(--ssc-text-secondary)', margin: 0 }}>
            <span style={{ fontWeight: 700 }}>Tip:</span>{' '}
            {aiInsight || 'Read this once, then try recalling the answer without looking at the options.'}
          </p>
        </div>
      ) : (
        <div className="mb-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--ssc-warning-soft)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(251,146,60,0.7))' }}>
              <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.6-1.4 4.9-3.5 6.2-.5.3-.5.8-.5 1.3V17H9v-.5c0-.5 0-1-.5-1.3A7 7 0 0112 2z"/>
            </svg>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--ssc-warning)' }}>Review Tip</p>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ssc-text-secondary)' }}>
            {aiInsight || getQuestionReviewTip({
              status: 'incorrect',
              selectedOption: userAnswer,
              correctOption: question.correctOption,
              hasExplanation: false,
              topicMistakeCount,
              totalSkipped,
            })}
          </p>
          {!aiInsight && (
            <button
              onClick={handleExplainMore}
              disabled={aiLoading}
              className="mt-2 text-[11px] font-semibold active:scale-95 transition-transform"
              style={{ color: aiLoading ? 'rgba(251,146,60,0.4)' : '#fb923c', background: 'none', border: 'none', cursor: aiLoading ? 'default' : 'pointer', padding: 0 }}
            >
              {aiLoading ? 'Loading…' : 'Need more help? Explain this →'}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={toggleSave} style={isSaved
          ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(20,184,166,0.35)', background: 'rgba(20,184,166,0.10)', color: '#14B8A6', cursor: 'pointer', fontFamily: 'inherit' }
          : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', color: 'var(--ssc-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {isSaved ? '✓ Saved' : 'Save for Revision'}
        </button>
        <button onClick={toggleUnderstood} style={isUnderstood
          ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.10)', color: '#A5B4FC', cursor: 'pointer', fontFamily: 'inherit' }
          : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', color: 'var(--ssc-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {isUnderstood ? '✓ Understood' : 'Mark as Understood'}
        </button>
      </div>
    </div>
  );
}
