import { useEffect, useMemo, useState } from 'react';
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

const FILTER_MODES = [
  { key: 'all', label: 'All' },
  { key: 'subject', label: 'Subject-wise' },
  { key: 'topic', label: 'Topic-wise' },
];

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

function QuestionCard({ item }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
      <p className="text-xs font-bold text-teal-400">
        {item.subject || 'Subject'} &middot; {item.topic || 'Topic'}
      </p>
      <p className="font-display mt-2 font-bold leading-relaxed text-white">
        {item.questionPreview || item.question || 'Question text unavailable'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-300">
          Wrong {item.wrongCount || 0}x
        </span>
        <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-slate-300">
          Skipped {item.skippedCount || 0}x
        </span>
        <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-orange-300">
          Attempts {item.totalAttempts || 0}
        </span>
      </div>
    </div>
  );
}

export default function RepeatedMistakesPage() {
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

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

  const subjects = useMemo(() => buildCountOptions(mistakes, 'subject'), [mistakes]);
  const topics = useMemo(() => {
    const source = selectedSubject
      ? mistakes.filter(item => item.subject === selectedSubject)
      : mistakes;
    return buildCountOptions(source, 'topic');
  }, [mistakes, selectedSubject]);

  useEffect(() => {
    setSelectedSubject('');
    setSelectedTopic('');
  }, [filterMode]);

  useEffect(() => {
    setSelectedTopic('');
  }, [selectedSubject]);

  const filteredMistakes = useMemo(() => mistakes.filter(item => {
    if (filterMode === 'subject' && selectedSubject && item.subject !== selectedSubject) return false;
    if (filterMode === 'topic') {
      if (selectedSubject && item.subject !== selectedSubject) return false;
      if (selectedTopic && item.topic !== selectedTopic) return false;
    }
    return true;
  }), [filterMode, mistakes, selectedSubject, selectedTopic]);

  const activeSummary = useMemo(() => {
    if (filterMode === 'subject' && selectedSubject) return `${selectedSubject} repeated mistakes`;
    if (filterMode === 'topic' && selectedTopic) return `${selectedTopic} repeated mistakes`;
    if (filterMode === 'topic' && selectedSubject) return `${selectedSubject} topics with repeated mistakes`;
    return 'All repeated mistakes';
  }, [filterMode, selectedSubject, selectedTopic]);

  return (
    <div className="min-h-screen [background:var(--bg-app)] pb-24">
      <Head><title>Repeated Mistakes - SSC GK Score Booster</title></Head>
      <HistoryTopBar title="Repeated Mistakes" icon={RepeatedMistakesIcon} showBack />
      <main className="px-4 pt-5">
        <p className="t-page-subtitle mb-5 text-slate-400">Practice questions you got wrong multiple times.</p>

        {loading ? <Loader card size="md" label="Loading mistakes..." /> : (
          <div className="flex flex-col gap-3">
            {error ? (
              <div className="rounded-2xl p-5 text-red-200" style={{ background: '#172D47', border: '1px solid rgba(248,113,113,.22)' }}>
                {error}
              </div>
            ) : null}

            {!error ? (
              <>
                <section className="rounded-2xl p-3" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-black text-white">{filteredMistakes.length} Questions</p>
                      <p className="text-xs font-bold text-slate-400">{activeSummary}</p>
                    </div>
                    <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">
                      Repeated
                    </span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {FILTER_MODES.map(mode => (
                      <button
                        key={mode.key}
                        type="button"
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${filterMode === mode.key ? 'border-orange-500/45 bg-orange-500/15 text-orange-300' : 'border-slate-600/60 bg-slate-900/30 text-slate-400'}`}
                        onClick={() => setFilterMode(mode.key)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {filterMode === 'subject' ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      <button
                        type="button"
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${!selectedSubject ? 'border-teal-500/45 bg-teal-500/15 text-teal-300' : 'border-slate-600/60 bg-slate-900/30 text-slate-400'}`}
                        onClick={() => setSelectedSubject('')}
                      >
                        All Subjects ({mistakes.length})
                      </button>
                      {subjects.map(item => (
                        <button
                          key={item.name}
                          type="button"
                          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${selectedSubject === item.name ? 'border-teal-500/45 bg-teal-500/15 text-teal-300' : 'border-slate-600/60 bg-slate-900/30 text-slate-400'}`}
                          onClick={() => setSelectedSubject(item.name)}
                        >
                          {item.name} ({item.count})
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {filterMode === 'topic' ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                          type="button"
                          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${!selectedSubject ? 'border-teal-500/45 bg-teal-500/15 text-teal-300' : 'border-slate-600/60 bg-slate-900/30 text-slate-400'}`}
                          onClick={() => setSelectedSubject('')}
                        >
                          All Subjects
                        </button>
                        {subjects.map(item => (
                          <button
                            key={item.name}
                            type="button"
                            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${selectedSubject === item.name ? 'border-teal-500/45 bg-teal-500/15 text-teal-300' : 'border-slate-600/60 bg-slate-900/30 text-slate-400'}`}
                            onClick={() => setSelectedSubject(item.name)}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                          type="button"
                          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${!selectedTopic ? 'border-orange-500/45 bg-orange-500/15 text-orange-300' : 'border-slate-600/60 bg-slate-900/30 text-slate-400'}`}
                          onClick={() => setSelectedTopic('')}
                        >
                          All Topics ({selectedSubject ? mistakes.filter(item => item.subject === selectedSubject).length : mistakes.length})
                        </button>
                        {topics.map(item => (
                          <button
                            key={item.name}
                            type="button"
                            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${selectedTopic === item.name ? 'border-orange-500/45 bg-orange-500/15 text-orange-300' : 'border-slate-600/60 bg-slate-900/30 text-slate-400'}`}
                            onClick={() => setSelectedTopic(item.name)}
                          >
                            {item.name} ({item.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>

                {filteredMistakes.length === 0 ? (
                  <div className="rounded-2xl p-5 text-slate-400" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>No repeated mistakes found for this filter.</div>
                ) : filteredMistakes.map(item => (
                  <QuestionCard key={item.questionId} item={item} />
                ))}
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
