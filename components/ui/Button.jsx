'use client';

import clsx from 'clsx';
import dynamic from 'next/dynamic';

const Link = dynamic(() => import('next/link').then((m) => m.default), {
  ssr: true,
});

const variants = {
  primary:
    'gradient-bg text-white shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 hover:-translate-y-0.5',
  secondary:
    'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
  outline:
    'bg-transparent border-2 border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40',
  danger:
    'bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700',
  success:
    'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700',
};

const sizes = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  xl: 'h-14 px-8 text-lg gap-3',
  icon: 'h-10 w-10 p-0',
  iconSm: 'h-8 w-8 p-0',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  type = 'button',
  href,
  as: As,
  ...props
}) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none select-none';

  const classes = clsx(
    baseClasses,
    variants[variant],
    sizes[size],
    className
  );

  const content = (
    <>
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && children}
    </>
  );

  if (href && !As) {
    return (
      <Link
        href={href}
        className={clsx(classes, disabled && 'pointer-events-none')}
        aria-disabled={disabled || loading}
        {...props}
      >
        {content}
      </Link>
    );
  }

  if (As) {
    return (
      <As className={classes} disabled={disabled || loading} {...props}>
        {content}
      </As>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
}
