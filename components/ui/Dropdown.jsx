'use client';

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

export function DropdownMenu({ trigger, children, className = '', align = 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const escHandler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx('relative inline-block', className)}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={clsx(
            'absolute z-50 mt-2 min-w-[12rem] rounded-xl border bg-white dark:bg-slate-900 shadow-xl animate-fade-in',
            'border-slate-200 dark:border-slate-700 py-1',
            align === 'end' && 'right-0',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2'
          )}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  icon: Icon,
  className = '',
  danger = false,
  disabled = false,
}) {
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
      }}
      disabled={disabled}
      className={clsx(
        'w-full flex items-center gap-2 px-3.5 py-2 text-sm transition-colors text-left',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : danger
            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
        className
      )}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function DropdownSeparator({ className = '' }) {
  return (
    <div
      className={clsx(
        'my-1 h-px bg-slate-200 dark:bg-slate-700',
        className
      )}
    />
  );
}

export function DropdownLabel({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'px-3.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider',
        className
      )}
    >
      {children}
    </div>
  );
}

export default DropdownMenu;
