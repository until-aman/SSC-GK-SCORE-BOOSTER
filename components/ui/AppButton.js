import { buttonStyles } from '@/lib/designTokens';

const variants = {
  primary: buttonStyles.primary,
  secondary: buttonStyles.secondary,
  ghost: buttonStyles.ghost,
};

export default function AppButton({
  as: Component = 'button',
  variant = 'primary',
  className = '',
  style,
  children,
  ...props
}) {
  const classes = `${variants[variant] || variants.primary} ${className}`.trim();

  return (
    <Component className={classes} style={style} {...props}>
      {children}
    </Component>
  );
}
