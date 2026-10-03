"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useStatsStore } from "@/store/useStatsStore";
import { startSyncListeners } from "@/lib/sync-queue";

/**
 * Starts the offline sync queue listeners. When the browser regains
 * connectivity, any mutations queued while offline are flushed to Firestore.
 * Renders nothing.
 */
export function OfflineSyncProvider() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user?.id) return;
    const cleanup = startSyncListeners(user.id);
    return cleanup;
  }, [user?.id]);

  // Rientro dalla connessione: le mutazioni accodate offline vengono scritte
  // su Firestore in quel momento, quindi gli aggregati in memoria sono
  // sicuramente stale. Il flag si mette qui e non dentro flushQueue per non
  // dover importare uno store dentro lib/ (sync-queue e' gia' importato dai
  // store: l'import inverso sarebbe un ciclo).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => useStatsStore.getState().markStatsDirty();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return null;
}
