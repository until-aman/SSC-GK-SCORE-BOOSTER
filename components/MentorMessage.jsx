import Lottie from 'lottie-react';
import mentorPointer from '@/public/animations/mentor-pointer.json';

export default function MentorMessage({ message, variant = 'info' }) {
  const accentColor = {
    info: 'border-l-orange-500',
    warning: 'border-l-amber-500',
    success: 'border-l-orange-400',
    strict: 'border-l-red-500',
  };

  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-slate-800 p-4 border-l-4 ${accentColor[variant] || accentColor.info}`}>
      <div className="flex-shrink-0 w-9 h-9">
        <Lottie
          animationData={mentorPointer}
          loop={false}
          autoplay={true}
          style={{ width: 36, height: 36 }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Aapka Mentor
        </p>
        <p className="text-sm text-slate-100 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
