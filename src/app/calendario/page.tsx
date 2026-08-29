"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useMatchesStore } from '@/store/useMatchesStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Calendar as CalendarIcon,
  ArrowRight,
  Home,
  Plane,
  Clock,
  History,
  TrendingUp,
  PlusCircle,
  ChevronRight,
  Globe,
  ClipboardCopy,
  Trash2,
  Pencil,
  Save
} from "lucide-react";
import { GiWhistle } from "react-icons/gi";
import { PiTrafficCone } from "react-icons/pi";
import { format, isAfter, parseISO, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from '@/lib/utils';
import { MATCH_TYPES, type MatchType } from '@/lib/types';
import { MatchFormDialog } from '@/components/partite/match-form-dialog';
import { ImportTuttocampoDialog } from "@/components/partite/import-tuttocampo-dialog";
import { ImportCalendarioScraperDialog } from "@/components/partite/import-calendario-scraper-dialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useStatsStore } from "@/store/useStatsStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RoundBadge = ({ round }: { round?: number }) => {
  if (!round || round === 0) return null;

  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center border-2 border-primary dark:border-brand-green bg-primary/10 dark:bg-black text-primary dark:text-brand-green text-[10px] font-black shrink-0 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]">
      {round}
    </div>
  );
};

export default function CalendarioPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMatchFormOpen, setIsMatchFormOpen] = useState(false);
  const [isScraperImportOpen, setIsScraperImportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<MatchType | 'all'>('all');

  const { activeSeason, fetchAll: fetchSeasons } = useSeasonsStore();
  const { matches, fetchAll: fetchMatches, add: addMatch, remove: removeMatch, removeAll: removeAllMatches, loading } = useMatchesStore();
  const { loadSummaryStats } = useStatsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated || !user) {
        if (mounted) router.push('/login');
        return;
      }

      await fetchSeasons();
      const season = useSeasonsStore.getState().activeSeason;
      if (season) {
        await fetchMatches(season.id);
      }
    };

    if (mounted) {
      init();
    }
  }, [mounted, isAuthenticated, user, fetchSeasons, fetchMatches, router]);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [matches]);

  const nextMatch = useMemo(() => {
    const today = startOfDay(new Date());
    return sortedMatches.find(m => {
      const d = parseISO(m.date);
      return (d >= today || m.status === 'scheduled') && m.status !== 'canceled' && m.status !== 'completed' && !m.result;
    });
  }, [sortedMatches]);

  const lastMatch = useMemo(() => {
    const completed = sortedMatches
      .filter(m => m.status === 'completed' || !!m.result)
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    return completed[0] || null;
  }, [sortedMatches]);

  const formStats = useMemo(() => {
    const completed = sortedMatches
      .filter(m => m.status === 'completed' || !!m.result)
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
      .slice(0, 5)
      .reverse();

    return completed.map(m => {
      let isWin = m.resultType === 'W';
      let isLoss = m.resultType === 'L';
      let isDraw = m.resultType === 'D';

      if (!m.resultType && m.result) {
        const teamG = m.isHome ? m.result.home : m.result.away;
        const oppG = m.isHome ? m.result.away : m.result.home;
        if (teamG > oppG) isWin = true;
        else if (teamG < oppG) isLoss = true;
        else isDraw = true;
      }

      let label = '-';
      let color = 'bg-muted text-muted-foreground';

      if (isWin) { label = 'V'; color = 'bg-brand-green/20 text-brand-green border border-brand-green/30'; }
      else if (isLoss) { label = 'P'; color = 'bg-rose-500/20 text-rose-500 border border-rose-500/30'; }
      else if (isDraw) { label = 'N'; color = 'bg-amber-500/20 text-amber-500 border border-amber-500/30'; }

      return { label, color };
    });
  }, [sortedMatches]);

  const handleCreateMatch = async (data: any) => {
    const newMatch = await addMatch(data);
    if (newMatch) {
      loadSummaryStats(activeSeason?.id);
    }
  };

  const handleSaveChanges = async () => {
    const seasonId = activeSeason?.id;
    for (const id of pendingDeletions) {
      await removeMatch(id);
    }
    if (seasonId) loadSummaryStats(seasonId);
    setPendingDeletions([]);
    setIsEditMode(false);
  };

  const handleCancelChanges = () => {
    setPendingDeletions([]);
    setIsEditMode(false);
  };

  const UI_Matches = useMemo(() => {
    return sortedMatches.filter(m => !pendingDeletions.includes(m.id));
  }, [sortedMatches, pendingDeletions]);

  // Tab visibili solo se esiste almeno un evento di quel tipo
  const presentTypes = useMemo(
    () => MATCH_TYPES.filter(t => matches.some(m => m.type === t)),
    [matches]
  );

  const filteredMatches = useMemo(() => {
    if (activeTab === 'all') return UI_Matches;
    return UI_Matches.filter(m => m.type === activeTab);
  }, [UI_Matches, activeTab]);

  const handleDeleteAllMatches = async () => {
    const seasonId = activeSeason?.id;
    setIsDeleteAllOpen(false);
    setIsEditMode(false);
    setPendingDeletions([]);
    setTimeout(async () => {
      try {
        await removeAllMatches();
        if (seasonId) loadSummaryStats(seasonId);
        document.body.style.pointerEvents = "";
      } catch (error) {
        console.error("Errore durante l'eliminazione di tutte le partite:", error);
      }
    }, 200);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-24">
      <div className="-mt-2 mb-2 md:mb-4">
        <PageHeader title="">
          <div className="flex gap-1.5 shrink-0 items-center w-full">
            <RoleGuard allowedRoles={['developer']}>
              <Button
                variant="outline"
                className="bg-muted dark:bg-black/80 border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-black hover:scale-105 transition-all h-9 px-3 rounded-xl shadow-sm flex items-center gap-1.5 flex-1"
                onClick={() => setIsScraperImportOpen(true)}
                title="Sincronizza da URL (Scraping)"
              >
                <Globe className="h-4 w-4 text-primary dark:text-brand-green" />
                <span className="font-black uppercase text-[10px]">IMPORTA</span>
              </Button>
            </RoleGuard>
            <Button
              variant="outline"
              className="bg-muted dark:bg-black/80 border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-black hover:scale-105 transition-all h-9 px-3 rounded-xl shadow-sm flex items-center gap-1.5 flex-1"
              onClick={() => setIsImportOpen(true)}
              title="Importazione Smart (Copia e Incolla)"
            >
              <ClipboardCopy className="h-4 w-4 text-primary dark:text-brand-green" />
              <span className="font-black uppercase text-[10px]">IMPORTA</span>
            </Button>
            <Button
              variant="outline"
              className="bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green hover:opacity-90 dark:hover:bg-black/80 hover:scale-105 transition-all h-9 px-3 rounded-xl shadow-md dark:shadow-[0_0_15px_rgba(172,229,4,0.15)] flex items-center gap-1.5 flex-1"
              onClick={() => setIsMatchFormOpen(true)}
              title="Nuova Partita"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="font-black uppercase text-[10px]">PARTITE</span>
            </Button>
          </div>
        </PageHeader>
      </div>

      {/* TAB per tipo evento — visibili solo se esiste almeno un evento di quel tipo */}
      <div className="flex bg-muted/50 rounded-full p-0.5 w-fit">
        {(['all', ...presentTypes] as (MatchType | 'all')[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={
              'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ' +
              (activeTab === t
                ? 'bg-background dark:bg-black border border-primary dark:border-brand-green text-foreground'
                : 'text-muted-foreground/50')
            }
          >
            {t === 'all' ? 'Tutte' : t}
          </button>
        ))}
      </div>

      {nextMatch && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <CalendarIcon className="h-4 w-4 text-primary dark:text-brand-green" />
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70 dark:text-white/50">Prossimo Incontro</h3>
          </div>

          <Card
            onClick={() => router.push(`/calendario/${nextMatch.id}`)}
            className="relative overflow-hidden border-2 border-primary/50 dark:border-brand-green bg-primary/10 dark:bg-brand-green/5 rounded-3xl cursor-pointer group hover:bg-primary/20 dark:hover:bg-brand-green/10 transition-all shadow-lg dark:shadow-[0_0_20px_rgba(172,229,4,0.1)]"
          >
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              {nextMatch.isHome ? <Home className="w-16 h-16" /> : <Plane className="w-16 h-16" />}
            </div>

            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary dark:bg-brand-green flex items-center justify-center text-white dark:text-black shadow-md shrink-0">
                    <GiWhistle className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <Badge className="bg-primary/20 dark:bg-brand-green/20 text-primary dark:text-brand-green border-none font-black text-[8px] sm:text-[9px] uppercase tracking-widest mb-0.5 px-2 py-0">
                      {nextMatch.type}
                    </Badge>
                    <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tighter text-foreground dark:text-white truncate">
                      VS {nextMatch.opponent}
                    </h2>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-muted-foreground dark:text-white/40 font-bold text-[9px] sm:text-[10px] uppercase tracking-tight">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(nextMatch.date), "dd MMM", { locale: it })}
                      </span>
                      <span>•</span>
                      <span className="truncate">{nextMatch.isHome ? "Casa" : "Trasferta"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 relative z-10">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none mb-0.5">Status</p>
                    <p className="text-xs font-black uppercase text-primary dark:text-brand-green">In Attesa</p>
                  </div>
                  <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-primary dark:text-brand-green group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ULTIMO INCONTRO & ANDAMENTO */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary dark:text-brand-green" />
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70 dark:text-white/50">Ultimi Incontri</h3>
          </div>

          <div className="flex items-center gap-1.5 opacity-90">
            {formStats.length > 0 ? (
              formStats.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] transition-all hover:scale-110",
                    item.color
                  )}
                >
                  {item.label}
                </div>
              ))
            ) : (
              <div className="py-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Dati forma insufficienti</p>
              </div>
            )}
          </div>
        </div>

        {lastMatch ? (
          <Card
            onClick={() => router.push(`/calendario/${lastMatch.id}`)}
            className="bg-card dark:bg-black border border-border dark:border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-primary dark:hover:border-brand-green/40 transition-all group"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">
                    {format(parseISO(lastMatch.date), "dd/MM/yyyy")}
                  </p>
                  <h4 className="text-base font-black uppercase truncate text-foreground dark:text-white">
                    {lastMatch.opponent}
                  </h4>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-2xl font-black",
                      lastMatch.resultType === 'W' ? "text-brand-green" : lastMatch.resultType === 'L' ? "text-rose-500" : "text-foreground dark:text-white"
                    )}>
                      {lastMatch.teamGoals ?? (lastMatch.isHome ? lastMatch.result?.home : lastMatch.result?.away) ?? 0} - {lastMatch.opponentGoals ?? (lastMatch.isHome ? lastMatch.result?.away : lastMatch.result?.home) ?? 0}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="p-8 border border-dashed border-border dark:border-white/10 rounded-3xl text-center">
            <p className="text-xs font-black uppercase text-muted-foreground">Nessun risultato registrato</p>
          </div>
        )}
      </section>

      {/* LISTA COMPLETA */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary dark:text-brand-green" />
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70 dark:text-white/50">Tutte le Partite</h3>
          </div>
          {!isEditMode ? (
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground">{sortedMatches.length} Gare</p>
              {sortedMatches.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-xl transition-all text-muted-foreground/40 hover:bg-muted dark:hover:bg-white/5"
                  onClick={() => setIsEditMode(true)}
                  title="Modifica Lista"
                >
                  <Pencil className="h-3.5 w-3.5 text-foreground dark:text-white" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-7 px-3 text-[10px] font-black uppercase border-border dark:border-brand-green/50 text-foreground dark:text-white hover:bg-muted dark:hover:bg-brand-green/10 rounded-xl transition-all"
                onClick={handleCancelChanges}
              >
                Annulla
              </Button>
              <div className="flex items-center gap-1.5">
                {UI_Matches.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-rose-500 hover:text-white hover:bg-rose-500 bg-rose-50 dark:bg-black border border-rose-200 dark:border-rose-500/40 transition-all rounded-xl"
                    onClick={() => setIsDeleteAllOpen(true)}
                    title="Elimina tutto (Definitivo)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 bg-primary dark:bg-brand-green border-none text-white dark:text-black rounded-xl shadow-md hover:scale-105 transition-all"
                  onClick={handleSaveChanges}
                  title="Salva Modifiche"
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {filteredMatches.map((m) => (
            <Card
              key={m.id}
              onClick={() => router.push(`/calendario/${m.id}`)}
              className={cn(
                "bg-card dark:bg-black/40 border border-border dark:border-white/5 rounded-2xl cursor-pointer hover:bg-muted dark:hover:bg-white/5 transition-all group overflow-hidden",
                m.status === 'scheduled' && "border-l-4 border-l-primary dark:border-l-brand-green"
              )}
            >
              <CardContent className="p-4 pl-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(() => {
                    const sameTypeMatches = sortedMatches.filter(match => match.type === m.type);
                    const autoRound = sameTypeMatches.findIndex(match => match.id === m.id) + 1;
                    return <RoundBadge round={autoRound} />;
                  })()}

                  <div className={cn(
                    "w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shrink-0",
                    m.status === 'completed' ? "bg-muted dark:bg-zinc-900 text-muted-foreground" : "bg-primary/20 dark:bg-brand-green/20 text-primary dark:text-brand-green"
                  )}>
                    <span className="leading-none text-base">{format(parseISO(m.date), "dd")}</span>
                    <span className="uppercase text-[9px] opacity-70 mt-0.5">{format(parseISO(m.date), "MMM", { locale: it })}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h5 className="text-sm font-black uppercase tracking-tight text-foreground dark:text-white group-hover:text-primary dark:group-hover:text-brand-green transition-colors truncate">
                      {m.opponent}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground/60">{m.type}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-[9px] font-bold uppercase text-muted-foreground/60">{m.isHome ? "Casa" : "Trasferta"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 min-w-[85px] justify-end">
                  {m.status === 'completed' || !!m.result ? (
                    <div className="flex items-center gap-1.5 bg-muted/50 dark:bg-white/5 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
                      <span className={cn(
                        "text-xs font-black whitespace-nowrap",
                        m.resultType === 'W' ? "text-brand-green" : m.resultType === 'L' ? "text-rose-500" : "text-foreground dark:text-white"
                      )}>
                        {m.teamGoals ?? (m.isHome ? m.result?.home : m.result?.away) ?? 0} - {m.opponentGoals ?? (m.isHome ? m.result?.away : m.result?.home) ?? 0}
                      </span>
                    </div>
                  ) : m.status === 'canceled' ? (
                    <Badge variant="outline" className="text-[9px] uppercase font-black border-rose-500/50 text-rose-500">Annullata</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] uppercase font-black border-primary/50 dark:border-brand-green/50 text-primary dark:text-brand-green animate-pulse">Programmata</Badge>
                  )}

                  {isEditMode ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-white hover:bg-red-500 rounded-xl shrink-0 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeletions(prev => [...prev, m.id]);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {loading && sortedMatches.length === 0 ? (
            <div className="space-y-4 px-2">
              <Skeleton className="h-24 w-full rounded-2xl bg-card/20" />
              <Skeleton className="h-24 w-full rounded-2xl bg-card/20" />
              <Skeleton className="h-24 w-full rounded-2xl bg-card/20" />
            </div>
          ) : sortedMatches.length === 0 ? (
            <div className="py-12 text-center bg-card dark:bg-black/20 border border-dashed border-border dark:border-white/10 rounded-3xl">
              <PiTrafficCone className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40 mb-4">Mister inizia a popolare il calendario!</p>
              <Button
                variant="outline"
                className="rounded-full font-bold uppercase tracking-wider text-xs px-6 border-border dark:border-white/10 hover:bg-muted dark:hover:bg-white/5"
                onClick={() => setIsMatchFormOpen(true)}
              >
                Aggiungi +
              </Button>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="py-12 text-center bg-card dark:bg-black/20 border border-dashed border-border dark:border-white/10 rounded-3xl">
              <PiTrafficCone className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40 mb-4">Nessun evento in questa categoria</p>
            </div>
          ) : null}
        </div>
      </section>

      <MatchFormDialog
        open={isMatchFormOpen}
        onOpenChange={setIsMatchFormOpen}
        onSave={handleCreateMatch}
      />

      {isImportOpen && (
        <ImportTuttocampoDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
        />
      )}

      {isScraperImportOpen && (
        <ImportCalendarioScraperDialog
          open={isScraperImportOpen}
          onOpenChange={setIsScraperImportOpen}
        />
      )}

      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-3xl border border-border dark:border-brand-green/20 shadow-2xl p-8 bg-card dark:bg-black">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight text-red-600">Svuota Calendario</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Sei sicuro di voler eliminare TUTTE le {matches.length} partite? Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-8">
            <AlertDialogCancel className="flex-1 mt-0 rounded-2xl font-black text-foreground uppercase text-xs h-12 bg-muted hover:bg-muted/80 dark:bg-card border-none">Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllMatches} className="flex-1 bg-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl font-black uppercase text-xs h-12 shadow-lg shadow-red-600/20 transition-all">
              Elimina Tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
