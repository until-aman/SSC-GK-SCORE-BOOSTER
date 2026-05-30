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
    subjects: ['Polity', 'Geography', 'Economics', 'Current Affairs', 'Static GK'],
  },
  {
    label:    'Science',
    subjects: ['Physics', 'Chemistry', 'Biology'],
  },
  {
    label:    'History',
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
──────────────────────────────────────────────────────────────────────────── */
function SubjectGrid({ subjects, displayCounts, selected, setSelected, startIdx = 0 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '0 20px 14px' }}>
      {subjects.map((subject, i) => {
        const theme      = THEME[subject] ?? {};
        const isSelected = selected === subject;
        const hex        = theme.accent || '#64748B';
        const glow       = theme.glow   || 'rgba(100,116,139,0.18)';
        const rgb        = hexRgb(hex);
        const count      = displayCounts ? displayCounts[subject] : null;
        const enterClass = `card-enter card-enter-${Math.min(startIdx + i + 1, 6)}`;

        return (
          <button
            key={subject}
            onClick={() => {
              setSelected(isSelected ? null : subject);
              // Short haptic pulse on selection; silent on deselect
              if (!isSelected) navigator.vibrate?.(8);
            }}
            className={`subject-card ${isSelected ? 'selected' : ''} ${enterClass}`}
            style={{ '--accent': hex, '--accent-glow': glow }}
          >
            {/* Icon box */}
            <div className="subject-icon-box">
              {theme.icon ?? subjectStyles[subject]?.icon}
            </div>

            {/* Name + subtitle + bottom row */}
            <div style={{ position: 'relative', zIndex: 1, paddingTop: 4 }}>
              <p className="t-card-title font-display" style={{ color: '#ffffff', marginBottom: 2 }}>
                {subject}
              </p>
              <p className="t-badge" style={{ color: 'rgba(148,163,184,0.55)', marginBottom: 6, marginTop: 0, lineHeight: 1.5 }}>
                {theme.subtitle || ''}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                {isSelected ? (
                  <span className="t-badge" style={{ color: hex, background: `color-mix(in srgb, ${hex} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${hex} 30%, transparent)`, borderRadius: 20, padding: '2px 8px', lineHeight: 1.6 }}>
                    ✓ Selected
                  </span>
                ) : count != null ? (
                  <span className="t-badge" style={{ color: 'rgba(148,163,184,0.70)', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: 20, padding: '2px 8px', lineHeight: 1.6 }}>
                    {count.toLocaleString()} Qs
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)' }}>—</span>
                )}
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: `rgba(${rgb},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="2.8" opacity="0.8"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  )}
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
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');

  const collection = router.query.collection || 'general';
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
    setSelected(null);
  }, [collection]);

  useEffect(() => {
    if (!isFetching) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, [isFetching]);

  const displayCounts = subjectCounts ?? (isError ? FALLBACK_SUBJECT_COUNTS : null);

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

      <style>{`
        /* ── Shimmer skeleton ── */
        @keyframes shimmer {
          0%   { background-position:  200% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton-card {
          background: linear-gradient(90deg, #172D47 25%, #1E3554 50%, #172D47 75%);
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.07);
        }
        .skeleton-bone {
          background: linear-gradient(90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.10) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
          border-radius: 6px;
        }

        /* ── Subject card base ── */
        .subject-card {
          position: relative;
          min-height: 130px;
          padding: 14px;
          border-radius: 22px;
          background: #172D47;
          border: 1px solid rgba(255, 255, 255, 0.10);
          overflow: hidden;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: left;
          transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 0.18s ease,
                      border-color 0.18s ease;
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
          border: 1.5px solid var(--accent);
          box-shadow: 0 0 0 1px var(--accent-glow),
                      0 12px 32px var(--accent-glow);
          transform: translateY(-2px);
        }

        /* Press state — overrides selected transform */
        .subject-card:active {
          transform: scale(0.97) !important;
          transition: transform 0.08s ease;
        }


        /* ── Icon container ── */
        .subject-icon-box {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          background: color-mix(in srgb, var(--accent) 20%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
          font-size: 18px;
          line-height: 1;
          /* Force consistent emoji rendering across platforms */
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
        }

        .subj-search::placeholder { color: #94A3B8; }
        .subj-search:focus { outline: none; }

        /* Search container focus ring */
        .subj-search-wrap {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .subj-search-wrap:focus-within {
          border-color: rgba(255, 107, 22, 0.45) !important;
          box-shadow: 0 0 0 3px rgba(255, 107, 22, 0.12);
        }
      `}</style>

      <div className="min-h-screen pb-28" style={{ background: 'var(--bg-app)' }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '24px 20px 12px' }}>
          <button
            onClick={() => router.back()}
            className="active:scale-95 transition-transform"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', flexShrink: 0, marginTop: 2,
            }}
            aria-label="Go back"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="t-page-title font-display" style={{ color: '#ffffff' }}>
              Choose a Subject
            </h1>
            <p className="t-page-subtitle" style={{ color: 'rgba(148,163,184,0.8)' }}>
              Select one to start your GK quiz
            </p>
          </div>
        </div>

        {/* ── SEARCH BAR ── */}
        <div style={{ padding: '0 20px 12px' }}>
          <div className="subj-search-wrap" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-card)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '10px 14px',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="2.3" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="subj-search"
              aria-label="Search subjects"
              placeholder="Search subjects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: '#fff', fontSize: 15, lineHeight: '22px', fontFamily: 'inherit',
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

        {/* ── MIXED GK CHALLENGE — featured full-width card ── */}
        <div style={{ padding: '0 20px 14px' }}>
          <button
            onClick={() => {
              navigator.vibrate?.(10);
              const col = router.query.collection || 'general';
              router.push(`/quiz?subject=Mixed&topic=Mixed&count=25&collection=${col}`);
            }}
            className="w-full active:scale-[0.98] transition-transform"
            style={{
              position: 'relative',
              width: '100%',
              padding: '12px 16px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, #7C3AED 0%, #C2410C 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              boxShadow: '0 8px 28px rgba(124,58,237,0.30)',
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
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, lineHeight: 1,
            }}>
              🎯
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <p className="t-card-title font-display" style={{ color: '#ffffff', margin: 0 }}>
                  Mixed GK Challenge
                </p>
                <span className="t-badge" style={{
                  letterSpacing: '0.06em', color: '#fde68a',
                  background: 'rgba(253,230,138,0.18)',
                  border: '1px solid rgba(253,230,138,0.35)',
                  borderRadius: 20, padding: '2px 7px',
                  textTransform: 'uppercase', flexShrink: 0,
                }}>
                  Recommended
                </span>
              </div>
              <p className="t-card-subtitle" style={{ color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>
                All subjects • Exam-like practice
              </p>
            </div>

            {/* Arrow */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
        </div>

        {/* ── SLOW FETCH HINT — only shown on initial load (no cached data yet) ── */}
        {isFetching && slow && !isError && displayCounts === null && (
          <div style={{
            margin: '0 20px 10px', padding: '10px 14px', borderRadius: 14,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
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
                  Couldn't load subjects
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.4 }}>
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
            fontSize: 13, color: 'rgba(148,163,184,0.45)',
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
          <SubjectGrid subjects={searchResults} displayCounts={displayCounts} selected={selected} setSelected={setSelected} startIdx={0} />
        )}

        {/* ── SECTIONED LAYOUT — shown when not searching ── */}
        {!search && displayCounts !== null && SUBJECT_SECTIONS.map((section) => {
          const subjects = sectionSubjects(section.subjects);
          if (subjects.length === 0) return null;
          return (
            <div key={section.label} style={{ marginBottom: 20 }}>
              {/* Section label */}
              <p className="t-section-label" style={{
                color: '#7A8FA6',
                margin: '0 20px 8px',
              }}>
                {section.label}
              </p>
              <SubjectGrid subjects={subjects} displayCounts={displayCounts} selected={selected} setSelected={setSelected} startIdx={0} />
            </div>
          );
        })}

        {/* bottom breathing room above sticky CTA */}
        <div style={{ height: 24 }} />
      </div>

      {/* ── FIXED BOTTOM CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div style={{
          maxWidth: 430, margin: '0 auto',
          padding: '10px 16px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          background: 'linear-gradient(to top, var(--bg-app) 72%, transparent)',
        }}>

          {/* Main CTA button */}
          <button
            onClick={() => {
              if (!selected) return;
              const col = router.query.collection || 'general';
              router.push(`/quiz-setup?subject=${encodeURIComponent(selected)}&collection=${encodeURIComponent(col)}`);
            }}
            disabled={!selected || displayCounts === null}
            className={selected ? 'active:scale-[0.98]' : ''}
            style={{
              width: '100%',
              padding: '15px 20px',
              borderRadius: 18,
              border: selected ? 'none' : '1px solid rgba(148,163,184,0.16)',
              background: displayCounts === null
                ? '#172D47'
                : selected
                  ? 'linear-gradient(135deg, #FF8A1F, #FF5A00)'
                  : '#172D47',
              boxShadow: selected ? '0 12px 28px rgba(255,106,0,0.28)' : 'none',
              color: selected ? '#ffffff' : '#64748B',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: selected ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'box-shadow 0.2s ease, transform 0.1s ease',
            }}
          >
            {displayCounts === null ? (
              'Loading subjects…'
            ) : selected ? (
              <>
                Start {selected} Quiz
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            ) : (
              'Choose any subject to continue'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
