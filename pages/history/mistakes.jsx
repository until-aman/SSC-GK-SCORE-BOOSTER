import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const RepeatedMistakesIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
  </svg>
);

const TONES = {
  green: ['#86efac', 'rgba(34,197,94,.12)'],
  amber: ['#fcd34d', 'rgba(245,158,11,.12)'],
  red: ['#fca5a5', 'rgba(239,68,68,.12)'],
  blue: ['#93c5fd', 'rgba(59,130,246,.12)'],
};

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#14B8A6' : 'none'} stroke={filled ? '#14B8A6' : '#64748b'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <p className="font-display font-black text-white">{title}</p>
      <p className="mt-1 mb-4 text-sm text-slate-400">{body}</p>
      {action ? <button type="button" className="primary-btn" onClick={onClick}>{action}</button> : null}
    </section>
  );
}

function QuestionCard({ item, isOpen, onToggleOpen, onPracticeOne, onToggleSave }) {
  const correctCount = Number(item.correctCount) || 0;
  const wrongCount = Number(item.wrongCount) || 0;
  const skippedCount = Number(item.skippedCount) || 0;
  const lastAnswerText = item.lastUserAnswer ? optionText(item, item.lastUserAnswer) : '';
  const correctAnswerText = item.correctOption ? optionText(item, item.correctOption) : '';
  const lastAnswerTone = !item.lastUserAnswer ? 'skipped' : item.lastUserAnswer === item.correctOption ? 'correct' : 'wrong';
  const statusText = item.lastAttemptStatus === 'skipped' ? 'Skipped' : item.lastAttemptStatus === 'correct' ? 'Correct' : 'Wrong';
  let smartTag = 'Needs Revision';
  let tagTone = TONES.amber;

  if (wrongCount >= 2 && correctCount === 0) {
    smartTag = 'Never Correct';
    tagTone = TONES.red;
  } else if (wrongCount >= 2) {
    smartTag = 'Repeated Mistake';
    tagTone = TONES.red;
  } else if (skippedCount >= 2) {
    smartTag = 'Often Skipped';
    tagTone = TONES.blue;
  } else if (correctCount > 0 && wrongCount > 0) {
    smartTag = 'Improving';
    tagTone = TONES.amber;
  } else if (correctCount >= 2 && item.lastAttemptStatus === 'correct') {
    smartTag = 'Mastered';
    tagTone = TONES.green;
  }

  return (
    <article className={`history-card question-card ${isOpen ? 'open' : ''}`}>
      <div className="question-top-row">
        <p className="question-kicker">{item.subject} &middot; {item.topic}</p>
        <span className="tone-pill question-badge" style={{ color: tagTone[0], background: tagTone[1], borderColor: `${tagTone[0]}55` }}>{smartTag}</span>
      </div>

      <p className="question-preview font-display">{item.questionPreview || item.question}</p>

      <div className="question-stat-row">
        <span className="text-red-300">Wrong {wrongCount}x</span>
        <span className="text-slate-400">Skipped {skippedCount}x</span>
      </div>

      {isOpen ? (
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
          <p className="expanded-attempt">Last attempt: {statusText} &middot; {formatDate(item.lastAttemptedAt)}</p>
          <div className="divider" />
          <p className="expanded-label">Explanation</p>
          {item.explanation ? <p className="text-sm leading-relaxed text-slate-300">{item.explanation}</p> : <p className="text-sm text-slate-500">No official explanation available.</p>}
        </div>
      ) : null}

      <div className="question-actions">
        <button type="button" className="primary-btn" onClick={() => onPracticeOne(item)}>Practice Again</button>
        <button type="button" className="secondary-btn" onClick={onToggleOpen}>{isOpen ? 'Close' : 'Open'}</button>
        <button type="button" className={`save-icon-btn ${item.isSaved ? 'saved' : ''}`} onClick={event => { event.stopPropagation(); onToggleSave(item); }} aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'} title={item.isSaved ? 'Saved' : 'Save'}>
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>
    </article>
  );
}

export default function RepeatedMistakesPage() {
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
          const params = new URLSearchParams({
            answerStatus: 'wrong_skipped',
            questionHistory: 'repeated',
            limit: '50',
            page: String(page),
          });
          const res = await fetch(`/api/history/questions?${params.toString()}`);
          const json = await res.json();

          if (!res.ok || !json.success) {
            throw new Error(json.error || 'Failed to load repeated mistakes');
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
    await fetch('/api/saved-questions/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...question, action: question.isSaved ? 'unsave' : 'save' }),
    }).catch(() => setMistakes(prev => prev.map(item => item.questionId === question.questionId ? { ...item, isSaved: question.isSaved } : item)));
  }

  const styles = `
    .history-shell{padding:16px 16px calc(158px + env(safe-area-inset-bottom))}
    .intro-block{margin-bottom:12px}.intro-subtitle{color:#94a3b8;font-size:13px;line-height:1.45;margin:0}
    .history-card{background:#172d47;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;margin-bottom:12px}
    .question-card{padding:11px 14px}.question-top-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.question-kicker{color:#5eead4;font-size:11px;font-weight:900;margin:0;line-height:1.35;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-badge{font-size:10px;padding:4px 8px;max-width:132px;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}.question-preview{color:#f8fafc;font-size:13px;font-weight:900;line-height:1.38;margin:9px 0 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.question-stat-row{display:flex;align-items:center;gap:14px;margin-top:10px;padding:8px 0 0;border-top:1px solid rgba(148,163,184,.10);font-size:12px;font-weight:900;white-space:nowrap}.question-stat-row span+span:before{content:'';margin:0}.question-actions{display:grid;grid-template-columns:1fr .72fr 40px;gap:8px;margin-top:11px;align-items:center}.save-icon-btn{height:40px;width:40px;border-radius:999px;border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;transition:transform .12s ease,background .12s ease,border-color .12s ease}.save-icon-btn:active{transform:scale(.92)}.save-icon-btn.saved{border-color:rgba(20,184,166,.40);background:rgba(20,184,166,.18)}
    .chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;margin-left:-16px;margin-right:-16px;padding:0 16px 14px;scrollbar-width:none;-ms-overflow-style:none}.chip-row::-webkit-scrollbar{display:none}.chip{border:1px solid rgba(148,163,184,.14);border-radius:999px;background:rgba(23,45,71,.92);color:#8da0b8;font-size:12px;font-weight:800;padding:7px 13px;white-space:nowrap;text-transform:capitalize;flex:0 0 auto}.chip.active{background:rgba(255,122,26,.17);border-color:rgba(255,122,26,.52);color:#fdba74;box-shadow:0 5px 16px rgba(255,90,0,.08)}
    .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit;min-height:40px}.primary-btn{border:0;background:linear-gradient(135deg,#ff7a1a,#ff4d00);color:white;box-shadow:0 8px 22px rgba(255,90,0,.16)}.secondary-btn{border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.04);color:#cbd5e1}.primary-btn:disabled,.secondary-btn:disabled{opacity:.45;cursor:default;box-shadow:none}
    .tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;white-space:nowrap}.divider{height:1px;background:rgba(255,255,255,.07);margin:12px 0}.question-expanded{overflow:hidden;margin-top:12px;padding:11px;border:1px solid rgba(148,163,184,.10);border-radius:14px;background:rgba(15,23,42,.30)}.expanded-block{margin-bottom:10px}.expanded-label{color:#94a3b8;font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}.expanded-question{color:#f8fafc;font-size:13px;font-weight:900;line-height:1.48;margin:0}.expanded-attempt{color:#64748b;font-size:11px;font-weight:800;margin:9px 0 0}.answer-detail-grid{display:grid;gap:8px}.answer-detail{border:1px solid rgba(148,163,184,.10);background:rgba(255,255,255,.035);border-radius:12px;padding:9px 10px}.answer-detail span{display:block;color:#94a3b8;font-size:10px;font-weight:900;margin-bottom:4px}.answer-detail b{display:block;font-size:12px;line-height:1.4}.answer-detail.correct b{color:#5eead4}.answer-detail.wrong b{color:#fca5a5}.answer-detail.skipped b{color:#93a4ba}
    .mistake-filter-group{margin-bottom:16px}.mistake-filter-group .chip-row{padding-bottom:0}.mistake-filter-label{display:block;margin:0 0 10px 2px;color:#cbd5e1;font-size:12px;font-weight:900;line-height:1}.active-filter-summary{margin:-2px 2px 14px;color:#94a3b8;font-size:12px;font-weight:800;line-height:1.4}
  `;

  return (
    <div className="min-h-screen [background:var(--bg-app)] pb-28">
      <Head><title>Repeated Mistakes - SSC GK Score Booster</title></Head>
      <style>{styles}</style>
      <HistoryTopBar title="Repeated Mistakes" icon={RepeatedMistakesIcon} showBack />
      <main className="history-shell">
        <section className="intro-block">
          <p className="intro-subtitle">Practice questions you got wrong multiple times.</p>
        </section>

        {loading ? <Loader card size="md" label="Loading mistakes..." /> : error ? (
          <EmptyPanel title="Couldn't load repeated mistakes." body={error} action="Retry" onClick={() => router.reload()} />
        ) : (
          <>
            <section>
              <div className="mistake-filter-group">
                <p className="mistake-filter-label">Subject / Source</p>
                <div className="chip-row">
                  <button type="button" className={`chip ${!questionSubject ? 'active' : ''}`} onClick={() => setQuestionSubject('')}>All</button>
                  {subjects.map(item => <button key={item.name} type="button" className={`chip ${questionSubject === item.name ? 'active' : ''}`} onClick={() => setQuestionSubject(item.name)}>{item.name}</button>)}
                </div>
              </div>

              {questionSubject ? (
              <div className="mistake-filter-group">
                <p className="mistake-filter-label">Topic</p>
                <div className="chip-row">
                  <button type="button" className={`chip ${!questionTopic ? 'active' : ''}`} onClick={() => setQuestionTopic('')}>All Topics</button>
                  {topics.map(item => <button key={item.name} type="button" className={`chip ${questionTopic === item.name ? 'active' : ''}`} onClick={() => setQuestionTopic(item.name)}>{item.name}</button>)}
                </div>
              </div>
              ) : null}

              <p className="active-filter-summary">Showing: {activeMistakeSummary}</p>

              <div className="history-card">
                <p className="font-display font-black text-white">{practiceCount} repeated questions found</p>
                {practiceCount > 0 ? (
                  <button type="button" className="primary-btn mt-3 w-full" disabled={starting} onClick={() => startPractice({})}>
                    {starting ? 'Starting...' : `Practice All ${practiceCount}`}
                  </button>
                ) : null}
              </div>

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
                <EmptyPanel title="No repeated questions found." body="Practice more to build this list." action="Practice More →" onClick={() => router.push('/dashboard')} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
