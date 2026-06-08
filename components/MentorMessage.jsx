export function TeacherMentorIcon({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 18.5V8.75l8-3.25 8 3.25v9.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11.25h9M7.5 14h6.25M7.5 16.75h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M15.25 17.25l4.25-4.25M19.5 13v3.5M19.5 13H16"
        stroke="#14B8A6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.75a3 3 0 0 1 6 0"
        stroke="#F97316"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MentorMessage({ message, variant = 'info' }) {
  const accentColor = {
    info: 'border-l-orange-500',
    warning: 'border-l-amber-500',
    success: 'border-l-teal-400',
    strict: 'border-l-red-500',
  };

  return (
    <div className="flex items-start">
      <div className="z-10 mt-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-orange-500/35 bg-gradient-to-br from-orange-500 via-orange-500/80 to-teal-500/80 text-white shadow-lg shadow-black/25">
        <TeacherMentorIcon className="h-6 w-6" />
      </div>
      <div className={`relative -ml-3 flex-1 rounded-2xl border border-white/[0.06] border-l-4 ${accentColor[variant] || accentColor.info} bg-slate-800 px-4 py-4 pl-7`}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
          AAPKA MENTOR
        </p>
        <p className="text-sm leading-relaxed text-slate-100">{message}</p>
      </div>
    </div>
  );
}
