'use client';

/**
 * Wrapper che carica Konva solo nel browser.
 *
 * Konva NON funziona in Node: `new Konva.Stage(...)` lancia "Konva.js
 * unsupported environment" quando manca `document`. Con un import statico,
 * finisce nel bundle del server e la pagina va in crash al render — e' esattamente
 * quello che succedeva: il dialog di visualizzazione esercizi e' montato anche
 * in /allenamento/[id], quindi il crash colpiva tutta la pagina Allenamento, non
 * solo la libreria.
 *
 * next/dynamic con ssr:false tiene il modulo fuori dal rendering lato server e
 * lo carica a runtime sul client. Il fallback e' uno spazio vuoto della stessa
 * altezza, cosi' il layout non salta quando il canvas appare.
 */

import dynamic from 'next/dynamic';
import type { TacticalExercise } from '@/lib/tactical-exercise';

const ExercisePlayerInner = dynamic(
  () => import('./exercise-player-inner'),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[420px] flex items-center justify-center rounded-xl border border-brand-green/20 bg-black/40"
        aria-label="Caricamento lavagna animata"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Carico la lavagna...
        </span>
      </div>
    ),
  },
);

interface Props {
  data: TacticalExercise;
  className?: string;
  /** Vedi exercise-player-inner: selezione, drag, aggiunta e rimozione. */
  editable?: boolean;
  /** Notifica ogni modifica della scena. */
  onChange?: (data: TacticalExercise) => void;
}

export default function ExercisePlayer(props: Props) {
  return <ExercisePlayerInner {...props} />;
}
