import './globals.css';
import { Inter } from 'next/font/google';
import ThemeProvider from '@/components/ui/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import Providers from './providers';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Chess Arena — Play Chess Online',
    template: '%s | Chess Arena',
  },
  description:
    'Play chess in real-time, compete in tournaments, and connect with players from around the world.',
  keywords: [
    'chess',
    'chess online',
    'play chess',
    'chess tournaments',
    'chess arena',
    'chess rating',
    'elo',
  ],
  authors: [{ name: 'Chess Arena' }],
  openGraph: {
    type: 'website',
    title: 'Chess Arena — Play Chess Online',
    description:
      'Play chess in real-time, compete in tournaments, and connect with players from around the world.',
    siteName: 'Chess Arena',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chess Arena — Play Chess Online',
    description:
      'Play chess in real-time, compete in tournaments, and connect with players from around the world.',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#080a14' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased flex flex-col">
        <ThemeProvider>
          <ToastProvider>
            <Providers>
              <div className="flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1 flex flex-col">{children}</main>
                <Footer />
              </div>
            </Providers>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
