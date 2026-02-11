import * as React from 'react';

type TabsValue = string;

export interface TabsProps {
  value: TabsValue;
  onValueChange: (value: TabsValue) => void;
  children: React.ReactNode;
  className?: string;
}

export const TabsContext = React.createContext<{
  value: TabsValue;
  onValueChange: (value: TabsValue) => void;
} | null>(null);

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className = '' }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={['ui-tabs', className].filter(Boolean).join(' ')}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TabsList: React.FC<TabsListProps> = ({ className = '', ...props }) => {
  return <div className={['ui-tabs__list', className].filter(Boolean).join(' ')} {...props} />;
};

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: TabsValue;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, className = '', ...props }) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  const isActive = ctx.value === value;
  const classes = [
    'ui-tabs__trigger',
    isActive ? 'ui-tabs__trigger--active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-selected={isActive}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    />
  );
};

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: TabsValue;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, className = '', ...props }) => {
  const ctx = React.useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return (
    <div
      className={['ui-tabs__content', className].filter(Boolean).join(' ')}
      role="tabpanel"
      {...props}
    />
  );
};

