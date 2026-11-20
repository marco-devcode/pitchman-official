import type { Metadata } from 'next';
import { Host_Grotesk, JetBrains_Mono } from 'next/font/google';
import './landing-taste.css';

const hostGrotesk = Host_Grotesk({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-host',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-jb-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PitchMan: software tattico e gestionale per squadre di calcio',
  description:
    'Rosa su 13 ruoli, lavagna esercizi 2D animata con Gemini AI, cronometro partita con recupero e test atletici in un unico archivio anche offline.',
  openGraph: {
    title: 'PitchMan: software tattico e gestionale per squadre di calcio',
    description:
      'Rosa su 13 ruoli, lavagna esercizi 2D animata con Gemini AI, cronometro partita con recupero e test atletici.',
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${hostGrotesk.variable} ${jetBrainsMono.variable} pm-taste`}
      data-type="software"
      data-radius="soft"
      data-buttons="arrow"
      data-motion="on"
    >
      {children}
    </div>
  );
}
