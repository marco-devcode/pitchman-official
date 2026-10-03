"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { PlusCircle, Trash2, Calendar, Home, Plane, Globe, ChevronLeft, ClipboardCopy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Match, MatchStatus } from "@/lib/types";
import { RoundBadge } from "@/components/calendario/round-badge";
import { useMatchesStore } from "@/store/useMatchesStore";
import { useStatsStore } from "@/store/useStatsStore";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImportTuttocampoDialog } from "@/components/partite/import-tuttocampo-dialog";
import { ImportCalendarioScraperDialog } from "@/components/partite/import-calendario-scraper-dialog";
import { cn } from "@/lib/utils";
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

const MatchFormDialog = dynamic(() => import("@/components/partite/match-form-dialog").then(mod => mod.MatchFormDialog), {
  ssr: false
});

interface FullCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FullCalendarDialog({ open, onOpenChange }: FullCalendarDialogProps) {
  const { matches, loading: matchesLoading, add: addMatch, remove: removeMatch, removeAll: removeAllMatches } = useMatchesStore();
  const { loadSummaryStats } = useStatsStore();
  const { activeSeason } = useSeasonsStore();
  const router = useRouter();

  // Cleanup degli eventi del puntatore (fix per bug Radix UI nested dialogs)
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isScraperImportOpen, setIsScraperImportOpen] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSaveMatch = async (data: any) => {
    const newMatch = await addMatch(data);
    if (newMatch) {
      loadSummaryStats(activeSeason?.id);
    }
  };

  const handleDeleteMatch = async () => {
    if (!matchToDelete) return;
    const matchId = matchToDelete.id;
    const seasonId = activeSeason?.id;

    setIsProcessing(true);
    // Pattern: chiudiamo il dialog PRIMA per evitare lock della UI di Radix
    setMatchToDelete(null);

    // Eseguiamo l'eliminazione con un piccolo delay
    setTimeout(async () => {
      try {
        await removeMatch(matchId);
        await loadSummaryStats(seasonId);
        // Forza pulizia pointer-events per bug Radix
        document.body.style.pointerEvents = "";
      } catch (error) {
        console.error("Errore durante l'eliminazione della partita:", error);
      } finally {
        setIsProcessing(false);
      }
    }, 200);
  };

  const handleDeleteAllMatches = async () => {
    const seasonId = activeSeason?.id;

    setIsProcessing(true);
    // Chiudiamo il dialog PRIMA
    setIsDeleteAllOpen(false);

    setTimeout(async () => {
      try {
        await removeAllMatches();
        await loadSummaryStats(seasonId);
        // Forza pulizia pointer-events per bug Radix
        document.body.style.pointerEvents = "";
      } catch (error) {
        console.error("Errore durante l'eliminazione di tutte le partite:", error);
      } finally {
        setIsProcessing(false);
      }
    }, 200);
  };

  const navigateToMatch = (match: Match) => {
    onOpenChange(false);
    router.push(`/calendario/${match.id}?s=${match.seasonId}`);
  };

  const StatusBadge = ({ status }: { status: MatchStatus }) => {
    switch (status) {
      case 'completed': return <div className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-brand-green" />;
      case 'scheduled': return <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 dark:bg-white/20" />;
      case 'canceled': return <div className="h-1.5 w-1.5 rounded-full bg-destructive shadow-sm dark:shadow-[0_0_6px_rgba(239,68,68,0.5)]" />;
      default: return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] h-[90vh] md:max-w-3xl rounded-3xl p-0 overflow-hidden flex flex-col border-none shadow-2xl [&>button]:hidden">
          <DialogHeader className="p-4 md:p-6 bg-card dark:bg-background border-b border-border dark:border-white/5 flex-row items-center justify-between space-y-0 shrink-0 transition-colors">
            <DialogTitle className="sr-only">Calendario</DialogTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 dark:hover:bg-white/10 h-8 w-8 transition-colors" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Stagione {activeSeason?.name}</p>
                </div>
                {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-primary dark:text-brand-green" />}
              </div>
            </div>
            <div className="flex gap-1 md:gap-1.5 shrink-0 items-center">
              <Button
                variant="outline"
                className="bg-muted dark:bg-black/80 border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-black hover:scale-105 transition-all h-8 w-8 rounded-xl shadow-sm p-0"
                size="icon"
                onClick={() => setIsScraperImportOpen(true)}
                disabled={isProcessing}
                title="Sincronizza da URL (Scraping)"
              >
                <Globe className="h-4 w-4 text-primary dark:text-brand-green" />
              </Button>
              <Button
                variant="outline"
                className="bg-muted dark:bg-black/80 border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-black hover:scale-105 transition-all h-8 w-8 rounded-xl shadow-sm p-0"
                size="icon"
                onClick={() => setIsImportOpen(true)}
                disabled={isProcessing}
                title="Importazione Smart (Copia e Incolla)"
              >
                <ClipboardCopy className="h-4 w-4 text-primary dark:text-brand-green" />
              </Button>
              <Button
                variant="outline"
                className="bg-muted dark:bg-black/80 border-border dark:border-brand-green text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-black hover:scale-105 transition-all h-8 w-8 rounded-xl shadow-sm p-0"
                size="icon"
                onClick={() => setIsFormOpen(true)}
                disabled={isProcessing}
                title="Nuova Partita"
              >
                <PlusCircle className="h-4 w-4 text-primary dark:text-brand-green" />
              </Button>
              {matches.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 dark:text-red-500 hover:text-white hover:bg-red-600 bg-red-50 dark:bg-black border border-red-200 dark:border-red-500/40 h-8 w-8 transition-all rounded-lg"
                  onClick={() => setIsDeleteAllOpen(true)}
                  disabled={isProcessing}
                  title="Elimina tutto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 bg-card dark:bg-background">
            {matchesLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto opacity-20 mb-4 text-primary dark:text-brand-green" />
                <p className="font-black text-xs uppercase tracking-widest">Nessuna partita registrata</p>
              </div>
            ) : (
              <Table>
                <TableBody>
                  {matches.map((match) => {
                    const mDate = new Date(match.date);
                    const day = mDate.getDate().toString().padStart(2, '0');
                    const month = mDate.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase();

                    // Calcolo automatico della giornata per tipo di competizione
                    const sameTypeMatches = matches.filter(m => m.type === match.type);
                    const autoRound = sameTypeMatches.findIndex(m => m.id === match.id) + 1;

                    return (
                      <TableRow key={match.id} className={cn("h-14 border-b border-border dark:border-white/5 hover:bg-muted/50 dark:hover:bg-primary/5 transition-all group", isProcessing && "opacity-50 pointer-events-none")}>
                        <TableCell
                          className="p-0 px-4 cursor-pointer"
                          onClick={() => !isProcessing && navigateToMatch(match)}
                        >
                          <div className="flex items-center gap-4">
                            <RoundBadge round={autoRound} />
                            <div className="flex flex-col items-center min-w-[36px]">
                              <span className="text-xs font-black leading-none text-foreground">{day}</span>
                              <span className="text-[9px] font-bold text-muted-foreground">{month}</span>
                            </div>
                            <div className="p-1.5 bg-background dark:bg-muted/30 border border-border dark:border-transparent rounded-lg shadow-sm dark:shadow-none">
                              {match.isHome ? <Home className="h-3.5 w-3.5 text-primary dark:text-brand-green" /> : <Plane className="h-3.5 w-3.5 text-sky-500 dark:text-brand-cyan" />}
                            </div>
                            <div className="flex-1 flex items-center justify-between gap-2">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-foreground uppercase tracking-tight truncate max-w-[120px] md:max-w-none">
                                  {match.opponent}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{match.type}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="bg-muted/50 dark:bg-primary/5 border border-border dark:border-primary/10 px-2 py-0.5 rounded-lg min-w-[40px] text-center shadow-sm dark:shadow-none">
                                  <span className="text-xs font-black tabular-nums text-foreground">
                                    {match.result ? `${match.result.home} - ${match.result.away}` : '0 - 0'}
                                  </span>
                                </div>
                                <StatusBadge status={match.status} />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right p-0 pr-4 w-10">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 lg:opacity-20 lg:group-hover:opacity-100 opacity-100 transition-all rounded-lg"
                            onClick={(e) => { e.stopPropagation(); setMatchToDelete(match); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          <AlertDialog open={!!matchToDelete} onOpenChange={(open) => !open && setMatchToDelete(null)}>
            <AlertDialogContent className="max-w-[90vw] rounded-3xl border border-border dark:border-none shadow-2xl p-8 bg-card dark:bg-background">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground text-2xl font-black uppercase tracking-tight">Elimina Gara</AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  Questa azione è irreversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-3 mt-8">
                <AlertDialogCancel className="flex-1 mt-0 rounded-2xl font-black text-foreground uppercase text-xs h-12 bg-muted hover:bg-muted/80 dark:bg-muted/50 border-none">Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteMatch} className="flex-1 bg-destructive hover:bg-destructive/90 rounded-2xl font-black uppercase text-xs h-12 shadow-lg shadow-destructive/20">
                  Conferma
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
            <AlertDialogContent className="max-w-[90vw] rounded-3xl border border-border dark:border-none shadow-2xl p-8 bg-card dark:bg-background">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight text-red-600">Svuota Calendario</AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  Sei sicuro di voler eliminare TUTTE le {matches.length} partite? Questa azione è irreversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-3 mt-8">
                <AlertDialogCancel className="flex-1 mt-0 rounded-2xl font-black text-foreground uppercase text-xs h-12 bg-muted hover:bg-muted/80 dark:bg-black border-none">Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAllMatches} className="flex-1 bg-black border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl font-black uppercase text-xs h-12 shadow-lg shadow-red-600/20 transition-all">
                  Elimina Tutto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>

      {isFormOpen && (
        <MatchFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSave={handleSaveMatch}
          match={null}
        />
      )}

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
    </>
  );
}
