import { cardStyles, spacing } from '@/lib/designTokens';

export default function AppCard({
  as: Component = 'div',
  variant = 'base',
  interactive = false,
  className = '',
  style,
  children,
  ...props
}) {
  const base = cardStyles[variant] || cardStyles.base;
  const interaction = interactive ? cardStyles.interactive : '';
  const classes = `${base} ${spacing.cardPadding} ${interaction} ${className}`.trim();

  return (
    <Component className={classes} style={style} {...props}>
      {children}
    </Component>
  );
}
