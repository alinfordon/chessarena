'use client';

import { useState, createContext, useContext } from 'react';
import clsx from 'clsx';

const TabsContext = createContext(null);

export function Tabs({ defaultValue, children, className = '', value, onValueChange }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const setValue = (v) => {
    if (!isControlled) setInternalValue(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '' }) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/60 p-1 gap-1',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = '' }) {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const isActive = ctx.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.setValue(value)}
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200',
        isActive
          ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = '' }) {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={clsx('mt-4 animate-fade-in', className)}
    >
      {children}
    </div>
  );
}

export default Tabs;
