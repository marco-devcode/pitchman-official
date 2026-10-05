"use client";


import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Shield, Server } from 'lucide-react';
import { GuideDialog } from './guide-dialog';
import { InstallPWA } from './install-pwa';

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/calendario", label: "Calendario" },
  { href: "/allenamento", label: "Allenamento" },
  { href: "/membri", label: "Rosa" },
  { href: "/altro", label: "Impostazioni" },
];

/**
 * Navigazione del DEVELOPER: solo backend.
 *
 * Il developer non e' un allenatore: non ha una squadra, quindi Dashboard,
 * Rosa, Calendario e Allenamento gli mostrerebbero una stagione vuota e la
 * tentazione di creare una stagione dal piu' inutile dei tre, cioe' il caso in
 * cui il dato si crea per sbaglio. Per questo la nav da allenatore sparisce
 * del tutto e il suo mondo e' questo.
 *
 * `permessi` e `salute` erano due voci separate qui e nel bottom-nav; qui sono
 * una voce sola perche' la lista sotto e' l'unica che conta. Il nome "Backend"
 * copre entrambe.
 */
const developerNavItems = [
  { href: "/admin", label: "Backend" },
  { href: "/admin/plans", label: "Piani" },
];

export function AppHeader() {
  const user = useAuthStore((state) => state.user);
  const teamName = useSettingsStore((state) => state.teamName);
  const pathname = usePathname();
  
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-background dark:bg-black border-b border-border dark:border-brand-green/20 px-4 md:px-8 shadow-sm dark:shadow-themesoft transition-all duration-300">
      <div className="flex items-center gap-10">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="p-1.5 bg-muted dark:bg-black border border-border dark:border-brand-green/20 rounded-xl transition-colors">
            <img src="/favicon-16x16_light.png" alt="App Logo" className="h-7 w-7 object-contain drop-shadow dark:hidden" />
            <img src="/favicon-16x16.png" alt="App Logo" className="h-7 w-7 object-contain drop-shadow hidden dark:block" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter leading-none text-foreground dark:text-white">{teamName || 'PitchMan'}</span>
            <span className="text-[7px] uppercase font-bold tracking-[0.3em] text-muted-foreground dark:text-white/30 mt-0.5">Tactical Manager</span>
          </div>
        </Link>

        {/* Desktop Navigation. Il developer vede la sua lista, non quella da
            allenatore: vedi developerNavItems per perche'. */}
        <nav className="hidden md:flex items-center gap-1.5">
          {(user?.role === 'developer' ? developerNavItems : navItems).map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                  isActive 
                    ? "bg-primary/5 dark:bg-black text-primary dark:text-brand-green border-primary/50 dark:border-brand-green shadow-sm dark:shadow-theme-strong" 
                    : "text-muted-foreground dark:text-white/40 border-transparent hover:text-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

      </div>

      {user && (
        <div className="flex items-center gap-3">
          {/* PWA Install Button */}
          <InstallPWA />
          
          {/* Help Button */}
          <GuideDialog />

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[10px] font-black text-foreground dark:text-white uppercase leading-none">
              {user.username}
            </span>
            <span className="text-[8px] font-bold text-primary dark:text-brand-green uppercase tracking-tighter mt-1">
              Online
            </span>
          </div>
          <div className="h-9 w-9 rounded-xl bg-muted dark:bg-black border border-border dark:border-brand-green/30 flex items-center justify-center text-foreground dark:text-white font-black text-xs shadow-sm dark:shadow-theme">
            {user.username.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </header>
  );
}
