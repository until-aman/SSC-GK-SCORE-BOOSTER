import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';

const OPTION_KEYS = { A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD' };

export default function DetailedAnalysis() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [preloadedInsights, setPreloadedInsights] = useState({});

  useEffect(() => {
    const stored = sessionStorage.getItem('quizResult');
    if (!stored) {
      router.push('/');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setResult(parsed);
      setPreloadedInsights(parsed.aiData?.insights || {});
    } catch {
      router.push('/');
    }
  }, [router]);

  if (!result) return null;

  return (
    <Layout title="Detailed Analysis — SSC GK SCORE BOOSTER">
      <div className="card-container mx-auto fade-in pb-10">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => router.push('/result')}
            className="w-10 h-10 rounded-full bg-orange-500 border border-orange-500 flex items-center justify-center text-white shadow-sm transition hover:bg-orange-600"
          >
            ✕
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">📊 Detailed Insight</h1>
        </div>

        <div className="space-y-4">
          {result.questions.map((q, idx) => (
            <QuestionReviewCard 
              key={q.id} 
              question={q} 
              index={idx} 
              userAnswer={result.answers[q.id]}
              subject={result.subject}
              topic={result.topic}
              preloadedInsight={preloadedInsights[q.id]}
            />
          ))}
        </div>

        <button
          onClick={() => router.push('/result')}
          className="w-full mt-8 bg-[#FE702C] text-white rounded-2xl py-4 font-black text-xs shadow-xl active:scale-95 transition"
        >
          BACK TO RESULTS
        </button>
      </div>
    </Layout>
  );
}

function QuestionReviewCard({ question, index, userAnswer, subject, topic, preloadedInsight }) {
  const [aiInsight, setAiInsight] = useState(preloadedInsight ?? null);
  const [loading, setLoading] = useState(preloadedInsight === undefined);
  const isCorrect = userAnswer === question.correctOption;
  const isSkipped = !userAnswer || userAnswer === 'SKIPPED';

  // Load AI insight from preloaded data or fetch lazily if needed.
  useEffect(() => {
    if (preloadedInsight !== undefined) {
      setAiInsight(preloadedInsight);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchAiInsight();
    }, index * 200);
    return () => clearTimeout(timer);
  }, [preloadedInsight]);

  async function fetchAiInsight() {
    if (isCorrect) return; // Only explain mistakes/skips per common pattern, or as requested
    
    setLoading(true);
    const endpoint = isSkipped ? '/api/ai/tip' : '/api/ai/explain';
    const body = isSkipped 
      ? { 
          question: question.question, 
          correctOption: question.correctOption, 
          correctOptionText: question[OPTION_KEYS[question.correctOption]], 
          explanation: question.explanation,
          subject, 
          topic 
        }
      : { 
          question: question.question, 
          optionA: question.optionA, 
          optionB: question.optionB, 
          optionC: question.optionC, 
          optionD: question.optionD, 
          correctOption: question.correctOption, 
          userOption: userAnswer, 
          explanation: question.explanation,
          subject, 
          topic 
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('AI failed');
      const data = await res.json();
      setAiInsight(isSkipped ? data.aiTip : (data.aiExplanation || data.fallback));
    } catch (e) {
      setAiInsight(question.explanation || 'Review this concept in your study material.');
    } finally {
      setLoading(false);
    }
  }

  const normalizeText = (text = '') => text.toLowerCase().trim();
  const isExplanationRedundant = (explanation, insight) => {
    if (!explanation || !insight) return false;
    const base = normalizeText(explanation);
    const ai = normalizeText(insight);
    return base === ai || ai.includes(base) || base.includes(ai);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Question {index + 1}</span>
        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${
          isCorrect ? 'bg-emerald-50 text-emerald-700' : 
          isSkipped ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-700'
        }`}>
          {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
        </span>
      </div>
      
      <p className="text-gray-800 font-bold mb-5 leading-tight">{question.question}</p>
      
      <div className="grid grid-cols-1 gap-2 mb-4">
        {['A', 'B', 'C', 'D'].map(opt => {
          const isThisUser = userAnswer === opt;
          const isThisCorrect = question.correctOption === opt;
          return (
            <div key={opt} className={`text-xs p-4 rounded-xl border flex justify-between items-center transition-all ${
              isThisCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' :
              isThisUser ? 'bg-red-50 border-red-200 text-red-900 font-bold' :
              'bg-gray-50 border-transparent text-gray-400'
            }`}>
              <span>{opt}. {question[OPTION_KEYS[opt]]}</span>
              {isThisCorrect && <span>✅</span>}
              {isThisUser && !isThisCorrect && <span>❌</span>}
            </div>
          );
        })}
      </div>

      {question.explanation && !isExplanationRedundant(question.explanation, aiInsight) && (
        <div className="mb-4 p-4 bg-gray-50 rounded-2xl text-[11px] leading-relaxed">
          <span className="font-bold uppercase text-[9px] text-[#FE702C] block mb-1">Explanation</span>
          {question.explanation}
        </div>
      )}

      {!isCorrect && (
        <div className="p-5 bg-orange-50 rounded-2xl border border-orange-100 min-h-[60px] flex flex-col justify-center">
          <p className="text-[10px] font-black text-orange-400 uppercase mb-2 tracking-widest flex items-center gap-2">
            <span>🤖 AI Mentor Insight</span>
            {loading && <span className="w-1 h-1 bg-orange-400 rounded-full animate-ping" />}
          </p>
          {loading ? (
            <div className="space-y-2">
              <div className="h-2 bg-orange-100 rounded w-full animate-pulse" />
              <div className="h-2 bg-orange-100 rounded w-5/6 animate-pulse" />
            </div>
          ) : (
            <p className="text-xs text-orange-900 leading-relaxed italic font-medium">
              &quot;{aiInsight || 'Reviewing...'}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
