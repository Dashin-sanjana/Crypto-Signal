import * as React from 'react';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = '', ...props }, ref) => {
    const classes = ['ui-scroll-area', className].filter(Boolean).join(' ');
    return <div ref={ref} className={classes} {...props} />;
  },
);

ScrollArea.displayName = 'ScrollArea';

