import clsx from 'clsx';

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border transition-all duration-300',
        'bg-white/80 dark:bg-slate-900/70',
        'border-slate-200/80 dark:border-slate-700/60',
        'shadow-sm hover:shadow-premium',
        hover && 'hover:-translate-y-1 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div
      className={clsx(
        'p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-700/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3
      className={clsx(
        'text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p
      className={clsx(
        'mt-1 text-sm text-slate-500 dark:text-slate-400',
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={clsx('p-5 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={clsx(
        'p-5 sm:p-6 border-t border-slate-200/60 dark:border-slate-700/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
