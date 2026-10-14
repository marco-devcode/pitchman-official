/**
 * Posizione di ogni entita' all'INIZIO di uno step.
 *
 * Due modelli, in ordine di preferenza:
 *
 * 1. FRAME (Tactical Pad): ogni step ha `frame`, una fotografia completa del
 *    campo a fine step. La posizione iniziale dello step N è il frame dello
 *    step N-1. L'animazione interpola tra le due fotografie: tutti i
 *    giocatori si muovono insieme, in modo coerente, senza `from`/`to` per
 *    singola entità. È il modello della lavagna manuale.
 *
 * 2. ACTIONS (AI): ogni step ha `actions`, una lista di movimenti per
 *    singola entità. La posizione iniziale dello step N è la posizione
 *    finale dello step N-1, calcolata applicando le azioni in sequenza.
 *    Retrocompatibilità con il generatore AI.
 *
 * La funzione restituisce una Map entityId -> {x, y} con la posizione di
 * ogni entità all'inizio dello step richiesto.
 */

import type { TacticalEntity, TacticalStep } from './tactical-exercise';

export function posizioniInizialiStep(
  entities: TacticalEntity[],
  steps: TacticalStep[],
  indiceStep: number,
): Map<string, { x: number; y: number }> {
  const posizioni = new Map<string, { x: number; y: number }>();
  for (const e of entities) posizioni.set(e.id, { x: e.x, y: e.y });

  // Modello FRAME: la posizione iniziale dello step N è il frame dello step N-1.
  // Si scorre al contrario perché il frame dello step precedente è già la
  // posizione finale di quello ancora prima.
  const usaFrame = steps.some((s) => s.frame);
  if (usaFrame) {
    for (let i = indiceStep - 1; i >= 0; i--) {
      const frame = steps[i]?.frame;
      if (!frame) continue;
      for (const e of frame) {
        posizioni.set(e.id, { x: e.x, y: e.y });
      }
      // Il frame trovato è la posizione di partenza: ci si ferma.
      break;
    }
    return posizioni;
  }

  // Modello ACTIONS: applica le azioni degli step precedenti in sequenza.
  for (let i = 0; i < indiceStep; i++) {
    for (const a of steps[i]?.actions ?? []) {
      if (!a.to) continue;
      posizioni.set(a.entityId, { x: a.to.x, y: a.to.y });
    }
  }
  return posizioni;
}

/**
 * Posizione di OGNI entità alla FINE dello step richiesto.
 *
 * Nel modello frame, è semplicemente il frame dello step. Nel modello
 * actions, è la posizione iniziale più le azioni dello step applicate.
 */
export function posizioniFineStep(
  entities: TacticalEntity[],
  steps: TacticalStep[],
  indiceStep: number,
): Map<string, { x: number; y: number }> {
  const inizio = posizioniInizialiStep(entities, steps, indiceStep);
  const step = steps[indiceStep];
  if (!step) return inizio;

  if (step.frame) {
    const fine = new Map(inizio);
    for (const e of step.frame) {
      fine.set(e.id, { x: e.x, y: e.y });
    }
    return fine;
  }

  const fine = new Map(inizio);
  for (const a of step.actions ?? []) {
    if (!a.to) continue;
    fine.set(a.entityId, { x: a.to.x, y: a.to.y });
  }
  return fine;
}
