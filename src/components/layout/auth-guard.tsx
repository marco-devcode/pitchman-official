"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SplashScreen } from '@/components/layout/splash-screen';
import { useStatsStore } from '@/store/useStatsStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { useAppStore } from '@/store/useAppStore';


export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { hasInitialized, setHasInitialized } = useAppStore();

  // Pagine pubbliche (legali, landing e sondaggi giocatore via token): non richiedono autenticazione
  const isPublicLegal =
    pathname === '/termini' ||
    pathname === '/privacy' ||
    pathname === '/landing' ||
    pathname.startsWith('/sondaggio');

  const { fetchSettings } = useSettingsStore();
  const { fetchAll: fetchSeasons, resetSeasons } = useSeasonsStore();
  const { loadDetailedStats } = useStatsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isInitialized) return;

    if (!isAuthenticated || !user) {
      resetSeasons();
      return;
    }

    if (hasInitialized) return;

    let cancelled = false;
    // Garanzia hard-cap: lo splash screen non deve mai bloccarsi oltre 3s su reti lente
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setHasInitialized(true);
    }, 3000);

    const scheduleBackgroundWarmup = () => {
      setTimeout(() => {
        if (cancelled) return;
        const seasonId = useSeasonsStore.getState().activeSeason?.id;
        if (seasonId) {
          void loadDetailedStats(seasonId);
        }
      }, 250);
    };

    const initData = async () => {
      const seasonsState = useSeasonsStore.getState();
      const sameUserCachedSeason =
        seasonsState.ownerUserId === user.id && seasonsState.activeSeason !== null;

      if (seasonsState.ownerUserId && seasonsState.ownerUserId !== user.id) {
        resetSeasons();
      }

      if (sameUserCachedSeason) {
        // Ingresso immediato con stagione in cache; refresh e stats partono in background
        setHasInitialized(true);
        void Promise.allSettled([fetchSettings(user.id), fetchSeasons()]).then(() => {
          scheduleBackgroundWarmup();
        });
        return;
      }

      try {
        await Promise.all([
          fetchSettings(user.id),
          fetchSeasons(),
        ]);
      } catch (error) {
        console.error("Global init error:", error);
      } finally {
        if (!cancelled) {
          setHasInitialized(true);
          scheduleBackgroundWarmup();
        }
      }
    };

    void initData();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [mounted, isInitialized, isAuthenticated, user, hasInitialized, fetchSettings, fetchSeasons, resetSeasons, loadDetailedStats, setHasInitialized]);

  useEffect(() => {
    if (mounted && isInitialized && !isAuthenticated && pathname !== '/login' && !isPublicLegal) {
      router.push('/login');
    }
  }, [isAuthenticated, isInitialized, pathname, router, mounted, isPublicLegal]);

  const isLoginPage = pathname === '/login';

  // Hydration guard: show splash screen until mounted on client
  if (!mounted) {
    return <SplashScreen />;
  }

  // Se siamo in login o in una pagina legale pubblica, non blocchiamo mai il rendering
  if (isLoginPage || isPublicLegal) {
    return <>{children}</>;
  }

  // Aspettiamo che firebase e i dati globali siano pronti prima di entrare
  if (!isInitialized || (isAuthenticated && !hasInitialized)) {
    return <SplashScreen />;
  }

  // Se non autenticato, reindirizziamo ma mostriamo splash nel frattempo
  if (!isAuthenticated) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
