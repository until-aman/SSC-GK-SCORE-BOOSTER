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

const VARIANT_STYLES = {
  info: {
    card: 'border-[#BDEDEA] bg-[#F2FCFA]',
    chip: 'bg-[#E8F8F6] text-[#0EA5A4] border-[#BDEDEA]',
  },
  warning: {
    card: 'border-[#F8D9A0] bg-[#FFF7E6]',
    chip: 'bg-[#FFF0CF] text-[#B45309] border-[#F8D9A0]',
  },
  success: {
    card: 'border-[#BDEDD8] bg-[#E7FAF3]',
    chip: 'bg-white text-[#0F9F75] border-[#BDEDD8]',
  },
  strict: {
    card: 'border-[#FBCACA] bg-[#FEECEC]',
    chip: 'bg-white text-[#DC2626] border-[#FBCACA]',
  },
};

export default function MentorMessage({ message, variant = 'info', compact = false }) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

  return (
    <div className={`flex items-start gap-3 rounded-[20px] border ${styles.card} ${compact ? 'p-3' : 'p-3.5'} shadow-[var(--ssc-shadow-card)]`}>
      <div className={`flex ${compact ? 'h-10 w-10' : 'h-16 w-16'} flex-shrink-0 items-end justify-center overflow-hidden rounded-2xl border ${styles.chip}`}>
        <TeacherMentorIcon className={compact ? 'h-8 w-8' : 'h-16 w-16'} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? 'text-sm' : 'text-base'} font-display font-black leading-tight text-ssc-text-primary`}>
          Aapka Mentor <span className="text-xs text-[#F59E0B]">✦</span>
        </p>
        <p className={`${compact ? 'mt-0.5 text-xs' : 'mt-1 text-xs'} font-semibold leading-relaxed text-ssc-text-primary`}>
          {message}
        </p>
      </div>
    </div>
  );
}
