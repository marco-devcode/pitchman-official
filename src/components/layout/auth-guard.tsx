"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SplashScreen } from '@/components/layout/splash-screen';
import { usePlayersStore } from '@/store/usePlayersStore';
import { useMatchesStore } from '@/store/useMatchesStore';
import { useTrainingStore } from '@/store/useTrainingStore';
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

  // Pagine legali sempre pubbliche (requisito legale, non servono auth)
  const isPublicLegal = pathname === '/termini' || pathname === '/privacy';

  const { fetchSettings } = useSettingsStore();
  const { fetchAll: fetchSeasons } = useSeasonsStore();
  const { fetchAll: fetchPlayers } = usePlayersStore();
  const { fetchAll: fetchMatches } = useMatchesStore();
  const { fetchAll: fetchTrainings } = useTrainingStore();
  const { loadDetailedStats } = useStatsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const initData = async () => {
      if (mounted && isInitialized && isAuthenticated && user && !hasInitialized) {
        try {
          // 1. Settings e Stagioni
          await Promise.all([
            fetchSettings(user.id),
            fetchSeasons()
          ]);

          // 2. I dati che dipendono dalla stagione attiva
          const season = useSeasonsStore.getState().activeSeason;
          if (season) {
            await Promise.all([
              fetchPlayers(),
              fetchMatches(season.id),
              fetchTrainings(),
              loadDetailedStats(season.id)
            ]);
          }
        } catch (error) {
          console.error("Global init error:", error);
        } finally {
          setHasInitialized(true);
        }
      }
    };

    initData();
  }, [mounted, isInitialized, isAuthenticated, user, hasInitialized, fetchSettings, fetchSeasons, fetchPlayers, fetchMatches, fetchTrainings, loadDetailedStats, setHasInitialized]);

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
