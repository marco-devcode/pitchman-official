
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppHeaderWrapper } from '@/components/layout/app-header-wrapper';
import { BottomNavWrapper } from '@/components/layout/bottom-nav-wrapper';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AuthGuard } from '@/components/layout/auth-guard';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { PrefetchProvider } from '@/hooks/PrefetchProvider';
import { OfflineSyncProvider } from '@/components/layout/offline-sync-provider';
import { PT_Sans } from 'next/font/google';

const ptSans = PT_Sans({ 
  weight: ['400', '700'], 
  subsets: ['latin'], 
  variable: '--font-pt-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#080808',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'PitchMan',
  description: 'La tua app per la gestione della tua squadra',
  manifest: '/manifest.json',
  icons: {
    // Dichiarate per esteso perche' il browser, non trovando nulla, indovina
    // e va a prendere /favicon.ico. Con le dichiarazioni usa i file giusti:
    // il 32px per la scheda e il 192 per i dispositivi che lo chiedono.
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-32x32_light.png', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: light)' },
    ],
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PitchMan',
  },
  formatDetection: {
    telephone: false,
  },
};

import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { FloatingMatchTimer } from '@/components/partite/floating-match-timer';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head />
      <body className={`font-body antialiased ${ptSans.variable}`}>
        <FirebaseClientProvider>
          <ThemeProvider>
            <AuthGuard>
              <PrefetchProvider>
                <div className="relative flex min-h-screen w-full flex-col">
                  <AppHeaderWrapper />
                  <main className="flex-1 p-3 pb-24 md:p-10 lg:p-16">
                    {children}
                  </main>
                  <BottomNavWrapper />
                  <FloatingMatchTimer />
                </div>
              </PrefetchProvider>
            </AuthGuard>
            <Toaster />
            <OfflineSyncProvider />
          </ThemeProvider>
        </FirebaseClientProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
