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

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Line, Arrow, Text as KonvaText, Group } from 'react-konva';
import {
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Plus, Trash2, Undo2,
} from 'lucide-react';

import type { TacticalAction, TacticalExercise, TacticalEntity, TacticalStep } from '@/lib/tactical-exercise';
import {
  clampCoord,
  durataSegmenti,
  posizioneAlTempo,
  posizioniInizialiStep,
  segmentiStep,
} from '@/lib/tactical-exercise';
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
  // Squadra "senza squadra": grigio. Non e' una tifoseria avversaria, quindi
  // non si prende un colore di squadra: si prende il colore dell'assenza.
  neutral: '#9ca3af',
};

function arrowStyleForAction(type: TacticalAction['type']) {
  switch (type) {
    case 'pass':
      return {
        stroke: 'rgba(255,255,255,0.65)',
        fill: 'rgba(255,255,255,0.65)',
        strokeWidth: 1.8,
        pointerLength: 6,
        pointerWidth: 6,
      };
    case 'shoot':
      return {
        stroke: '#facc15',
        fill: '#facc15',
        strokeWidth: 2.2,
        pointerLength: 7,
        pointerWidth: 7,
      };
    case 'dribble':
      return {
        stroke: 'rgba(172,229,4,0.85)',
        fill: 'rgba(172,229,4,0.85)',
        strokeWidth: 1.8,
        dash: [3, 3],
        pointerLength: 5,
        pointerWidth: 5,
      };
    case 'run':
    default:
      return {
        stroke: 'rgba(255,255,255,0.5)',
        fill: 'rgba(255,255,255,0.5)',
        strokeWidth: 1.6,
        dash: [5, 4],
        pointerLength: 5,
        pointerWidth: 5,
      };
  }
}

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
  /**
   * Modalita' modifica: selezione, trascinamento, aggiunta e rimozione di
   * pedine e palla.
   *
   * Di proposito e' una prop separata e non un comportamento sempre attivo.
   * Nella libreria l'esercizio si vede e si riguarda, non si riedita: mettere
   * il cursore di drag su una lavagna che si sta solo guardando fa solo
   * impigliarsi. E Konva mette il touch-action:none sul canvas: utile per
   * trascinare, scomodo per scorrere la pagina con il dito sopra la lavagna.
   *
   * In modifica, per scorrere la pagina serve un'area fuori dal campo.
   */
  editable?: boolean;
  /** Chiamata a ogni modifica della scena: la UI la usa per il pulsante Salva. */
  onChange?: (data: TacticalExercise) => void;
  /**
   * Quando cambia valore, aggiunge un'entità di quel tipo sul campo.
   * Serve a collegare una toolbar esterna (es. il builder) ai pulsanti
   * interni del player: il player ha già la logica di posizionamento
   * intelligente, non va duplicata.
   */
  addType?: TacticalEntity['type'] | null;
  /**
   * Contatore che il genitore incrementa a ogni click su "aggiungi": e' il
   * segnale che fa scattare l'aggiunta. Non si guarda `addType` da solo
   * perche' cliccare due volte sullo stesso tipo deve aggiungere due entità.
   */
  addSignal?: number;
  /** Nasconde i pulsanti di aggiunta interni (usato quando c'è una toolbar esterna). */
  showAddButtons?: boolean;
}

export default function ExercisePlayerInner({ data, className, editable = false, onChange, addType, addSignal = 0, showAddButtons = true }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);

  const frameRef = useRef<number | null>(null);
  // Copia sincrona di `progress`: il loop di animazione la legge per
  // RIPRENDERE da dove era (pausa/play, cambio velocita') invece di ripartire
  // da zero, che faceva tornare le pedine indietro di scatto.
  const progressRef = useRef(0);
  const impostaProgress = useCallback((valore: number) => {
    progressRef.current = valore;
    setProgress(valore);
  }, []);

  // Il modello può non avere step (o averne di strani): senza questo i
  // controlli crasherebbero su steps[0] undefined.
  // --- modifica della scena -------------------------------------------------
  //
  // Lo stato locale tiene la scena modificata invece di scrivere su `data`:
  // `data` arriva come prop e riscriverlo significa mutare l'oggetto del
  // genitore, che React non prevede e che romperebbe il salvataggio. La
  // modifica parte da una copia e vive qui finche' il genitore non la conferma.

  const [scena, setScena] = useState<TacticalEntity[]>(data?.initialEntities ?? []);
  const [selezionato, setSelezionato] = useState<string | null>(null);

  // La scena segue `data` solo quando cambia l'esercizio, non a ogni
  // render: senza questo controllo, la modifica di una pedina verrebbe
  // cancellata dal prop al primo re-render del genitore.
  const idEsercizio = data?.title ?? '';
  React.useEffect(() => {
    setScena(data?.initialEntities ?? []);
    setSelezionato(null);
    setStepIndex(0);
    impostaProgress(0);
    setIsPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEsercizio]);

  /** Scrive una nuova scena e la propaga al genitore. */
  const aggiornaScena = useCallback(
    (nuova: TacticalEntity[]) => {
      setScena(nuova);
      onChange?.({ ...data, initialEntities: nuova });
    },
    [data, onChange],
  );

  /**
   * Traduce la posizione del canvas in coordinate normalizzate.
   *
   * Inverse di toPx, e va rifatta qui e non riesportata: toPx e' legato alle
   * dimensioni fisse di questo canvas, mentre questa funzione serve solo al
   * drag e va tenuta vicina al codice che la usa.
   */
  const daPx = useCallback((x: number, y: number) => ({
    x: clampCoord(((x - PAD) / INNER_W) * 100),
    y: clampCoord(((y - PAD) / INNER_H) * 100),
  }), []);


  /**
   * Aggiunge un oggetto in un posto libero.
   *
   * La ricerca del posto libero e' deterministica: parte dal centro e va in
   * spirale, e si ferma al primo punto che non e' troppo vicino a un oggetto
   * esistente. Mettere il nuovo oggetto sempre al centro coprirebbe un
   * giocatore, che e' esattamente il difetto che il repair corregge a valle.
   */
  const aggiungiEntita = useCallback(
    (tipo: TacticalEntity['type']) => {
      // Nessun limite sul numero di palle: un esercizio puo' averne piu'
      // di una (es. doppio pallone per la ricezione). Il blocco "una sola
      // palla" era una regola dell'AI, non della lavagna manuale: qui
      // l'allenatore sa cosa sta facendo.

      const occupati = scena;
      let punto = { x: 50, y: 50 };
      for (let r = 0; r < 40; r++) {
        const candidati = [
          { x: 50 + r * 3, y: 50 },
          { x: 50, y: 50 + r * 3 },
          { x: 50 - r * 3, y: 50 },
          { x: 50, y: 50 - r * 3 },
        ];
        const libero = candidati.find(
          (c) =>
            c.x >= 3 && c.x <= 97 && c.y >= 3 && c.y <= 97 &&
            occupati.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > 8),
        );
        if (libero) {
          punto = libero;
          break;
        }
      }

      const indice = scena.filter((e) => e.type === tipo).length + 1;
      const nuova: TacticalEntity = {
        id: `${tipo}-${Date.now().toString(36)}-${indice}`,
        type: tipo,
        x: punto.x,
        y: punto.y,
      };
      if (tipo === 'player') {
        nuova.team = 'blue';
        nuova.label = String(indice);
      } else if (tipo === 'goal') {
        nuova.width = 14;
        nuova.height = 4;
      }
      aggiornaScena([...scena, nuova]);
      setSelezionato(nuova.id);
    },
    [scena, aggiornaScena],
  );

  // Aggiunta comandata dal genitore (builder). NON si guarda il VALORE di
  // `addType`: si guarda un contatore `addSignal` che il genitore incrementa
  // a ogni click. Con un ref sul valore, resettarlo per permettere di
  // riaggiungere lo stesso tipo faceva rifare il confronto a OGNI render
  // (addType invariato, ref nullato): aggiungeva un giocatore per frame,
  // React moriva con "Maximum update depth exceeded" e il dialog della
  // lavagna si apriva su una schermata di errore. Il contatore no: cambia
  // solo quando il genitore clicca davvero.
  const addSignalRef = useRef(addSignal);
  useEffect(() => {
    if (addType && addSignal !== addSignalRef.current) {
      addSignalRef.current = addSignal;
      aggiungiEntita(addType);
    }
  }, [addType, addSignal, aggiungiEntita]);

  const rimuoviSelezionato = useCallback(() => {
    if (!selezionato) return;
    // Non si cancella l'ultimo pezzo: una lavagna vuota non e' modificabile,
    // e l'allenatore non ha piu' niente da cui ripartire.
    if (scena.length <= 1) return;
    aggiornaScena(scena.filter((e) => e.id !== selezionato));
    setSelezionato(null);
  }, [selezionato, scena, aggiornaScena]);

  const steps = useMemo(() => data?.steps ?? [], [data?.steps]);
  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStep = steps[safeIndex];

  // Le entita' che il player disegna: in modifica la copia locale su cui si
  // trascina, altrimenti quelle del prop. Va dichiarata qui e non piu' in
  // fondo perche' `positionOf` la usa, e una variabile usata prima della sua
  // dichiarazione e' un errore di compilazione, non una questione di stile.
  // In sola lettura si puo' passare direttamente il prop senza memoizzare:
  // non cambia mai dentro un render.
  const entities = useMemo(
    () => {
      if (editable) return scena;
      // In sola lettura, se lo step corrente ha un frame, mostra le entità
      // nella posizione dello step PRECEDENTE (da dove parte l'animazione).
      // Senza questo, il canvas mostrerebbe initialEntities (la scena base)
      // anche quando si guarda uno step avanzato, e il primo frame
      // dell'animazione farebbe saltare i giocatori.
      if (currentStep?.frame && safeIndex > 0) {
        const framePrecedente = steps[safeIndex - 1]?.frame;
        if (framePrecedente) return framePrecedente;
      }
      return data?.initialEntities ?? [];
    },
    [editable, scena, data?.initialEntities, currentStep, safeIndex, steps],
  );

  const posizioniInizio = useMemo(
    () => posizioniInizialiStep(entities, steps, safeIndex),
    [entities, steps, safeIndex],
  );

  /**
   * Tratti di movimento dello step corrente (modello ACTIONS). Calcolati con
   * la stessa funzione che decide dove finisce ogni step: cosi' la fine di
   * uno step coincide esattamente con l'inizio del successivo.
   */
  const segmenti = useMemo(
    () =>
      segmentiStep(
        currentStep,
        posizioniInizio,
        entities.filter((e) => e.type === 'ball').map((e) => e.id),
      ),
    [currentStep, posizioniInizio, entities],
  );

  /**
   * Durata TOTALE dello step, in secondi: la fine dell'ultimo tratto, non la
   * durata massima. Un'azione che inizia dopo 2s e dura 1s finisce a 3s.
   * Modello FRAME: durata fissa, tutti si muovono insieme.
   */
  const durataStep = useMemo(
    () => (currentStep?.frame ? 2 : durataSegmenti(segmenti)),
    [currentStep, segmenti],
  );

  const spostaEntita = useCallback(
    (id: string, x: number, y: number) => {
      setIsPlaying(false);
      const punto = daPx(x, y);

      // Modello FRAME: aggiorna la posizione dell'entità nel frame dello step
      // corrente. Il frame è una fotografia completa del campo: si prende
      // quella dello step precedente (o la scena base se è il primo step) e
      // si sposta solo l'entità trascinata. L'animazione interpola tra le
      // due fotografie — tutti i giocatori si muovono insieme, coerente.
      if (currentStep && steps.length > 0) {
        const framePrecedente = safeIndex > 0
          ? (steps[safeIndex - 1]?.frame ?? null)
          : null;
        const base = framePrecedente ?? scena;
        const nuovoFrame = base.map((e) =>
          e.id === id ? { ...e, ...punto } : e,
        );
        // Se l'entità non è nel frame precedente (aggiunta dopo), la aggiunge.
        if (!nuovoFrame.find((e) => e.id === id)) {
          const originale = scena.find((e) => e.id === id);
          if (originale) nuovoFrame.push({ ...originale, ...punto });
        }
        const nuoviSteps = steps.map((s, i) =>
          i === safeIndex ? { ...s, frame: nuovoFrame } : s,
        );
        onChange?.({ ...data, steps: nuoviSteps });
        return;
      }

      // Senza step attivi, il drag modifica la scena base.
      aggiornaScena(
        scena.map((e) => (e.id === id ? { ...e, ...punto } : e)),
      );
    },
    [scena, daPx, aggiornaScena, currentStep, steps, safeIndex, data, onChange],
  );

  /**
   * Posizione corrente di un'entita', interpolata sul progresso dello step.
   *
   * Due modelli:
   * - FRAME: interpola linearmente tra la posizione iniziale (dallo step
   *   precedente) e la posizione nel frame dello step corrente. Tutte le
   *   entità si muovono insieme, stessa durata, stesso easing. È il modello
   *   Tactical Pad: coerente e semplice.
   * - ACTIONS: campiona i tratti calcolati da `segmentiStep`. Ogni tratto
   *   parte dalla posizione reale dell'entita', quindi non ci sono scatti.
   */
  const positionOf = useCallback(
    (entity: TacticalEntity) => {
      // Punto di partenza: fine dello step precedente, non l'origine.
      const partenza = posizioniInizio.get(entity.id) ?? { x: entity.x, y: entity.y };

      // Modello FRAME.
      if (currentStep?.frame) {
        const nelFrame = currentStep.frame.find((e) => e.id === entity.id);
        if (!nelFrame) return toPx(partenza);
        // In editing e a step fermo (progress=0): mostra la posizione del
        // FRAME, non quella di partenza. L'allenatore ha trascinato il
        // giocatore e deve vedere dove l'ha messo, non da dove parte
        // l'animazione. Con progress=0 e interpolazione, il giocatore
        // tornava visivamente alla posizione precedente dopo il drag.
        if (editable && !isPlaying && progress === 0) {
          return toPx(nelFrame);
        }
        const t = Math.max(0, Math.min(1, progress / durataStep));
        return toPx({
          x: partenza.x + (nelFrame.x - partenza.x) * t,
          y: partenza.y + (nelFrame.y - partenza.y) * t,
        });
      }

      // Modello ACTIONS (AI + animazioni multi-azione).
      return toPx(posizioneAlTempo(segmenti.get(entity.id), partenza, progress));
    },
    [currentStep, progress, posizioniInizio, durataStep, segmenti, editable, isPlaying],
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


  useEffect(() => {
    if (!isPlaying) return;
    if (steps.length === 0) {
      setIsPlaying(false);
      return;
    }

    // `progress` e' il tempo trascorso NELLO STEP, in secondi di simulazione
    // (gia' scalato per la velocita'). Riparte da `progressRef.current` cosi'
    // pausa/riprendi e cambio velocita' proseguono senza scatti.
    const totale = durataStep;
    const baseProgress = progressRef.current >= totale ? 0 : progressRef.current;
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const trascorso = baseProgress + ((timestamp - start) / 1000) * speed;
      const next = Math.min(trascorso, totale);
      impostaProgress(next);

      if (trascorso < totale) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Fine dello step: passa subito allo step successivo senza pausa,
      // mantenendo continuita' tra posizione finale di questo step e partenza
      // del successivo.
      if (safeIndex >= steps.length - 1) {
        // Fine dell'esercizio: resta fermo sulle posizioni finali invece di
        // far scattare indietro le pedine.
        impostaProgress(totale);
        setIsPlaying(false);
        return;
      }

      impostaProgress(0);
      setStepIndex((i) => i + 1);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, safeIndex, speed, durataStep, steps.length, impostaProgress]);

  const goTo = (next: number) => {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, next)));
    impostaProgress(0);
    setIsPlaying(false);
  };

  const reset = () => {
    impostaProgress(0);
    setIsPlaying(false);
  };

  const selezionata = entities.find((e) => e.id === selezionato);

  return (
    <div className={cn('flex flex-col items-center text-white p-4 rounded-xl', className)}>
      <h2 className="text-base font-black uppercase tracking-tight mb-2 text-center">
        {data?.title}
      </h2>

      {/* Toolbar di modifica: SOPRA il canvas. I pulsanti di aggiunta sono
          nascosti quando c'è una toolbar esterna (showAddButtons=false):
          il genitore li ha già, e averli in due posti crea confusione. */}
      {editable && (
        <div className="w-full flex flex-wrap items-center gap-1.5 mb-3">
          {showAddButtons && (
            <>
              <button
                type="button"
                onClick={() => aggiungiEntita('player')}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-black/60 text-[10px] font-black uppercase tracking-wider hover:bg-black/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> Pedina
              </button>
              <button
                type="button"
                onClick={() => aggiungiEntita('ball')}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-black/60 text-[10px] font-black uppercase tracking-wider hover:bg-black/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> Palla
              </button>
              <button
                type="button"
                onClick={() => aggiungiEntita('cone')}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-black/60 text-[10px] font-black uppercase tracking-wider hover:bg-black/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> Cono
              </button>
              <button
                type="button"
                onClick={() => aggiungiEntita('zone')}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-black/60 text-[10px] font-black uppercase tracking-wider hover:bg-black/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> Zona
              </button>
            </>
          )}
          <button
            type="button"
            onClick={rimuoviSelezionato}
            disabled={!selezionato || scena.length <= 1}
            aria-label="Rimuovi selezionato"
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-black/60 text-[10px] font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <Trash2 className="h-3 w-3" /> Togli
          </button>
          <span className="flex-1" />

          {/* Coordinate della pedina selezionata: senza, spostare di due unità
              è un gioco a indovinare. */}
          <span className="text-[10px] font-black tabular-nums text-brand-green">
            {selezionata
              ? `${selezionata.id}: ${selezionata.x.toFixed(0)}, ${selezionata.y.toFixed(0)}`
              : 'Tocca una pedina'}
          </span>
          <button
            type="button"
            onClick={() => aggiornaScena(data?.initialEntities ?? [])}
            aria-label="Annulla le modifiche"
            className="p-2 bg-black/60 rounded-lg hover:bg-black/80"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="border-2 border-brand-green/50 rounded-lg overflow-hidden">
        {/* touch-action: none solo in modifica. In sola lettura il campo deve
            poter scorrere via swipe insieme alla pagina: senza, il dito ferma
            lo scroll e sull'iPhone la lavagna blocca il resto della schermata. */}
        <Stage
          width={FIELD_W}
          height={FIELD_H}
          style={editable ? { touchAction: 'none' } : undefined}
          onMouseDown={editable ? (e) => {
            // Il click sul vuoto deseleziona: altrimenti non c'e' modo di
            // togliere la selezione senza selezionarne un'altra.
            if (e.target === e.target.getStage()) setSelezionato(null);
          } : undefined}
          onTouchStart={editable ? () => setSelezionato(null) : undefined}
        >
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
                    fill={selezionato === zone.id ? "rgba(172,229,4,0.25)" : "rgba(172,229,4,0.12)"}
                    stroke={selezionato === zone.id ? "#ffffff" : "rgba(172,229,4,0.5)"}
                    strokeWidth={selezionato === zone.id ? 2 : 1}
                    cornerRadius={4}
                    draggable={editable}
                    onDragStart={() => setSelezionato(zone.id)}
                    onDragEnd={(e) => spostaEntita(zone.id, e.target.x(), e.target.y())}
                    onClick={() => editable && setSelezionato(zone.id)}
                    onTap={() => editable && setSelezionato(zone.id)}
                  />
                );
              })}

            {/* Coni */}
            {entities
              .filter((e) => e.type === 'cone')
              .map((cone) => {
                const p = toPx(cone);
                return (
                  <Circle
                    key={cone.id}
                    x={p.x}
                    y={p.y}
                    radius={4}
                    fill="#f97316"
                    stroke={selezionato === cone.id ? '#ffffff' : undefined}
                    strokeWidth={selezionato === cone.id ? 1.5 : 0}
                    draggable={editable}
                    onDragStart={() => setSelezionato(cone.id)}
                    onDragEnd={(e) => spostaEntita(cone.id, e.target.x(), e.target.y())}
                    onClick={() => editable && setSelezionato(cone.id)}
                    onTap={() => editable && setSelezionato(cone.id)}
                  />
                );
              })}

            {/* Porte / porticine */}
            {entities
              .filter((e) => e.type === 'goal')
              .map((goal) => {
                const p = toPx(goal);
                const sideGoal = (goal.x <= 18 || goal.x >= 82) && goal.y > 18 && goal.y < 82;
                const gwPct = sideGoal ? (goal.height ?? 4) : (goal.width ?? 14);
                const ghPct = sideGoal ? (goal.width ?? 14) : (goal.height ?? 4);
                const gw = (gwPct / 100) * INNER_W;
                const gh = (ghPct / 100) * INNER_H;
                return (
                  <Rect
                    key={goal.id}
                    x={p.x - gw / 2}
                    y={p.y - gh / 2}
                    width={gw}
                    height={gh}
                    fill={selezionato === goal.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)'}
                    stroke="#ffffff"
                    strokeWidth={selezionato === goal.id ? 2.5 : 1.8}
                    cornerRadius={2}
                    draggable={editable}
                    onDragStart={() => setSelezionato(goal.id)}
                    onDragEnd={(e) => spostaEntita(goal.id, e.target.x() + gw / 2, e.target.y() + gh / 2)}
                    onClick={() => editable && setSelezionato(goal.id)}
                    onTap={() => editable && setSelezionato(goal.id)}
                  />
                );
              })}

            {/* Frecce tattiche dello step corrente: partono dalla posizione reale */}
            {Array.from(segmenti.entries())
              .flatMap(([entityId, lista]) =>
                lista
                  .filter((seg) => !seg.segue)
                  .map((seg) => ({ entityId, seg })),
              )
              .sort((a, b) => a.seg.indiceAzione - b.seg.indiceAzione)
              .map(({ entityId, seg }, idx) => {
                const fp = toPx(seg.from);
                const rawTp = toPx(seg.to);
                const dx = rawTp.x - fp.x;
                const dy = rawTp.y - fp.y;
                const len = Math.hypot(dx, dy);
                if (len < 2) return null;
                const trim = seg.type === 'pass' && len > 24 ? 11 : 0;
                const tp =
                  trim > 0
                    ? { x: rawTp.x - (dx / len) * trim, y: rawTp.y - (dy / len) * trim }
                    : rawTp;
                const style = arrowStyleForAction(seg.type);
                return (
                  <Arrow
                    key={`${entityId}-${seg.type}-${seg.indiceAzione}-${idx}`}
                    points={[fp.x, fp.y, tp.x, tp.y]}
                    stroke={style.stroke}
                    fill={style.fill}
                    strokeWidth={style.strokeWidth}
                    dash={style.dash}
                    pointerLength={style.pointerLength}
                    pointerWidth={style.pointerWidth}
                    listening={false}
                  />
                );
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
                    stroke={selezionato === ball.id ? '#ffffff' : '#000000'}
                    strokeWidth={selezionato === ball.id ? 3 : 1}
                    opacity={editable ? 1 : undefined}
                    draggable={editable}
                    onDragStart={() => setSelezionato(ball.id)}
                    onDragEnd={(e) => spostaEntita(ball.id, e.target.x(), e.target.y())}
                    onClick={() => editable && setSelezionato(ball.id)}
                    onTap={() => editable && setSelezionato(ball.id)}
                  />
                );
              })}

            {/* Giocatori */}
            {entities
              .filter((e) => e.type === 'player')
              .map((player) => {
                const p = positionOf(player);
                return (
                  <Group
                    key={player.id}
                    x={p.x}
                    y={p.y}
                    draggable={editable}
                    onDragStart={() => setSelezionato(player.id)}
                    onDragEnd={(e) => spostaEntita(player.id, e.target.x(), e.target.y())}
                    onClick={() => editable && setSelezionato(player.id)}
                    onTap={() => editable && setSelezionato(player.id)}
                  >
                    {/* alone di selezione: disegnato sotto, quindi non copre
                        numero ed etichetta */}
                    {selezionato === player.id && (
                      <Circle radius={15} stroke="#ffffff" strokeWidth={1.5} dash={[3, 3]} />
                    )}
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
      <div className="flex flex-wrap items-center gap-2 mt-3">
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
            // Se l'esercizio e' finito (fermo all'ultimo step sul fondo)
            // riparte dal primo step.
            const aFineEsercizio = safeIndex >= steps.length - 1 && progress >= durataStep;
            if (aFineEsercizio) {
              setStepIndex(0);
              impostaProgress(0);
            }
            setIsPlaying(true);
          }}
          disabled={steps.length === 0}
          aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
          className="p-3 bg-brand-green text-black rounded-full hover:opacity-90 font-bold disabled:opacity-30 disabled:pointer-events-none"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        {/* Aggiungi step: solo in modifica. Lo step nuovo parte dalle posizioni
            attuali delle entita' (cioe' dove sono finite quelle dello step
            precedente), cosi' la continuita' con quello prima e' gia' corretta. */}
        {editable && (
          <button
            type="button"
            onClick={() => {
              // Il nuovo step parte con un frame identico alla scena corrente
              // (o al frame dello step precedente): l'allenatore lo trascina
              // da lì. Senza frame iniziale, il primo drag creerebbe il frame
              // da zero e le entità non trascinate sparirebbero.
              const framePrecedente = steps.length > 0
                ? (steps[steps.length - 1]?.frame ?? null)
                : null;
              const frameIniziale = framePrecedente ?? scena;
              const nuovoStep: TacticalStep = {
                stepNumber: steps.length + 1,
                description: `Step ${steps.length + 1}`,
                actions: [],
                frame: frameIniziale.map((e) => ({ ...e })),
              };
              const nuoviSteps = [...steps, nuovoStep];
              onChange?.({ ...data, steps: nuoviSteps });
              setStepIndex(nuoviSteps.length - 1);
              impostaProgress(0);
              setIsPlaying(false);
            }}
            aria-label="Aggiungi step"
            className="p-2 bg-black/60 rounded-full hover:bg-black/80 border border-brand-green/30"
          >
            <Plus size={16} className="text-brand-green" />
          </button>
        )}

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
