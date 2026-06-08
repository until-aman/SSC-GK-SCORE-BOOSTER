/**
 * Loader — custom CSS spinner (no external GIF dependency).
 *
 * Props:
 *   label      string          — optional text below spinner
 *   size       "sm"|"md"|"lg"  — 28 / 52 / 80 px  (default "md")
 *   fullScreen boolean         — fixed full-viewport overlay
 *   card       boolean         — card-framed inline loader
 */

const SIZE = { sm: 28, md: 52, lg: 80 };
const STROKE = { sm: 3, md: 4, lg: 5 };

function Spinner({ size = 'md' }) {
  const s = SIZE[size] || SIZE.md;
  const stroke = STROKE[size] || STROKE.md;
  const r = (s - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ animation: 'ssc-spin 0.9s linear infinite' }}
    >
      <style>{`
        @keyframes ssc-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Track */}
      <circle
        cx={s / 2}
        cy={s / 2}
        r={r}
        fill="none"
        stroke="var(--color-border-light)"
        strokeWidth={stroke}
      />
      {/* Arc — 75 % of circumference */}
      <circle
        cx={s / 2}
        cy={s / 2}
        r={r}
        fill="none"
        stroke="var(--color-brand-teal)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={0}
        transform={`rotate(-90 ${s / 2} ${s / 2})`}
      />
    </svg>
  );
}

export default function Loader({ label = '', size = 'md', fullScreen = false, card = false }) {
  const inner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Spinner size={size} />
      {label && (
        <p className="max-w-[220px] text-center font-sans text-sm font-medium leading-snug text-text-muted">
          {label}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(246,249,252,0.86)', backdropFilter: 'blur(4px)' }}
      >
        {inner}
      </div>
    );
  }

  if (card) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-border-subtle bg-white p-8 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        {inner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-6">
      {inner}
    </div>
  );
}
