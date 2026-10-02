
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useTrainingStore } from "@/store/useTrainingStore";
import { usePlayersStore } from "@/store/usePlayersStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { trainingRepository } from "@/lib/repositories/training-repository";
import { Loader2, ClipboardCheck, ChevronLeft, CalendarRange } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isSameWeek, parseISO, isAfter, startOfDay, isBefore, isSameDay } from "date-fns";
import { displayPlayerName } from "@/lib/utils";

interface TrainingStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWeekStart: Date;
}

export function TrainingStatsDialog({ open, onOpenChange, currentWeekStart }: TrainingStatsDialogProps) {
  const { sessions } = useTrainingStore();
  const { players } = usePlayersStore();
  const user = useAuthStore(state => state.user);
  // Le presenze stanno sotto la stagione, non sotto l'utente: serve la stagione
  // attiva. Vedi training-repository.
  const activeSeason = useSeasonsStore((s) => s.activeSeason);
  const seasonId = activeSeason?.id;

  const [loading, setLoading] = useState(false);
  const [allAttendance, setAllAttendance] = useState<{ sessionId: string, attendance: any[] }[]>([]);

  useEffect(() => {
    if (open && user && seasonId && sessions.length > 0) {
      const load = async () => {
        setLoading(true);
        const data = await trainingRepository.getAllAttendanceForSeason(seasonId, sessions.map(s => s.id));
        setAllAttendance(data);
        setLoading(false);
      };
      load();
    }
  }, [open, user, seasonId, sessions]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    
    // Filtriamo le sessioni passate per il denominatore.
    // Includiamo "oggi" solo se sono state effettivamente prese le presenze.
    const sessionsToCount = sessions.filter(s => {
      const sDate = s.date.includes('T') ? parseISO(s.date) : new Date(s.date);
      const sDay = startOfDay(sDate);
      
      if (isBefore(sDay, today)) return true;
      if (isSameDay(sDay, today)) {
        const sessionData = allAttendance.find(a => a.sessionId === s.id);
        return sessionData && sessionData.attendance.length > 0;
      }
      return false;
    });
    
    const pastSessionsCount = sessionsToCount.length;

    return players.map(player => {
      let totalPresent = 0;
      let weeklyPresent = 0;
      let weeklyLate = 0;

      allAttendance.forEach(sessionData => {
        const session = sessions.find(s => s.id === sessionData.sessionId);
        if (!session) return;

        // Consideriamo solo le sessioni già avvenute (o oggi) per il totale
        const sessionDate = session.date.includes('T') ? parseISO(session.date) : new Date(session.date);
        const isPastOrToday = !isAfter(startOfDay(sessionDate), today);

        const record = sessionData.attendance.find(a => a.playerId === player.id);
        const isInCurrentWeek = isSameWeek(sessionDate, currentWeekStart, { weekStartsOn: 1 });

        if (record) {
          if (record.status === 'presente' || record.status === 'ritardo') {
            if (isPastOrToday) totalPresent++;
            if (isInCurrentWeek) weeklyPresent++;
          }
          if (record.status === 'ritardo' && isInCurrentWeek) {
            weeklyLate++;
          }
        }
      });

      const percentage = pastSessionsCount > 0 ? Math.round((totalPresent / pastSessionsCount) * 100) : 0;

      return {
        id: player.id,
        name: player.name,
        totalPresent,
        weeklyPresent,
        weeklyLate,
        percentage
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [players, allAttendance, sessions, currentWeekStart]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] md:max-w-2xl rounded-3xl p-0 overflow-hidden flex flex-col border border-border dark:border-brand-green/30 shadow-md dark:shadow-[0_0_25px_rgba(172,229,4,0.15)] [&>button]:hidden">
        <DialogHeader className="p-6 bg-card dark:bg-black border-b border-border dark:border-brand-green/30 text-foreground flex-row items-center gap-4 space-y-0 shrink-0 transition-colors">
          <Button variant="ghost" size="icon" className="text-primary dark:text-brand-green hover:bg-muted dark:hover:bg-black/60 h-8 w-8 transition-colors" onClick={() => onOpenChange(false)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted dark:bg-black border border-border dark:border-brand-green/30 rounded-xl shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)] transition-all">
              <ClipboardCheck className="h-5 w-5 text-primary dark:text-brand-green" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Report Presenze</DialogTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Analisi Rendimento Allenamenti</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-background dark:bg-black overflow-hidden flex flex-col transition-colors">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-10 w-10 text-foreground animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Calcolo Statistiche...</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-4">
                <Table>
                  <TableHeader className="bg-muted dark:bg-card/50">
                    <TableRow className="hover:bg-transparent border-b border-border dark:border-brand-green/20 h-10">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-primary dark:text-brand-green px-3">Giocatore</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-primary dark:text-brand-green px-1">Sett (P)</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center text-primary dark:text-brand-green px-1">Sett (R)</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest text-center px-1 text-primary dark:text-brand-green">Tot%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((row) => (
                      <TableRow key={row.id} className="h-12 border-b border-border dark:border-brand-green/10 hover:bg-muted dark:hover:bg-card/50 transition-all">
                        <TableCell className="px-3 py-0">
                          <span className="text-xs font-black uppercase text-foreground leading-tight block truncate max-w-[120px]">
                            {displayPlayerName(row as any)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center px-1 py-0">
                          <span className="text-xs font-bold text-muted-foreground">
                            {row.weeklyPresent}
                          </span>
                        </TableCell>
                        <TableCell className="text-center px-1 py-0">
                          <span className="text-xs font-bold text-foreground">
                            {row.weeklyLate}
                          </span>
                        </TableCell>
                        <TableCell className="text-center px-1 py-0">
                          <div className="bg-primary/10 dark:bg-card border border-primary/20 dark:border-brand-green/30 px-2 py-1 rounded-lg inline-block min-w-[32px]">
                            <span className="text-xs font-black text-primary dark:text-brand-green tabular-nums">
                              {row.percentage}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="p-4 bg-muted/30 dark:bg-black border-t border-border dark:border-brand-green/20 flex flex-col items-center gap-2 transition-colors shrink-0">
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 dark:text-muted-foreground/40">Dati riferiti alla settimana attuale</span>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary dark:bg-brand-green shadow-sm dark:shadow-[0_0_6px_rgba(172,229,4,0.5)]" />
              <span className="text-[8px] font-black text-muted-foreground dark:text-white/40 uppercase">Sett (P): Presenze</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-[8px] font-black text-muted-foreground dark:text-white/40 uppercase">Sett (R): Ritardi</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
