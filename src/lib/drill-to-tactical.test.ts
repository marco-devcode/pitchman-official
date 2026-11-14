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
import {
  durataSegmenti,
  posizioneAlTempo,
  posizioniFineStep,
  posizioniInizialiStep,
  segmentiStep,
  type TacticalExercise,
} from './tactical-exercise';

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

  it('mappa le porte (goal) e aggiorna la posizione della palla dopo un dribble per lo step successivo', () => {
    const conPorta: Drill = {
      ...base,
      objects: [
        ...base.objects,
        { id: 'g1', kind: 'goal', x: 92, y: 50 },
      ],
      sequence: [
        ...base.sequence,
        {
          id: 's3',
          description: 'Tiro in porta dopo la conduzione',
          duration: 1500,
          actions: [{ id: 'a3', type: 'shoot', subject: 'ball', target: 'g1', duration: 800 }],
        },
      ],
    };
    const res = drillToTactical(repairDrill(conPorta)!.drill);
    const goal = res.initialEntities.find((e) => e.id === 'g1');
    expect(goal?.type).toBe('goal');
    expect(res.playersShown).toBe(6);
    expect(res.steps[2].actions[0].from).toEqual({ x: 55, y: 50 });
    expect(res.steps[2].actions[0].to).toEqual({ x: 92, y: 50 });
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

  it('converte la zona dal centro (Drill) all\'angolo in alto a sinistra (TacticalEntity)', () => {
    const zona = t.initialEntities.find((e) => e.id === 'z1')!;
    expect(zona.width).toBe(20);
    expect(zona.height).toBe(15);
    expect(zona.x).toBe(40);
    expect(zona.y).toBe(42.5);
  });

  it('non teletrasporta il ricevente verso la palla dopo un passaggio', () => {
    const quasiAddosso: Drill = {
      ...base,
      sequence: [
        {
          id: 's1',
          description: 'passaggio leggermente impreciso vicino a cc',
          duration: 1500,
          actions: [{ id: 'a1', type: 'pass', subject: 'ball', to: { x: 46, y: 50 }, duration: 700 }],
        },
        {
          id: 's2',
          description: 'cc scatta',
          duration: 1500,
          actions: [{ id: 'a2', type: 'run', subject: 'cc', to: { x: 70, y: 50 }, duration: 900 }],
        },
      ],
    };
    const res = drillToTactical(repairDrill(quasiAddosso)!.drill);
    expect(res.steps[1].actions[0].from).toEqual({ x: 45, y: 50 });
  });
});

const esercizioContinuita: TacticalExercise = {
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
  const { initialEntities, steps } = esercizioContinuita;

  it('al primo step ogni entita\' parte dalla sua posizione iniziale', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 0);
    expect(p.get('p1')).toEqual({ x: 20, y: 20 });
    expect(p.get('p2')).toEqual({ x: 80, y: 80 });
  });

  it('al secondo step p1 parte da dove e\' finito il primo', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 1);
    expect(p.get('p1')).toEqual({ x: 40, y: 40 });
  });

  it('al terzo step p1 parte da dove e\' finito il secondo', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 2);
    expect(p.get('p1')).toEqual({ x: 60, y: 60 });
  });

  it('un\'entita\' che non si e\' mossa resta dov\'era', () => {
    for (const i of [0, 1, 2]) {
      expect(posizioniInizialiStep(initialEntities, steps, i).get('p2')).toEqual({ x: 80, y: 80 });
    }
  });

  it('la palla segue il passaggio come un giocatore', () => {
    const p = posizioniInizialiStep(initialEntities, steps, 1);
    expect(p.get('ball')).toEqual({ x: 40, y: 40 });
  });

  it('la palla segue il dribble del portatore fra uno step e il successivo', () => {
    const conDribble: TacticalExercise = {
      ...esercizioContinuita,
      steps: [
        {
          stepNumber: 1,
          description: 'p1 conduce palla',
          actions: [
            { entityId: 'p1', type: 'dribble', from: { x: 20, y: 20 }, to: { x: 52, y: 38 }, duration: 1 },
          ],
        },
      ],
    };
    const p = posizioniInizialiStep(conDribble.initialEntities, conDribble.steps, 1);
    expect(p.get('p1')).toEqual({ x: 52, y: 38 });
    expect(p.get('ball')).toEqual({ x: 52, y: 38 });
  });

  it('andare a uno step a ritroso non lascia residui', () => {
    const avanti = posizioniInizialiStep(initialEntities, steps, 2);
    posizioniInizialiStep(initialEntities, steps, 0);
    const indietro = posizioniInizialiStep(initialEntities, steps, 2);
    expect(indietro.get('p1')).toEqual(avanti.get('p1'));
  });

  it('uno step senza azioni lascia la scena com\'era', () => {
    const vuoto: TacticalExercise = {
      ...esercizioContinuita,
      steps: [{ stepNumber: 1, description: 'nessuna azione', actions: [] }],
    };
    const p = posizioniInizialiStep(vuoto.initialEntities, vuoto.steps, 1);
    expect(p.get('p1')).toEqual({ x: 20, y: 20 });
  });

  it('l\'avanzamento e\' monotono: ogni posizione successiva e\' piu\' avanti', () => {
    const posizioni = [0, 1, 2].map((i) =>
      posizioniInizialiStep(initialEntities, steps, i).get('p1')!.x,
    );
    expect(posizioni).toEqual([20, 40, 60]);
  });
});

describe('timeline continua (segmentiStep / posizioneAlTempo)', () => {
  it('mantiene continuita\' perfetta fra fine step 0 e inizio step 1 anche con from incoerenti', () => {
    const sporco: TacticalExercise = {
      title: 'Sporco',
      description: '',
      playersShown: 2,
      initialEntities: [
        { id: 'p1', type: 'player', team: 'blue', x: 20, y: 50 },
        { id: 'ball', type: 'ball', x: 20, y: 50 },
      ],
      steps: [
        {
          stepNumber: 1,
          description: 'dribble',
          actions: [
            // `from` sbagliato di proposito: la pedina sta a (20,50)
            { entityId: 'p1', type: 'dribble', from: { x: 5, y: 5 }, to: { x: 48, y: 50 }, duration: 1.5 },
          ],
        },
        {
          stepNumber: 2,
          description: 'prosegue',
          actions: [
            // altro `from` incoerente nello step successivo
            { entityId: 'p1', type: 'run', from: { x: 10, y: 10 }, to: { x: 75, y: 50 }, duration: 2 },
          ],
        },
      ],
    };

    const start0 = posizioniInizialiStep(sporco.initialEntities, sporco.steps, 0);
    const seg0 = segmentiStep(sporco.steps[0], start0, ['ball']);
    const dur0 = durataSegmenti(seg0);
    expect(posizioneAlTempo(seg0.get('p1'), start0.get('p1')!, 0)).toEqual({ x: 20, y: 50 });

    const fineP1 = posizioneAlTempo(seg0.get('p1'), start0.get('p1')!, dur0);
    const fineBall = posizioneAlTempo(seg0.get('ball'), start0.get('ball')!, dur0);
    expect(fineP1).toEqual({ x: 48, y: 50 });
    expect(fineBall).toEqual({ x: 48, y: 50 });

    const start1 = posizioniInizialiStep(sporco.initialEntities, sporco.steps, 1);
    const seg1 = segmentiStep(sporco.steps[1], start1, ['ball']);
    expect(posizioneAlTempo(seg1.get('p1'), start1.get('p1')!, 0)).toEqual(fineP1);
    expect(posizioniFineStep(sporco.initialEntities, sporco.steps, 1).get('p1')).toEqual({ x: 75, y: 50 });
  });

  it('non tronca step fino a 13 secondi (allineamento con startAt+duration del repair)', () => {
    const lungo: TacticalExercise = {
      title: 'Lungo',
      description: '',
      playersShown: 1,
      initialEntities: [{ id: 'p1', type: 'player', team: 'blue', x: 15, y: 50 }],
      steps: [
        {
          stepNumber: 1,
          description: 'azione lunga',
          actions: [
            { entityId: 'p1', type: 'run', from: { x: 15, y: 50 }, to: { x: 80, y: 50 }, startAt: 4, duration: 6 },
          ],
        },
      ],
    };
    const start0 = posizioniInizialiStep(lungo.initialEntities, lungo.steps, 0);
    const seg0 = segmentiStep(lungo.steps[0], start0, []);
    expect(durataSegmenti(seg0)).toBe(10);
  });
});