"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { parseError, missingSeasonError } from "@/lib/error-utils";
import { aggregationRepository } from "@/lib/repositories/aggregation-repository";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { MatchTypeFilters } from "@/components/statistiche/match-type-filters";
import type { FilterType } from "@/lib/aggregators/filter";

// Dynamic imports for chart components
const VenueStatsCharts = dynamic(
  () => import("@/components/statistiche/venue-stats-charts").then(mod => mod.VenueStatsCharts),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false }
);
const GoalVenueCharts = dynamic(
  () => import("@/components/statistiche/goal-venue-charts").then(mod => mod.GoalVenueCharts),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false }
);
const TeamPerformanceChart = dynamic(
  () => import("@/components/statistiche/team-performance-chart").then(mod => mod.TeamPerformanceChart),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false }
);
const GoalsIntervalChart = dynamic(
  () => import("@/components/statistiche/goals-interval-chart").then(mod => mod.GoalsIntervalChart),
  { loading: () => <Skeleton className="h-80 w-full" />, ssr: false }
);
const SquadUsageChart = dynamic(
  () => import("@/components/statistiche/squad-usage-chart").then(mod => mod.SquadUsageChart),
  { loading: () => <Skeleton className="h-[420px] w-full" />, ssr: false }
);
const SquadFormationView = dynamic(
  () => import("@/components/statistiche/squad-formation-view").then(mod => mod.SquadFormationView),
  { loading: () => <Skeleton className="h-[600px] w-full" />, ssr: false }
);
const TeamRecord = dynamic(
  () => import("@/components/statistiche/team-record").then(mod => mod.TeamRecord),
  { loading: () => <Skeleton className="h-28 w-full" />, ssr: false }
);
const PlayerLeaderboard = dynamic(
  () => import("@/components/statistiche/player-leaderboard").then(mod => mod.PlayerLeaderboard),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false }
);

export default function StatistichePage() {
  const { activeSeason, error: seasonsError, fetchAll: fetchSeasons } = useSeasonsStore();
  const { user } = useAuthStore();
  const [context, setContext] = useState<any | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [matchFilter, setMatchFilter] = useState<FilterType>('all');
  const [activeMainTab, setActiveMainTab] = useState('record');

  useEffect(() => {
    const initialize = async () => {
      try {
        const seasons = await fetchSeasons();
        const activeId = useSeasonsStore.getState().activeSeason?.id;
        const targetUserId = user?.id;
        if (activeId && targetUserId) {
          const ctx = await aggregationRepository.getDetailedContext(targetUserId, activeId);
          setContext(ctx);
        }
        void seasons;
      } catch (e: any) {
        setPageError(e?.message || 'Errore caricamento statistiche');
      } finally {
        setLoadingContext(false);
      }
    };
    initialize();
  }, [user?.id, fetchSeasons]);

  if (!loadingContext && !activeSeason && !seasonsError) {
    return (
      <div className="pb-24 pt-4">
        <ErrorState error={missingSeasonError()} />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="pb-24 pt-4">
        <ErrorState
          error={parseError(pageError)}
          onRetry={() => {
            setPageError(null);
            setLoadingContext(true);
            if (user?.id && activeSeason?.id) {
              aggregationRepository.getDetailedContext(user.id, activeSeason.id)
                .then(setContext)
                .catch((e) => setPageError(e?.message || 'Errore'))
                .finally(() => setLoadingContext(false));
            }
          }}
          fullScreen
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top filter: 4 tabs for match type */}
      <MatchTypeFilters
        context={context || undefined}
        loadingContext={loadingContext}
        filter={matchFilter}
        onFilterChange={setMatchFilter}
      />

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6 h-12 bg-muted dark:bg-black/40 border border-border dark:border-brand-green/20 p-1 rounded-2xl transition-colors">
          <TabsTrigger value="record" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green data-[state=active]:border data-[state=active]:border-primary/50 dark:data-[state=active]:border-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all">Record</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green data-[state=active]:border data-[state=active]:border-primary/50 dark:data-[state=active]:border-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all">Giocatori</TabsTrigger>
          <TabsTrigger value="utilizzo" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green data-[state=active]:border data-[state=active]:border-primary/50 dark:data-[state=active]:border-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all">Utilizzo</TabsTrigger>
          <TabsTrigger value="grafici" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green data-[state=active]:border data-[state=active]:border-primary/50 dark:data-[state=active]:border-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all">Grafici</TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          {loadingContext ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <TeamRecord />
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          {loadingContext ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <PlayerLeaderboard />
          )}
        </TabsContent>

        <TabsContent value="utilizzo">
          {loadingContext ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <Tabs defaultValue="rosa" className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <TabsList className="bg-muted dark:bg-black/40 border border-border dark:border-brand-green/20 p-1 rounded-xl h-10 transition-colors">
                  <TabsTrigger value="rosa" className="text-[9px] font-black uppercase rounded-lg px-6 data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green transition-all">ROSA</TabsTrigger>
                  <TabsTrigger value="formazione" className="text-[9px] font-black uppercase rounded-lg px-6 data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green transition-all">FORMAZIONE</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="rosa" className="mt-0">
                <SquadUsageChart />
              </TabsContent>
              <TabsContent value="formazione" className="mt-0">
                <SquadFormationView />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="grafici">
          {loadingContext ? (
            <div className="space-y-6">
              <Skeleton className="h-80 w-full" />
              <Skeleton className="h-80 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <VenueStatsCharts />
              <GoalVenueCharts />
              <TeamPerformanceChart />
              <GoalsIntervalChart />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
