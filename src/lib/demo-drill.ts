/**
 * Esercizi di esempio, mostrati quando l'AI non e' raggiungibile.
 *
 * Non sono un placeholder decorativo: sono esercizi veri, scritti a mano e
 * rispettano tutte le regole che il prompt chiede al modello (una palla,
 * passaggi con la palla come soggetto, coordinate dentro il campo). Servono
 * a tre cose:
 *
 *  - senza chiave API l'app mostra comunque una lavagna funzionante invece di
 *    una pagina vuota;
 *  - i pulsanti "Esempi" nella UI partono da qui, e partono da qualcosa che
 *    l'allenatore ha davanti, non da una stringa da cui ricordarsi la
 *    sintassi;
 *  - i test hanno un riferimento stabile, che non dipende dal modello.
 *
 * Ogni esercizio e' gia' nel formato Drill gia' riparato: questo file non
 * passa dal repair perche' non ne ha bisogno, e un esempio che non lo
 * richiede e' anche il test che il repair non serve percio' non e' rotto.
 */

import type { Drill } from './drill';

/** 3v2 dal basso: portiere, due centrali, centrocampista, due pressori. */
export const DEMO_COSTRUZIONE_3V2: Drill = {
  id: 'demo-costruzione-3v2',
  name: 'Costruzione dal basso 3v2 con ampiezza',
  description:
    'Il portiere apre la costruzione. I due centrali si allargano per dare ampiezza, il centrocampista si offre come appoggio fra le linee. I due pressori chiudono lo spazio centrale, quindi il possessore deve usare il cambio di gioco laterale per uscire.',
  category: 'Costruzione',
  ageGroup: 'U12',
  pitch: { shape: 'half-pitch', width: 60, height: 44 },
  cycles: 2,
  objects: [
    { id: 'gk', kind: 'player', team: 'blue', label: 'GK', x: 8, y: 50, hasBall: true },
    { id: 'dc1', kind: 'player', team: 'blue', label: '5', x: 24, y: 24 },
    { id: 'dc2', kind: 'player', team: 'blue', label: '6', x: 24, y: 76 },
    { id: 'cc', kind: 'player', team: 'blue', label: '8', x: 42, y: 50 },
    { id: 'pv1', kind: 'player', team: 'red', label: '9', x: 55, y: 36 },
    { id: 'pv2', kind: 'player', team: 'red', label: '10', x: 55, y: 64 },
    { id: 'ball', kind: 'ball', x: 8, y: 50 },
    { id: 'c1', kind: 'cone', x: 34, y: 12 },
    { id: 'c2', kind: 'cone', x: 34, y: 88 },
    { id: 'z1', kind: 'zone', x: 62, y: 50, width: 24, height: 34 },
  ],
  sequence: [
    {
      id: 's1',
      description:
        'Il portiere passa al centrocampo, che riceve di spalle e si gira. I due centrali allargano: e\' la loro apertura a dare al passaggio due uscite, non la palla in mezzo.',
      duration: 4000,
      actions: [
        { id: 's1-a1', type: 'pass', subject: 'ball', target: 'cc', duration: 1100, easing: 'easeOut' },
        { id: 's1-a2', type: 'move', subject: 'pv1', to: { x: 45, y: 40 }, duration: 1600, startAt: 400 },
        { id: 's1-a3', type: 'move', subject: 'pv2', to: { x: 45, y: 60 }, duration: 1600, startAt: 700 },
      ],
    },
    {
      id: 's2',
      description:
        "Scarico al centrale di sinistra, che e' libero perche' il pressore ha seguito la palla e non l'uomo.",
      duration: 3500,
      actions: [
        { id: 's2-a1', type: 'pass', subject: 'ball', target: 'dc1', duration: 900, easing: 'easeOut', startAt: 300 },
        { id: 's2-a2', type: 'run', subject: 'pv1', to: { x: 30, y: 30 }, duration: 1800 },
      ],
    },
    {
      id: 's3',
      description:
        'Passaggio di profondita\' verso la zona evidenziata: la linea si apre quando la palla esce dal corto, non prima.',
      duration: 3500,
      actions: [
        { id: 's3-a1', type: 'pass', subject: 'ball', to: { x: 74, y: 50 }, duration: 1200, easing: 'easeOut', startAt: 300 },
        { id: 's3-a2', type: 'dribble', subject: 'cc', to: { x: 62, y: 50 }, duration: 2200, startAt: 200 },
      ],
    },
  ],
};

/** 2v2 con mini porte: ricezione spalle, scarico, profondita', finalizzazione. */
export const DEMO_2V2_PORTICINE: Drill = {
  id: 'demo-2v2-porticine',
  name: '2v2 con ricezione spalle e mini porte',
  description:
    'Due attaccanti ricevono spalle alla porta, scaricano per non chiudersi e attaccano la profondita\'. I due difendenti restano passivi: guardano la palla, non la palla e l\'uomo insieme.',
  category: 'Finalizzazione',
  ageGroup: 'U12',
  pitch: { shape: 'rectangle', width: 40, height: 30 },
  cycles: 3,
  objects: [
    { id: 'gk', kind: 'player', team: 'blue', label: 'GK', x: 8, y: 50, hasBall: true },
    { id: 'a1', kind: 'player', team: 'blue', label: '9', x: 42, y: 28 },
    { id: 'a2', kind: 'player', team: 'blue', label: '11', x: 42, y: 72 },
    { id: 'b1', kind: 'player', team: 'red', label: '2', x: 62, y: 38 },
    { id: 'b2', kind: 'player', team: 'red', label: '3', x: 62, y: 62 },
    { id: 'ball', kind: 'ball', x: 8, y: 50 },
    { id: 'g1', kind: 'goal', x: 93, y: 28 },
    { id: 'g2', kind: 'goal', x: 93, y: 72 },
  ],
  sequence: [
    {
      id: 's1',
      description: 'Il portiere apre alla destra, l\'attaccante riceve di spalle.',
      duration: 3000,
      actions: [
        { id: 's1-a1', type: 'pass', subject: 'ball', target: 'a1', duration: 1000, easing: 'easeOut' },
        { id: 's1-a2', type: 'move', subject: 'b1', to: { x: 55, y: 32 }, duration: 1400, startAt: 400 },
      ],
    },
    {
      id: 's2',
      description:
        'Scarico all\'attaccante opposto: spalle alla porta senza palla vogliono dire spalle al compagno, non spalle al pallone.',
      duration: 3000,
      actions: [
        { id: 's2-a1', type: 'pass', subject: 'ball', target: 'a2', duration: 900, easing: 'easeOut', startAt: 300 },
      ],
    },
    {
      id: 's3',
      description: 'Attacco della profondita\' e finalizzazione nella mini porta.',
      duration: 3000,
      actions: [
        { id: 's3-a1', type: 'dribble', subject: 'a2', to: { x: 68, y: 66 }, duration: 1400 },
        { id: 's3-a2', type: 'shoot', subject: 'ball', to: { x: 93, y: 72 }, duration: 700, easing: 'easeOut', startAt: 1500 },
        { id: 's3-a3', type: 'run', subject: 'b2', to: { x: 78, y: 70 }, duration: 2200 },
      ],
    },
  ],
};

/** Rondo 4v2: quattro possessori esterni, due difendenti interni. */
export const DEMO_RONDO_4V2: Drill = {
  id: 'demo-rondo-4v2',
  name: 'Rondo 4v2 nel quadrato, passa e muoviti',
  description:
    'Quattro giocatori ai vertici di un quadrato, due difendenti dentro. Dopo ogni ricezione si esce dal quadrato: muoversi e\' la parte che rende il rondo difficile, il passaggio e\' solo il mezzo.',
  category: 'Possesso',
  ageGroup: 'U10',
  pitch: { shape: 'rectangle', width: 24, height: 24 },
  cycles: 4,
  objects: [
    { id: 'q1', kind: 'player', team: 'blue', label: '1', x: 32, y: 32, hasBall: true },
    { id: 'q2', kind: 'player', team: 'blue', label: '2', x: 68, y: 32 },
    { id: 'q3', kind: 'player', team: 'blue', label: '3', x: 68, y: 68 },
    { id: 'q4', kind: 'player', team: 'blue', label: '4', x: 32, y: 68 },
    { id: 'd1', kind: 'player', team: 'red', label: '5', x: 45, y: 45 },
    { id: 'd2', kind: 'player', team: 'red', label: '6', x: 55, y: 55 },
    { id: 'ball', kind: 'ball', x: 32, y: 32 },
    { id: 'z1', kind: 'zone', x: 50, y: 50, width: 42, height: 42 },
  ],
  sequence: [
    {
      id: 's1',
      description: 'Primo passaggio e prima uscita: q1 passa a q2 ed esce dal quadrato.',
      duration: 3500,
      actions: [
        { id: 's1-a1', type: 'pass', subject: 'ball', target: 'q2', duration: 800, easing: 'easeOut' },
        { id: 's1-a2', type: 'move', subject: 'q1', to: { x: 22, y: 46 }, duration: 1500, startAt: 900 },
        { id: 's1-a3', type: 'move', subject: 'd1', to: { x: 52, y: 40 }, duration: 1200, startAt: 500 },
      ],
    },
    {
      id: 's2',
      description: 'q2 a q3. Il difendente segue la palla e lascia libero il lato: e\' il principio del rondo.',
      duration: 3500,
      actions: [
        { id: 's2-a1', type: 'pass', subject: 'ball', target: 'q3', duration: 800, easing: 'easeOut', startAt: 300 },
        { id: 's2-a2', type: 'move', subject: 'q2', to: { x: 78, y: 46 }, duration: 1500, startAt: 1200 },
      ],
    },
    {
      id: 's3',
      description: 'q3 a q4, il secondo difendente chiude: e\' il giocatore libero che deve accoglierlo.',
      duration: 3500,
      actions: [
        { id: 's3-a1', type: 'pass', subject: 'ball', target: 'q4', duration: 800, easing: 'easeOut', startAt: 300 },
        { id: 's3-a2', type: 'move', subject: 'd2', to: { x: 46, y: 58 }, duration: 1200, startAt: 500 },
        { id: 's3-a3', type: 'move', subject: 'q3', to: { x: 78, y: 54 }, duration: 1500, startAt: 1200 },
      ],
    },
  ],
};

/** Ricezione, sponda e tiro: progressione in tre step. */
export const DEMO_RICEZIONE_SPONDA: Drill = {
  id: 'demo-ricezione-sponda',
  name: 'Ricezione, sponda e tiro',
  description:
    'Server, attaccante e difensore passivo. La sponda del difensore costringe l\'attaccante a ricevere orientato: il punto di ricezione e\' la prima cosa che decide se il tiro esiste.',
  category: 'Finalizzazione',
  ageGroup: 'U13',
  pitch: { shape: 'rectangle', width: 30, height: 25 },
  cycles: 3,
  objects: [
    { id: 'srv', kind: 'player', team: 'blue', label: '8', x: 14, y: 50, hasBall: true },
    { id: 'att', kind: 'player', team: 'blue', label: '9', x: 48, y: 40 },
    { id: 'dif', kind: 'player', team: 'red', label: '4', x: 52, y: 60 },
    { id: 'gk', kind: 'player', team: 'blue', label: 'GK', x: 90, y: 50 },
    { id: 'ball', kind: 'ball', x: 14, y: 50 },
    { id: 'g1', kind: 'goal', x: 93, y: 50 },
  ],
  sequence: [
    {
      id: 's1',
      description: 'Il server mette il pallone fra le linee, dove l\'attaccante ha spalle alla porta.',
      duration: 3000,
      actions: [
        { id: 's1-a1', type: 'pass', subject: 'ball', target: 'att', duration: 1000, easing: 'easeOut' },
        { id: 's1-a2', type: 'move', subject: 'dif', to: { x: 44, y: 48 }, duration: 1600, startAt: 500 },
      ],
    },
    {
      id: 's2',
      description: 'L\'attaccante riceve orientato e si attira il difensore: l\'aggancio e\' quello che crea lo spazio per il tiro.',
      duration: 3000,
      actions: [
        { id: 's2-a1', type: 'dribble', subject: 'att', to: { x: 62, y: 38 }, duration: 1300, startAt: 400 },
        { id: 's2-a2', type: 'move', subject: 'dif', to: { x: 66, y: 44 }, duration: 1600, startAt: 700 },
      ],
    },
    {
      id: 's3',
      description: 'Tiro in porta. Il portiere e\' sul lato opposto rispetto al piede di tiro: e\' il segnale all\'allenatore che il tiro era disponibile.',
      duration: 3000,
      actions: [
        { id: 's3-a1', type: 'shoot', subject: 'ball', to: { x: 93, y: 34 }, duration: 800, easing: 'easeOut', startAt: 600 },
        { id: 's3-a2', type: 'run', subject: 'gk', to: { x: 90, y: 66 }, duration: 1800, startAt: 400 },
      ],
    },
  ],
};

/** I quattro esempi mostrati come pulsanti nella UI. */
export const ESEMPI_ESERCIZI: { label: string; prompt: string; drill: Drill }[] = [
  {
    label: 'Costruzione 3v2',
    prompt: 'Costruzione dal basso 3v2 per U12 con portiere, ampiezza, sostegno e due porticine',
    drill: DEMO_COSTRUZIONE_3V2,
  },
  {
    label: '2v2 mini porte',
    prompt: '2v2 con ricezione spalle alla porta e attacco della profondita\'',
    drill: DEMO_2V2_PORTICINE,
  },
  {
    label: 'Rondo 4v2',
    prompt: 'Rondo 4v2 in un quadrato, passa e muoviti dopo ogni ricezione',
    drill: DEMO_RONDO_4V2,
  },
  {
    label: 'Ricezione e tiro',
    prompt: 'Ricezione, sponda del difensore e tiro in porta, progressione in tre step',
    drill: DEMO_RICEZIONE_SPONDA,
  },
];

/** Esempio mostrato quando non c'e' chiave API o il servizio non risponde. */
export const DEMO_DRILL: Drill = DEMO_COSTRUZIONE_3V2;