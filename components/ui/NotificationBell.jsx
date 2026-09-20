'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  X,
  Swords,
  Trophy,
  MessageCircle,
  UserPlus,
  Check,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { DropdownMenu } from './Dropdown';
import Button from './Button';

const STORAGE_KEY = 'ca:notifications:v1';

function loadSaved() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 100);
  } catch {
    return [];
  }
}

function saveNotifs(arr) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 100)));
    }
  } catch {}
}

function iconForType(type) {
  switch (type) {
    case 'game_started':
    case 'game_invite':
      return Swords;
    case 'tournament_started':
    case 'tournament_registered':
      return Trophy;
    case 'friend_request':
      return UserPlus;
    case 'chat_message':
      return MessageCircle;
    default:
      return Bell;
  }
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

export default function NotificationBell() {
  const { socket, connected } = useSocket();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState(() => loadSaved());
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    saveNotifs(notifications);
  }, [notifications]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const push = (payload) => {
      if (!payload) return;
      const n = {
        id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: payload.type || 'info',
        title: payload.title || 'Notificare',
        message: payload.message || '',
        actionHref: payload.actionHref || null,
        actionLabel: payload.actionLabel || null,
        read: false,
        createdAt: payload.createdAt || Date.now(),
      };
      setNotifications((prev) => [n, ...prev].slice(0, 100));
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(n.title, { body: n.message || '' });
        }
      } catch {}
    };

    const onGameStarted = (data) => {
      push({
        type: 'game_started',
        title: 'Meciul a început!',
        message: data?.opponent ? `Îți joci împotriva ${data.opponent}.` : 'Un meci nou a început.',
        actionHref: data?.gameId ? `/game/${data.gameId}` : null,
        actionLabel: 'Deschide joc',
      });
    };

    const onGameInvite = (data) => {
      push({
        type: 'game_invite',
        title: 'Invitație joc',
        message: data?.from ? `${data.from} te invită la un joc de șah.` : 'Ai o invitație nouă.',
        actionHref: data?.gameId ? `/game/${data.gameId}` : null,
        actionLabel: 'Acceptă',
      });
    };

    const onTournamentStarted = (data) => {
      push({
        type: 'tournament_started',
        title: 'Turneu început',
        message: data?.name ? `Turneul ${data.name} a început.` : 'Un turneu la care participi a început.',
        actionHref: data?.tournamentId ? `/tournaments/${data.tournamentId}` : null,
        actionLabel: 'Vezi turneu',
      });
    };

    const onUserBanned = (data) => {
      push({
        type: 'system',
        title: 'Cont suspendat',
        message: data?.reason || 'Contul tău a fost suspendat temporar.',
      });
    };

    const onGenericNotify = (data) => {
      push(data);
    };

    socket.on('notify:game_started', onGameStarted);
    socket.on('notify:game_invite', onGameInvite);
    socket.on('notify:tournament_started', onTournamentStarted);
    socket.on('notify', onGenericNotify);
    socket.on('user:banned', onUserBanned);

    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {}

    return () => {
      socket.off('notify:game_started', onGameStarted);
      socket.off('notify:game_invite', onGameInvite);
      socket.off('notify:tournament_started', onTournamentStarted);
      socket.off('notify:', onGenericNotify);
      socket.off('user:banned', onUserBanned);
    };
  }, [socket, isAuthenticated]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const markRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const removeOne = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAction = (n) => {
    markRead(n.id);
    setOpen(false);
    if (n.actionHref) {
      router.push(n.actionHref);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          className={clsx(
            'relative inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
            unreadCount > 0 && 'text-brand-600 dark:text-brand-400'
          )}
          aria-label="Notificări"
        >
          {unreadCount > 0 ? (
            <>
              <BellRing size={18} className={clsx('animate-pulse')} />
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </>
          ) : (
            <Bell size={18} />
          )}
          {!connected && (
            <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-950" title="Deconectat" />
          )}
        </button>
      }
    >
      <div className="w-[360px] sm:w-[420px] max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-brand-600 dark:text-brand-400" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Notificări</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {unreadCount} necitite · total {notifications.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <Button variant="ghost" size="iconSm" title="Marchează toate ca citite" onClick={markAllRead} disabled={unreadCount === 0}>
                  <Check size={15} />
                </Button>
                <Button variant="ghost" size="iconSm" title="Șterge toate" onClick={clearAll}>
                  <Trash2 size={15} />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Bell size={20} className="text-slate-400" />
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fără notificări</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Vei primi notificări când încep meciurile sau când ești invitat la jocuri.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.slice(0, 30).map((n) => {
                const Icon = iconForType(n.type);
                return (
                  <li
                    key={n.id}
                    className={clsx(
                      'group px-4 py-3 transition-colors',
                      !n.read && 'bg-brand-50/50 dark:bg-brand-950/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          'mt-0.5 h-9 w-9 shrink-0 rounded-lg flex items-center justify-center',
                          !n.read
                            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div
                              className={clsx(
                                'text-sm truncate',
                                !n.read
                                  ? 'font-bold text-slate-900 dark:text-slate-100'
                                  : 'font-medium text-slate-700 dark:text-slate-300'
                              )}
                            >
                              {n.title}
                            </div>
                            {n.message && (
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                                {n.message}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                              {fmtTime(n.createdAt)}
                            </span>
                            <button
                              onClick={() => removeOne(n.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              title="Șterge"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                        {n.actionHref && (
                          <button
                            onClick={() => handleAction(n)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline underline-offset-2"
                          >
                            {n.actionLabel || 'Vezi'}
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                      {!n.read && (
                        <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DropdownMenu>
  );
}
