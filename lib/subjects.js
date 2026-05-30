export const subjectStyles = {
  'Polity':           { gradient: 'from-blue-600 to-indigo-700',    icon: '⚖️',  color: 'blue' },
  'Geography':        { gradient: 'from-[#14B8A6] to-teal-700',    icon: '🌍',  color: 'teal' },
  'Ancient History':  { gradient: 'from-amber-400 to-orange-500',   icon: '🏺',  color: 'amber' },
  'Medieval History': { gradient: 'from-rose-400 to-pink-500',      icon: '🏰',  color: 'rose' },
  'Modern History':   { gradient: 'from-violet-400 to-purple-500',  icon: '🗺️',  color: 'violet' },
  'Economics':        { gradient: 'from-amber-500 to-orange-600',   icon: '📈',  color: 'amber' },
  'Physics':          { gradient: 'from-violet-600 to-purple-700',  icon: '⚛️',  color: 'violet' },
  'Chemistry':        { gradient: 'from-cyan-500 to-sky-700',       icon: '🧪',  color: 'cyan' },
  'Biology':          { gradient: 'from-green-500 to-green-700',    icon: '🧬',  color: 'green' },
  'Current Affairs':  { gradient: 'from-red-500 to-rose-700',       icon: '📰',  color: 'red' },
  'Static GK':        { gradient: 'from-teal-500 to-cyan-700',      icon: '📖',  color: 'teal' },
  'Mixed':            { gradient: 'from-fuchsia-500 to-pink-700',   icon: '🎯',  color: 'fuchsia' },
};

export function getSubjectStyle(subject) {
  return subjectStyles[subject] || {
    gradient: 'from-slate-600 to-slate-700',
    icon: '📚',
    color: 'slate',
  };
}
