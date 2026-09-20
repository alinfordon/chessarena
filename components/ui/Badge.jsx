import clsx from 'clsx';

const variants = {
  default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  primary: 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/30',
  success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30',
  warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30',
  danger: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30',
  purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30',
  gold: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  silver: 'bg-gradient-to-r from-slate-300 to-slate-400 text-white',
  bronze: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white',
};

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-emerald-500',
            variant === 'danger' && 'bg-red-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'primary' && 'bg-brand-500',
            !['success', 'danger', 'warning', 'primary'].includes(variant) && 'bg-current opacity-60'
          )}
        />
      )}
      {children}
    </span>
  );
}
