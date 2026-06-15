import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';
// subjectStyles kept only as an emergency icon fallback in SubjectGrid
import { subjectStyles } from '@/lib/subjects';
import { getTopics } from '@/lib/data/questionData';

// Grouped sections — Mixed is excluded (it has its own featured card)
const SUBJECT_SECTIONS = [
  {
    label:    'Popular Subjects',
    pyqLabel: 'Core SSC Subjects',
    subjects: ['Polity', 'Geography', 'Economics', 'Current Affairs', 'Static GK'],
  },
  {
    label:    'Science',
    pyqLabel: 'Science',
    subjects: ['Physics', 'Chemistry', 'Biology'],
  },
  {
    label:    'History',
    pyqLabel: 'History',
    subjects: ['Modern History', 'Ancient History', 'Medieval History'],
  },
];

// Flat list derived from sections — used for search filtering
const ALL_SUBJECTS = SUBJECT_SECTIONS.flatMap(s => s.subjects);

/* ─── Single source of truth for all subject theming ────────────────────────
   camelCase keys match the developer config; THEME provides fast label lookup.
──────────────────────────────────────────────────────────────────────────── */
const SUBJECT_THEME = {
  polity:         { label: 'Polity',           icon: '⚖️',  subtitle: 'Constitution • Govt',    accent: '#6366F1', glow: 'rgba(99,102,241,0.18)'   },
  geography:      { label: 'Geography',         icon: '🌍',  subtitle: 'Maps • Climate',          accent: '#06B6D4', glow: 'rgba(6,182,212,0.18)'    },
  ancientHistory: { label: 'Ancient History',   icon: '🏺',  subtitle: 'Vedic • Empires',         accent: '#D97706', glow: 'rgba(217,119,6,0.18)'    },
  medievalHistory:{ label: 'Medieval History',  icon: '🏰',  subtitle: 'Sultanate • Mughals',     accent: '#DC2626', glow: 'rgba(220,38,38,0.16)'    },
  modernHistory:  { label: 'Modern History',    icon: '🗺️', subtitle: 'Freedom • Reforms',       accent: '#8B5CF6', glow: 'rgba(139,92,246,0.18)'   },
  economics:      { label: 'Economics',          icon: '📈',  subtitle: 'Banking • Budget',        accent: '#F97316', glow: 'rgba(249,115,22,0.18)'   },
  physics:        { label: 'Physics',            icon: '⚛️', subtitle: 'Motion • Energy',         accent: '#2563EB', glow: 'rgba(37,99,235,0.18)'    },
  chemistry:      { label: 'Chemistry',          icon: '🧪',  subtitle: 'Elements • Reactions',   accent: '#14B8A6', glow: 'rgba(20,184,166,0.18)'   },
  biology:        { label: 'Biology',            icon: '🧬',  subtitle: 'Human Body • Life',       accent: '#16A34A', glow: 'rgba(22,163,74,0.18)'    },
  currentAffairs: { label: 'Current Affairs',   icon: '📰',  subtitle: 'Latest GK',               accent: '#DB2777', glow: 'rgba(219,39,119,0.18)'   },
  staticGk:       { label: 'Static GK',          icon: '📚',  subtitle: 'Awards • Books',          accent: '#14B8A6', glow: 'rgba(20,184,166,0.18)'   },
  mixed:          { label: 'Mixed',              icon: '🎯',  subtitle: 'All Subjects',            accent: '#9333EA', glow: 'rgba(147,51,234,0.20)'   },
};

// Fast O(1) lookup by label string — used everywhere the subject name is the key
const THEME = Object.fromEntries(
  Object.values(SUBJECT_THEME).map(t => [t.label, t])
);

/* Converts "#RRGGBB" → "R,G,B" for use inside rgba(...) */
function hexRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ].join(',');
}

/* ─── Fallback subject list ───────────────────────────────────────────────────
   Safety net so the grid is never blank on the very first visit.
   null count = "unknown but likely present" → passes the visibility filter.
   Replaced with real counts once the API responds.
──────────────────────────────────────────────────────────────────────────── */
const FALLBACK_SUBJECTS = [
  'Polity', 'Geography', 'Economics',
  'Ancient History', 'Medieval History', 'Modern History',
  'Physics', 'Chemistry', 'Biology',
  'Current Affairs', 'Static GK', 'Mixed',
];

const FALLBACK_SUBJECT_COUNTS = Object.fromEntries(
  FALLBACK_SUBJECTS.map(s => [s, null])
);

/* ─── localStorage bridge ────────────────────────────────────────────────────
   Mirrors every successful fetch into localStorage so returning users get
   instant data even after a hard refresh. v3 prefix busts stale entries.
──────────────────────────────────────────────────────────────────────────── */
const CACHE_PREFIX = 'ssc_subjects_v3_';
const SUBJECTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function readSubjectCache(collection) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + collection);
    if (!raw) return undefined;
    const entry = JSON.parse(raw);
    // Support both old format (plain object) and new format ({ data, cachedAt })
    if (entry && typeof entry.cachedAt === 'number') {
      if (Date.now() - entry.cachedAt > SUBJECTS_CACHE_TTL) return undefined; // expired
      return entry.data;
    }
    return entry; // old format — return as-is (no TTL check for legacy entries)
  } catch {
    return undefined;
  }
}

function writeSubjectCache(collection, counts) {
  try {
    localStorage.setItem(CACHE_PREFIX + collection, JSON.stringify({ data: counts, cachedAt: Date.now() }));
  } catch {}
}

/* ─── Query function ─────────────────────────────────────────────────────── */
async function fetchSubjectCounts(collection) {
  const result = await getTopics({ collection });
  const counts = result.data?.subjectCounts || {};
  writeSubjectCache(collection, counts);
  return counts;
}

/* ─── Shared card grid ────────────────────────────────────────────────────────
   Renders a 2-column grid of subject cards. Used both for sectioned layout
   and for flat search results. startIdx offsets the enter-animation delay.
   isPYQ: hides subtitle, shows "PYQs" label, reduces card min-height.
──────────────────────────────────────────────────────────────────────────── */
function SubjectGrid({ subjects, displayCounts, collection, router, startIdx = 0, isPYQ = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '0 20px 14px' }}>
      {subjects.map((subject, i) => {
        const theme      = THEME[subject] ?? {};
        const hex        = theme.accent || '#64748B';
        const glow       = theme.glow   || 'rgba(100,116,139,0.18)';
        const rgb        = hexRgb(hex);
        const count      = displayCounts ? displayCounts[subject] : null;
        const enterClass = `card-enter card-enter-${Math.min(startIdx + i + 1, 6)}`;

        return (
          <button
            key={subject}
            onClick={() => {
              navigator.vibrate?.(8);
              router.push(`/quiz-setup?subject=${encodeURIComponent(subject)}&collection=${encodeURIComponent(collection)}&sourceScreen=dashboard`);
            }}
            className={`subject-card${isPYQ ? ' subject-card-pyq' : ''} ${enterClass}`}
            style={{ '--accent': hex, '--accent-glow': glow }}
          >
            {/* Icon box */}
            <div className="subject-icon-box">
              {theme.icon ?? subjectStyles[subject]?.icon}
            </div>

            {/* Name + [subtitle in normal mode] + count/arrow row */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', marginBottom: isPYQ ? 4 : 2 }}>
                {subject}
              </p>
              {!isPYQ && (
                <p className="t-badge" style={{ color: 'var(--ssc-text-secondary)', marginBottom: 6, marginTop: 0, lineHeight: 1.5 }}>
                  {theme.subtitle || ''}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                {count != null ? (
                  <span className="t-badge" style={{ color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.16)', borderRadius: 20, padding: '2px 8px', lineHeight: 1.6 }}>
                    {count.toLocaleString()} {isPYQ ? 'PYQs' : 'Questions'}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--ssc-text-muted)' }}>—</span>
                )}
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: `rgba(${rgb},0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="2.8" opacity="0.8"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function SubjectsPage() {
  const router = useRouter();
  const [search, setSearch]     = useState('');

  const collection = router.query.collection || 'general';
  const isPYQ      = collection === 'PYQ';
  const [slow, setSlow] = useState(false);

  const { data: subjectCounts, isFetching, isError, refetch } = useQuery({
    queryKey:  ['subjects', collection],
    queryFn:   () => fetchSubjectCounts(collection),
    enabled:   router.isReady,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime:    1000 * 60 * 60 * 24 * 7,
    retry:     1,
    initialData:          () => readSubjectCache(collection),
    initialDataUpdatedAt: 0,
  });

  // Reset selection if the collection changes (e.g. user navigates to a
  // different quiz set — a subject valid in one set may not exist in another)
  useEffect(() => {
    // no selected state; cards navigate directly to setup
  }, [collection]);

  useEffect(() => {
    if (!isFetching) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, [isFetching]);

  const displayCounts = subjectCounts ?? (isError ? FALLBACK_SUBJECT_COUNTS : null);

  // Total PYQ count — sum of all known subject counts for the context card
  const totalPYQCount = displayCounts
    ? ALL_SUBJECTS.reduce((sum, s) => sum + (displayCounts[s] || 0), 0)
    : null;

  // When searching: flat filtered list across all sections
  // When not searching: null (sections render themselves with their own filter)
  const searchResults = search && displayCounts
    ? ALL_SUBJECTS.filter(s =>
        (displayCounts[s] == null || displayCounts[s] > 0) &&
        s.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  // Helper: filter a section's subjects against displayCounts
  const sectionSubjects = (subjects) =>
    displayCounts
      ? subjects.filter(s => displayCounts[s] == null || displayCounts[s] > 0)
      : [];

  return (
    <>
      <Head><title>Choose a Subject — SSC GK Score Booster</title></Head>

      <style suppressHydrationWarning>{`
        /* ── Shimmer skeleton ── */
        @keyframes shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton-card {
          background: linear-gradient(90deg, #E8F8F6 25%, #F8FAFC 50%, #E8F8F6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
          border-radius: 22px;
          border: 1px solid var(--ssc-border-soft);
        }
        .skeleton-bone {
          background: linear-gradient(90deg,
            rgba(221,232,240,0.45) 25%,
            rgba(232,248,246,0.95) 50%,
            rgba(221,232,240,0.45) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
          border-radius: 6px;
        }

        /* ── Subject card base ── */
        .subject-card {
          position: relative;
          min-height: 116px;
          padding: 14px;
          border-radius: 18px;
          background: var(--ssc-surface);
          border: 1px solid var(--ssc-border-soft);
          overflow: hidden;
          cursor: pointer;
          display: grid;
          grid-template-columns: 40px 1fr;
          align-items: center;
          gap: 12px;
          text-align: left;
          transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.18s ease,
                      border-color 0.18s ease;
          box-shadow: var(--ssc-shadow-card);
        }

        /* PYQ mode — no subtitle → shorter card */
        .subject-card-pyq {
          min-height: 90px;
        }

        /* Per-card accent glow — top-left radial */
        .subject-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at top left,
            var(--accent-glow),
            transparent 58%
          );
          pointer-events: none;
        }

        /* Selected state */
        .subject-card.selected {
          border: 1.5px solid var(--ssc-teal);
          box-shadow: 0 0 0 3px rgba(14,165,164,0.12),
                      var(--ssc-shadow-card);
          transform: translateY(-2px);
        }

        /* Press state — overrides selected transform */
        .subject-card:active {
          transform: scale(0.97) !important;
          transition: transform 0.08s ease;
        }


        /* ── Icon container ── */
        .subject-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          background: color-mix(in srgb, var(--accent) 16%, white);
          border: 1px solid color-mix(in srgb, var(--accent) 20%, white);
          font-size: 18px;
          line-height: 1;
          /* Force consistent emoji rendering across platforms */
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
        }

        .subj-search::placeholder { color: var(--ssc-text-muted); }
        .subj-search:focus { outline: none; }

        /* Search container focus ring */
        .subj-search-wrap {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .subj-search-wrap:focus-within {
          border-color: rgba(14, 165, 164, 0.45) !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.12);
        }
      `}</style>

      <div
        className="min-h-screen pb-28"
        style={{
          background: 'var(--ssc-bg)',
          '--bg-app': 'var(--ssc-bg)',
          '--bg-card': 'var(--ssc-surface)',
          '--border-soft': 'var(--ssc-border-soft)',
          '--text-primary': 'var(--ssc-text-primary)',
          '--text-secondary': 'var(--ssc-text-secondary)',
          '--text-muted': 'var(--ssc-text-muted)',
        }}
      >

        {/* ── HEADER ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center', gap: 8, padding: '24px 20px 16px' }}>
          <button
            onClick={() => router.back()}
            className="active:scale-95 transition-transform"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ssc-text-primary)', flexShrink: 0, marginTop: 2,
              boxShadow: 'var(--ssc-shadow-card)',
            }}
            aria-label="Go back"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <h1 className="t-page-title font-display" style={{ color: 'var(--ssc-text-primary)', fontSize: 18 }}>
              Select a subject
            </h1>
            <p className="t-page-subtitle" style={{ color: 'var(--ssc-text-secondary)', fontSize: 12 }}>
              {isPYQ ? 'Choose a subject to start previous year questions' : 'Choose a subject to continue'}
            </p>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ssc-text-primary)', fontWeight: 800 }}>
            ?
          </div>
        </div>

        {/* ── SEARCH BAR ── */}
        <div style={{ padding: '0 20px 12px' }}>
          <div className="subj-search-wrap" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--ssc-surface)',
            border: '1px solid var(--ssc-border-soft)',
            borderRadius: 14,
            padding: '10px 14px',
            boxShadow: 'var(--ssc-shadow-card)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2.3" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="subj-search"
              aria-label="Search subjects"
              placeholder={isPYQ ? 'Search PYQ subjects...' : 'Search subjects…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: 'var(--ssc-text-primary)', fontSize: 15, lineHeight: '22px', fontFamily: 'inherit',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1, color: 'rgba(148,163,184,0.6)', display: 'flex' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── PYQ CONTEXT CARD — shown only in PYQ mode ── */}
        {isPYQ && (
          <div style={{ padding: '0 20px 14px' }}>
            <div style={{
              background: 'var(--ssc-surface)',
              border: '1px solid var(--ssc-border-soft)',
              borderRadius: 20,
              padding: '16px',
              boxShadow: 'var(--ssc-shadow-card)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Subtle teal glow top-left */}
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top left, rgba(20,184,166,0.08), transparent 60%)', pointerEvents: 'none' }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative', zIndex: 1 }}>
                {/* Icon */}
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22, lineHeight: 1, fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>
                  📚
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: '0 0 4px' }}>
                    Previous Year Questions
                  </p>
                  <p className="t-card-subtitle" style={{ color: 'var(--ssc-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Practice real SSC exam questions subject-wise.
                  </p>
                </div>

                {/* Trophy decoration */}
                <div style={{ fontSize: 30, flexShrink: 0, lineHeight: 1, fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>
                  🏆
                </div>
              </div>

              {/* Chips row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, position: 'relative', zIndex: 1 }}>
                {[
                  totalPYQCount ? `${totalPYQCount.toLocaleString()} PYQs` : '7,000+ PYQs',
                  'Exam-level',
                  'Subject-wise',
                ].map(chip => (
                  <span key={chip} className="t-badge" style={{
                    color: 'var(--ssc-teal)',
                    background: 'var(--ssc-teal-soft)',
                    border: '1px solid rgba(14,165,164,0.20)',
                    borderRadius: 20,
                    padding: '3px 10px',
                    lineHeight: 1.6,
                  }}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MIXED GK CHALLENGE — featured full-width card (hidden in PYQ mode) ── */}
        {!isPYQ && (
          <div style={{ padding: '0 20px 14px' }}>
            <button
              onClick={() => {
                navigator.vibrate?.(10);
                const col = router.query.collection || 'general';
                router.push(`/quiz?subject=Mixed&topic=Mixed&count=25&collection=${col}&sourceScreen=dashboard`);
              }}
              className="w-full active:scale-[0.98] transition-transform"
              style={{
                position: 'relative',
                width: '100%',
                padding: '12px 16px',
                borderRadius: 20,
                background: 'linear-gradient(135deg, #FFF8F4 0%, #E8F8F6 100%)',
                border: '1px solid var(--ssc-border-soft)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                textAlign: 'left',
                boxShadow: 'var(--ssc-shadow-card)',
              }}
            >
              {/* Subtle shimmer streak */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
                pointerEvents: 'none',
              }} />

              {/* Icon box */}
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: '#FFF1E8',
                border: '1px solid rgba(255,106,0,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, lineHeight: 1,
              }}>
                🎯
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: 0 }}>
                    Mixed GK Challenge
                  </p>
                  <span className="t-badge" style={{
                    letterSpacing: '0.06em', color: 'var(--ssc-teal)',
                    background: 'var(--ssc-teal-soft)',
                    border: '1px solid rgba(14,165,164,0.20)',
                    borderRadius: 20, padding: '2px 7px',
                    textTransform: 'uppercase', flexShrink: 0,
                  }}>
                    Recommended
                  </span>
                </div>
                <p className="t-card-subtitle" style={{ color: 'var(--ssc-text-secondary)', margin: '4px 0 0' }}>
                  All subjects • Exam-like practice
                </p>
              </div>

              {/* Arrow */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--ssc-surface)',
                border: '1px solid var(--ssc-border-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2.8">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* ── SLOW FETCH HINT — only shown on initial load (no cached data yet) ── */}
        {isFetching && slow && !isError && displayCounts === null && (
          <div style={{
            margin: '0 20px 10px', padding: '10px 14px', borderRadius: 14,
            background: 'var(--ssc-warning-soft)', border: '1px solid rgba(245,158,11,0.24)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>⏳</span>
            <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.9)', fontWeight: 600, margin: 0 }}>
              Taking longer than usual…
            </p>
          </div>
        )}

        {/* ── ERROR BANNER ── */}
        {isError && (
          <div style={{
            margin: '0 20px 10px', padding: '13px 16px', borderRadius: 18,
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1.3 }}>⚠️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', margin: '0 0 2px' }}>
                  Couldn&apos;t load subjects
                </p>
                <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Check your connection and try again.
                </p>
              </div>
              <button
                onClick={() => refetch()}
                style={{
                  flexShrink: 0, padding: '6px 13px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)',
                  color: '#fca5a5', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── NO SEARCH RESULTS ── */}
        {search && searchResults && searchResults.length === 0 && (
          <p style={{
            fontSize: 13, color: 'var(--ssc-text-muted)',
            textAlign: 'center', margin: '28px 20px 8px', lineHeight: 1.5,
          }}>
            No subjects match &ldquo;{search}&rdquo;
          </p>
        )}

        {/* ── SKELETON (first visit, no cache) ── */}
        {displayCounts === null && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '4px 20px 8px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card" style={{ minHeight: 130, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="skeleton-bone" style={{ width: 34, height: 34, borderRadius: 11 }} />
                <div>
                  <div className="skeleton-bone" style={{ height: 12, width: '62%', marginBottom: 6 }} />
                  <div className="skeleton-bone" style={{ height: 10, width: '38%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SEARCH RESULTS — flat grid, no section labels ── */}
        {searchResults && searchResults.length > 0 && (
          <SubjectGrid subjects={searchResults} displayCounts={displayCounts} collection={collection} router={router} startIdx={0} isPYQ={isPYQ} />
        )}

        {/* ── SECTIONED LAYOUT — shown when not searching ── */}
        {!search && displayCounts !== null && SUBJECT_SECTIONS.map((section) => {
          const subjects = sectionSubjects(section.subjects);
          if (subjects.length === 0) return null;
          return (
            <div key={section.label} style={{ marginBottom: 20 }}>
              {/* Section label */}
              <p className="t-section-label" style={{
                color: 'var(--ssc-text-secondary)',
                margin: '0 20px 8px',
              }}>
                {isPYQ ? section.pyqLabel : section.label}
              </p>
              <SubjectGrid subjects={subjects} displayCounts={displayCounts} collection={collection} router={router} startIdx={0} isPYQ={isPYQ} />
            </div>
          );
        })}

        {/* bottom breathing room above bottom nav */}
        <div style={{ height: 88 }} />
      </div>
    </>
  );
}
