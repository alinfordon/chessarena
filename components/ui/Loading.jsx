import clsx from 'clsx';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-3',
    xl: 'h-16 w-16 border-4',
  };
  return (
    <svg
      className={clsx('animate-spin text-brand-500', sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function LoadingScreen({ label = 'Loading...', fullScreen = false }) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-4',
        fullScreen ? 'min-h-screen w-full' : 'min-h-[300px] w-full'
      )}
    >
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-slate-200 dark:border-slate-700" />
        <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-brand-500 animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/70',
        className
      )}
    />
  );
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
          <Icon size={32} />
        </div>
      )}
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, retry, className = '' }) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
    >
      <div className="mb-4 p-4 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          {description}
        </p>
      )}
      {retry && <div className="mt-5">{retry}</div>}
    </div>
  );
}

export default { Spinner, LoadingScreen, Skeleton, EmptyState, ErrorState };
