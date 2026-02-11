import * as React from 'react';

export type ButtonVariant = 'default' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  'ui-button';

const variantClass: Record<ButtonVariant, string> = {
  default: 'ui-button--default',
  outline: 'ui-button--outline',
  ghost: 'ui-button--ghost',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'ui-button--sm',
  md: 'ui-button--md',
  lg: 'ui-button--lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', ...props }, ref) => {
    const classes = [base, variantClass[variant], sizeClass[size], className]
      .filter(Boolean)
      .join(' ');

    return <button ref={ref} className={classes} {...props} />;
  },
);

Button.displayName = 'Button';

