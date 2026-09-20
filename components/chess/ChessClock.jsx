'use client';

import clsx from 'clsx';
import { formatTime } from '@/utils/time';

export default function ChessClock({
  whiteTime,
  blackTime,
  turn,
  orientation = 'white',
  className = '',
}) {
  const meTime = orientation === 'white' ? whiteTime : blackTime;
  const oppTime = orientation === 'white' ? blackTime : whiteTime;
  const meActive = (orientation === 'white' && turn === 'w') ||
                   (orientation === 'black' && turn === 'b');
  const oppActive = !meActive;

  const ClockCell = ({ label, time, active, top }) => {
    const critical = time < 30;
    const danger = time < 10;
    return (
      <div className={clsx(
        'flex items-center justify-between px-4 py-2 sm:px-6 sm:py-3 rounded-xl transition-all duration-200',
        active
          ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40 scale-[1.02]'
          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300',
        critical && active && '!bg-red-500 !shadow-red-500/40 animate-pulse',
        danger && active && '!font-black tracking-wider',
        className
      )}>
        <span className={clsx(
          'text-xs sm:text-sm font-semibold uppercase tracking-wide opacity-90',
          top && 'order-2 sm:order-none'
        )}>
          {label}
        </span>
        <span className={clsx(
          'font-mono font-bold tabular-nums',
          'text-xl sm:text-2xl md:text-3xl',
          danger && 'text-2xl sm:text-3xl md:text-4xl'
        )}>
          {formatTime(time)}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-[min(92vw,92vh,720px)] mx-auto">
      <ClockCell
        label={orientation === 'white' ? 'Negru' : 'Alb'}
        time={oppTime}
        active={oppActive}
        top
      />
      <ClockCell
        label={orientation === 'white' ? 'Alb' : 'Negru'}
        time={meTime}
        active={meActive}
      />
    </div>
  );
}
