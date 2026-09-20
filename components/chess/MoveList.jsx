'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';

export default function MoveList({ moves = [], currentIndex = null, onMoveClick, className = '' }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current && (currentIndex === null || currentIndex === moves.length - 1)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else if (scrollRef.current && currentIndex !== null) {
      const target = scrollRef.current.querySelector(`[data-move-idx="${currentIndex}"]`);
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [moves.length, currentIndex]);

  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: { move: moves[i], idx: i },
      black: moves[i + 1] ? { move: moves[i + 1], idx: i + 1 } : null,
    });
  }

  return (
    <div className={clsx(
      'rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 overflow-hidden flex flex-col',
      className
    )}>
      <div className="px-3 py-1.5 border-b border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between shrink-0">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
          Lista mutărilor
        </h4>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {moves.length} mutări
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin min-h-0"
      >
        {pairs.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500 italic">
            Nicio mutare încă.
            <br />
            Începeți cu 1. e4 sau altă deschidere.
          </div>
        ) : (
          <div className="font-mono text-sm select-none">
            {pairs.map((p, idx) => (
              <div
                key={idx}
                className={clsx(
                  'grid grid-cols-[auto,1fr,1fr] gap-2 px-2 py-1.5 border-b border-slate-100/60 dark:border-slate-800/40 last:border-0',
                  idx % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''
                )}
              >
                <span className="text-slate-400 dark:text-slate-500 text-xs pt-0.5 w-6 text-right pr-1">
                  {p.num}.
                </span>
                <button
                  data-move-idx={p.white.idx}
                  type="button"
                  onClick={() => onMoveClick?.(p.white.idx)}
                  className={clsx(
                    'text-left px-1.5 py-0.5 rounded transition-colors truncate',
                    currentIndex === p.white.idx
                      ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-bold'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/40'
                  )}
                >
                  {p.white.move?.san || ''}
                </button>
                <button
                  data-move-idx={p.black?.idx}
                  type="button"
                  onClick={() => p.black && onMoveClick?.(p.black.idx)}
                  className={clsx(
                    'text-left px-1.5 py-0.5 rounded transition-colors truncate',
                    p.black && currentIndex === p.black.idx
                      ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-bold'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/40'
                  )}
                >
                  {p.black?.move?.san || ''}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
