"use client";

import * as React from "react";
import { motion, useDragControls } from "framer-motion";
import { cn, displayStarterName } from "@/lib/utils";
import { Player } from "@/lib/types";
import { Activity, Plus } from "lucide-react";

interface DraggablePlayerProps {
  player?: Player;
  acronym: string;
  isPOR?: boolean;
  isInjured?: boolean;
  index: number;
  type: 'starter' | 'sub';
  isEditing: boolean;
  onSwap: (source: { type: 'starter' | 'sub'; index: number }, target: { type: 'starter' | 'sub'; index: number }) => void;
  onClick: () => void;
}

/** Soglia (px) oltre la quale il gesto e' considerato uno scroll, non un drag. */
const MOVE_TOLERANCE = 10;
/** Durata (ms) della pressione prolungata prima di attivare il drag. */
const LONG_PRESS_MS = 400;

export function DraggablePlayer({
  player,
  acronym,
  isPOR,
  isInjured,
  index,
  type,
  isEditing,
  onSwap,
  onClick
}: DraggablePlayerProps) {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = React.useState(false);
  // true tra il pointerdown e l'attivazione del drag: serve a far apparire il
  // feedback "pronto" senza ancora trascinare.
  const [isArmed, setIsArmed] = React.useState(false);

  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = React.useRef<{ x: number; y: number } | null>(null);
  // Riferimento all'elemento radice, non a event.target: quest'ultimo e' il
  // figlio che ha ricevuto l'evento (span/icona) e disabilitargli i
  // pointer-events non liberava il campo per il drop target.
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Impedisce che un click sintetico successivo al drag apra il dialogo slot.
  const suppressClick = React.useRef(false);

  const clearTimer = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const cancelGesture = React.useCallback(() => {
    clearTimer();
    startPos.current = null;
    setIsArmed(false);
  }, [clearTimer]);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!isEditing || !player) return;
    // Tasto destro / middle: ignoriamo, il drag e' solo col dito o col mouse
    // principale.
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    startPos.current = { x: event.clientX, y: event.clientY };
    setIsArmed(true);

    longPressTimer.current = setTimeout(() => {
      setIsDragging(true);
      controls.start(event);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!longPressTimer.current || !startPos.current) return;

    const dx = event.clientX - startPos.current.x;
    const dy = event.clientY - startPos.current.y;
    const distance = Math.hypot(dx, dy);

    // Muoversi prima della soglia e' uno scroll della pagina, non un drag:
    // annulliamo la pressione prolungata.
    if (distance > MOVE_TOLERANCE) {
      clearTimer();
      startPos.current = null;
      setIsArmed(false);
    }
  };

  const handlePointerUp = () => {
    cancelGesture();
  };

  const handleDragEnd = (_event: unknown, info: { point: { x: number; y: number } }) => {
    setIsDragging(false);
    setIsArmed(false);
    startPos.current = null;

    // Disabilita i pointer-events sull'intero elemento trascinato, cosi'
    // elementFromPoint restituisce il bersaglio che sta sotto e non se stesso.
    const node = rootRef.current;
    if (!node) return;
    const prevPointerEvents = node.style.pointerEvents;
    const prevUserSelect = node.style.userSelect;
    node.style.pointerEvents = 'none';
    node.style.userSelect = 'none';

    let dropTarget: Element | null = null;
    try {
      const element = document.elementFromPoint(info.point.x, info.point.y);
      dropTarget = element?.closest('[data-drop-target="true"]') ?? null;
    } finally {
      node.style.pointerEvents = prevPointerEvents;
      node.style.userSelect = prevUserSelect;
    }

    if (!dropTarget) return;

    const targetType = dropTarget.getAttribute('data-slot-type') as 'starter' | 'sub' | null;
    const targetIndex = parseInt(dropTarget.getAttribute('data-slot-index') || '', 10);

    if (!targetType || Number.isNaN(targetIndex)) return;
    // Scambiare uno slot con se stesso non ha senso: niente da fare.
    if (targetType === type && targetIndex === index) return;

    suppressClick.current = true;
    onSwap({ type, index }, { type: targetType, index: targetIndex });
  };

  const draggable = isEditing && !!player;

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col items-center gap-1 w-16 sm:w-20 group"
    >
      <motion.div
        drag={draggable}
        dragControls={controls}
        dragListener={false}
        dragSnapToOrigin
        dragMomentum={false}
        dragElastic={0}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        whileDrag={{ scale: 1.12, zIndex: 50, opacity: 0.85 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => {
          // Se il click segue un drag, non aprire il selettore.
          if (suppressClick.current) {
            suppressClick.current = false;
            e.stopPropagation();
            return;
          }
          if (!isDragging) onClick();
        }}
        data-drop-target="true"
        data-slot-type={type}
        data-slot-index={index}
        className={cn(
          "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 shadow-lg transition-colors",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          // Feedback "pronto al drag" durante la pressione prolungata.
          isArmed && !isDragging && "ring-2 ring-brand-green/70",
          isDragging && "ring-2 ring-brand-green",
          player
            ? isPOR
              ? "bg-amber-600 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              : "bg-primary/90 dark:bg-brand-green/90 border-primary dark:border-brand-green text-white dark:text-black shadow-[0_0_15px_rgba(172,229,4,0.3)]"
            : "bg-neutral-800/50 border-neutral-700 text-neutral-500 border-dashed"
        )}
      >
        {player ? (
          <span className="text-[10px] font-black uppercase pointer-events-none">{acronym}</span>
        ) : (
          <Plus className="w-5 h-5 pointer-events-none" />
        )}
      </motion.div>

      {/* Hint visivo: su desktop il drag richiede una pressione prolungata, che
          non è intuitiva se non lo si dice. Solo per i titolari in campo, dove
          lo scambio ha senso. */}
      {type === 'starter' && isEditing && player && (
        <span className="text-[7px] font-bold uppercase text-muted-foreground/70 text-center leading-none pointer-events-none">
          tieni premuto
        </span>
      )}

      {/* Nome Giocatore - solo per i TITOLARI (sotto al cerchio in campo). In
          panchina il nome è già mostrato a destra del cerchio nel SelectTrigger,
          quindi il box nero qui sarebbe ridondante. */}
      {type === 'starter' && (
        <div className="w-full bg-black/60 backdrop-blur-sm px-1 py-0.5 rounded border border-white/10 text-center overflow-hidden min-h-[1.2rem] flex items-center justify-center gap-1 pointer-events-none">
          {player && isInjured && (
            <Activity className="w-2 h-2 text-red-500 shrink-0" />
          )}
          <p className="text-[8px] sm:text-[9px] font-black text-white uppercase truncate">
            {player ? displayStarterName(player) : acronym}
          </p>
        </div>
      )}
    </div>
  );
}
