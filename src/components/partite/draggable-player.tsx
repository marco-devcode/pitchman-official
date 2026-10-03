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
  // Copia dello stato di drag in un ref. handlePointerMove deve poter sapere
  // se il drag e' partito GIA' nel frame in cui parte: se legesse isDragging
  // dallo stato React, il primo pointermove successivo all'attivazione
  // userebbe ancora il closure del render precedente (isDragging = false),
  // interpreterebbe la mossa come scroll, chiamerebbe cancelGesture e
  // sbloccherebbe la pagina sotto il dito che sta trascinando il pallino.
  const isDraggingRef = React.useRef(false);
  // Riferimento al body, per congelare lo scroll durante il drag.
  const scrollLock = React.useRef<{ paddingRight: string; overflow: string } | null>(null);
  // Riferimento all'elemento radice, non a event.target: quest'ultimo e' il
  // figlio che ha ricevuto l'evento (span/icona) e disabilitargli i
  // pointer-events non liberava il campo per il drop target.
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Impedisce che il click che il browser emette subito dopo il rilascio di un
  // drag apra il dialogo di selezione. Un flag booleano non basta: lo si
  // consumerebbe col click sbagliato se il rilascio non ha prodotto uno swap,
  // e resterebbe armato per il click successivo. Un timestamp e' immune a
  // entrambi i casi.
  const lastDragEndAt = React.useRef(0);
  /** Finestra (ms) in cui un click e' considerato effetto del drag. */
  const POST_DRAG_MS = 350;

  const clearTimer = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /**
   * Congela lo scroll della pagina per tutta la durata del drag.
   * Senza questo, su mobile il dito che trascina il pallino si trascina
   * anche la pagina, e il drop finisce su un altro slot perche' le coordinate
   * del puntatore non corrispondono piu' a quello che si vede.
   * overflow:hidden sul body preserva scrollY, quindi nessun salto visivo.
   */
  const lockScroll = React.useCallback(() => {
    if (scrollLock.current) return;
    const body = document.body;
    scrollLock.current = { paddingRight: body.style.paddingRight, overflow: body.style.overflow };
    // Compensa la scomparsa della scrollbar, altrimenti il contenuto
    // slitta di qualche px verso destra quando la blocchiamo.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    body.style.overflow = 'hidden';
  }, []);

  const unlockScroll = React.useCallback(() => {
    if (!scrollLock.current) return;
    const body = document.body;
    body.style.paddingRight = scrollLock.current.paddingRight;
    body.style.overflow = scrollLock.current.overflow;
    scrollLock.current = null;
  }, []);

  // Se il componente smonta col drag in corso (salvataggio, navigazione), lo
  // scroll resterebbe bloccato per sempre.
  React.useEffect(() => () => unlockScroll(), [unlockScroll]);

  const cancelGesture = React.useCallback(() => {
    clearTimer();
    startPos.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);
    setIsArmed(false);
    unlockScroll();
  }, [clearTimer, unlockScroll]);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!isEditing || !player) return;
    // Tasto destro / middle: ignoriamo, il drag e' solo col dito o col mouse
    // principale.
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    startPos.current = { x: event.clientX, y: event.clientY };
    setIsArmed(true);

    longPressTimer.current = setTimeout(() => {
      isDraggingRef.current = true;
      setIsDragging(true);
      lockScroll();
      controls.start(event);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!longPressTimer.current || !startPos.current) return;

    const dx = event.clientX - startPos.current.x;
    const dy = event.clientY - startPos.current.y;
    const distance = Math.hypot(dx, dy);

    // Muoversi prima della soglia e' uno scroll della pagina, non un drag:
    // annulliamo la pressione prolungata. Una volta partito il drag non si
    // guarda piu' la distanza: il pallino segue il dito e il movimento e'
    // l'utenza, non uno scroll.
    if (distance > MOVE_TOLERANCE && !isDraggingRef.current) {
      cancelGesture();
    }
  };

  const handlePointerUp = () => {
    cancelGesture();
  };

  const handleDragEnd = (event: unknown, _info: unknown) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setIsArmed(false);
    startPos.current = null;
    clearTimer();
    // Lo scroll torna subito disponibile: da qui in avanti il puntatore non
    // trascina piu' il pallino, quindi non deve piu' trascinare la pagina.
    unlockScroll();

    // pointercancel = gesto abortito dal browser (ha preso il possesso del
    // puntatore per uno scroll nativo, o la finestra ha perso il focus).
    // Non e' un rilascio intenzionale: niente swap.
    if (event && (event as PointerEvent).type === 'pointercancel') return;

    // Coordinate del rilascio. Si usa l'evento DOM reale (clientX/clientY,
    // coordinate viewport) e NON info.point di framer-motion: quest'ultimo e'
    // in pageX/pageY, cioe' coordinate documento che contengono gia' lo
    // scroll. Passarle a elementFromPoint, che accetta solo coordinate
    // viewport, puntava a un punto piu' in basso di quanto il dito: lo swap
    // finiva su uno slot lontano, o su nessuno.
    const pointer = event as { clientX?: number; clientY?: number } | null;
    const x = pointer?.clientX;
    const y = pointer?.clientY;
    if (typeof x !== 'number' || typeof y !== 'number') return;

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
      const element = document.elementFromPoint(x, y);
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

    // Il click post-riilascio va ignorato, ma solo se il rilascio ha prodotto
    // uno swap: un rilascio a vuoto lascia passare il click, che e' quello
    // che l'utente voleva (aprire il selettore di quello slot).
    lastDragEndAt.current = Date.now();
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
          // Click emesso dal browser subito dopo il rilascio di un drag che ha
          // scambiato due giocatori: ignorarlo, altrimenti si apre la lista di
          // selezione sullo slot di destinazione.
          if (Date.now() - lastDragEndAt.current < POST_DRAG_MS) {
            e.stopPropagation();
            return;
          }
          onClick();
        }}
        data-drop-target="true"
        data-slot-type={type}
        data-slot-index={index}
        className={cn(
          "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 shadow-lg transition-colors",
          // touch-action: nessun gesto nativo (scroll, zoom, callout) parte
          // gia' dal primo tocco: i 400ms di attesa della pressione
          // prolungata devono essere sul nostro timer, non su quello del
          // browser che nel frattempo potrebbe gia' aver fatto scorrere la
          // pagina. Con lo scroll congelato via JS ai 400ms, il lock
          // arrivedi tardi per questo.
          draggable && "touch-none select-none",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          // Feedback "pronto al drag" durante la pressione prolungata.
          isArmed && !isDragging && "ring-2 ring-brand-green/70",
          isDragging && "ring-2 ring-brand-green",
          player
            ? isPOR
              ? "bg-amber-600 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              : "bg-primary/90 dark:bg-brand-green/90 border-primary dark:border-brand-green text-white dark:text-black shadow-theme-strong"
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
        <span className="text-[7px] font-bold uppercase text-muted-foreground dark:text-muted-foreground/70 text-center leading-none pointer-events-none">
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
