import clsx from 'clsx';

const sizes = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-xl',
  xl: 'h-20 w-20 text-2xl',
  '2xl': 'h-28 w-28 text-4xl',
};

const statusColors = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-400',
  away: 'bg-amber-500',
  playing: 'bg-brand-500 animate-pulse',
};

export default function Avatar({
  src,
  alt = '',
  size = 'md',
  status = null,
  className = '',
  ring = false,
}) {
  return (
    <div className={clsx('relative inline-flex', className)}>
      <div
        className={clsx(
          'rounded-full overflow-hidden flex items-center justify-center font-bold text-white bg-gradient-to-br from-brand-500 to-purple-600 ring-2 ring-white dark:ring-slate-900',
          sizes[size],
          ring && 'ring-4 ring-brand-500/30'
        )}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="uppercase tracking-wide">{alt?.[0] || '?'}</span>
        )}
      </div>
      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-slate-900',
            sizes[size] === 'xs' && 'h-1.5 w-1.5',
            sizes[size] === 'sm' && 'h-2 w-2',
            (sizes[size] === 'md' || sizes[size] === 'lg') && 'h-3 w-3',
            (sizes[size] === 'xl' || sizes[size] === '2xl') && 'h-4 w-4',
            statusColors[status] || statusColors.offline
          )}
          title={status}
        />
      )}
    </div>
  );
}
