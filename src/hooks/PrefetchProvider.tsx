'use client';

import { usePrefetch } from './usePrefetch';
import { usePresence } from './usePresence';
import { PresenceAlert } from '@/components/squadra/presence-alert';

export function PrefetchProvider({ children }: { children: React.ReactNode }) {
  usePrefetch();
  usePresence();
  return (
    <>
      {children}
      {/* Fuori da AuthGuard puo' sembrare strano, ma il popup deve poter
          comparire anche mentre l'app e' in una schermata di transizione:
          dentro il provider dei dati e' il posto in cui vive gia' tutto il
          resto dello stato per sessione. */}
      <PresenceAlert />
    </>
  );
}
