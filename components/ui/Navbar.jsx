'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Crown, Users, Trophy, Swords, User, LogIn, LogOut, Menu, X, Home } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import Button from './Button';
import Avatar from './Avatar';
import Badge from './Badge';
import NotificationBell from './NotificationBell';
import clsx from 'clsx';
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
} from './Dropdown';
import { useState } from 'react';

export default function Navbar() {
  const { theme, toggleTheme, mounted } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/lobby', label: 'Lobby', icon: Users },
    { href: '/play', label: 'Play', icon: Swords },
    { href: '/tournaments', label: 'Tournaments', icon: Trophy },
    { href: '/leaderboard', label: 'Leaderboard', icon: Crown },
  ];

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 text-white"
                >
                  <path
                    d="M8 2L4 6v5l8 11 8-11V6l-4-4H8z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 10a2 2 0 100-4 2 2 0 000 4z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              Chess<span className="gradient-text">Arena</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'relative px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2',
                  isActive(href)
                    ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="iconSm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={!mounted ? 'opacity-0' : ''}
            >
              {mounted && theme === 'dark' ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </Button>

            <NotificationBell />

            <div className="hidden sm:flex items-center gap-2">
              {isAuthenticated && user ? (
                <DropdownMenu
                  trigger={
                    <button className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <Avatar
                        src={user.avatar}
                        alt={user.username}
                        size="sm"
                        status={user.isOnline ? 'online' : 'offline'}
                      />
                      <div className="text-left hidden lg:block">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                          {user.username}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {user.rating} ELO
                        </div>
                      </div>
                    </button>
                  }
                >
                  <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-700 sm:hidden">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={user.avatar}
                        alt={user.username}
                        size="md"
                        status={user.isOnline ? 'online' : 'offline'}
                      />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {user.username}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Rating: {user.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DropdownItem icon={User} onClick={() => (window.location.href = '/profile')}>
                    My Profile
                  </DropdownItem>
                  <DropdownItem icon={Trophy}>
                    <Link href="/leaderboard">Leaderboard</Link>
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem
                    icon={LogOut}
                    danger
                    onClick={() => logout('/')}
                  >
                    Log out
                  </DropdownItem>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="ghost" size="sm"  href="/login">
                    <LogIn size={16} />
                    Login
                  </Button>
                  <Button size="sm"  href="/register">
                    Sign up
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="ghost"
              size="iconSm"
              className="md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 animate-fade-in border-t border-slate-200/60 dark:border-slate-800/60 mt-2">
            <nav className="flex flex-col gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors',
                    isActive(href)
                      ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
              <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-3">
                    <Avatar
                      src={user.avatar}
                      alt={user.username}
                      size="md"
                      status={user.isOnline ? 'online' : 'offline'}
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {user.username}
                        <Badge variant="primary" size="sm">
                          {user.rating}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {user.gamesPlayed || 0} games played
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <User size={16} />
                    My Profile
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      logout('/');
                    }}
                    className="px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 w-full text-left"
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-3 pt-2">
                  <Button variant="secondary"  href="/login" onClick={() => setMobileOpen(false)}>
                    <LogIn size={16} />
                    Login
                  </Button>
                  <Button  href="/register" onClick={() => setMobileOpen(false)}>
                    Create Account
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
