"use client";

import { useState, useEffect } from "react";
import { Timer, Plus, Minus, Loader2 } from "lucide-react";

import { useMatchDetailStore } from "@/store/useMatchDetailStore";
import { getStoppage, getTotalStoppage } from "@/lib/stoppage-time";
import { cn } from "@/lib/utils";

const MAX_STOPPAGE = 30;

/**
 * Minuti di recupero dichiarati per ciascun tempo.
 *
 * Il dato e' per periodo e non un totale: il 1TS e il 2TS sono due blocchi
 * distinti, e archiviare un solo numero farebbe perdere a quale tempo si
 * riferisce. Non si deduce dagli eventi registrati in 1TS/2TS: un allenatore
 * che registra un evento nel recupero non sta dichiarando quanto recupero
 * c'era.
 *
 * Cambiando il recupero i minuti giocati vengono ricalcolati (updateMatch ->
 * syncAndPersistMinutes), perche' il recupero sposta la fine reale della
 * partita: 90+5 significa che un titolare in campo fino all'ultimo fischio ha
 * giocato 95 minuti, non 90.
 */
export function MatchStoppageEditor() {
  const match = useMatchDetailStore((s) => s.match);
  const updateMatch = useMatchDetailStore((s) => s.updateMatch);

  const [first, setFirst] = useState(0);
  const [second, setSecond] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirst(getStoppage(match?.addedTime, '1TS'));
    setSecond(getStoppage(match?.addedTime, '2TS'));
  }, [match?.addedTime]);

  if (!match) return null;

  const total = getTotalStoppage({ '1TS': first, '2TS': second });

  /** Salva sempre l'oggetto, anche a 0: azzerare deve poter cancellare un
   * recupero precedente, e omettere il campo lo lascerebbe in Firestore. */
  async function persist(next1: number, next2: number) {
    if (!match) return;
    setSaving(true);
    try {
      await updateMatch({
        addedTime: { '1TS': next1 || undefined, '2TS': next2 || undefined },
      });
    } finally {
      setSaving(false);
    }
  }

  function change(period: '1TS' | '2TS', delta: number) {
    // Si parte dagli stato LOCALE, non dalla props: cliccando piu' volte in
    // fretta, leggere il match gia' salvato perderebbe gli incrementi
    // intermedi e il contatore andrebbe al contrario.
    const next = period === '1TS'
      ? Math.max(0, Math.min(MAX_STOPPAGE, first + delta))
      : Math.max(0, Math.min(MAX_STOPPAGE, second + delta));

    if (next === (period === '1TS' ? first : second)) return;

    if (period === '1TS') setFirst(next);
    else setSecond(next);
    persist(period === '1TS' ? next : first, period === '1TS' ? second : next);
  }

  function Stepper({
    label,
    value,
    onMinus,
    onPlus,
  }: {
    label: string;
    value: number;
    onMinus: () => void;
    onPlus: () => void;
  }) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Riduci il recupero del ${label}`}
            disabled={value <= 0 || saving}
            onClick={onMinus}
            className={cn(
              "h-7 w-7 rounded-lg border border-border dark:border-brand-green/30",
              "flex items-center justify-center transition-colors",
              "text-foreground dark:text-brand-green",
              "hover:bg-muted dark:hover:bg-brand-green/10",
              "disabled:opacity-30 disabled:pointer-events-none",
            )}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          <span
            aria-live="polite"
            className={cn(
              "min-w-[2.25rem] text-center text-sm font-black tabular-nums",
              "text-foreground dark:text-brand-green",
            )}
          >
            {value > 0 ? `+${value}` : "—"}
          </span>

          <button
            type="button"
            aria-label={`Aumenta il recupero del ${label}`}
            disabled={value >= MAX_STOPPAGE || saving}
            onClick={onPlus}
            className={cn(
              "h-7 w-7 rounded-lg border border-border dark:border-brand-green/30",
              "flex items-center justify-center transition-colors",
              "text-foreground dark:text-brand-green",
              "hover:bg-muted dark:hover:bg-brand-green/10",
              "disabled:opacity-30 disabled:pointer-events-none",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-2">
        <Timer className="h-4 w-4 text-primary dark:text-brand-green" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Tempo aggiuntivo
        </h4>
        {saving && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      <div className="rounded-xl border border-border dark:border-brand-green/20 bg-card p-3 space-y-3">
        <Stepper
          label="1TS"
          value={first}
          onMinus={() => change('1TS', -1)}
          onPlus={() => change('1TS', 1)}
        />
        <Stepper
          label="2TS"
          value={second}
          onMinus={() => change('2TS', -1)}
          onPlus={() => change('2TS', 1)}
        />

        {total > 0 && (
          <p className="text-[10px] font-bold text-muted-foreground pt-1 border-t border-border/50 dark:border-brand-green/10">
            Fine partita reale: {match.duration || 90}+{total}′ — i minuti giocati
            includono il recupero, e chi entra nel recupero conta come presenza.
          </p>
        )}
      </div>
    </div>
  );
}
