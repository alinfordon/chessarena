'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Github, Twitter, MessageCircle, Mail, Heart } from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  if (pathname?.startsWith('/game/') || pathname?.startsWith('/admin')) return null;

  const links = {
    Product: [
      { label: 'Play Chess', href: '/play' },
      { label: 'Lobby', href: '/lobby' },
      { label: 'Tournaments', href: '/tournaments' },
      { label: 'Leaderboard', href: '/leaderboard' },
    ],
    Community: [
      { label: 'Forum', href: '#' },
      { label: 'Discord', href: '#' },
      { label: 'Twitter', href: '#' },
      { label: 'Blog', href: '#' },
    ],
    Support: [
      { label: 'Help Center', href: '#' },
      { label: 'Contact Us', href: '#' },
      { label: 'Report Bug', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  };

  const socials = [
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Github, href: '#', label: 'GitHub' },
    { icon: MessageCircle, href: '#', label: 'Discord' },
    { icon: Mail, href: '#', label: 'Email' },
  ];

  return (
    <footer className="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-brand-500/30">
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
              <span className="text-lg font-extrabold tracking-tight">
                Chess<span className="gradient-text">Arena</span>
              </span>
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mb-5">
              Play chess in real-time, compete in tournaments, and connect with
              players from around the world. A product of Sky Game &amp; Robotics Development.
            </p>
            <div className="flex items-center gap-2">
              {socials.map(({ icon: Icon, href, label }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <Icon size={18} />
                </Link>
              ))}
            </div>
          </div>

          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {currentYear} Chess Arena. All rights reserved.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            Made with <Heart size={14} className="text-red-500 fill-red-500" /> by
            Sky Game &amp; Robotics Development
          </p>
        </div>
      </div>
    </footer>
  );
}
