'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import clsx from 'clsx';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const variants = {
  success: {
    icon: CheckCircle2,
    container:
      'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200/60 dark:border-emerald-800/40',
    iconColor: 'text-emerald-500',
    title: 'text-emerald-900 dark:text-emerald-100',
    desc: 'text-emerald-700 dark:text-emerald-300',
  },
  error: {
    icon: XCircle,
    container:
      'bg-red-50 dark:bg-red-950/70 border-red-200/60 dark:border-red-800/40',
    iconColor: 'text-red-500',
    title: 'text-red-900 dark:text-red-100',
    desc: 'text-red-700 dark:text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    container:
      'bg-amber-50 dark:bg-amber-950/70 border-amber-200/60 dark:border-amber-800/40',
    iconColor: 'text-amber-500',
    title: 'text-amber-900 dark:text-amber-100',
    desc: 'text-amber-700 dark:text-amber-300',
  },
  info: {
    icon: Info,
    container:
      'bg-brand-50 dark:bg-brand-950/70 border-brand-200/60 dark:border-brand-800/40',
    iconColor: 'text-brand-500',
    title: 'text-brand-900 dark:text-brand-100',
    desc: 'text-brand-700 dark:text-brand-300',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = 4000 }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const v = variants[t.variant] || variants.info;
          const Icon = v.icon;
          return (
            <div
              key={t.id}
              role="alert"
              className={clsx(
                'pointer-events-auto rounded-xl border p-4 shadow-lg backdrop-blur-sm animate-slide-up flex items-start gap-3',
                v.container
              )}
            >
              <Icon size={20} className={clsx('mt-0.5 flex-shrink-0', v.iconColor)} />
              <div className="flex-1 min-w-0">
                {t.title && (
                  <p className={clsx('font-semibold text-sm', v.title)}>
                    {t.title}
                  </p>
                )}
                {t.description && (
                  <p className={clsx('text-sm mt-0.5', v.desc)}>
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export default ToastProvider;
