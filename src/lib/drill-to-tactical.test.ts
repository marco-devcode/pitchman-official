/**
 * Test dell'adattatore Drill -> TacticalExercise.
 *
 * Il pericolo di questo file non e' che lanci: e' che perda un'azione o
 * converta male le unita' e l'animazione risulti "quasi giusta". Un passo
 * saltato in una sequenza di 6 si vede appena, ma rende l'esercizio
 * incomprensibile. Quindi qui si conta quante azioni arrano e si controlla
 * che i secondi siano davvero secondi.
 */

import { drillToTactical } from './drill-to-tactical';
import { repairDrill } from './repair-drill';
import type { Drill } from './drill';

const base: Drill = {
  id: 'd1',
  name: 'Costruzione 3v2',
  description: 'desc',
  category: 'costruzione',
  ageGroup: 'U12',
  pitch: { shape: 'rectangle', width: 60, height: 40 },
  cycles: 1,
  objects: [
    { id: 'gk', kind: 'player', team: 'blue', label: 'GK', x: 10, y: 50, hasBall: true },
    { id: 'dc1', kind: 'player', team: 'blue', label: '5', x: 30, y: 35 },
    { id: 'dc2', kind: 'player', team: 'blue', label: '6', x: 30, y: 65 },
    { id: 'cc', kind: 'player', team: 'blue', label: '8', x: 45, y: 50 },
    { id: 'pv1', kind: 'player', team: 'red', label: '9', x: 60, y: 40 },
    { id: 'pv2', kind: 'player', team: 'red', label: '10', x: 60, y: 60 },
    { id: 'ball', kind: 'ball', x: 10, y: 50 },
    { id: 'c1', kind: 'cone', x: 75, y: 30 },
    { id: 'z1', kind: 'zone', x: 50, y: 50, width: 20, height: 15 },
  ],
  sequence: [
    {
      id: 's1',
      description: 'Il portiere passa al centrocampista',
      duration: 2000,
      actions: [{ id: 'a1', type: 'pass', subject: 'ball', target: 'cc', duration: 900, easing: 'easeOut' }],
    },
    {
      id: 's2',
      description: 'Il centrocampista dribbla',
      duration: 2000,
      actions: [
        { id: 'a2', type: 'dribble', subject: 'cc', to: { x: 55, y: 50 }, duration: 1200, startAt: 200 },
      ],
    },
  ],
};

describe('drillToTactical', () => {
  const t = drillToTactical(repairDrill(base)!.drill);

  it('conta i giocatori senza contare palla, coni e zone', () => {
    expect(t.playersShown).toBe(6);
  });

  it('esclude le porte (non animabili) e tiene palla, coni e zone', () => {
    const kinds = t.initialEntities.map((e) => e.type);
    expect(kinds).toContain('ball');
    expect(kinds).toContain('cone');
    expect(kinds).toContain('zone');
    expect(kinds.filter((k) => k === 'ball')).toHaveLength(1);
  });

  it('traduce il portiere come gk, non come giocatore di squadra', () => {
    expect(t.initialEntities.find((e) => e.id === 'gk')!.team).toBe('gk');
  });

  it('converte i millisecondi in secondi', () => {
    const a = t.steps[0].actions[0];
    // 900ms -> 0.9s. Se tornasse 900, il player mostrerebbe un passo di 15
    // minuti e l'app sembrerebbe bloccata.
    expect(a.duration).toBeCloseTo(0.9, 2);
    expect(a.duration).toBeLessThan(8);
  });

  it('ricostruisce il punto di partenza di ogni azione', () => {
    // La palla parte dal portiere (10,50), non dal centrocampo.
    const a = t.steps[0].actions[0];
    expect(a.from).toEqual({ x: 10, y: 50 });
    expect(a.to).toEqual({ x: 45, y: 50 });
  });

  it('fa partire il dribble dal punto dove la palla e\' arrivata', () => {
    const a = t.steps[1].actions[0];
    expect(a.from).toEqual({ x: 45, y: 50 });
    expect(a.to).toEqual({ x: 55, y: 50 });
  });

  it('converte startAt e lo conserva come opzionale', () => {
    expect(t.steps[1].actions[0].startAt).toBeCloseTo(0.2, 2);
    expect(t.steps[0].actions[0].startAt).toBeUndefined();
  });

  it('conserva easing', () => {
    expect(t.steps[0].actions[0].easing).toBe('easeOut');
  });

  it('non perde azioni: ogni azione del drill deve arrivare al player', () => {
    const totale = t.steps.reduce((n, s) => n + s.actions.length, 0);
    expect(totale).toBe(2);
  });

  it('numera gli step in ordine', () => {
    expect(t.steps.map((s) => s.stepNumber)).toEqual([1, 2]);
  });

  it('scarta le azioni "wait" invece di farle muovere a caso', () => {
    const conWait = repairDrill({
      ...base,
      sequence: [
        {
          id: 's1',
          description: 'attesa',
          duration: 1000,
          actions: [{ id: 'a1', type: 'wait', subject: 'pv1', duration: 500 }],
        },
      ],
    })!.drill;
    expect(drillToTactical(conWait).steps[0].actions).toHaveLength(0);
  });

  it('mappa un giocatore senza squadra su neutral', () => {
    const senza = repairDrill({
      ...base,
      objects: [
        { id: 'x1', kind: 'player', team: 'neutral', label: 'X', x: 30, y: 30, hasBall: true },
        { id: 'x2', kind: 'player', team: 'blue', label: '2', x: 60, y: 60 },
      ],
      sequence: [
        {
          id: 's1',
          description: 'passaggio',
          duration: 1000,
          actions: [{ id: 'a1', type: 'pass', subject: 'ball', target: 'x2', duration: 700 }],
        },
      ],
    })!.drill;
    expect(drillToTactical(senza).initialEntities.find((e) => e.id === 'x1')!.team).toBe('neutral');
  });
});