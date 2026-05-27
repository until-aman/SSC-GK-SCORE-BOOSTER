import { typography } from '@/lib/designTokens';

export default function SectionHeader({
  title,
  subtitle,
  action,
  className = '',
  titleClassName = '',
  subtitleClassName = '',
  style,
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`.trim()} style={style}>
      <div style={{ minWidth: 0 }}>
        {title && (
          <h2 className={`${typography.sectionTitle} ${titleClassName}`.trim()}>
            {title}
          </h2>
        )}
        {subtitle && (
          <p className={`${typography.bodySmall} mt-1 ${subtitleClassName}`.trim()}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
