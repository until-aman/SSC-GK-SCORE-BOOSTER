import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Timer from '@/components/Timer';
import ProgressBar from '@/components/ProgressBar';

// Fisher-Yates shuffle
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Sample n questions
function sampleQuestions(pool, n) {
  return shuffle(pool).slice(0, Math.min(n, pool.length));
}

// Calculate results
function calculateResults(questions, answers) {
  let correct = 0, incorrect = 0, skipped = 0;
  questions.forEach(q => {
    const userAnswer = answers[q.id];
    if (!userAnswer || userAnswer === 'SKIPPED') {
      skipped++;
    } else if (userAnswer === q.correctOption) {
      correct++;
    } else {
      incorrect++;
    }
  });
  const totalQuestions = questions.length;
  const rawScore = correct * 2 - incorrect * 0.5;
  const accuracy = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
  return { correct, incorrect, skipped, totalQuestions, rawScore, accuracy };
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];

export default function Quiz() {
  const { data: session } = useSession();
  const router = useRouter();
  const { subject, topic, n } = router.query;

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Fetch questions
  useEffect(() => {
    if (!subject || !topic || !n) return;
    setLoading(true);
    setError(null);
    fetch(`/api/questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.questions || data.questions.length === 0) {
          setError('no-questions');
          setLoading(false);
          return;
        }
        const sampled = sampleQuestions(data.questions, parseInt(n));
        setQuestions(sampled);
        setLoading(false);
      })
      .catch(() => {
        setError('fetch-failed');
        setLoading(false);
      });
  }, [subject, topic, n]);

  // Complete quiz
  const finishQuiz = useCallback(async (finalAnswers) => {
    if (quizComplete) return;
    setQuizComplete(true);
    const results = calculateResults(questions, finalAnswers);

    async function prefetchAiData() {
      const summaryPromise = fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          topic,
          totalQuestions: results.totalQuestions,
          correctAnswers: results.correct,
          incorrectAnswers: results.incorrect,
          skipped: results.skipped,
          rawScore: results.rawScore,
          accuracy: results.accuracy,
        }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => data.aiSummary || null)
        .catch(() => null);

      const insightPromises = questions.map((q) => {
        const userAnswer = finalAnswers[q.id];
        if (!userAnswer || userAnswer === 'SKIPPED') {
          return fetch('/api/ai/tip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: q.question,
              correctOption: q.correctOption,
              correctOptionText: q[OPTION_KEYS[q.correctOption]],
              explanation: q.explanation,
              subject,
              topic,
            }),
          })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => ({ id: q.id, text: data.aiTip || null }))
            .catch(() => ({ id: q.id, text: null }));
        }

        if (userAnswer === q.correctOption) {
          return Promise.resolve({ id: q.id, text: null });
        }

        return fetch('/api/ai/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption,
            userOption: userAnswer,
            explanation: q.explanation,
            subject,
            topic,
          }),
        })
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then((data) => ({ id: q.id, text: data.aiExplanation || null }))
          .catch(() => ({ id: q.id, text: null }));
      });

      const [summary, insights] = await Promise.all([summaryPromise, Promise.all(insightPromises)]);
      return {
        summary,
        insights: Object.fromEntries(insights.map((item) => [item.id, item.text])),
      };
    }

    const aiData = await prefetchAiData();

    if (session) {
      fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctAnswers: results.correct,
          incorrectAnswers: results.incorrect,
          skipped: results.skipped,
          totalQuestions: results.totalQuestions,
          rawScore: results.rawScore,
          subject,
          topic,
        }),
      }).catch(() => {});
    }

    sessionStorage.setItem('quizResult', JSON.stringify({
      subject,
      topic,
      questions,
      answers: finalAnswers,
      correct: results.correct,
      incorrect: results.incorrect,
      skipped: results.skipped,
      totalQuestions: results.totalQuestions,
      rawScore: results.rawScore,
      accuracy: results.accuracy,
      aiData,
    }));
    router.push('/result');
  }, [questions, session, subject, topic, router, quizComplete]);

  // Advance
  const advanceQuestion = useCallback((newAnswers) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      finishQuiz(newAnswers);
    } else {
      setCurrentIndex(nextIndex);
      setSelectedOption(null);
      setShowFeedback(false);
    }
  }, [currentIndex, questions.length, finishQuiz]);

  // Handle option select
  function handleOptionSelect(optionLabel) {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    const newAnswers = { ...answers, [q.id]: optionLabel };
    setAnswers(newAnswers);
    setSelectedOption(optionLabel);
    setShowFeedback(true);
    setTimeout(() => {
      advanceQuestion(newAnswers);
    }, 600);
  }

  // Handle skip
  function handleSkip() {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    const newAnswers = { ...answers, [q.id]: 'SKIPPED' };
    setAnswers(newAnswers);
    advanceQuestion(newAnswers);
  }

  // Handle timer expiry
  const handleTimeUp = useCallback(() => {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    if (!q) return;
    const newAnswers = { ...answers, [q.id]: 'SKIPPED' };
    setAnswers(newAnswers);
    advanceQuestion(newAnswers);
  }, [showFeedback, quizComplete, questions, currentIndex, answers, advanceQuestion]);

  if (loading) {
    return (
      <Layout title="Loading Your Challenge..." hideAuth={true}>
        <div className="card-container mx-auto fade-in text-center py-12">
          {/* Mascot Icon */}
          <div className="mx-auto mb-8 w-24 h-24 rounded-3xl overflow-hidden bg-gray-50 shadow-sm flex items-center justify-center">
             <img src="/images/logo.png" alt="Mascot" className="w-20 h-20 object-contain" />
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-2 leading-tight">
            Loading Your GK<br />Challenge...
          </h1>
          
          <p className="text-gray-500 text-sm font-medium mb-6 flex items-center justify-center gap-2">
            Fetching questions for your SSC prep 📚
          </p>

          <div className="mb-8">
            <span className="text-xs font-black text-[#FF6A00] uppercase tracking-widest bg-orange-50 px-4 py-2 rounded-full">
              {subject} • {topic}
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-8 shadow-inner">
            <div className="h-full bg-gradient-to-r from-[#FF8C00] to-[#FF6B35] animate-progress-glow rounded-full" style={{ width: '60%' }}></div>
          </div>

          <p className="text-gray-400 text-xs font-medium italic animate-pulse">
            Preparing your score booster session...
          </p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Quiz Error" hideAuth={true}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-6 leading-relaxed">
            {error === 'no-questions' ? 'No questions available for this topic.' : 'Could not load questions.'}
          </p>
          <button
            onClick={() => error === 'fetch-failed' ? window.location.reload() : router.push('/')}
            className="w-full bg-[#FF7C1A] text-white rounded-2xl py-4 font-black text-xs transition"
          >
            {error === 'fetch-failed' ? 'RETRY' : 'GO BACK'}
          </button>
        </div>
      </Layout>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <Layout title={`Q${currentIndex + 1} — SSC GK SCORE BOOSTER`} hideAuth={true}>
      <div className="card-container mx-auto fade-in">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <ProgressBar current={currentIndex + 1} total={questions.length} />
            </div>
            <Timer duration={20} onTimeUp={handleTimeUp} resetKey={currentIndex} />
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-start">
            <span className="text-[10px] font-black bg-orange-50 text-orange-600 rounded-full px-3 py-1 uppercase tracking-widest">{subject}</span>
            <span className="text-[10px] font-black bg-gray-50 text-gray-500 rounded-full px-3 py-1 uppercase tracking-widest">{topic}</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-[2rem] border border-gray-100 p-4 mb-4 fade-in min-h-[100px] flex items-center" key={currentIndex}>
          <p className="text-sm font-bold text-gray-800 leading-snug">{currentQuestion.question}</p>
        </div>

        <div className="space-y-2 mb-4">
          {OPTION_LABELS.map((label, idx) => {
            const optionText = currentQuestion[OPTION_KEYS[idx]];
            const isSelected = selectedOption === label;
            const isCorrect = label === currentQuestion.correctOption;
            let optionClasses = 'w-full text-left border rounded-3xl p-3 flex gap-3 items-start transition-all duration-200';
            if (showFeedback) {
              if (isCorrect) optionClasses += ' border-emerald-500 bg-emerald-50 text-emerald-800 font-bold';
              else if (isSelected && !isCorrect) optionClasses += ' border-red-400 bg-red-50 text-red-700 font-bold';
              else optionClasses += ' border-gray-50 bg-gray-25 text-gray-300';
            } else {
              optionClasses += ' border-gray-100 bg-white hover:border-orange-300 active:scale-[0.98] text-gray-600 font-medium';
            }
            return (
              <button key={label} onClick={() => handleOptionSelect(label)} disabled={showFeedback} className={optionClasses}>
                <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                  showFeedback && isCorrect ? 'bg-emerald-500 text-white' : showFeedback && isSelected && !isCorrect ? 'bg-red-400 text-white' : 'bg-orange-50 text-orange-400'
                }`}>
                  {label}
                </span>
                <span className="text-sm pt-0.5">{optionText}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSkip}
          disabled={showFeedback}
          className={`w-full bg-white border border-gray-100 text-gray-400 rounded-3xl py-3 text-xs font-black uppercase tracking-widest transition ${
            showFeedback ? 'opacity-30' : 'hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          Skip Question →
        </button>
      </div>
    </Layout>
  );
}
