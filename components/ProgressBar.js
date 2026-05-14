export default function ProgressBar({ current, total }) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="typo-small-label !text-orange-400 uppercase !tracking-widest">
          Q {current} / {total}
        </span>
        <span className="typo-small-label !text-gray-400 !font-bold">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(249,115,22,0.28)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
