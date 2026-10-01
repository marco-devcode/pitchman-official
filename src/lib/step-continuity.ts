/**
 * Posizione di ogni entita' all'INIZIO di uno step.
 *
 * E' la funzione che tiene insieme l'animazione: senza di essa, un'entita'
 * che si muove nello step 2 ripartirebbe dalla sua posizione di partenza
 * originale invece che da dove ha finito lo step 1, e il campo si
 * teletrasporterebbe indietro a ogni passo. Su un esercizio di tre passi si
 * vede tre volte, ed e' il motivo per cui l'animazione risulta macchinosa.
 *
 * Si simula dall'inizio dell'esercizio ogni volta invece di tenere in memoria
 * un indice di "posizioni finali": cosi' resta corretto anche andando a uno
 * step a caso con le frecce di navigazione, che e' il modo normale in cui si
 * guarda un esercizio.
 *
 * Vive in lib e non dentro il componente perche' sia testabile: Konva e
 * requestAnimationFrame non lo sono, e il difetto che ha causato e' proprio
 * della logica, non del rendering.
 */

import type { TacticalEntity, TacticalStep } from './tactical-exercise';

export function posizioniInizialiStep(
  entities: TacticalEntity[],
  steps: TacticalStep[],
  indiceStep: number,
): Map<string, { x: number; y: number }> {
  const posizioni = new Map<string, { x: number; y: number }>();
  for (const e of entities) posizioni.set(e.id, { x: e.x, y: e.y });

  // Solo gli step precedenti a quello corrente: a fine sequenza un'entita' e'
  // nel punto d'arrivo della sua ultima azione, non nel `from` (che e' dove
  // parte). Usare il `from` qui la lascerebbe un passo indietro ogni volta.
  for (let i = 0; i < indiceStep; i++) {
    for (const a of steps[i]?.actions ?? []) {
      if (!a.to) continue;
      posizioni.set(a.entityId, { x: a.to.x, y: a.to.y });
    }
  }
  return posizioni;
}
