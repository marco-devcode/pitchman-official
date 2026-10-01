/**
 * Test della continuita' fra step nel player.
 *
 * Il difetto che questo file blocca e' invisibile a occhio nel codice e
 * visibilissimo a occhio nell'app: le pedine tornavano alla posizione di
 * partenza a ogni step. Il campo tornava indietro tre volte in un esercizio di
 * tre passi, e non si capiva mai chi fosse dove.
 *
 * Importa la funzione vera dal lib, non una copia: una copia passerebbe
 * questi test anche se il player tornasse a sbagliare, che e' esattamente il
 * difetto di un test che duplica la logica invece di esercitarla.
 */

import { posizioniInizialiStep } from './step-continuity';
import type { TacticalExercise } from './tactical-exercise';

const esercizio: TacticalExercise = {
  title: '3 passi',
  description: '',
  playersShown: 2,
  initialEntities: [
    { id: 'p1', type: 'player', team: 'blue', label: '1', x: 20, y: 20 },
    { id: 'p2', type: 'player', team: 'blue', label: '2', x: 80, y: 80 },
    { id: 'ball', type: 'ball', x: 20, y: 20 },
  ],
  steps: [
    {
      stepNumber: 1,
      description: 'p1 corre in avanti',
      actions: [
        { entityId: 'p1', type: 'run', from: { x: 20, y: 20 }, to: { x: 40, y: 40 }, duration: 1 },
        { entityId: 'ball', type: 'pass', from: { x: 20, y: 20 }, to: { x: 40, y: 40 }, duration: 1 },
      ],
    },
    {
      stepNumber: 2,
      description: 'p1 continua a correre',
      actions: [
        { entityId: 'p1', type: 'run', from: { x: 40, y: 40 }, to: { x: 60, y: 60 }, duration: 1 },
      ],
    },
    {
      stepNumber: 3,
      description: 'p1 arriva in fondo',
      actions: [
        { entityId: 'p1', type: 'run', from: { x: 60, y: 60 }, to: { x: 75, y: 75 }, duration: 1 },
      ],
    },
  ],
};

describe('posizioniInizialiStep', () => {
  const { initialEntities, steps } = esercizio;

  it('al primo step ogni entita\' parte dalla sua posizione iniziale', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 0);
    expect(p.get('p1')).toEqual({ x: 20, y: 20 });
    expect(p.get('p2')).toEqual({ x: 80, y: 80 });
  });

  it('al secondo step p1 parte da dove e\' finito il primo', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 1);
    // Il difetto: qui tornava a 20,20 e il campo si teletrasportava indietro.
    expect(p.get('p1')).toEqual({ x: 40, y: 40 });
  });

  it('al terzo step p1 parte da dove e\' finito il secondo', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 2);
    expect(p.get('p1')).toEqual({ x: 60, y: 60 });
  });

  it('un\'entita\' che non si e\' mossa resta dov\'era', () => {
    // p2 non ha azioni in nessuno step: deve restare a 80,80 in tutti gli step,
    // non saltare perche' il calcolo non la tocca.
    for (const i of [0, 1, 2]) {
      expect(posizioniInizialiStep(initialEntities, steps, i).get('p2')).toEqual({ x: 80, y: 80 });
    }
  });

  it('la palla segue il passaggio come un giocatore', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 1);
    expect(p.get('ball')).toEqual({ x: 40, y: 40 });
  });

  it('andare a uno step a ritroso non lascia residui', () => {
    // Il calcolo riparte da capo a ogni chiamata: il risultato non deve
    // dipendere dall'ordine in cui si chiedono gli step, altrimenti navigando
    // avanti e indietro l'animazione si sposta.
    const avanti = posizioniInizialiStep(initialEntities, steps, 2);
    posizioniInizialiStep(initialEntities, steps, 0);
    const indietro = posizioniInizialiStep(initialEntities, steps, 2);
    expect(indietro.get('p1')).toEqual(avanti.get('p1'));
  });

  it('uno step senza azioni lascia la scena com\'era', () => {
    const vuoto: TacticalExercise = {
      ...esercizio,
      steps: [{ stepNumber: 1, description: 'nessuna azione', actions: [] }],
    };
    const p = posizioniInizialiStep(vuoto.initialEntities, vuoto.steps, 1);
    expect(p.get('p1')).toEqual({ x: 20, y: 20 });
  });

  it('l\'avanzamento e\' monotono: ogni posizione successiva e\' piu\' avanti', () => {
    // Il caso che descrive il sintomo segnalato: uno scalino all'indietro a
    // ogni step. Se il test passa ma l'animazione "brutta", il difetto e'
    // altrove; se fallisce qui, la simulazione torna indietro.
    const posizioni = [0, 1, 2].map((i) =>
      posizioniInizialiStep(initialEntities, steps, i).get('p1')!.x,
    );
    expect(posizioni).toEqual([20, 40, 60]);
  });
});