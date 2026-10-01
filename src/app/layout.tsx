
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
    // `icons.apple` e' omesso apposta. Next genera da questo campo un
    // <link rel="apple-touch-icon"> SENza media query, che competesca con i
    // due dichiarati a mano qui sotto in <head>: su un iPhone in tema scuro
    // quello senza condizioni puo' vincere e far prendere l'icona sbagliata,
    // che e' esattamente il difetto da correggere. I due link espliciti sono
    // l'unico modo per distinguere il tema su iOS.
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
      <head>
        {/*
          Icona della home screen su iOS, per tema scuro.

          Il campo `icons.apple` del metadata serve gia' il caso generale, ma
          iOS non lo distingue per tema: con la sola dichiarazione in metadata
          un iPhone in modalita' scura può prendere la versione pensata per lo
          schema chiaro, che è una versione trasparente e su uno sfondo scuro
          risulta illeggibile.

          Qui si dichiarano entrambe, con la media query, in modo che quella
          scura valga quando il tema e' scuro. Il file e' gia' a sfondo pieno,
          quindi non serve composing: e' lo stesso logo su nero.
        */}
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
          media="(prefers-color-scheme: dark)"
        />
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon-light.png"
          media="(prefers-color-scheme: light)"
        />
      </head>
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
