'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative w-full rounded-2xl glass-strong shadow-2xl animate-slide-up',
          sizeClasses[size],
          'max-h-[90vh] overflow-hidden flex flex-col',
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-700/50">
            <div>
              {title && (
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </Button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 scrollbar-thin">
          {children}
        </div>
        {footer && (
          <div className="p-5 sm:p-6 border-t border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
