"use client";

/**
 * Il numero di giornata.
 *
 * Vive in un file solo perche' esisteva in DUE copie identiche
 * (`app/calendario/page.tsx` e `components/partite/full-calendar-dialog.tsx`)
 * che potevano divergere senza che nulla lo segnalasse: la copia del dialogo
 * non aveva nemmeno l'alone. Una copia sola e' l'unica garanzia che restino
 * uguali quando una delle due viene toccata.
 *
 * Il bordo e' a gradiente (`.border-theme`, 2px) e il numero usa `--t1`: il
 * testo resta leggibile per qualunque coppia, per costruzione.
 */
export function RoundBadge({ round }: { round?: number }) {
  if (!round || round === 0) return null;

  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center border-theme
                 bg-theme-fill-soft text-theme text-[10px] font-black shrink-0
                 shadow-theme"
      style={{ borderWidth: 2 }}
    >
      {round}
    </div>
  );
}