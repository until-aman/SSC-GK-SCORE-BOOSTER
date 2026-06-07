// components/MentorMessage.jsx
// Renders mentor avatar + Hinglish guidance message.
// variant: 'info' | 'warning' | 'success' | 'strict'

export default function MentorMessage({ message, variant = 'info' }) {
  const styles = {
    info:    'border-teal-500/30 bg-teal-500/10 text-teal-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    success: 'border-green-500/30 bg-green-500/10 text-green-100',
    strict:  'border-red-500/30 bg-red-500/10 text-red-100',
  };
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${styles[variant] || styles.info}`}>
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-base">
        🎯
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-0.5">
          Aapka Mentor
        </p>
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
