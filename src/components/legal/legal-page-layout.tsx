"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, FileText } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  activeDoc: 'privacy' | 'termini';
  children: React.ReactNode;
}

export function LegalPageLayout({
  title,
  lastUpdated,
  activeDoc,
  children,
}: LegalPageLayoutProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(isAuthenticated ? '/' : '/login');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-black dark:text-white transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full border-b border-border dark:border-brand-green/20 bg-background/80 dark:bg-black/80 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2 rounded-xl text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isAuthenticated ? "Torna all'app" : "Accedi"}
              </span>
            </Button>

            <div className="h-4 w-px bg-border/60 dark:bg-brand-green/20 hidden sm:block" />

            <Link href={isAuthenticated ? "/" : "/login"} className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <div className="p-1 bg-muted dark:bg-black border border-border dark:border-brand-green/30 rounded-lg">
                <img src="/favicon-16x16_light.png" alt="Logo" className="h-5 w-5 object-contain dark:hidden" />
                <img src="/favicon-16x16.png" alt="Logo" className="h-5 w-5 object-contain hidden dark:block" />
              </div>
              <span className="text-sm font-black tracking-tight uppercase">PitchMan</span>
            </Link>
          </div>

          {/* Switch Document Nav */}
          <div className="flex items-center gap-1.5 bg-muted/50 dark:bg-card/20 p-1 rounded-xl border border-border/60 dark:border-brand-green/20 text-xs font-bold">
            <Link
              href="/privacy"
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeDoc === 'privacy'
                  ? 'bg-primary text-primary-foreground dark:bg-brand-green dark:text-black shadow-sm font-black'
                  : 'text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Privacy</span>
            </Link>
            <Link
              href="/termini"
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeDoc === 'termini'
                  ? 'bg-primary text-primary-foreground dark:bg-brand-green dark:text-black shadow-sm font-black'
                  : 'text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Termini</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="mb-8 border-b border-border dark:border-brand-green/20 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green border border-primary/20 dark:border-brand-green/30 text-[11px] font-bold uppercase tracking-wider mb-3">
            Informativa Legale Ufficiale
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground dark:text-white mb-2">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/60 font-medium">
            Ultimo aggiornamento: <strong className="text-foreground dark:text-white">{lastUpdated}</strong>
          </p>
        </div>

        <div className="space-y-8 text-foreground/90 dark:text-white/90 leading-relaxed text-sm sm:text-base">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border dark:border-brand-green/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground dark:text-white/50">
          <p>© {new Date().getFullYear()} PitchMan. Tutti i diritti riservati.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 font-bold">
            <Link href="/landing" className="hover:underline hover:text-primary dark:hover:text-brand-green transition-colors">
              Scopri PitchMan
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:underline hover:text-primary dark:hover:text-brand-green transition-colors">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link href="/termini" className="hover:underline hover:text-primary dark:hover:text-brand-green transition-colors">
              Termini di Servizio
            </Link>
            <span>&bull;</span>
            <Link href={isAuthenticated ? "/" : "/login"} className="hover:underline hover:text-primary dark:hover:text-brand-green transition-colors">
              {isAuthenticated ? "Dashboard" : "Accedi"}
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
