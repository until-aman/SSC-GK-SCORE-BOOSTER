import { formatLastUpdated } from '@/lib/clientCache';

function formatUpdatedText(updatedAt) {
  const formatted = formatLastUpdated(updatedAt);
  if (!formatted) return 'Updated recently';
  return `Updated ${formatted.charAt(0).toLowerCase()}${formatted.slice(1)}`;
}

export default function RefreshStatus({
  updatedAt,
  isRefreshing,
  onRefresh,
  label,
  refreshText = 'Refresh',
}) {
  const statusText = label || formatUpdatedText(updatedAt);

  return (
    <div
      className="flex items-center gap-1.5 text-[10px]"
      style={{ color: '#5B6B82', minWidth: 0, flexWrap: 'wrap' }}
    >
      <span>{statusText}</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="font-semibold active:opacity-70 disabled:opacity-60 ssc-focus-ring rounded-full"
        style={{
          color: '#0EA5A4',
          background: 'none',
          border: 'none',
          padding: '1px 2px',
          cursor: isRefreshing ? 'default' : 'pointer',
        }}
      >
        {isRefreshing ? 'Refreshing...' : refreshText}
      </button>
    </div>
  );
}
