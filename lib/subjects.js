export const subjectStyles = {
  'Polity':          { gradient: 'from-blue-600 to-indigo-700',   icon: '⚖️',  color: 'blue' },
  'Geography':       { gradient: 'from-emerald-600 to-teal-700',  icon: '🌍',  color: 'emerald' },
  'Economics':       { gradient: 'from-amber-500 to-orange-600',  icon: '📈',  color: 'amber' },
  'History':         { gradient: 'from-rose-600 to-pink-700',     icon: '🏛️',  color: 'rose' },
  'Physics':         { gradient: 'from-violet-600 to-purple-700', icon: '⚛️',  color: 'violet' },
  'Chemistry':       { gradient: 'from-cyan-500 to-sky-700',      icon: '🧪',  color: 'cyan' },
  'Biology':         { gradient: 'from-green-500 to-emerald-700', icon: '🧬',  color: 'green' },
  'Current Affairs': { gradient: 'from-red-500 to-rose-700',      icon: '📰',  color: 'red' },
};

export function getSubjectStyle(subject) {
  return subjectStyles[subject] || {
    gradient: 'from-slate-600 to-slate-700',
    icon: '📚',
    color: 'slate',
  };
}
