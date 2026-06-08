export function TeacherMentorIcon({ className = 'h-6 w-6' }) {
  return (
    <img
      src="/Mentor%20icon.png"
      alt=""
      aria-hidden="true"
      className={`${className} object-contain`}
    />
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
