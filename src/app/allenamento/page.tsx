"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, PlusCircle, Trash2, Loader2, Eraser, ClipboardCheck, Target, Users, Filter, CalendarRange, Archive, Clock, UserX } from "lucide-react";
import { PiTrafficCone } from "react-icons/pi";
import { useTrainingStore } from "@/store/useTrainingStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { usePlayersStore } from "@/store/usePlayersStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format, startOfWeek, addWeeks, subWeeks, isSameWeek, parseISO, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { TrainingStatsDialog } from "@/components/allenamento/training-stats-dialog";
import { TrainingListDialog } from "@/components/allenamento/training-list-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { parseError, missingSeasonError } from "@/lib/error-utils";

export default function AllenamentoPage() {
  const router = useRouter();
  const { sessions, loading, error: trainingError, fetchAll, generateSessions, deleteSession, deleteSessions, clearAllSessions } = useTrainingStore();
  const { sessionsPerWeek } = useSettingsStore();
  const { activeSeason, error: seasonsError } = useSeasonsStore();
  const { players, fetchAll: fetchPlayers } = usePlayersStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [genStart, setGenStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [genEnd, setGenEnd] = useState(format(addWeeks(new Date(), 4), "yyyy-MM-dd"));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [focusFilter, setFocusFilter] = useState<string | null>(null);

  // States for deletions
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isClearWeekOpen, setIsClearWeekOpen] = useState(false);

  useEffect(() => {
    if (activeSeason) {
      fetchAll();
      fetchPlayers();
    }
  }, [fetchAll, activeSeason, fetchPlayers]);

  const weekSessions = useMemo(() => {
    return sessions.filter(s => {
      try {
        const sessionDate = s.date.includes('T') ? parseISO(s.date) : new Date(s.date);
        const isInWeek = isSameWeek(sessionDate, currentWeekStart, { weekStartsOn: 1 });

        if (!isInWeek) return false;
        if (focusFilter && s.focus !== focusFilter) return false;

        return true;
      } catch (e) {
        return false;
      }
    });
  }, [sessions, currentWeekStart, focusFilter]);

  const uniqueFocuses = useMemo(() => {
    const focuses = new Set<string>();
    sessions.forEach(s => {
      if (s.focus && s.focus.trim() !== "") {
        focuses.add(s.focus);
      }
    });
    return Array.from(focuses).sort();
  }, [sessions]);

  const handleGenerate = async () => {
    setIsGeneratorOpen(false);
    setTimeout(() => {
      const [sy, sm, sd] = genStart.split('-').map(Number);
      const [ey, em, ed] = genEnd.split('-').map(Number);
      generateSessions(new Date(sy, sm - 1, sd), new Date(ey, em - 1, ed), sessionsPerWeek);
    }, 150);
  };

  const handleDeleteSingle = async () => {
    if (sessionToDelete) {
      const id = sessionToDelete;
      setSessionToDelete(null);
      setTimeout(() => deleteSession(id), 150);
    }
  };

  const handleDeleteWeek = async () => {
    const ids = weekSessions.map(s => s.id);
    setIsClearWeekOpen(false);
    setTimeout(() => deleteSessions(ids), 150);
  };

  const handleDeleteAll = async () => {
    setIsClearAllOpen(false);
    setTimeout(() => clearAllSessions(), 300);
  };

  const nextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const prevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));

  const hasPageError = seasonsError || trainingError;

  if (!loading && !activeSeason && !seasonsError) {
    return (
      <div className="pb-24 pt-4 w-full">
        <PageHeader title="Allenamento" />
        <ErrorState error={missingSeasonError()} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20">
      {!hasPageError && (
        <div className="w-full px-1">
          <div className="flex flex-col gap-2 w-full">
            {/* Riga 1 — Azioni principali */}
            <div className="grid grid-cols-4 gap-2 w-full">
              <Button
                variant="ghost"
                className="w-full rounded-xl px-0 h-10 bg-muted/30 dark:bg-white/5 border border-border/50 dark:border-brand-green/10 hover:bg-muted dark:hover:bg-brand-green/10 flex flex-col sm:flex-row items-center justify-center gap-1 group transition-all active:scale-95"
                onClick={() => setIsStatsOpen(true)}
              >
                <ClipboardCheck className="h-4 w-4 text-primary dark:text-brand-green group-hover:scale-110 transition-transform" />
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">Report</span>
              </Button>

              <Button
                variant="ghost"
                className="w-full rounded-xl px-0 h-10 bg-muted/30 dark:bg-white/5 border border-border/50 dark:border-brand-green/10 hover:bg-muted dark:hover:bg-brand-green/10 flex flex-col sm:flex-row items-center justify-center gap-1 group transition-all active:scale-95"
                onClick={() => setIsGeneratorOpen(true)}
              >
                <PlusCircle className="h-4 w-4 text-primary dark:text-brand-green group-hover:scale-110 transition-transform" />
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">Genera</span>
              </Button>

              <Button
                variant="ghost"
                className="w-full rounded-xl px-0 h-10 bg-muted/30 dark:bg-white/5 border border-border/50 dark:border-brand-green/10 hover:bg-muted dark:hover:bg-brand-green/10 flex flex-col sm:flex-row items-center justify-center gap-1 group transition-all active:scale-95"
                onClick={() => setIsArchiveOpen(true)}
              >
                <Archive className="h-4 w-4 text-primary dark:text-brand-green group-hover:scale-110 transition-transform" />
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">Archivio</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full rounded-xl px-0 h-10 bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 flex flex-col sm:flex-row items-center justify-center gap-1 group transition-all active:scale-95 text-rose-500"
                  >
                    <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter">Elimina</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl bg-card dark:bg-black border-border dark:border-brand-green/30 backdrop-blur-xl text-foreground dark:text-white p-2">
                  <DropdownMenuItem className="text-[10px] font-black uppercase rounded-xl mb-1 focus:bg-primary/20 hover:bg-primary/10 dark:focus:bg-brand-green/20 dark:hover:bg-brand-green/10 transition-colors" onClick={() => setTimeout(() => setIsClearWeekOpen(true), 100)}>
                    <Eraser className="mr-2 h-4 w-4 text-primary dark:text-brand-green" /> Elimina Settimana
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-[10px] font-black uppercase rounded-xl text-rose-500 focus:bg-rose-500/20 hover:bg-rose-500/10 transition-colors cursor-pointer" onClick={() => setTimeout(() => setIsClearAllOpen(true), 100)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Elimina Tutto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Riga 2 — Esercizi + Test */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant="ghost"
                className="w-full rounded-xl px-0 h-10 bg-muted/30 dark:bg-white/5 border border-border/50 dark:border-brand-green/10 hover:bg-muted dark:hover:bg-brand-green/10 flex items-center justify-center gap-2 group transition-all active:scale-95"
                onClick={() => router.push('/allenamento/libreria')}
              >
                <PiTrafficCone className="h-4 w-4 text-primary dark:text-brand-green group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">Esercizi</span>
              </Button>

              <Button
                variant="ghost"
                className="w-full rounded-xl px-0 h-10 bg-muted/30 dark:bg-white/5 border border-border/50 dark:border-brand-green/10 hover:bg-muted dark:hover:bg-brand-green/10 flex items-center justify-center gap-2 group transition-all active:scale-95"
                onClick={() => router.push('/allenamento/test')}
              >
                <Plus className="h-4 w-4 text-primary dark:text-brand-green group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">Test</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasPageError ? (
        <div className="w-full px-1">
          <ErrorState 
            error={parseError(seasonsError || trainingError)} 
            onRetry={() => {
              useSeasonsStore.getState().fetchAll();
              fetchAll();
            }}
            fullScreen
          />
        </div>
      ) : (
        <div className="w-full px-1 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevWeek}
              className="h-10 w-10 text-foreground/50 dark:text-white/50 hover:bg-primary/10 dark:hover:bg-brand-green/10 hover:text-primary dark:hover:text-brand-green rounded-xl transition-all"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="flex flex-col items-center h-auto hover:bg-transparent px-2 transition-opacity active:opacity-70">
                  <div className="flex items-center gap-1.5 translate-y-0.5">
                    <CalendarRange className="h-3 w-3 text-primary/40 dark:text-brand-green/40" />
                    <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest leading-tight">Settimana del</span>
                  </div>
                  <span className="text-sm font-black uppercase text-foreground tracking-tight mt-0.5">
                    {format(currentWeekStart, "dd MMM yyyy", { locale: it })}
                    <span className="text-muted-foreground mx-1.5 opacity-50">-</span>
                    {format(addDays(currentWeekStart, 6), "dd MMM yyyy", { locale: it })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl bg-card dark:bg-background border-border dark:border-white/10 text-foreground" align="center">
                <Calendar
                  mode="single"
                  selected={currentWeekStart}
                  onSelect={(date) => {
                    if (date) {
                      setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
                      setIsCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  locale={it}
                  className="p-3 bg-card dark:bg-background rounded-2xl"
                  classNames={{
                    weekday: "text-muted-foreground/30 rounded-md w-9 font-black text-[0.6rem] uppercase tracking-tighter text-center",
                    caption_label: "text-sm font-black uppercase tracking-[0.2em] text-foreground dark:text-white",
                    day: "h-10 w-10 p-0 m-0 flex items-center justify-center relative",
                    day_button: "text-foreground/80 dark:text-white/60 hover:bg-muted dark:hover:bg-black hover:text-foreground dark:hover:text-white hover:border hover:border-primary/30 dark:hover:border-brand-green/30 hover:shadow-sm dark:hover:shadow-[0_0_15px_rgba(172,229,4,0.4)] rounded-xl h-10 w-10 flex items-center justify-center p-0 font-black transition-all cursor-pointer relative z-10",
                    selected: "!bg-transparent border-2 border-primary dark:border-brand-green text-primary dark:text-brand-green shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] hover:!bg-muted dark:hover:!bg-black hover:!text-foreground dark:hover:!text-white rounded-xl",
                    today: "bg-muted/50 dark:bg-white/5 text-foreground/50 dark:text-white/40 rounded-xl",
                    button_previous: "hover:bg-primary/10 dark:hover:bg-brand-green/10 hover:text-primary dark:hover:text-brand-green rounded-lg transition-colors p-1 text-foreground/50 dark:text-white/50",
                    button_next: "hover:bg-primary/10 dark:hover:bg-brand-green/10 hover:text-primary dark:hover:text-brand-green rounded-lg transition-colors p-1 text-foreground/50 dark:text-white/50",
                  }}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={nextWeek}
              className="h-10 w-10 text-foreground/50 dark:text-white/50 hover:bg-primary/10 dark:hover:bg-brand-green/10 hover:text-primary dark:hover:text-brand-green rounded-xl transition-all"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          <div className="w-full space-y-4">
            {weekSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-muted/20 dark:bg-white/5 rounded-3xl border border-dashed border-border/50 dark:border-brand-green/10">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 dark:bg-brand-green/10 flex items-center justify-center">
                  <CalendarRange className="h-8 w-8 text-primary dark:text-brand-green opacity-50" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Nessun allenamento</h3>
                  <p className="text-[11px] text-muted-foreground uppercase font-medium">Non ci sono sessioni programmate per questa settimana.</p>
                </div>
                <Button 
                  onClick={() => setIsGeneratorOpen(true)}
                  className="rounded-xl h-9 bg-primary dark:bg-brand-green text-primary-foreground dark:text-black font-black uppercase text-[10px] tracking-widest px-6 hover:opacity-90 transition-all active:scale-95"
                >
                  Genera ora
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {weekSessions.map((session) => (
                  <Card 
                    key={session.id} 
                    className="group overflow-hidden border-border/50 dark:border-white/10 bg-card dark:bg-black/40 hover:border-primary/30 dark:hover:border-brand-green/30 transition-all cursor-pointer active:scale-[0.98] rounded-3xl"
                    onClick={() => router.push(`/allenamento/${session.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-black uppercase text-primary dark:text-brand-green tracking-widest">
                            {format(session.date.includes('T') ? parseISO(session.date) : new Date(session.date), "EEEE d MMMM", { locale: it })}
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tight text-foreground dark:text-white leading-tight">
                            {session.focus || "Sessione di Allenamento"}
                          </h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2 mt-3 pt-3 border-t border-border/50 dark:border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-foreground tracking-widest">
                            {(() => {
                              const att = (session.attendances as Array<{ status: string }> | undefined) || [];
                              const present = att.filter(a => a.status === 'presente' || a.status === 'ritardo').length;
                              return `${present} / ${players.length} ATLETI`;
                            })()}
                          </span>
                          <span className="text-[10px] font-black uppercase text-primary dark:text-brand-green tracking-widest">
                            {session.exercises?.length || 0} ESERCIZI
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted dark:bg-zinc-900 rounded-full overflow-hidden border border-border/30 dark:border-brand-green/10 relative">
                          {(() => {
                            const att = (session.attendances as Array<{ status: string }> | undefined) || [];
                            const present = att.filter(a => a.status === 'presente' || a.status === 'ritardo').length;
                            const late = att.filter(a => a.status === 'ritardo').length;
                            const total = players.length;
                            const presentPct = total > 0 ? (present / total) * 100 : 0;
                            const latePct = total > 0 ? (late / total) * 100 : 0;
                            return (
                              <>
                                <div
                                  className="h-full transition-all duration-500 rounded-full shadow-[0_0_8px_rgba(172,229,4,0.35)] bg-primary dark:bg-brand-green"
                                  style={{ width: `${presentPct}%` }}
                                />
                                {late > 0 && (
                                  <div
                                    className="absolute top-0 right-0 h-full bg-yellow-500 rounded-r-full"
                                    style={{ width: `${latePct}%` }}
                                    title={`${late} ritardo${late > 1 ? 'i' : ''}`}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {(() => {
                              const att = (session.attendances as Array<{ status: string }> | undefined) || [];
                              return att.filter(a => a.status === 'presente').length;
                            })()} Presenti
                          </span>
                          {(() => {
                            const att = (session.attendances as Array<{ status: string }> | undefined) || [];
                            const late = att.filter(a => a.status === 'ritardo').length;
                            if (late === 0) return null;
                            return (
                              <span className="text-[9px] font-bold uppercase text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {late} Ritardo{late > 1 ? 'i' : ''}
                              </span>
                            );
                          })()}
                          <span className="text-[9px] font-bold uppercase text-red-600 dark:text-red-400 flex items-center gap-1">
                            <UserX className="h-3 w-3" />
                            {(() => {
                              const att = (session.attendances as Array<{ status: string }> | undefined) || [];
                              const present = att.filter(a => a.status === 'presente' || a.status === 'ritardo').length;
                              return Math.max(0, players.length - present);
                            })()} Assenti
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <TrainingStatsDialog 
        open={isStatsOpen} 
        onOpenChange={setIsStatsOpen} 
        currentWeekStart={currentWeekStart}
      />

      <TrainingListDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        sessions={sessions}
      />

      <Dialog open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl bg-card dark:bg-black border-border dark:border-brand-green/30 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter text-foreground dark:text-white">Genera Programmazione</DialogTitle>
            <DialogDescription className="text-[11px] font-medium uppercase tracking-tight text-muted-foreground">
              Crea automaticamente le sessioni di allenamento per un periodo specifico.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="start" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data Inizio</Label>
              <Input
                id="start"
                type="date"
                value={genStart}
                onChange={(e) => setGenStart(e.target.value)}
                className="rounded-2xl bg-muted/50 dark:bg-white/5 border-border/50 dark:border-white/10 h-11 font-bold focus:ring-primary dark:focus:ring-brand-green"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data Fine</Label>
              <Input
                id="end"
                type="date"
                value={genEnd}
                onChange={(e) => setGenEnd(e.target.value)}
                className="rounded-2xl bg-muted/50 dark:bg-white/5 border-border/50 dark:border-white/10 h-11 font-bold focus:ring-primary dark:focus:ring-brand-green"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleGenerate}
              className="w-full rounded-2xl h-12 bg-primary dark:bg-brand-green text-primary-foreground dark:text-black font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
            >
              Genera Sessioni
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent className="rounded-3xl bg-card dark:bg-black border-border dark:border-brand-green/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] font-medium uppercase tracking-tight text-muted-foreground">
              Questa azione non può essere annullata. La sessione verrà eliminata definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-2xl font-black uppercase text-[10px] tracking-widest border-border/50">Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSingle}
              className="rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearWeekOpen} onOpenChange={setIsClearWeekOpen}>
        <AlertDialogContent className="rounded-3xl bg-card dark:bg-black border-border dark:border-brand-green/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Elimina Settimana?</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] font-medium uppercase tracking-tight text-muted-foreground">
              Stai per eliminare tutte le sessioni di questa settimana. Confermi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-2xl font-black uppercase text-[10px] tracking-widest border-border/50">Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteWeek}
              className="rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest"
            >
              Elimina Tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
        <AlertDialogContent className="rounded-3xl bg-card dark:bg-black border-border dark:border-brand-green/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-rose-500">Elimina Tutto?</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] font-medium uppercase tracking-tight text-muted-foreground">
              Questa azione eliminerà TUTTE le sessioni di allenamento del database. Sei assolutamente sicuro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-2xl font-black uppercase text-[10px] tracking-widest border-border/50">Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAll}
              className="rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest"
            >
              Sì, Elimina Tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
