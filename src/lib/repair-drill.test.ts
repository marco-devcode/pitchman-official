/**
 * Test del repair deterministico.
 *
 * Il repair e' la difesa contro un modello che sbaglia: se smette di
 * correggere, l'esercizio resta "carino" ma animato in modo incoerente, e in
 * una lavagna animata l'incoerenza e' molto piu' dannosa di un errore
 * esplicito. Quindi qui non si testa "il modello risponde bene", che e'
 * casuale, ma "gli errori noti vengono corretti".
 */

import { repairDrill, repairVariants } from './repair-drill';
import type { Drill, DrillObject } from './drill';

function drillWith(objects: DrillObject[], sequence?: Drill['sequence']): Drill {
  return {
    id: 'd1',
    name: 'Test',
    description: '',
    category: '',
    ageGroup: 'U12',
    pitch: { shape: 'rectangle', width: 60, height: 40 },
    objects,
    sequence: sequence ?? [
      {
        id: 's1',
        description: 'passaggio',
        duration: 2000,
        actions: [
          { id: 'a1', type: 'pass', subject: 'ball', target: 'p2', duration: 700 },
        ],
      },
    ],
    cycles: 1,
  };
}

const player = (id: string, x: number, y: number, hasBall = false): DrillObject => ({
  id,
  kind: 'player',
  team: 'blue',
  label: id.toUpperCase(),
  x,
  y,
  hasBall,
});

const ball = (id: string, x: number, y: number): DrillObject => ({
  id,
  kind: 'ball',
  x,
  y,
});

describe('repairDrill — scena', () => {
  it('crea la palla sul possessore iniziale quando il modello la dimentica', () => {
    const r = repairDrill(drillWith([player('p1', 30, 30, true), player('p2', 60, 60)]));
    expect(r).not.toBeNull();
    const palla = r!.drill.objects.find((o) => o.kind === 'ball');
    expect(palla).toBeDefined();
    expect(palla!.id).toBe('ball');
    expect(palla!.x).toBe(30);
    expect(palla!.y).toBe(30);
    expect(r!.fixes.join(' ')).toMatch(/palla/i);
  });

  it('tiene una sola palla e le dà l\'id canonico', () => {
    const r = repairDrill(drillWith([player('p1', 30, 30, true), ball('palla1', 30, 30), ball('palla2', 70, 20)]));
    const palle = r!.drill.objects.filter((o) => o.kind === 'ball');
    expect(palle).toHaveLength(1);
    expect(palle[0].id).toBe('ball');
  });

  it('sposta la palla sul possessore quando era lontana', () => {
    const r = repairDrill(drillWith([player('p1', 20, 20, true), ball('ball', 80, 80)]));
    const palla = r!.drill.objects.find((o) => o.id === 'ball')!;
    expect(palla.x).toBe(20);
    expect(palla.y).toBe(20);
  });

  it('lascia un solo possessore iniziale', () => {
    const r = repairDrill(drillWith([player('p1', 20, 20, true), player('p2', 40, 40, true)]));
    const possessori = r!.drill.objects.filter((o) => o.hasBall);
    expect(possessori).toHaveLength(1);
    expect(possessori[0].id).toBe('p1');
  });

  it('sposta i giocatori fuori dai coni', () => {
    const r = repairDrill(
      drillWith([player('p1', 50, 50, true), player('p2', 70, 70), { id: 'c1', kind: 'cone', x: 50, y: 50 }]),
    );
    const vicinoAlCono = r!.drill.objects.find((o) => o.id === 'p1')!;
    const cono = r!.drill.objects.find((o) => o.id === 'c1')!;
    const d = Math.hypot(vicinoAlCono.x - cono.x, vicinoAlCono.y - cono.y);
    expect(d).toBeGreaterThanOrEqual(4.9);
  });

  it('separa i giocatori sovrapposti', () => {
    const r = repairDrill(drillWith([player('p1', 50, 50, true), player('p2', 50.2, 50.1)]));
    const p1 = r!.drill.objects.find((o) => o.id === 'p1')!;
    const p2 = r!.drill.objects.find((o) => o.id === 'p2')!;
    expect(Math.hypot(p1.x - p2.x, p1.y - p2.y)).toBeGreaterThan(2.9);
  });

  it('riporta dentro le coordinate fuori campo', () => {
    const r = repairDrill(drillWith([player('p1', 140, -30, true), player('p2', 60, 60)]));
    for (const o of r!.drill.objects) {
      expect(o.x).toBeGreaterThanOrEqual(3);
      expect(o.x).toBeLessThanOrEqual(97);
      expect(o.y).toBeGreaterThanOrEqual(3);
      expect(o.y).toBeLessThanOrEqual(97);
    }
  });

  it('scarta un esercizio senza giocatori', () => {
    expect(repairDrill(drillWith([ball('ball', 50, 50)]))).toBeNull();
  });
});

describe('repairDrill — azioni', () => {
  it('mette la palla come soggetto di passaggio e tiro', () => {
    const r = repairDrill(
      drillWith(
        [player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)],
        [
          {
            id: 's1',
            description: 'passa e tira',
            duration: 3000,
            actions: [
              { id: 'a1', type: 'pass', subject: 'p1', target: 'p2', duration: 700 },
              { id: 'a2', type: 'shoot', subject: 'p2', target: 'p1', duration: 800 },
            ],
          },
        ],
      ),
    );
    expect(r!.drill.sequence[0].actions.every((a) => a.subject === 'ball')).toBe(true);
  });

  it('elimina le azioni che puntano a un id inesistente', () => {
    const r = repairDrill(
      drillWith(
        [player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)],
        [
          {
            id: 's1',
            description: 'passa a nessuno',
            duration: 3000,
            actions: [
              { id: 'a1', type: 'pass', subject: 'ball', target: 'fantasma', duration: 700 },
            ],
          },
        ],
      ),
    );
    expect(r!.drill.sequence[0].actions).toHaveLength(0);
  });

  it('elimina le azioni senza destinazione', () => {
    const r = repairDrill(
      drillWith(
        [player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)],
        [
          {
            id: 's1',
            description: 'azione vuota',
            duration: 3000,
            actions: [{ id: 'a1', type: 'run', subject: 'p1', duration: 500 }],
          },
        ],
      ),
    );
    expect(r!.drill.sequence[0].actions).toHaveLength(0);
  });

  it('non lascia passare un giocatore a se stesso: aggancia il vicino', () => {
    const r = repairDrill(
      drillWith(
        [player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)],
        [
          {
            id: 's1',
            description: 'passaggio a se stesso',
            duration: 3000,
            actions: [{ id: 'a1', type: 'pass', subject: 'ball', target: 'p1', duration: 700 }],
          },
        ],
      ),
    );
    const azione = r!.drill.sequence[0].actions[0];
    expect(azione.to).toEqual({ x: 60, y: 60 });
  });

  it('converte in dribble la corsa del possessore', () => {
    const r = repairDrill(
      drillWith(
        [player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)],
        [
          {
            id: 's1',
            description: 'il possessore scappa',
            duration: 3000,
            actions: [{ id: 'a1', type: 'run', subject: 'p1', to: { x: 40, y: 40 }, duration: 900 }],
          },
        ],
      ),
    );
    expect(r!.drill.sequence[0].actions[0].type).toBe('dribble');
  });

  it('risolve `target` in un punto sul campo', () => {
    const r = repairDrill(
      drillWith(
        [player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)],
        [
          {
            id: 's1',
            description: 'passa al二号',
            duration: 3000,
            actions: [{ id: 'a1', type: 'pass', subject: 'ball', target: 'p2', duration: 700 }],
          },
        ],
      ),
    );
    expect(r!.drill.sequence[0].actions[0].to).toEqual({ x: 60, y: 60 });
  });

  it('clampa durate assurde', () => {
    const r = repairDrill(
      drillWith(
        [player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)],
        [
          {
            id: 's1',
            description: 'passaggio lentissimo',
            duration: 999999,
            actions: [{ id: 'a1', type: 'pass', subject: 'ball', target: 'p2', duration: 999999 }],
          },
        ],
      ),
    );
    expect(r!.drill.sequence[0].actions[0].duration).toBeLessThanOrEqual(8000);
    expect(r!.drill.sequence[0].duration).toBeLessThanOrEqual(30000);
  });

  it('taglia la sequenza a MAX_STEPS', () => {
    const sequence = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`,
      description: `step ${i}`,
      duration: 1000,
      actions: [{ id: `a${i}`, type: 'pass' as const, subject: 'ball', target: 'p2', duration: 700 }],
    }));
    const r = repairDrill(drillWith([player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)], sequence));
    expect(r!.drill.sequence.length).toBeLessThanOrEqual(6);
  });

  it('non muta il drill di ingresso', () => {
    const ingresso = drillWith([player('p1', 140, 140, true), player('p2', 60, 60)]);
    const copia = JSON.stringify(ingresso);
    repairDrill(ingresso);
    expect(JSON.stringify(ingresso)).toBe(copia);
  });
});

describe('repairVariants', () => {
  it('scarta le varianti irrecuperabili e le annota', () => {
    const { drills, fixes } = repairVariants([
      drillWith([player('p1', 30, 30, true), player('p2', 60, 60)]),
      drillWith([ball('ball', 50, 50)]),
    ]);
    expect(drills).toHaveLength(1);
    expect(fixes.join(' ')).toMatch(/scartata/i);
  });

  it('restituisce fixes vuota su un esercizio gia' , () => {
    const { fixes } = repairVariants([
      drillWith([player('p1', 30, 30, true), player('p2', 60, 60), ball('ball', 30, 30)]),
    ]);
    expect(fixes).toHaveLength(0);
  });
});