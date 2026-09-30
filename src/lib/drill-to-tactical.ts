/**
 * Traduce il contratto Drill (quello che produce il modello: millisecondi,
 * `subject`/`target`, kind come `goal`) nel formato TacticalExercise che il
 * player Konva sa disegnare (secondi, `entityId`, type come `player`).
 *
 * Perche' due formati invece di uno solo:
 *
 *  - il player e' gia' scritto, testato e salvato in Firestore con
 *    TacticalExercise. Cambiarne il formato cambierebbe anche tutti gli
 *    esercizi gia' salvati dagli allenatori;
 *  - il formato del modello e' migliore per farlo ragionare (millisecondi,
 *    "passo a cb1"), e il formato del player e' migliore per animare. Sono
 *    due problemi diversi e vanno risolti in due posti diversi.
 *
 * Quindi la traduzione sta qui, tutta in un file, e il resto dell'app non sa
 * che il Drill esiste.
 *
 * Il punto delicato e' il `from`: Konva vuole il punto di partenza esplicito
 * perche' animi' interpolando da li'. Nel Drill il `from` non esiste (l'azione
 * ha solo la destinazione), quindi qui si ricostruisce simulando la scena
 * step dopo step. E' la stessa simulazione che fa il repair, ma qui serve per
 * il rendering, non per la validazione.
 */

import type {
  TacticalAction,
  TacticalEntity,
  TacticalExercise,
  TacticalPoint,
  TacticalStep,
} from './tactical-exercise';
import { clampDrillCoord, isBallAction, type Drill, type DrillObject, type DrillPoint } from './drill';

const MS_PER_SECOND = 1000;

/**
 * Squadre del Drill -> squadre del player.
 *
 * Il player conosce blue/red/yellow/gk. Il modello puo' anche dire "neutral"
 * (un giocatore senza squadra, tipico degli esercizi a colore) o "black", che
 * semplicemente non esistono li': neutral e black finiscono su grey, che e'
 * l'unico modo per non fingere che siano tifoserie avversarie.
 */
function mapTeam(drill: DrillObject): TacticalEntity['team'] {
  if (drill.kind !== 'player') return undefined;
  const etichetta = (drill.label ?? '').toUpperCase();
  // Il portiere e' una POSIZIONE, non una squadra: si riconosce dalla label
  // ("GK", "PORT"). Senza questo, un modello che etichetta il portiere solo
  // come numero lo mostrerebbe come un normale giocatore di squadra.
  if (/GK|^P$|PORT/.test(etichetta)) return 'gk';
  if (drill.color && /grey|gray|grigio/i.test(drill.color)) return 'neutral';
  switch (drill.team) {
    case 'blue':
      return 'blue';
    case 'red':
      return 'red';
    case 'yellow':
      return 'yellow';
    case 'black':
      return 'neutral';
    case 'neutral':
      return 'neutral';
    default:
      return 'blue';
  }
}

/** kind del Drill -> type del player. `goal` non ha un tipo: e' decorazione. */
function mapKind(kind: DrillObject['kind']): TacticalEntity['type'] {
  switch (kind) {
    case 'player':
      return 'player';
    case 'ball':
      return 'ball';
    case 'cone':
      return 'cone';
    case 'zone':
      return 'zone';
    default:
      // 'goal': le porte vengono disegnate come marcatori statici dal player,
      // non come entita' animabili. Qui non finiscono nella scena perche'
    // il player non le sa muovere e le conterebbe fra i giocatori.
      return 'zone';
  }
}

/** Azioni che il player sa animare. */
function mapActionType(t: string): TacticalAction['type'] | null {
  switch (t) {
    case 'pass':
    case 'shoot':
    case 'dribble':
      return t;
    case 'run':
    case 'move':
      // Nel player `run` e `move` sono la stessa cosa: una corsa. Il Drill
      // distingue "corri" da "spostati pedonale", distinzione che per il
      // renderer non cambia niente.
      return 'run';
    case 'wait':
      // "stai fermo" e' l'assenza di azione: il player lascia l'entita' al
      // suo posto quando non trova un'azione che la riguarda.
      return null;
    default:
      return null;
  }
}

/**
 * Punto di partenza di un'azione.
 *
 * Si prende la posizione corrente del soggetto nella scena simulata. E' il
 * punto in cui la palla si trova all'inizio dello step, che e' l'unica
 * interpretazione calcisticamente corretta: se il passaggio parte dal piede
 * del ricevente di un passaggio precedente si vedrebbe la palla tornare
 * indietro.
 */
function startingPoint(
  subject: string,
  scene: Map<string, DrillPoint>,
  fallback: DrillPoint,
): TacticalPoint {
  const p = scene.get(subject);
  return p ? { x: p.x, y: p.y } : { x: fallback.x, y: fallback.y };
}

/** Normalizza un punto a due decimali: i pixel non hanno bisogno di piu'. */
function round2(p: DrillPoint) {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
}

/**
 * Traduce un Drill riparato nel formato del player Konva.
 *
 * Il Drill deve gia' essere passato per `repairDrill`: qui non si corregge
 * niente, si traduce. Se manca qualcosa, la posizione di partenza e' quella
 * iniziale dell'oggetto, cosi' l'animazione parte comunque da qualche parte.
 */
export function drillToTactical(drill: Drill): TacticalExercise {
  const entities: TacticalEntity[] = drill.objects
    .filter((o) => o.kind !== 'goal')
    .map((o) => {
      const e: TacticalEntity = {
        id: o.id,
        type: mapKind(o.kind),
        x: clampDrillCoord(o.x),
        y: clampDrillCoord(o.y),
      };
      const team = mapTeam(o);
      if (team) e.team = team;
      // Numero di maglia se c'e', altrimenti la label. Sul pallino c'e' una
      // riga sola: metterci entrambi la renderebbe illeggibile.
      const label = o.number ?? o.label;
      if (label) e.label = label;
      if (o.width !== undefined) e.width = o.width;
      if (o.height !== undefined) e.height = o.height;
      return e;
    });

  const byId = new Map(drill.objects.map((o) => [o.id, o]));
  // Scena simulata: da dove si parte e dove si arriva, azione dopo azione.
  const scene = new Map<string, DrillPoint>(
    drill.objects.map((o) => [o.id, { x: o.x, y: o.y }]),
  );

  const steps: TacticalStep[] = drill.sequence.map((step, i) => {
    const actions: TacticalAction[] = [];

    for (const action of step.actions) {
      const type = mapActionType(action.type);
      const to = typeof action.to === 'string' ? undefined : action.to;
      // Nel Drill riparato `to` e' SEMPRE un punto: resolveTo ha gia' risolto
      // gli id. Il ternario serve solo per non far crashare un drill passato a
      // mano al repair, dove `to` potrebbe essere ancora una stringa.
      const destinazione = to ?? scene.get(action.subject);
      if (!type || !destinazione) continue;

      const fallback = byId.get(action.subject) ?? { x: 50, y: 50 };
      const from = startingPoint(action.subject, scene, fallback);

      actions.push({
        entityId: action.subject,
        type,
        from: round2(from),
        to: round2({ x: clampDrillCoord(destinazione.x), y: clampDrillCoord(destinazione.y) }),
        // ms -> s: e' l'unica differenza di unita' fra i due formati.
        duration: Math.max(0.1, Math.round((action.duration / MS_PER_SECOND) * 100) / 100),
        startAt: action.startAt
          ? Math.round((action.startAt / MS_PER_SECOND) * 100) / 100
          : undefined,
        easing: action.easing,
      });

      // Avanza la simulazione con il punto d'arrivo.
      const arrivo = { x: clampDrillCoord(destinazione.x), y: clampDrillCoord(destinazione.y) };
      scene.set(action.subject, arrivo);
      // Se e' la palla, il possessore la segue: altrimenti a meta' esercizio
      // la palla viaggia sola e nessun giocatore risulta palla-piedi.
      if (isBallAction(action)) {
        const ricevente = drill.objects.find(
          (o) => o.kind === 'player' && Math.hypot(o.x - arrivo.x, o.y - arrivo.y) < 1.5,
        );
        if (ricevente) scene.set(ricevente.id, arrivo);
      }
    }

    return {
      stepNumber: i + 1,
      description: step.description,
      actions,
    };
  });

  const giocatori = drill.objects.filter((o) => o.kind === 'player').length;

  return {
    title: drill.name,
    description: drill.description,
    playersShown: giocatori,
    initialEntities: entities,
    steps,
  };
}

/**
 * Traduce l'esercizio attivo per il player, dato l'elenco delle varianti.
 * Se l'elenco e' vuoto restituisce null invece di far crashare il player.
 */
export function pickVariantForPlayer(drills: Drill[], index: number): TacticalExercise | null {
  const d = drills[index] ?? drills[0];
  return d ? drillToTactical(d) : null;
}