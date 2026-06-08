import { buttonStyles } from '@/lib/designTokens';

const variants = {
  primary: buttonStyles.primary,
  secondary: buttonStyles.secondary,
  teal: buttonStyles.teal,
  danger: buttonStyles.danger,
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
