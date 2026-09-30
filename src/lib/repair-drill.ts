/**
 * Correzioni deterministiche su un Drill generato dal modello.
 *
 * Il prompt riduce gli errori, non li elimina. Il modello produce regolarmente
 * due palloni, un passaggio da un giocatore a se stesso, coordinate fuori
 * campo, azioni che puntano a id inesistenti. Senza questo passaggio la
 * lavagna mostra cose incoerenti e l'allenatore non ha modo di accorgersene:
 * e' il caso peggiore, peggio di un errore esplicito.
 *
 * Ogni correzione viene annotata in `fixes`, con un testo leggibile: serve
 * sia al pannello di debug sia a capire, quando qualcosa esce storto, se e'
 * stato il modello o il renderer.
 *
 * L'ordine conta. Prima si sistema la scena (oggetti, pallone, possessore),
 * poi si ripuliscono le azioni: cosi' quando si controlla se un passaggio ha
 * senso, la scena su cui si ragiona e' gia' quella definitiva.
 */

import {
  MAX_COORD,
  MAX_STEPS,
  MIN_COORD,
  clampDrillCoord,
  dist,
  isBallAction,
  type Drill,
  type DrillAction,
  type DrillObject,
  type DrillPoint,
  type DrillStep,
} from './drill';

/** Offset minimo fra un giocatore e un cono, in unita' di coordinata. */
const CONE_OFFSET = 5;

/** Sotto questa distanza due giocatori sono considerati sovrapposti. */
const OVERLAP_DIST = 3;

export interface RepairResult {
  drill: Drill;
  fixes: string[];
}

/** Copia profonda di un Drill, cosi' il repair non muta l'input. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * `to` puo' essere un punto o un id. Il player Konva vuole sempre un punto:
 * qui si risolve l'id contro la scena, e se non esiste la destinazione
 * diventa il punto di partenza (azione trasformata in "resta fermo"), che e'
 * il degrade giusto: peggio che animare una palla che sparisce.
 */
function resolveTo(
  action: DrillAction,
  objects: DrillObject[],
  fixes: string[],
  stepId: string,
): DrillPoint | null {
  // `to` ha precedenza su `target`: se il modello li ha entrambi, `to` e' il
  // valore esplicito e vince.
  const raw: DrillPoint | string | undefined =
    typeof action.to === 'object' && action.to !== null ? action.to : action.target;

  if (raw && typeof raw === 'object') {
    return { x: clampDrillCoord(raw.x), y: clampDrillCoord(raw.y) };
  }

  if (typeof raw === 'string') {
    const found = objects.find((o) => o.id === raw);
    if (found) return { x: found.x, y: found.y };
    fixes.push(
      `Step ${stepId}: azione "${action.type}" puntava a "${raw}", che non esiste fra gli oggetti.`,
    );
    return null;
  }

  // Nessuna destinazione: il modello ha dimenticato il campo `to`/`target`.
  fixes.push(`Step ${stepId}: azione "${action.type}" senza destinazione, eliminata.`);
  return null;
}

/** Il modello sbaglia i limiti di campo piu' spesso di quanto sembri. */
function clampPoint(p: DrillPoint, label: string, fixes: string[]): DrillPoint {
  const cx = clampDrillCoord(p.x);
  const cy = clampDrillCoord(p.y);
  if (cx !== p.x || cy !== p.y) {
    fixes.push(`${label}: coordinate fuori campo (${p.x}, ${p.y}) riportate dentro.`);
  }
  return { x: cx, y: cy };
}

/**
 * Garantisce che la scena sia guardabile: una palla, un possessore iniziale,
 * giocatori non dentro i coni e non sovrapposti.
 *
 * Non tenta di correggere un esercizio senza palla "aggiungendola a caso":
 * la mette addosso al possessore, che e' l'unica posizione che ha senso e
 * rende l'esercizio comunque animabile.
 */
function repairObjects(drill: Drill, fixes: string[]): DrillObject[] {
  let objects = (drill.objects ?? []).map((o) => {
    const p = clampPoint(o, `Oggetto ${o.id}`, fixes);
    return { ...o, ...p };
  });

  // --- una sola palla, e con l'id canonico "ball" ---
  //
  // L'id va normalizzato DOPO aver scelto quale palla tenere: il caso
  // "trovate due palle" non arrivava mai alla rinomina, e la scena restava
  // con una palla che si chiudeva "palla1" mentre le azioni cercavano "ball".
  // Il repair avrebbe potuto creare una seconda palla senza accorgersene.
  const balls = objects.filter((o) => o.kind === 'ball');
  if (balls.length > 1) {
    fixes.push(`Trovate ${balls.length} palle, tenuta solo la prima.`);
    const keep = balls[0];
    objects = objects.filter((o) => o.kind !== 'ball' || o.id === keep.id);
  }
  const ballCorrente = objects.find((o) => o.kind === 'ball');
  if (ballCorrente && ballCorrente.id !== 'ball') {
    fixes.push(`La palla aveva id "${ballCorrente.id}", rinominata in "ball".`);
    objects = objects.map((o) =>
      o.kind === 'ball' && o.id === ballCorrente.id ? { ...o, id: 'ball' } : o,
    );
  }

  // --- un solo possessore iniziale ---
  const holders = objects.filter((o) => o.kind === 'player' && o.hasBall);
  if (holders.length > 1) {
    fixes.push(
      `${holders.length} giocatori risultavano possessori iniziali, tenuto solo "${holders[0].id}".`,
    );
    objects = objects.map((o) =>
      o.kind === 'player' && o.hasBall && o.id !== holders[0].id ? { ...o, hasBall: false } : o,
    );
  }

  let ball = objects.find((o) => o.kind === 'ball');
  const holder = objects.find((o) => o.kind === 'player' && o.hasBall);

  if (!ball) {
    const pos = holder ? { x: holder.x, y: holder.y } : { x: 50, y: 50 };
    ball = {
      id: 'ball',
      kind: 'ball',
      x: pos.x,
      y: pos.y,
      ...(holder ? {} : {}),
    };
    fixes.push(
      holder
        ? `Nessuna palla nella scena, creata sul possessore iniziale "${holder.id}".`
        : 'Nessuna palla nella scena, creata a centro campo.',
    );
    objects.push(ball);
  } else if (holder && dist(ball, holder) > OVERLAP_DIST) {
    // Regola 4 del prompt: la palla parte dal possessore. Se il modello le
    // ha dato un'altra posizione, la palla vince il legame col possessore,
    // perche' e' quello che l'allenatore guarda per primo.
    fixes.push(
      `La palla era lontana dal possessore iniziale "${holder.id}": spostata su di lui.`,
    );
    objects = objects.map((o) => (o.id === 'ball' ? { ...o, x: holder.x, y: holder.y } : o));
  }

  // --- i giocatori stanno ACCANTO ai coni, non sopra ---
  const cones = objects.filter((o) => o.kind === 'cone');
  objects = objects.map((o) => {
    if (o.kind !== 'player') return o;
    for (const cone of cones) {
      if (dist(o, cone) >= CONE_OFFSET) continue;
      // Sposta lungo l'asse X, nel verso che porta piu' lontano dal cono:
      // se il giocatore e' esattamente sopra il cono non c'e' un verso
      // preferibile, e va bene uno qualsiasi dei due.
      const dx = o.x - cone.x;
      const verso = Math.abs(dx) < 0.5 ? 1 : Math.sign(dx);
      // Spread di `o`: restituire solo il punto qui perdeva id e kind, e il
      // giocatore spostato sparisce dalla scena con tutti i suoi riferimenti.
      return {
        ...o,
        ...clampPoint({ x: cone.x + verso * CONE_OFFSET, y: o.y }, `Giocatore ${o.id}`, fixes),
      };
    }
    return o;
  });

  // --- niente giocatori sovrapposti ---
  const players = objects.filter((o) => o.kind === 'player');
  const seen: DrillObject[] = [];
  objects = objects.map((o) => {
    if (o.kind !== 'player') return o;
    const clash = seen.find((s) => dist(s, o) < OVERLAP_DIST);
    if (!clash) {
      seen.push(o);
      return o;
    }
    // Piccolo scarto diagonale: sovrapporre due pedine e' il difetto piu'
    // visibile in assoluto, e spostarle di 4 unita' basta a leggerle.
    fixes.push(`Giocatori "${clash.id}" e "${o.id}" erano sovrapposti: "${o.id}" spostato.`);
    const spostato = clampPoint(
      { x: o.x + 4, y: o.y + 4 },
      `Giocatore ${o.id}`,
      fixes,
    );
    seen.push({ ...o, ...spostato });
    return { ...o, ...spostato };
  });

  return objects;
}

/**
 * Ripulisce la sequenza e ne simula il risultato.
 *
 * La simulazione serve per una cosa precisa: agganciare una destinazione
 * ambigua al giocatore piu' vicino e capire chi ha davvero la palla a metto
 * esercizio. Senza, una passaggio "a un giocatore qualsiasi" finisce
 * scherzando in un angolo vuoto.
 */
function repairSequence(
  drill: Drill,
  objects: DrillObject[],
  fixes: string[],
): DrillStep[] {
  const byId = new Map(objects.map((o) => [o.id, o]));

  // Scena iniziale: da qui si simula step dopo step.
  const scena = new Map<string, DrillPoint>();
  for (const o of objects) scena.set(o.id, { x: o.x, y: o.y });

  let stepNumber = 0;
  const steps: DrillStep[] = [];

  for (const raw of drill.sequence ?? []) {
    stepNumber += 1;
    const id = raw.id || `step-${stepNumber}`;
    const azioni: DrillAction[] = [];

    for (const rawAction of raw.actions ?? []) {
      const actionId = rawAction.id || `${id}-a${azioni.length + 1}`;
      const subject = rawAction.subject;

      // --- id inesistenti ---
      if (!subject || !byId.has(subject)) {
        fixes.push(`Step ${stepNumber}: azione senza soggetto valido ("${subject}"), eliminata.`);
        continue;
      }

      const type = rawAction.type;

      // --- pass/shoot: il soggetto e' la palla, punto ---
      let act: DrillAction = {
        id: actionId,
        type,
        subject,
        duration: rawAction.duration,
        startAt: rawAction.startAt,
        easing: rawAction.easing,
      };

      if (isBallAction(rawAction) && subject !== 'ball') {
        fixes.push(
          `Step ${stepNumber}: "${subject}" risultava soggetto di un ${type}. Passaggio e tiro agiscono sempre con la palla, correto.`,
        );
        act.subject = 'ball';
      }

      // Il possessore che si muove dribbla: senza questo la palla resta a
      // terra mentre il suo possessore scappa, che e' il difetto piu' grottesco
      // in assoluto su una lavagna animata.
      if (act.subject !== 'ball' && (type === 'run' || type === 'move')) {
        const possessore = Array.from(scena.entries()).find(
          ([oid]) => byId.get(oid)?.hasBall,
        )?.[0];
        if (possessore === act.subject) {
          act.type = 'dribble';
        }
      }

      // --- durata e ritardo ---
      const durata = Number(act.duration);
      if (!Number.isFinite(durata) || durata <= 0) {
        fixes.push(
          `Step ${stepNumber}: azione "${actionId}" con durata non valida, messa a 800ms.`,
        );
        act.duration = 800;
      } else if (durata > 8000) {
        fixes.push(`Step ${stepNumber}: durata di ${durata}ms ridotta a 8000ms.`);
        act.duration = 8000;
      }
      const startAt = Number(act.startAt ?? 0);
      if (!Number.isFinite(startAt) || startAt < 0) {
        act.startAt = 0;
      } else if (startAt > 5000) {
        act.startAt = 5000;
      }

      // --- destinazione ---
      const to = resolveTo(rawAction, objects, fixes, String(stepNumber));

      if (!to) {
        continue; // gia' annotata in resolveTo
      }

      // Un giocatore non passa a se stesso: e' sempre un errore del modello,
      // e senza questa correzione la palla parte e resta ferma sullo stesso
      // piede, illeggibile.
      if (isBallAction(act) && to.x === scena.get(act.subject)?.x && to.y === scena.get(act.subject)?.y) {
        const partenza = scena.get(act.subject) as DrillPoint;
        // Si esclude chi e' GIA' a quel punto, non solo chi ha lo stesso id:
        // il possessore della palla e' per definizione sulla posizione di
        // partenza, quindi restituendolo l'azione resterebbe identica e
        // l'allenatore vedrebbe una palla che passa a se stessa.
        const alternativa = objects
          .filter((o) => o.kind === 'player' && dist(o, partenza) > OVERLAP_DIST)
          .sort((a, b) => dist(a, partenza) - dist(b, partenza))[0];
        if (alternativa) {
          fixes.push(
            `Step ${stepNumber}: la palla passava a se stessa. Agganciata al giocatore piu' vicino, "${alternativa.id}".`,
          );
          act.to = { x: alternativa.x, y: alternativa.y };
        } else {
          fixes.push(`Step ${stepNumber}: la palla passava a se stessa e non c'e' nessun altro giocatore. Azione eliminata.`);
          continue;
        }
      } else {
        act.to = to;
      }

      azioni.push(act);
    }

    const durataStep = Number(raw.duration);
    steps.push({
      id,
      description: raw.description || '',
      duration:
        Number.isFinite(durataStep) && durataStep > 0
          ? Math.min(durataStep, 30000)
          : azioni.reduce((max, a) => Math.max(max, (a.startAt ?? 0) + a.duration), 0),
      actions: azioni,
    });

    // --- simula lo step ---
    for (const action of azioni) {
      const to = action.to;
      if (!to || typeof to === 'string') continue;
      const from = scena.get(action.subject) ?? { x: to.x, y: to.y };

      if (action.subject === 'ball') {
        // Il passaggio/tiro sposta la palla e TRASFERISCE il possesso al
        // ricevente: senza il trasferimento il resto dell'esercizio si
        // anima con il possessore sbagliato.
        const ricevente = objects.find(
          (o) => o.kind === 'player' && o.x === to.x && o.y === to.y,
        );
        for (const obj of objects) {
          if (obj.kind === 'player') {
            scena.set(obj.id, { x: obj.hasBall ? from.x : obj.x, y: obj.hasBall ? from.y : obj.y });
          }
        }
        scena.set('ball', to);
        if (ricevente) {
          objects = objects.map((o) =>
            o.kind === 'player' ? { ...o, hasBall: o.id === ricevente.id } : o,
          );
          scena.set(ricevente.id, to);
        }
      } else {
        scena.set(action.subject, to);
        if (objects.find((o) => o.id === action.subject)?.hasBall) {
          scena.set('ball', to);
        }
      }
    }
  }

  if (steps.length > MAX_STEPS) {
    fixes.push(`${steps.length} step generati, tenuti i primi ${MAX_STEPS}.`);
    return steps.slice(0, MAX_STEPS);
  }

  return steps;
}

/**
 * Ripara un singolo Drill e restituisce il risultato con l'elenco delle
 * correzioni applicate.
 *
 * Non lancia mai: un modello che sbaglia produce un esercizo meno bello, non
 * una pagina bianca. Solo se l'esercizio e' irrecuperabile (niente oggetti,
 * niente step) restituisce `null`, e di li' il chiamante può scegliere se
 * mostrare un errore o l'esempio demo.
 */
export function repairDrill(input: Drill | null | undefined): RepairResult | null {
  if (!input || typeof input !== 'object') return null;
  const drill = clone(input);
  const fixes: string[] = [];

  const objects = repairObjects(drill, fixes);
  if (objects.filter((o) => o.kind === 'player').length === 0) {
    return null;
  }

  const sequence = repairSequence(drill, objects, fixes);
  if (sequence.length === 0) return null;

  // La scena finale (dopo la simulazione) e' quella che il player deve
  // mostrare ferma: se i giocatori si sono spostati durante l'esercizio, le
  // posizioni iniziali vanno comunque su quelle da cui partono le azioni.
  return {
    drill: {
      id: drill.id || 'drill',
      name: drill.name || 'Esercizio',
      description: drill.description || '',
      category: drill.category || '',
      ageGroup: drill.ageGroup || '',
      pitch: drill.pitch ?? { shape: 'rectangle', width: 60, height: 40 },
      objects,
      sequence,
      cycles: Number.isFinite(drill.cycles) && drill.cycles > 0 ? Math.min(drill.cycles, 20) : 1,
    },
    fixes,
  };
}

/** Ripara tutte le varianti, scartando quelle irrecuperabili. */
export function repairVariants(
  variants: Drill[] | null | undefined,
): { drills: Drill[]; fixes: string[] } {
  const drills: Drill[] = [];
  const fixes: string[] = [];
  (variants ?? []).forEach((v, i) => {
    const r = repairDrill(v);
    if (!r) {
      fixes.push(`Variante ${i + 1}: scartata, non riparabile.`);
      return;
    }
    if (r.fixes.length) {
      r.fixes.forEach((f) => fixes.push(`Variante ${i + 1} — ${f}`));
    }
    drills.push(r.drill);
  });
  return { drills, fixes };
}

export { MIN_COORD, MAX_COORD };