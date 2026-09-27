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

const SPEEDS = [0.5, 1, 1.5];

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

  const frameRef = useRef<number | null>(null);

  // Il modello può non avere step (o averne di strani): senza questo i
  // controlli crasherebbero su steps[0] undefined.
  const steps = data?.steps ?? [];
  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStep = steps[safeIndex];

  /** Posizione corrente di un'entita', interpolata sul progresso dello step. */
  const positionOf = useCallback(
    (entity: TacticalEntity) => {
      const action = currentStep?.actions?.find((a) => a.entityId === entity.id);
      if (!action) return toPx(entity);

      // Se l'azione parte da un punto diverso dalla posizione iniziale,
      // si parte da quello: altrimenti l'entita' salta all'inizio dello step.
      // from e to sono gia' normalizzati 0-100, quindi si interpola nel
      // dominio normalizzato e si converte solo alla fine: interpolare sui
      // pixel darebbe risultati diversi a seconda della dimensione del campo.
      const [fx, fy] = action.from;
      const [tx, ty] = action.to;
      return toPx({
        x: fx + (tx - fx) * progress,
        y: fy + (ty - fy) * progress,
      });
    },
    [currentStep, progress],
  );

  // Il passo dura quanto la piu' lunga azione dello step: le azioni piu'
  // brevi finiscono prima e restano ferme sul arrivo, che e' quello che si
  // vuole vedere.
  const stepDuration = useCallback(() => {
    const durations = currentStep?.actions?.map((a) => a.duration) ?? [];
    const max = durations.length ? Math.max(...durations) : 2;
    // Clamp: un duration assurdo dal modello bloccherebbe l'animazione per
    // minuti, e uno zero renderebbe lo step invisibile.
    return Math.max(0.5, Math.min(8, max || 2));
  }, [currentStep]);

  useEffect(() => {
    if (!isPlaying) return;

    const duration = stepDuration() / speed;
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = (timestamp - start) / 1000;
      const next = Math.min(elapsed / duration, 1);
      setProgress(next);

      if (next < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        // Resta sull'ultimo frame dello step: così si vede la posizione
        // finale, non un ritorno a metà strada.
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, safeIndex, speed, stepDuration]);

  const goTo = (next: number) => {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, next)));
    setProgress(0);
    setIsPlaying(false);
  };

  const reset = () => {
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
            // Al termine riparte da capo invece di fermarsi: play/pause sullo
            // stesso step deve poter essere ripetuto.
            if (progress >= 1) setProgress(0);
            setIsPlaying((p) => !p);
          }}
          disabled={steps.length === 0}
          aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
          className="p-3 bg-brand-green text-black rounded-full hover:opacity-90 font-bold disabled:opacity-30 disabled:pointer-events-none"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
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
