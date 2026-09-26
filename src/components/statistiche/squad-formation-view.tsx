"use client";

import { useMemo, useEffect, useState } from "react";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayersStore } from "@/store/usePlayersStore";
import { aggregationRepository } from "@/lib/repositories/aggregation-repository";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutGrid, AlertCircle, Loader2 } from "lucide-react";
import { cn, displayPlayerName } from "@/lib/utils";
import { FORMATION_POSITIONS, getPositionAcronym, MATCH_FORMATIONS } from "@/lib/lineup-mapping";

/**
 * Righe del campo per le statistiche: array di indici di slot, dalla punta in
 * giù. Quarta copia della lista formazioni dell'app (dopo i tre componenti
 * di partita e FORMATIONS in types.ts), quindi la stessa classe di difetto: il
 * 3-4-3 mancava e ricadeva silenziosamente sul 4-4-2, mostrando una formazione
 * con righe sbagliate. Completata e verificata sotto.
 */
const FORMATION_ROWS: Record<string, number[][]> = {
  "4-4-2": [[9, 10], [5, 6, 7, 8], [1, 2, 3, 4], [0]],
  "4-3-3": [[8, 9, 10], [5, 6, 7], [1, 2, 3, 4], [0]],
  "3-5-2": [[9, 10], [4, 5, 6, 7, 8], [1, 2, 3], [0]],
  "4-2-3-1": [[10], [7, 8, 9], [5, 6], [1, 2, 3, 4], [0]],
  "3-4-2-1": [[10], [8, 9], [4, 5, 6, 7], [1, 2, 3], [0]],
  "3-4-1-2": [[9, 10], [8], [4, 5, 6, 7], [1, 2, 3], [0]],
  "4-3-1-2": [[9, 10], [8], [5, 6, 7], [1, 2, 3, 4], [0]],
  "3-4-3": [[8, 9, 10], [4, 5, 6, 7], [1, 2, 3], [0]],
};

/**
 * Ogni modulo deve comparire qui, altrimenti `FORMATION_ROWS[formation] ||
 * FORMATION_ROWS["4-4-2"]` mostra il campo sbagliato senza segnalare nulla.
 * Verificato in sviluppo, alla stessa stima delle altre assertion del progetto.
 */
function assertFormationRowsComplete() {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return;
  const mancanti = MATCH_FORMATIONS.filter((f) => !FORMATION_ROWS[f]);
  if (mancanti.length) {
    throw new Error(
      `[squad-formation-view] senza righe: ${mancanti.join(', ')}. ` +
      `Questi moduli mostrerebbero le righe del 4-4-2.`,
    );
  }
}

assertFormationRowsComplete();

const formatPlayerName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].toUpperCase();
  const initial = parts[0].charAt(0).toUpperCase();
  const surname = parts.slice(1).join(' ').toUpperCase();
  return `${initial}. ${surname}`;
};

export function SquadFormationView() {
  const { user } = useAuthStore();
  const { activeSeason } = useSeasonsStore();
  const { players } = usePlayersStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bestLineup, setBestLineup] = useState<{
    formation: string;
    starters: { playerId: string; name: string }[];
    apps: number;
  } | null>(null);

  useEffect(() => {
    async function loadAndCalculate() {
      if (!user || !activeSeason) return;
      
      setLoading(true);
      try {
        const context = await aggregationRepository.getDetailedContext(user.id, activeSeason.id);
        const completedMatches = context.matches.filter(m => m.status === 'completed');
        
        if (completedMatches.length === 0) {
          setError("Nessuna partita completata trovata.");
          setLoading(false);
          return;
        }

        // 1. Trova il modulo più usato
        const formationCounts: Record<string, number> = {};
        completedMatches.forEach(m => {
          const lineup = context.matchesDetails[m.id]?.lineup;
          if (lineup?.formation) {
            formationCounts[lineup.formation] = (formationCounts[lineup.formation] || 0) + 1;
          }
        });

        const mostUsedFormation = Object.entries(formationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "4-4-2";
        const formationApps = formationCounts[mostUsedFormation] || 0;

        // 2. Per ogni posizione (0-10) del modulo, trova il giocatore più presente
        const positionPlayerCounts: Record<number, Record<string, number>> = {};
        for (let i = 0; i <= 10; i++) positionPlayerCounts[i] = {};

        completedMatches.forEach(m => {
          const lineup = context.matchesDetails[m.id]?.lineup;
          if (lineup && lineup.formation === mostUsedFormation) {
            lineup.starters.forEach((p, idx) => {
              const pid = typeof p === 'string' ? p : p.playerId;
              if (pid) {
                positionPlayerCounts[idx][pid] = (positionPlayerCounts[idx][pid] || 0) + 1;
              }
            });
          }
        });

        const starters: { playerId: string; name: string }[] = [];
        for (let i = 0; i <= 10; i++) {
          const topPlayerId = Object.entries(positionPlayerCounts[i]).sort((a, b) => b[1] - a[1])[0]?.[0];
          const player = players.find(p => p.id === topPlayerId);
          starters.push({
            playerId: topPlayerId || "",
            name: player ? player.name : "---"
          });
        }

        setBestLineup({
          formation: mostUsedFormation,
          starters,
          apps: formationApps
        });
      } catch (err) {
        console.error("Error calculating best lineup:", err);
        setError("Errore nel calcolo della formazione.");
      } finally {
        setLoading(false);
      }
    }

    loadAndCalculate();
  }, [user, activeSeason, players]);

  if (loading) {
    return (
      <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 rounded-3xl">
        <CardContent className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-8 w-8 text-primary dark:text-brand-green animate-spin" />
          <p className="text-sm text-muted-foreground uppercase font-black tracking-widest">Analisi dati in corso...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !bestLineup) {
    return (
      <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 rounded-3xl">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" />
          <div>
            <h3 className="font-black uppercase tracking-tight text-foreground">Dati insufficienti</h3>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              {error || "Registra qualche partita per visualizzare la formazione tipo."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = FORMATION_ROWS[bestLineup.formation] || FORMATION_ROWS["4-4-2"];

  return (
    <div className="space-y-4">
      <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.05)] rounded-3xl overflow-hidden backdrop-blur-sm transition-colors">
        <CardContent className="pt-6 pb-8 px-4 sm:px-6">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="px-4 py-2 rounded-2xl bg-primary/10 dark:bg-brand-green/10 border border-primary/20 dark:border-brand-green/20">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary dark:text-brand-green">Modulo: {bestLineup.formation}</span>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border dark:border-white/10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{bestLineup.apps} {bestLineup.apps === 1 ? 'Partita' : 'Partite'}</span>
            </div>
          </div>

          <div className="relative aspect-[3/4] w-full max-w-lg mx-auto rounded-[32px] bg-neutral-900 dark:bg-black overflow-hidden border-4 border-white/5 shadow-2xl flex flex-col p-4 md:p-8">
            {/* Linee del campo */}
            <div className="absolute inset-4 border-2 border-white/10 pointer-events-none rounded-sm">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-16 border-b-2 border-x-2 border-white/10" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-16 border-t-2 border-x-2 border-white/10" />
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/10 rounded-full" />
            </div>

            {/* Giocatori in Campo */}
            <div className="flex-1 flex flex-col justify-between relative z-10 py-4">
              {rows.map((rowIndices, rowIdx) => (
                <div key={rowIdx} className="flex justify-evenly items-center w-full px-1 sm:px-4">
                  {rowIndices.map((starterIdx) => {
                    const p = bestLineup.starters[starterIdx];
                    const isPOR = starterIdx === 0;

                    return (
                      <div key={starterIdx} className="flex flex-col items-center gap-1 sm:gap-1.5 w-[52px] sm:w-[70px] md:w-[80px]">
                        <div className={cn(
                          "w-9 h-9 sm:w-11 sm:h-11 md:w-14 md:h-14 shrink-0 rounded-full flex items-center justify-center border-2 md:border-2 shadow-xl transition-transform hover:scale-110",
                          isPOR
                            ? "bg-amber-600 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                            : "bg-primary/90 dark:bg-brand-green/90 border-primary dark:border-brand-green text-white dark:text-black shadow-[0_0_15px_rgba(172,229,4,0.3)]"
                        )}>
                          <span className="text-[8px] md:text-[11px] font-black uppercase text-center leading-none">
                            {getPositionAcronym(bestLineup.formation, starterIdx)}
                          </span>
                        </div>
                        <div className="bg-black/60 backdrop-blur-md px-1 py-0.5 rounded border border-white/10 w-full text-center overflow-hidden">
                          <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-white uppercase truncate whitespace-nowrap">
                            {p.name !== "---" ? formatPlayerName(p.name) : "---"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 text-center max-w-md">
              Questa formazione rappresenta i giocatori che hanno iniziato più spesso nelle rispettive posizioni utilizzando il modulo prevalente della stagione.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
