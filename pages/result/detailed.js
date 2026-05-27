import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { fetchAIExplain, fetchAITip } from '@/lib/fetchAI';

const OPTION_KEYS = { A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD' };

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
      <div className="min-h-screen bg-[#0f172a] pb-28">

        {/* Sticky top bar: title + stats + filter tabs */}
        <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800">
          <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
            <button
              onClick={() => router.push('/result')}
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center active:bg-slate-700 transition-colors flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-black text-[19px] text-white leading-none">Detailed Analysis</h1>
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
                    padding: '5px 14px', borderRadius: '30px', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: filter === key ? '700' : '400',
                    background: filter === key ? '#ffffff' : 'rgba(255,255,255,0.08)',
                    color: filter === key ? '#1a1a2a' : 'rgba(255,255,255,0.5)',
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
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Review Summary</p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#fca5a5' }}><strong style={{ fontSize: 16 }}>{wrongCount}</strong> wrong</span>
                <span style={{ fontSize: 13, color: '#94a3b8' }}><strong style={{ fontSize: 16 }}>{totalSkipped}</strong> skipped</span>
                <span style={{ fontSize: 13, color: '#6ee7b7' }}><strong style={{ fontSize: 16 }}>{correctCount}</strong> correct</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 10 }}>
                {wrongCount > 0 ? 'Best next step: review your wrong answers first.' : totalSkipped > 0 ? 'Best next step: go through the skipped questions.' : 'Great job — all correct!'}
              </p>
              {(wrongCount > 0 || totalSkipped > 0) && (
                <button
                  onClick={() => setFilter(wrongCount > 0 ? 'Wrong' : 'Skipped')}
                  style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.20)', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
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
                    subject={result.subject}
                    topic={result.topic}
                    topicMistakeCount={topicMistakeCounts[q.topic || result.topic || ''] || 0}
                    totalSkipped={totalSkipped}
                  />
                ))}
                {filteredQuestions.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '48px 20px',
                    color: 'rgba(255,255,255,0.35)',
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
          <button onClick={() => router.push('/result')} style={{ fontSize: 12, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Back to Results
          </button>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      {(wrongCount > 0 || totalSkipped > 0) && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '10px 16px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            {wrongCount > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>{wrongCount} wrong</span>}
            {wrongCount > 0 && totalSkipped > 0 && <span> · </span>}
            {totalSkipped > 0 && <span style={{ color: '#94a3b8' }}>{totalSkipped} skipped</span>}
          </p>
          <button
            onClick={() => {
              setFilter(wrongCount > 0 ? 'Wrong' : 'Skipped');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, #FF7A1A, #FF5A00)', color: 'white',
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#10b981' : 'none'} stroke={filled ? '#10b981' : '#475569'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      const { text } = isSkipped
        ? await fetchAITip({
            question: question.question,
            correctOption: question.correctOption,
            correctOptionText: question[OPTION_KEYS[question.correctOption]],
            sheetExplanation: question.explanation,
            subject,
            topic,
          })
        : await fetchAIExplain({
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
    ? { background: 'rgba(16,185,129,0.13)', color: '#34d399' }
    : isSkipped
    ? { background: 'rgba(100,116,139,0.14)', color: '#94a3b8' }
    : { background: 'rgba(239,68,68,0.13)', color: '#f87171' };
  const cardBg = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' };
  const collapseBtn = { fontSize: 11, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' };
  const leftBorder = isCorrect
    ? '3px solid rgba(16,185,129,0.30)'
    : isSkipped
    ? '3px solid rgba(100,116,139,0.28)'
    : '3px solid rgba(239,68,68,0.32)';

  // ── COLLAPSED (all types) ────────────────────────────────────────
  if (!expanded) {
    return (
      <div style={{ ...cardBg, borderRadius: 14, padding: '11px 14px', borderLeft: leftBorder }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>Q{index + 1}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>{statusLabel}</span>
        </div>
        {(subject || topic) && (
          <p style={{ fontSize: 11, color: '#475569', margin: '0 0 6px' }}>{[subject, topic].filter(Boolean).join(' · ')}</p>
        )}
        <p style={{ fontSize: 13, color: isCorrect ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.75)', fontWeight: isCorrect ? 400 : 500, lineHeight: 1.5, marginBottom: !isCorrect ? 7 : 9 }}>
          {question.question}
        </p>
        {!isCorrect && (
          <p style={{ fontSize: 12, color: '#6ee7b7', marginBottom: 9 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 5 }}>Correct</span>
            {correctAnswerText}
          </p>
        )}
        <button
          onClick={() => setExpanded(true)}
          style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 9, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
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
            <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>Q{index + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>Correct</span>
              <button onClick={() => setExpanded(false)} style={collapseBtn}>▲</button>
            </div>
          </div>
          {(subject || topic) && <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{[subject, topic].filter(Boolean).join(' · ')}</p>}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>{question.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['A', 'B', 'C', 'D'].map(opt => {
            const isThisCorrect = question.correctOption === opt;
            return (
              <div key={opt} style={{
                fontSize: 12, padding: '10px 14px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                border: isThisCorrect ? '1px solid rgba(16,185,129,0.40)' : '1px solid rgba(148,163,184,0.08)',
                background: isThisCorrect ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.02)',
                color: isThisCorrect ? '#6ee7b7' : '#475569', fontWeight: isThisCorrect ? 600 : 400,
              }}>
                <span style={{ flex: 1 }}>{opt}. {question[OPTION_KEYS[opt]]}</span>
                {isThisCorrect && <span style={{ fontSize: 10, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Correct</span>}
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
            <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>Q{index + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>Skipped</span>
              <button onClick={() => setExpanded(false)} style={collapseBtn}>▲</button>
            </div>
          </div>
          {(subject || topic) && <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{[subject, topic].filter(Boolean).join(' · ')}</p>}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>{question.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {['A', 'B', 'C', 'D'].map(opt => {
            const isThisCorrect = question.correctOption === opt;
            return (
              <div key={opt} style={{
                fontSize: 12, padding: '10px 14px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: isThisCorrect ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(148,163,184,0.08)',
                background: isThisCorrect ? 'rgba(16,185,129,0.08)' : 'transparent',
                color: isThisCorrect ? '#6ee7b7' : '#475569', fontWeight: isThisCorrect ? 600 : 400,
              }}>
                <span>{opt}. {question[OPTION_KEYS[opt]]}</span>
                {isThisCorrect && <span style={{ color: '#34d399' }}>✓</span>}
              </div>
            );
          })}
        </div>
        {question.explanation ? (
          <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.10)', borderRadius: 12 }}>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Explanation</span>
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 8px' }}>{question.explanation}</p>
            <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', margin: 0 }}>
              <span style={{ fontWeight: 700 }}>Tip:</span>{' '}
              {aiInsight || 'Try recalling this fact tomorrow without looking at the options.'}
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.10)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.6-1.4 4.9-3.5 6.2-.5.3-.5.8-.5 1.3V17H9v-.5c0-.5 0-1-.5-1.3A7 7 0 0112 2z"/>
              </svg>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Review Tip</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.8)', lineHeight: 1.6, margin: 0 }}>
              {aiInsight || getQuestionReviewTip({ status: 'skipped', selectedOption: null, correctOption: question.correctOption, hasExplanation: false, topicMistakeCount, totalSkipped })}
            </p>
            {!aiInsight && (
              <button onClick={handleExplainMore} disabled={aiLoading} style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: aiLoading ? 'rgba(148,163,184,0.4)' : '#94a3b8', background: 'none', border: 'none', cursor: aiLoading ? 'default' : 'pointer', padding: 0, fontFamily: 'inherit' }}>
                {aiLoading ? 'Loading…' : 'Need more help? Explain this →'}
              </button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={toggleSave} style={isSaved
            ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.10)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit' }
            : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
            {isSaved ? '✓ Saved' : 'Save for Revision'}
          </button>
          <button onClick={toggleUnderstood} style={isUnderstood
            ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.10)', color: '#A5B4FC', cursor: 'pointer', fontFamily: 'inherit' }
            : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
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
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>Q{index + 1}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...badgeStyle }}>Incorrect</span>
            <button onClick={() => setExpanded(false)} style={collapseBtn}>▲</button>
            <button onClick={toggleSave} className="w-7 h-7 flex items-center justify-center rounded-full active:scale-90 transition-transform" aria-label={isSaved ? 'Unsave' : 'Save'}>
              <BookmarkIcon filled={isSaved} />
            </button>
          </div>
        </div>
        {(subject || topic) && <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{[subject, topic].filter(Boolean).join(' · ')}</p>}
      </div>
      <p className="text-white font-semibold text-sm leading-snug mb-3 whitespace-pre-line">{question.question}</p>
      <div className="flex flex-col gap-2 mb-3">
        {['A', 'B', 'C', 'D'].map(opt => {
          const isThisUser    = userAnswer === opt;
          const isThisCorrect = question.correctOption === opt;
          let cls = 'text-[12px] px-4 py-3 rounded-xl border flex justify-between items-center gap-2';
          if (isThisCorrect)                     cls += ' bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold';
          else if (isThisUser && !isThisCorrect) cls += ' bg-red-500/15 border-red-500/40 text-red-300 font-bold';
          else                                   cls += ' bg-slate-900/40 border-slate-700/40 text-slate-500';
          return (
            <div key={opt} className={cls}>
              <span className="flex-1">{opt}. {question[OPTION_KEYS[opt]]}</span>
              {isThisCorrect && <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wide flex-shrink-0">Correct</span>}
              {isThisUser && !isThisCorrect && <span className="text-[10px] font-black text-red-400 uppercase tracking-wide flex-shrink-0">Your answer</span>}
            </div>
          );
        })}
      </div>
      {question.explanation ? (
        <div className="mb-3 px-4 py-3 bg-slate-900/60 border border-slate-700/40 rounded-2xl">
          <span className="block text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1.5">Explanation</span>
          <p className="text-[12px] text-slate-400 leading-relaxed" style={{ marginBottom: 8 }}>{question.explanation}</p>
          <p style={{ fontSize: 11, color: 'rgba(251,146,60,0.5)', margin: 0 }}>
            <span style={{ fontWeight: 700 }}>Tip:</span>{' '}
            {aiInsight || 'Read this once, then try recalling the answer without looking at the options.'}
          </p>
        </div>
      ) : (
        <div className="mb-3 px-4 py-3 bg-orange-500/8 border border-orange-500/20 rounded-2xl">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(251,146,60,0.7))' }}>
              <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.6-1.4 4.9-3.5 6.2-.5.3-.5.8-.5 1.3V17H9v-.5c0-.5 0-1-.5-1.3A7 7 0 0112 2z"/>
            </svg>
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Review Tip</p>
          </div>
          <p className="text-[12px] text-orange-200/80 leading-relaxed">
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
          ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.10)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit' }
          : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
          {isSaved ? '✓ Saved' : 'Save for Revision'}
        </button>
        <button onClick={toggleUnderstood} style={isUnderstood
          ? { fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.10)', color: '#A5B4FC', cursor: 'pointer', fontFamily: 'inherit' }
          : { fontSize: 11, fontWeight: 600, padding: '5px 13px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
          {isUnderstood ? '✓ Understood' : 'Mark as Understood'}
        </button>
      </div>
    </div>
  );
}
