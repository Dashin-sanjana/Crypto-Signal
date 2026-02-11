import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', ...props }, ref) => {
    const classes = ['ui-card', className].filter(Boolean).join(' ');
    return <div ref={ref} className={classes} {...props} />;
  },
);

Card.displayName = 'Card';

