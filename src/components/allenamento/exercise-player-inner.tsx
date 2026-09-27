'use client';

/**
 * Player animato su canvas Konva. NON importare questo file direttamente.
 *
 * Konva lancia in ambiente server ("Konva.js unsupported environment"), quindi
 * questo modulo va caricato solo dal browser: usa exercise-player.tsx, che lo
 * importa con next/dynamic e ssr:false. Importarlo qui causa un crash della
 * pagina intera, non solo del player.
 *
 * Sistema di coordinate: arriva normalizzato 0-100 (vedi tactical-exercise.ts)
 * e viene convertito in pixel del canvas qui dentro, cosi' i dati dell'esercizio
 * non contengono mai valori legati a una dimensione di schermo.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text as KonvaText, Group } from 'react-konva';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import type { TacticalExercise, TacticalEntity } from '@/lib/tactical-exercise';
import { clampCoord } from '@/lib/tactical-exercise';
import { cn } from '@/lib/utils';

const FIELD_W = 320;
const FIELD_H = 420;
/** Spessore del bordo: le coordinate si mappano sull'area interna. */
const PAD = 10;
const INNER_W = FIELD_W - PAD * 2;
const INNER_H = FIELD_H - PAD * 2;

const TEAM_FILL: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#eab308',
  gk: '#10b981',
};

// 0.5 / 1 / 1.5 / 2 come nella guida di riferimento. La velocità moltiplica il
// tempo simulato, non cambia le durate nel JSON: raddoppiando la velocità
// ogni azione dura meta' secondi reali, ma la descrizione del passo resta
// quella scritta dal modello.
const SPEEDS = [0.5, 1, 1.5, 2];

/** Converte una coordinata normalizzata in pixel del canvas. */
function toPx(e: { x: number; y: number }) {
  return {
    x: PAD + (clampCoord(e.x) / 100) * INNER_W,
    y: PAD + (clampCoord(e.y) / 100) * INNER_H,
  };
}

interface Props {
  data: TacticalExercise;
  className?: string;
}

export default function ExercisePlayerInner({ data, className }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  // True nella pausa fra uno step e il successivo: blocca i comandi, cosi' un
  // doppio tap sul play non desincronizza indice e animazione.
  const [inPausa, setInPausa] = useState(false);

  /** Pausa fra uno step e il successivo, in ms. */
  const PAUSA_TRA_STEP = 900;

  const frameRef = useRef<number | null>(null);
  // ReturnType invece di number: in Node setTimeout restituisce un oggetto
  // Timeout, e annotarlo come number non compila sotto tsconfig con i tipi Node.
  const pausaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Il timer della pausa fra step va cancellato se l'utente cambia step o
  // ferma il play: altrimenti il setTimeout sopravvive, avanza l'indice
  // all'improvviso e l'indice si desincronizza da quello mostrato.
  useEffect(() => {
    return () => {
      if (pausaRef.current !== null) clearTimeout(pausaRef.current);
    };
  }, []);

  // Il modello può non avere step (o averne di strani): senza questo i
  // controlli crasherebbero su steps[0] undefined.
  const steps = data?.steps ?? [];
  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStep = steps[safeIndex];

  /** Applica l'andamento richiesto al parametro 0..1. */
  const ease = (t: number, kind?: string): number => {
    switch (kind) {
      case 'easeIn':
        return t * t;
      case 'easeOut':
        return t * (2 - t);
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t;
    }
  };

  /**
   * Posizione corrente di un'entita', interpolata sul progresso dello step.
   *
   * `progress` e' il tempo trascorso nello step in secondi, non una frazione:
   * e' cosi' che startAt (ritardo) e duration (durata propria) si sommano
   * nello stesso dominio.
   */
  const positionOf = useCallback(
    (entity: TacticalEntity) => {
      const action = currentStep?.actions?.find((a) => a.entityId === entity.id);
      if (!action) return toPx(entity);

      // Se l'azione parte da un punto diverso dalla posizione iniziale,
      // si parte da quello: altrimenti l'entita' salta all'inizio dello step.
      // from e to sono {x, y} normalizzati 0-100, quindi si interpola nel
      // dominio normalizzato e si converte solo alla fine: interpolare sui
      // pixel darebbe risultati diversi a seconda della dimensione del campo.
      const fx = action.from?.x ?? entity.x;
      const fy = action.from?.y ?? entity.y;
      const tx = action.to?.x ?? fx;
      const ty = action.to?.y ?? fy;

      const dur = Math.max(0.1, action.duration ?? 1);
      const attesa = Math.max(0, action.startAt ?? 0);
      // Prima di startAt l'entita' e' ferma sul punto di partenza; dopo la
      // durata e' ferma su quello d'arrivo.
      const locale = (progress - attesa) / dur;
      const t = ease(Math.max(0, Math.min(1, locale)), action.easing);

      return toPx({
        x: fx + (tx - fx) * t,
        y: fy + (ty - fy) * t,
      });
    },
    [currentStep, progress],
  );

  /**
   * Durata TOTALE dello step, in secondi.
   *
   * E' il massimo di (startAt + duration) su tutte le azioni, non il massimo
   * delle duration: un'azione che inizia dopo 2 secondi e dura 1 finisce a 3,
   * e se lo step durasse 1 secondo non si vedrebbe mai arrivare. Le azioni piu'
   * brevi finiscono prima e restano ferme sull'arrivo, che e' quello che si
   * vuole vedere.
   */
  const stepDuration = useCallback(() => {
    const azioni = currentStep?.actions ?? [];
    if (!azioni.length) return 2;
    const fine = azioni.map((a) => Math.max(0, a.startAt ?? 0) + Math.max(0.1, a.duration ?? 1));
    const max = Math.max(...fine);
    // Clamp: un duration assurdo dal modello bloccherebbe l'animazione per
    // minuti, e uno zero renderebbe lo step invisibile. 8 secondi e' il tetto:
    // oltre, l'allenatore aspetta troppo prima di vedere il passo seguente.
    return Math.max(0.5, Math.min(8, max));
  }, [currentStep]);

  useEffect(() => {
    if (!isPlaying || inPausa) return;

    // `progress` e' il tempo trascorso NELLO STEP, in secondi di simulazione
    // (gia' divisi per la velocita'), non una frazione 0..1. Serve perche'
    // ogni azione abbia il proprio startAt e la propria duration: con una
    // frazione unica tutte le azioni finirebbero insieme a fine step.
    const totale = stepDuration();
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const trascorso = ((timestamp - start) / 1000) * speed;
      const next = Math.min(trascorso, totale);
      setProgress(next);

      if (trascorso < totale) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Fine dello step.
      //
      // Prima si fermava qui, e il play mostrava un solo step: era un bug, non
      // una scelta. Ora si passa al successivo, ma con una pausa: senza, la
      // descrizione dello step appena finito scorrerebbe via prima di essere
      // letta, che e' proprio la parte che l'allenatore deve guardare.
      if (safeIndex >= steps.length - 1) {
        // Fine dell'esercizio: si torna all'inizio, cosi' ripremere play
        // riproduce tutto da capo.
        setProgress(0);
        setIsPlaying(false);
        return;
      }

      setProgress(0);
      // Pausa reale: si sospende l'animazione e si riparte dopo 900ms. Il
      // timer e' tenuto in un ref cosi' puo' essere cancellato se l'utente
      // cambia step nel frattempo.
      setInPausa(true);
      if (pausaRef.current !== null) clearTimeout(pausaRef.current);
      pausaRef.current = setTimeout(() => {
        pausaRef.current = null;
        setInPausa(false);
        setStepIndex((i) => i + 1);
      }, PAUSA_TRA_STEP);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, safeIndex, speed, stepDuration, steps.length, inPausa]);

  const goTo = (next: number) => {
    // Cancella la pausa in corso: altrimenti il suo timer avanzerebbe
    // l'indice DOPO che l'utente ha gia' scelto un altro step.
    if (pausaRef.current !== null) {
      clearTimeout(pausaRef.current);
      pausaRef.current = null;
    }
    setInPausa(false);
    setStepIndex(Math.max(0, Math.min(steps.length - 1, next)));
    setProgress(0);
    setIsPlaying(false);
  };

  const reset = () => {
    if (pausaRef.current !== null) {
      clearTimeout(pausaRef.current);
      pausaRef.current = null;
    }
    setInPausa(false);
    setProgress(0);
    setIsPlaying(false);
  };

  const entities = data?.initialEntities ?? [];

  return (
    <div className={cn('flex flex-col items-center text-white p-4 rounded-xl', className)}>
      <h2 className="text-base font-black uppercase tracking-tight mb-2 text-center">
        {data?.title}
      </h2>

      <div className="border-2 border-brand-green/50 rounded-lg overflow-hidden">
        <Stage width={FIELD_W} height={FIELD_H}>
          <Layer>
            <Rect x={0} y={0} width={FIELD_W} height={FIELD_H} fill="#052e16" />
            <Rect
              x={PAD}
              y={PAD}
              width={INNER_W}
              height={INNER_H}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1.5}
            />
            <Line
              points={[PAD, PAD + INNER_H / 2, PAD + INNER_W, PAD + INNER_H / 2]}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1.5}
            />
            <Circle
              x={PAD + INNER_W / 2}
              y={PAD + INNER_H / 2}
              radius={34}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1.5}
            />
            {/* aree */}
            <Rect
              x={PAD + INNER_W * 0.25}
              y={PAD}
              width={INNER_W * 0.5}
              height={INNER_H * 0.16}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1.5}
            />
            <Rect
              x={PAD + INNER_W * 0.25}
              y={PAD + INNER_H * 0.84}
              width={INNER_W * 0.5}
              height={INNER_H * 0.16}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1.5}
            />

            {/* Zone: rettangoli semitrasparenti, disegnati sotto tutto il resto */}
            {entities
              .filter((e) => e.type === 'zone')
              .map((zone) => {
                const p = toPx(zone);
                return (
                  <Rect
                    key={zone.id}
                    x={p.x}
                    y={p.y}
                    width={((zone.width ?? 20) / 100) * INNER_W}
                    height={((zone.height ?? 20) / 100) * INNER_H}
                    fill="rgba(172,229,4,0.12)"
                    stroke="rgba(172,229,4,0.5)"
                    strokeWidth={1}
                    cornerRadius={4}
                  />
                );
              })}

            {/* Coni */}
            {entities
              .filter((e) => e.type === 'cone')
              .map((cone) => {
                const p = toPx(cone);
                return <Circle key={cone.id} x={p.x} y={p.y} radius={4} fill="#f97316" />;
              })}

            {/* Pallone */}
            {entities
              .filter((e) => e.type === 'ball')
              .map((ball) => {
                const p = positionOf(ball);
                return (
                  <Circle
                    key={ball.id}
                    x={p.x}
                    y={p.y}
                    radius={5}
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth={1}
                  />
                );
              })}

            {/* Giocatori */}
            {entities
              .filter((e) => e.type === 'player')
              .map((player) => {
                const p = positionOf(player);
                return (
                  <Group key={player.id} x={p.x} y={p.y}>
                    <Circle
                      radius={12}
                      fill={TEAM_FILL[player.team ?? 'blue'] ?? '#3b82f6'}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    {player.label && (
                      <KonvaText
                        x={-9}
                        y={-6}
                        width={18}
                        align="center"
                        text={player.label}
                        fill="#ffffff"
                        fontSize={10}
                        fontStyle="bold"
                      />
                    )}
                  </Group>
                );
              })}
          </Layer>
        </Stage>
      </div>

      {/* Descrizione dello step corrente */}
      {currentStep ? (
        <div className="w-full bg-black/50 p-3 rounded-lg mt-3 text-xs border border-brand-green/20">
          <span className="text-brand-green font-black mr-2">
            Step {safeIndex + 1}/{steps.length}:
          </span>
          {currentStep.description}
        </div>
      ) : (
        <div className="w-full bg-black/50 p-3 rounded-lg mt-3 text-xs border border-amber-500/30 text-amber-400">
          Questo esercizio non ha step da animare.
        </div>
      )}

      {/* Controlli */}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => goTo(safeIndex - 1)}
          disabled={safeIndex === 0}
          aria-label="Step precedente"
          className="p-2 bg-black/60 rounded-full hover:bg-black/80 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          onClick={() => {
            // Pausa durante la riproduzione: il pulsante resta un interruttore.
            if (isPlaying) {
              setIsPlaying(false);
              return;
            }
            // Se l'esercizio e' finito riparte dal primo step: altrimenti
            // ripremere play non farebbe nulla, perche' l'indice e' gia' all'
            // ultimo e l'animazione si fermerebbe subito.
            // progress e' in secondi, non una frazione: il confronto va con la
            // durata dello step, non con 1. Con `progress >= 1` la condizione
            // sarebbe vera quasi subito e ripremere play ripartirebbe sempre
            // dall'inizio.
            const aFineStep = progress >= stepDuration();
            if (aFineStep || safeIndex >= steps.length - 1) {
              setStepIndex(0);
              setProgress(0);
            }
            setIsPlaying(true);
          }}
          disabled={steps.length === 0 || inPausa}
          aria-label={isPlaying && !inPausa ? 'Pausa' : 'Riproduci'}
          className="p-3 bg-brand-green text-black rounded-full hover:opacity-90 font-bold disabled:opacity-30 disabled:pointer-events-none"
        >
          {isPlaying && !inPausa ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          type="button"
          onClick={() => goTo(safeIndex + 1)}
          disabled={safeIndex >= steps.length - 1}
          aria-label="Step successivo"
          className="p-2 bg-black/60 rounded-full hover:bg-black/80 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight size={18} />
        </button>

        <button
          type="button"
          onClick={reset}
          aria-label="Riavvia lo step"
          className="p-2 bg-black/60 rounded-full hover:bg-black/80 ml-1"
        >
          <RotateCcw size={16} />
        </button>

        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          aria-label="Velocità"
          className="bg-black/60 text-[10px] font-bold p-1.5 rounded border border-brand-green/30"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s.toFixed(1)}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
