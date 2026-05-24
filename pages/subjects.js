import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { subjectStyles } from '@/lib/subjects';

const SUBJECTS = Object.keys(subjectStyles);

const SUBJECT_COLORS = {
  'Polity':           '#4F46E5',
  'Geography':        '#0891B2',
  'Ancient History':  '#D97706',
  'Medieval History': '#DC2626',
  'Modern History':   '#7C3AED',
  'Economics':        '#EA580C',
  'Physics':          '#2563EB',
  'Chemistry':        '#059669',
  'Biology':          '#16A34A',
  'Current Affairs':  '#DB2777',
  'Static GK':        '#0D9488',
  'Mixed':            '#9333EA',
};

export default function SubjectsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [subjectCounts, setSubjectCounts] = useState(null);

  const collection = router.query.collection || 'general';

  // Change 1 — Fetch subject counts on mount
  useEffect(() => {
    if (!router.isReady) return;
    setSubjectCounts(null);
    fetch(`/api/topics?collection=${encodeURIComponent(collection)}`)
      .then(r => r.json())
      .then(data => setSubjectCounts(data.subjectCounts || {}))
      .catch(() => setSubjectCounts({}));
  }, [router.isReady, collection]);

  // Change 2 — Filter out subjects with zero questions
  const visibleSubjects = subjectCounts
    ? SUBJECTS.filter(s => subjectCounts[s] == null || subjectCounts[s] > 0)
    : [];


  return (
    <>
      <Head><title>Choose a Subject — SSC GK Score Booster</title></Head>
      <div className="min-h-screen pb-28" style={{ background: '#0f172a' }}>

        {/* ── HEADER ── */}
        <div className="flex items-center gap-3 px-4 pt-10 pb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white flex-shrink-0 active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="font-display font-black text-2xl text-white">Choose a Subject</h1>
            <p className="text-slate-400 text-xs mt-0.5">Select one to set up your quiz</p>
          </div>
        </div>

        {/* ── SUBJECTS GRID ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            padding: '4px 20px 24px',
          }}
        >
          {/* Change 3 — Skeleton while loading */}
          {subjectCounts === null
            ? [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 18,
                    minHeight: 100,
                    background: 'rgba(255,255,255,0.08)',
                  }}
                />
              ))
            : visibleSubjects.map((subject, idx) => {
                const style = subjectStyles[subject];
                const isSelected = selected === subject;
                const bgColor = SUBJECT_COLORS[subject] || '#334155';
                const enterClass = `card-enter card-enter-${Math.min(idx + 1, 6)}`;

                return (
                  <button
                    key={subject}
                    onClick={() => setSelected(isSelected ? null : subject)}
                    className={`card-lift text-left active:scale-[0.97] ${enterClass}`}
                    style={{
                      background: bgColor,
                      borderRadius: 18,
                      padding: 16,
                      minHeight: 100,
                      border: isSelected ? '2px solid white' : '2px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSelected ? '0 0 0 3px rgba(255,255,255,0.15)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{style.icon}</span>
                    <div style={{ marginTop: 10 }}>
                      <p className="font-display font-bold" style={{ fontSize: 14, lineHeight: 1.3, color: '#ffffff' }}>
                        {subject}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
                        {isSelected ? '✓ Selected' : 'Tap to select'}
                      </p>
                    </div>
                  </button>
                );
              })
          }
        </div>
      </div>

      {/* ── FIXED BOTTOM CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div
          style={{
            maxWidth: 430,
            margin: '0 auto',
            padding: '12px 16px',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
            background: 'linear-gradient(to top, #0f172a 70%, transparent)',
          }}
        >
          <button
            onClick={() => {
              if (!selected) return;
              const col = router.query.collection || 'general';
              if (selected === 'Mixed') {
                router.push(`/quiz?subject=Mixed&topic=Mixed&count=25&collection=${col}`);
                return;
              }
              router.push(`/quiz-setup?subject=${encodeURIComponent(selected)}&collection=${encodeURIComponent(col)}`);
            }}
            disabled={!selected}
            className={`w-full py-4 rounded-2xl font-display font-bold text-base transition-all flex items-center justify-center gap-2 ${
              selected
                ? 'bg-emerald-500 text-white btn-breathe active:scale-95 duration-100 shadow-cta'
                : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {selected ? 'Set up your quiz' : 'Select a subject first'}
            {selected && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
