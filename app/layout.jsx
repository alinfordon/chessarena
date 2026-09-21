import './globals.css';
import { Inter } from 'next/font/google';
import ThemeProvider from '@/components/ui/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import Providers from './providers';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import {
  SITE_CREATOR,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from '@/lib/site';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Play Chess Online`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_CREATOR, url: SITE_URL }],
  creator: SITE_CREATOR,
  publisher: SITE_CREATOR,
  category: 'games',
  referrer: 'origin-when-cross-origin',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Play Chess Online`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Play Chess Online`,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': ['Organization', 'SportsOrganization'],
      '@id': `${SITE_URL}/#organization`,
      name: SITE_CREATOR,
      url: SITE_URL,
      brand: SITE_NAME,
      description: `${SITE_NAME} is built by ${SITE_CREATOR}.`,
    },
    {
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
      },
      creator: { '@id': `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
