import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getHistoryQuestions, normalizeHistoryQuery } from '@/lib/data/historyClientData';
import { toggleSavedQuestion } from '@/lib/data/savedData';

const RepeatedMistakesIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
  </svg>
);

const TONES = {
  green: ['#12B886', 'var(--ssc-success-soft)'],
  amber: ['#F59E0B', 'var(--ssc-warning-soft)'],
  red: ['#EF4444', 'var(--ssc-danger-soft)'],
  blue: ['#2563EB', 'var(--ssc-info-soft)'],
};

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'var(--ssc-teal)' : 'none'} stroke={filled ? 'var(--ssc-teal)' : 'var(--ssc-text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

function optionText(question, option) {
  return question[`option${String(option || '').toUpperCase()}`] || '';
}

function formatDate(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recently';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function byCountThenName(a, b) {
  return b.count - a.count || a.name.localeCompare(b.name);
}

function buildCountOptions(items, keyName) {
  const map = new Map();
  items.forEach(item => {
    const name = String(item[keyName] || '').trim();
    if (!name) return;
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort(byCountThenName);
}

function EmptyPanel({ title, body, action, onClick }) {
  return (
    <section className="history-card text-center">
      <p className="font-display font-black text-[var(--ssc-text-primary)]">{title}</p>
      <p className="mt-1 mb-4 text-sm text-[var(--ssc-text-secondary)]">{body}</p>
      {action ? <button type="button" className="primary-btn" onClick={onClick}>{action}</button> : null}
    </section>
  );
}

function ChevronSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function QuestionCard({ item, isOpen, onToggleOpen, onPracticeOne, onToggleSave }) {
  const correctCount = Number(item.correctCount) || 0;
  const wrongCount = Number(item.wrongCount) || 0;
  const skippedCount = Number(item.skippedCount) || 0;
  const totalAttempts = correctCount + wrongCount + skippedCount;
  const correctPct = totalAttempts > 0 ? Math.round(correctCount / totalAttempts * 100) : null;
  const lastPracticed = formatDate(item.lastAttemptedAt);
  const lastAnswerText = item.lastUserAnswer ? optionText(item, item.lastUserAnswer) : '';
  const correctAnswerText = item.correctOption ? optionText(item, item.correctOption) : '';
  const lastAnswerTone = !item.lastUserAnswer ? 'skipped' : item.lastUserAnswer === item.correctOption ? 'correct' : 'wrong';

  return (
    <article className="rm-card">
      <div className="rm-header">
        <div className="rm-tags">
          {item.subject && <span className="rm-subject-tag">{item.subject}</span>}
          {item.topic && <span className="rm-topic-tag">{item.topic}</span>}
        </div>
        {wrongCount > 0 && (
          <span className="rm-repeat-pill">{wrongCount} {wrongCount === 1 ? 'time' : 'times'}</span>
        )}
      </div>

      <p className="rm-question-text">{item.questionPreview || item.question}</p>

      <div className="rm-footer">
        <div>
          <span className="rm-meta">Last Practiced: {lastPracticed}</span>
          {correctPct !== null && (
            <span className="rm-correct-label"> &middot; Correct: {correctPct}%</span>
          )}
        </div>
        <button
          type="button"
          className={`save-icon-btn ${item.isSaved ? 'saved' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleSave(item); }}
          aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'}
        >
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>

      {correctPct !== null && (
        <div className="sq-progress-track" style={{ marginTop: 8 }}>
          <div className="sq-progress-fill" style={{
            width: `${correctPct}%`,
            background: correctPct >= 50 ? 'var(--ssc-success)' : 'var(--ssc-danger)',
          }} />
        </div>
      )}

      {isOpen && (
        <div className="question-expanded">
          <div className="expanded-block">
            <p className="expanded-label">Full Question</p>
            <p className="expanded-question font-display">{item.question || item.questionPreview}</p>
          </div>
          <div className="answer-detail-grid">
            <div className={`answer-detail ${lastAnswerTone}`}>
              <span>Your Last Answer</span>
              <b>{lastAnswerText || 'Skipped'}</b>
            </div>
            <div className="answer-detail correct">
              <span>Correct Answer</span>
              <b>{correctAnswerText || item.correctOption || 'Not available'}</b>
            </div>
          </div>
          <p className="expanded-attempt">Wrong {wrongCount}x &middot; Skipped {skippedCount}x</p>
          <div className="divider" />
          <p className="expanded-label">Explanation</p>
          {item.explanation
            ? <p className="text-sm leading-relaxed text-[var(--ssc-text-secondary)]">{item.explanation}</p>
            : <p className="text-sm text-[var(--ssc-text-muted)]">No official explanation available.</p>
          }
        </div>
      )}

      <div className="question-actions">
        <button type="button" className="primary-btn" onClick={() => onPracticeOne(item)}>Practice Again</button>
        <button type="button" className="secondary-btn" onClick={onToggleOpen}>{isOpen ? 'Close' : 'Open'}</button>
        <div />
      </div>
    </article>
  );
}

export default function RepeatedMistakesPage() {
  const { data: session } = useSession();
  const cacheScope = getUserCacheScope(session);
  const router = useRouter();
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [questionSubject, setQuestionSubject] = useState('');
  const [questionTopic, setQuestionTopic] = useState('');
  const [expandedQuestionId, setExpandedQuestionId] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadRepeatedMistakes() {
      setLoading(true);
      setError('');
      try {
        const allQuestions = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const query = normalizeHistoryQuery({
            answerStatus: 'wrong_skipped',
            questionHistory: 'repeated',
            limit: 50,
            page,
          });
          const res = await getHistoryQuestions({ scope: cacheScope, query });
          const json = res?.data;
          if (!json?.success) {
            throw new Error(json?.error || 'Failed to load repeated mistakes');
          }

          allQuestions.push(...(json.data?.questions || []));
          hasMore = Boolean(json.data?.hasMore);
          page += 1;
        }

        if (!ignore) setMistakes(allQuestions);
      } catch (err) {
        if (!ignore) {
          setMistakes([]);
          setError(err.message || 'Failed to load repeated mistakes');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadRepeatedMistakes();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setQuestionTopic('');
    setExpandedQuestionId('');
  }, [questionSubject]);

  useEffect(() => {
    setExpandedQuestionId('');
  }, [questionTopic]);

  const subjects = useMemo(() => buildCountOptions(mistakes, 'subject'), [mistakes]);
  const topics = useMemo(() => {
    const source = questionSubject
      ? mistakes.filter(item => item.subject === questionSubject)
      : mistakes;
    return buildCountOptions(source, 'topic');
  }, [mistakes, questionSubject]);

  const filteredMistakes = useMemo(() => mistakes.filter(item => {
    if (questionSubject && item.subject !== questionSubject) return false;
    if (questionTopic && item.topic !== questionTopic) return false;
    return true;
  }), [mistakes, questionSubject, questionTopic]);

  const activeMistakeSummary = `repeated mistakes in ${questionTopic || questionSubject || 'All subjects'}`;
  const practiceCount = filteredMistakes.length;

  async function startPractice(payload) {
    if (starting) return;
    setStarting(true);
    try {
      if (payload.singleQuestion) {
        sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
          questions: [payload.singleQuestion],
          quizMode: 'filtered_mistakes',
          subject: payload.singleQuestion.subject,
          topic: payload.singleQuestion.topic,
          sourceCollection: payload.singleQuestion.sourceCollection || 'general',
        }));
        router.push('/quiz?mode=history&count=1&sourceScreen=history');
        return;
      }

      const res = await fetch('/api/history/reattempt-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: questionSubject,
          topic: questionTopic,
          answerStatus: 'wrong_skipped',
          questionHistory: 'repeated',
          limit: Math.min(50, Math.max(1, practiceCount)),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to start practice');
      sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
        questions: json.data.questions,
        quizMode: json.data.quizMode,
        subject: questionSubject || 'History',
        topic: questionTopic || 'Repeated Mistakes',
        sourceCollection: 'general',
      }));
      router.push(`/quiz?mode=history&count=${json.data.questionCount}&sourceScreen=history`);
    } catch (err) {
      setError(err.message || 'Failed to start practice');
    } finally {
      setStarting(false);
    }
  }

  async function toggleSave(question) {
    setMistakes(prev => prev.map(item => item.questionId === question.questionId ? { ...item, isSaved: !item.isSaved } : item));
    try {
      const r = await toggleSavedQuestion({ scope: cacheScope, action: question.isSaved ? 'unsave' : 'save', question });
      if (!r.ok) setMistakes(prev => prev.map(item => item.questionId === question.questionId ? { ...item, isSaved: question.isSaved } : item));
    } catch {
      setMistakes(prev => prev.map(item => item.questionId === question.questionId ? { ...item, isSaved: question.isSaved } : item));
    }
  }

  const styles = `
    .history-shell{padding:16px 16px calc(158px + env(safe-area-inset-bottom))}
    .intro-block{margin-bottom:12px}.intro-subtitle{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:0}
    .history-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
    .question-card{padding:12px 14px}.question-top-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.question-kicker{color:var(--ssc-teal);font-size:11px;font-weight:900;margin:0;line-height:1.35;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-badge{font-size:10px;padding:4px 8px;max-width:132px;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}.question-preview{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.38;margin:9px 0 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.question-stat-row{display:flex;align-items:center;gap:14px;margin-top:10px;padding:8px 0 0;border-top:1px solid var(--ssc-border-soft);font-size:12px;font-weight:900;white-space:nowrap}.question-stat-row span+span:before{content:'';margin:0}.question-actions{display:grid;grid-template-columns:1fr .72fr 40px;gap:8px;margin-top:11px;align-items:center}.save-icon-btn{height:40px;width:40px;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);display:flex;align-items:center;justify-content:center;transition:transform .12s ease,background .12s ease,border-color .12s ease}.save-icon-btn:active{transform:scale(.92)}.save-icon-btn.saved{border-color:rgba(14,165,164,.34);background:var(--ssc-teal-soft)}
    .chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;margin-left:-16px;margin-right:-16px;padding:0 16px 14px;scrollbar-width:none;-ms-overflow-style:none}.chip-row::-webkit-scrollbar{display:none}.chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:12px;font-weight:800;padding:7px 13px;white-space:nowrap;text-transform:capitalize;flex:0 0 auto}.chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white;box-shadow:0 8px 18px rgba(14,165,164,.16)}
    .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit;min-height:40px}.primary-btn{border:0;background:linear-gradient(135deg,#ff7a1a,#ff4d00);color:white;box-shadow:var(--ssc-shadow-cta)}.secondary-btn{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-teal)}.primary-btn:disabled,.secondary-btn:disabled{opacity:.55;cursor:default;box-shadow:none}
    .tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;white-space:nowrap}.divider{height:1px;background:var(--ssc-border-soft);margin:12px 0}.question-expanded{overflow:hidden;margin-top:12px;padding:11px;border:1px solid var(--ssc-border-soft);border-radius:14px;background:var(--ssc-surface-soft)}.expanded-block{margin-bottom:10px}.expanded-label{color:var(--ssc-text-muted);font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}.expanded-question{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.48;margin:0}.expanded-attempt{color:var(--ssc-text-muted);font-size:11px;font-weight:800;margin:9px 0 0}.answer-detail-grid{display:grid;gap:8px}.answer-detail{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface);border-radius:12px;padding:9px 10px}.answer-detail span{display:block;color:var(--ssc-text-muted);font-size:10px;font-weight:900;margin-bottom:4px}.answer-detail b{display:block;font-size:12px;line-height:1.4}.answer-detail.correct{background:var(--ssc-success-soft);border-color:rgba(18,184,134,.28)}.answer-detail.wrong{background:var(--ssc-danger-soft);border-color:rgba(239,68,68,.28)}.answer-detail.correct b{color:var(--ssc-success)}.answer-detail.wrong b{color:var(--ssc-danger)}.answer-detail.skipped b{color:var(--ssc-text-secondary)}
    .mistake-filter-group{margin-bottom:16px}.mistake-filter-group .chip-row{padding-bottom:0}.mistake-filter-label{display:block;margin:0 0 10px 2px;color:var(--ssc-text-primary);font-size:12px;font-weight:900;line-height:1}.active-filter-summary{margin:-2px 2px 14px;color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.4}
    .rm-summary-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:20px;padding:20px 18px;margin-bottom:14px;box-shadow:var(--ssc-shadow-card)}
    .rm-summary-icon{width:44px;height:44px;border-radius:13px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.20);display:flex;align-items:center;justify-content:center;margin-bottom:12px}
    .rm-summary-heading{font-size:13px;font-weight:700;color:var(--ssc-text-secondary);margin:0 0 4px}
    .rm-summary-count{font-size:40px;font-weight:900;color:var(--ssc-text-primary);line-height:1;font-family:var(--font-display);margin:0}
    .rm-summary-label{font-size:12px;color:var(--ssc-text-muted);font-weight:600;margin:4px 0 0}
    .rm-subject-row{display:flex;align-items:center;gap:12px;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:var(--ssc-shadow-card);cursor:pointer}
    .rm-subject-icon{width:40px;height:40px;border-radius:11px;background:rgba(239,68,68,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .rm-subject-name{flex:1;font-size:15px;font-weight:800;color:var(--ssc-text-primary)}
    .rm-subject-count{font-size:13px;font-weight:700;color:var(--ssc-text-secondary);margin-right:4px}
    .rm-list-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .rm-list-count{font-size:12px;color:var(--ssc-text-secondary);font-weight:500}
    .rm-card{background:var(--ssc-surface);border:1px solid rgba(239,68,68,0.18);border-radius:18px;padding:14px 16px;margin-bottom:10px;box-shadow:var(--ssc-shadow-card)}
    .rm-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px}
    .rm-tags{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0}
    .rm-subject-tag{font-size:11px;font-weight:700;color:var(--ssc-teal);background:var(--ssc-teal-soft);border-radius:99px;padding:2px 9px}
    .rm-topic-tag{font-size:11px;font-weight:700;color:#FF6A00;background:rgba(255,106,0,0.10);border-radius:99px;padding:2px 9px}
    .rm-repeat-pill{font-size:11px;font-weight:900;color:var(--ssc-danger);background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.20);border-radius:99px;padding:3px 10px;white-space:nowrap;flex-shrink:0}
    .rm-question-text{font-size:14px;font-weight:700;color:var(--ssc-text-primary);line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0 0 10px}
    .rm-footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
    .rm-meta{font-size:11px;color:var(--ssc-text-muted)}
    .rm-correct-label{font-size:11px;color:var(--ssc-text-secondary);font-weight:600}
    .sq-progress-track{height:4px;border-radius:99px;background:var(--ssc-border-soft);overflow:hidden}
    .sq-progress-fill{height:100%;border-radius:99px}
  `;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)] pb-28">
      <Head><title>Repeated Mistakes - SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{styles}</style>
      <HistoryTopBar title="Repeated Mistakes" icon={RepeatedMistakesIcon} showBack />
      <main className="history-shell">
        {loading ? <Loader card size="md" label="Loading mistakes..." /> : error ? (
          <EmptyPanel title="Couldn't load repeated mistakes." body={error} action="Retry" onClick={() => router.reload()} />
        ) : (
          <>
            {/* Subject chips */}
            <div className="chip-row" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className={`chip ${!questionSubject ? 'active' : ''}`}
                onClick={() => setQuestionSubject('')}
              >
                All {mistakes.length}
              </button>
              {subjects.map(item => (
                <button
                  key={item.name}
                  type="button"
                  className={`chip ${questionSubject === item.name ? 'active' : ''}`}
                  onClick={() => setQuestionSubject(item.name)}
                >
                  {item.name} {item.count}
                </button>
              ))}
            </div>

            {!questionSubject ? (
              <>
                {/* Summary card */}
                <div className="rm-summary-card">
                  <div className="rm-summary-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p className="rm-summary-heading font-display">Questions You Repeat</p>
                  <p className="rm-summary-count">{mistakes.length}</p>
                  <p className="rm-summary-label">Repeated Mistakes</p>
                </div>

                {/* Practice All CTA */}
                {mistakes.length > 0 && (
                  <button
                    type="button"
                    className="primary-btn w-full"
                    style={{ marginBottom: 14 }}
                    disabled={starting}
                    onClick={() => startPractice({})}
                  >
                    {starting ? 'Starting...' : `Practice All ${mistakes.length}`}
                  </button>
                )}

                {/* Subject category rows */}
                {subjects.map(subj => (
                  <div
                    key={subj.name}
                    className="rm-subject-row"
                    onClick={() => setQuestionSubject(subj.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setQuestionSubject(subj.name)}
                  >
                    <div className="rm-subject-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                      </svg>
                    </div>
                    <span className="rm-subject-name">{subj.name}</span>
                    <span className="rm-subject-count">{subj.count}</span>
                    <ChevronSVG />
                  </div>
                ))}

                {mistakes.length === 0 && (
                  <EmptyPanel
                    title="No repeated mistakes yet."
                    body="Practice more quizzes to build this list."
                    action="Practice Now"
                    onClick={() => router.push('/dashboard')}
                  />
                )}
              </>
            ) : (
              <>
                {/* Topic chips when subject selected */}
                {topics.length > 1 && (
                  <div className="chip-row" style={{ marginBottom: 14 }}>
                    <button
                      type="button"
                      className={`chip ${!questionTopic ? 'active' : ''}`}
                      onClick={() => setQuestionTopic('')}
                    >
                      All Topics
                    </button>
                    {topics.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        className={`chip ${questionTopic === item.name ? 'active' : ''}`}
                        onClick={() => setQuestionTopic(item.name)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* List header */}
                <div className="rm-list-header">
                  <span className="rm-list-count">
                    {filteredMistakes.length} question{filteredMistakes.length !== 1 ? 's' : ''}
                  </span>
                  {practiceCount > 0 && (
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ padding: '8px 14px', fontSize: 12, minHeight: 'auto' }}
                      disabled={starting}
                      onClick={() => startPractice({})}
                    >
                      {starting ? 'Starting...' : 'Practice All'}
                    </button>
                  )}
                </div>

                {/* Question cards */}
                {filteredMistakes.length ? filteredMistakes.map(item => (
                  <QuestionCard
                    key={item.questionId}
                    item={item}
                    isOpen={expandedQuestionId === item.questionId}
                    onToggleOpen={() => setExpandedQuestionId(current => current === item.questionId ? '' : item.questionId)}
                    onPracticeOne={question => startPractice({ singleQuestion: question })}
                    onToggleSave={toggleSave}
                  />
                )) : (
                  <EmptyPanel
                    title="No repeated questions found."
                    body="Practice more to build this list."
                    action="Practice More"
                    onClick={() => router.push('/dashboard')}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
