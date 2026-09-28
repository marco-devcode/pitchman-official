'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { usePresenceStore } from '@/store/usePresenceStore';
import { presenceRepository } from '@/lib/repositories/presence-repository';

/**
 * Segnala la presenza dell'utente sulla stagione attiva e ascolta chi c'e'.
 *
 * Rimane agganciata a (userId, seasonId): cambiando stagione si smonta tutto
 * e si riparte, altrimenti l'utente resterebbe dichiarato online su una
 * stagione che non sta guardando e gli altri riceverebbero un avviso falso.
 */
export function usePresence() {
  const user = useAuthStore((s) => s.user);
  const activeSeason = useSeasonsStore((s) => s.activeSeason);
  const setOnline = usePresenceStore((s) => s.setOnline);
  const reset = usePresenceStore((s) => s.reset);

  const userId = user?.id;
  const seasonId = activeSeason?.id;

  // Il teardown si esegue dentro l'effect: usarlo come dipendenza farebbe
  // ripartire il ciclo a ogni render del consumer.
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!userId || !seasonId) {
      reset();
      return;
    }

    const stopBeat = presenceRepository.startHeartbeat(seasonId, userId);
    const unsub = presenceRepository.subscribe(
      seasonId,
      userId,
      (online) => setOnline(online),
      () => setOnline([])
    );

    cleanupRef.current = () => {
      stopBeat();
      unsub();
      reset();
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [userId, seasonId, setOnline, reset]);
}
