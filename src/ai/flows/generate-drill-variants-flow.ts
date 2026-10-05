import 'server-only';
/**
 * Generazione dell'esercizio: NOME delle varianti come il brief chiede, cioe'
 * l'esercizio richiesto piu' due progressioni.
 *
 * Questo file non e' il posto dove si sceglie se usare il modello: quello e'
 * l'endpoint /api/generate, che e' l'unico contratto con il client. Qui c'e'
 * solo il lavoro che va fatto lato server: la catena di modelli, il timeout e
 * l'esempio demo.
 *
 * Le scelte sui modelli sono documentate sotto `CATENA_MODELLI` e vengono da
 * prove reali, non da supposizioni. Cambiarle senza evidenza costa una
 * richiesta persa.
 */

import { ai } from '@/ai/genkit';
import { DrillSchema } from '@/lib/drill-schema';
import type { Drill } from '@/lib/drill';
import { DEMO_DRILL } from '@/lib/demo-drill';

/**
 * Timeout per singolo modello.
 *
 * Il brief chiede 15-20 secondi, e il numero non e' un capriccio: e' il
 * tempo oltre il quale l'allenatore sulla panchina lascia il telefono e fa
 * l'esercizio a memoria. Oltre, la risposta arriva comunque e nessuno la
 * guarda. 18 secondi lascia margine a un 503 lento senza superarlo.
 *
 * Una volta scaduto, si passa al modello successivo invece di aspettare:
 * l'interfaccia non deve mai restare appesa.
 */
export const TIMEOUT_PER_MODELLO_MS = 18_000;

/**
 * Catena di modelli, dal piu' capace al piu' economico.
 *
 * I due modelli si possono invertire da .env.local senza toccare il codice:
 * `GEMINI_MODEL` e `GEMINI_FALLBACK_MODEL`. Qui ci sono i default per quando
 * le variabili non ci sono.
 *
 * Perche' 3.8 e non 3.7: gemini-3.7-flash risponde 200 ma IGNORA la richiesta,
 * producendo un esercizio generico che non c'entra con quello chiesto
 * (verificato: due prove su due hanno restituito "costruzione dal basso" e
 * "uscita con terzo uomo" quando si chiedeva un 2v2 con porticine). Un
 * modello che risponde e sbaglia e' PEGGIO di uno che fallisce, perche'
 * l'allenatore non ha modo di accorgersene.
 *
 * Il 3.6 risponde con meno giocatori e meno step, ma risponde: e' il fallback
 * giusto perche' un esercizio piu' povero si puo' completare a mano, uno
 * fuori topic no.
 */
const MODELLO_PRINCIPALE =
  process.env.GEMINI_MODEL || 'googleai/gemini-3.8-flash';
const MODELLO_FALLBACK =
  process.env.GEMINI_FALLBACK_MODEL || 'googleai/gemini-3.6-flash';

/**
 * Tentativi per modello, con attesa crescente.
 *
 * I 503 "high demand" di Gemini sono spike brevi: si verificano a ondate, non
 * non in modo continuo. Su questo progetto, un singolo tentativo sbagliato fa
 * fallire la generazione mentre il modello era perfettamente in grado di
 * rispondere un secondo dopo. La generazione esercitata su questo progetto ha
 * gia' misurato che due tentativi su tre falliscono e il terzo passa: da li'
 * questi valori.
 *
 * L'attesa totale dei tre tentativi (3s + 8s) sta dentro il budget di 18s per
 * modello: il timeout scatta solo se anche il terzo tentativo e' lento, non
 * mentre si aspetta la prossima finestra.
 */
const TENTATIVI_PER_MODELLO = 3;
const ATTESA_TENTATIVI_MS = [0, 3000, 8000];

/**
 * Tetto di tempo per TUTTA la generazione, non per una variante.
 *
 * Senza, la catena puo' arrivare a 3 varianti x 2 modelli x 3 tentativi, con
 * attese e timeout: ben oltre i 60 secondi che Vercel concede a una funzione
 * (maxDuration nell'endpoint). Superato quel limite Vercel taglia la richiesta e
 * risponde con una pagina HTML: l'allenatore vede un errore su una generazione
 * che in realta' stava funzionando.
 *
 * 45 secondi: sotto il tetto di Vercel con margine per la rete, e sopra
 * abbastanza per completare una variante vera (misurata in 14.6s). Scaduto il
 * budget, le varianti rimaste prendono il demo: e' comunque meglio di un
 * errore, e la UI lo dichiara.
 *
 * Da solo non basta: i tentativi non possono iniziare se non c'e' piu' tempo
 * utile. Per questo il budget si controlla ANCHE prima di ogni tentativo, e
 * non solo alla fine.
 */
const BUDGET_TOTALE_MS = 45_000;

/**
 * Un 429 NON si ritenta.
 *
 * Il messaggio di Gemini lo dice esplicitamente ("Please retry in 40.5s"):
 * la quota del free tier finisce in un tempo che nessun tentativo utile puo'
 * aspettare dentro una richiesta da interfaccia. Ritentare su 429 e' quindi
 * solo tempo perso e, peggio, consumo della quota residua degli altri modelli
 * nella stessa finestra.
 *
 * Un 503 invece SI ritenta: e' affollamento, non quota, e la finestra si
 * riapre in pochi secondi.
 */
function eQuotaEsaurita(messaggio: string): boolean {
  return /\[429\s*\]/.test(messaggio) || /quota/i.test(messaggio);
}

/** Espone la catena per il pannello di debug, senza esporre la chiave. */
export function catenaModelli(): string[] {
  return [MODELLO_PRINCIPALE, MODELLO_FALLBACK].filter(
    (m, i, a) => a.indexOf(m) === i,
  );
}

export interface GenerateResult {
  drills: Drill[];
  /** Modello che ha effettivamente risposto. */
  model: string;
  /** Se ha risposto il modello di riserva. */
  fallbackUsed: boolean;
  /** 'gemini' quando ha risposto il modello, 'demo' senza chiave. */
  source: 'gemini' | 'demo';
  /**
   * Provenienza di ogni variante, allineata a `drills`.
   *
   * Senza questo la UI puo' sbagliare: `source` dice "gemini" se ALMENO UNA
   * variante e' stata generata, ma la scheda attiva potrebbe essere una di
   * quelle cadute sul demo. Il risultato era un esercizio scritto a mano
   * etichettato "Generato con Gemini": non solo inutile, ma falso, e su una
   * lavagna didattica una Provenienza sbagliata e' la cosa peggiore che si
   * possa sbagliare.
   */
  sources: ('gemini' | 'demo')[];
  /**
   * Token consumati dalle chiamate reali al modello.
   *
   * Aggregano tutte le varianti e i tentativi, NON solo quello che ha
   * risposto: un tentativo fallito costa uguale. Senza questo il log dei costi
   * avrebbe contato una chiamata su tre, e la fattura reale sarebbe stata il
   * triplo di quella dichiarata.
   */
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * I tre ruoli delle varianti.
 *
 * Ogni variante e' una richiesta SEPARATA al modello, non un elemento di un
 * array di una risposta sola. Questa non e' una scelta di comodo: e' il limite
 * reale del servizio, misurato.
 *
 * Con lo schema che chiede tre varianti in una risposta, gemini-3.6-flash
 * risponde 503 "high demand" oppure scade sui 18 secondi. Con lo stesso schema
 * ridotto a UNA variante risponde 200 in 14.6s. La differenza non e' lo schema,
 * e' il peso del JSON da generare: tre esercizi completi con azioni,
 * durate e descrizioni sono troppi token per una risposta singola entro un
 * timeout accettabile.
 *
 * Tre chiamate in parallelo invece che tre in sequenza: il tempo totale resta
 * quello di una generazione sola (~15s) invece di 45s, e le varianti non
 * dipendono l'una dall'altra. Il prezzo e' consumare tre richieste di quota
 * invece di una, cosa che il free tier regge (20 al minuto).
 */
const RUOLI: { id: string; richiesta: (brief: string) => string; progressione: boolean }[] = [
  {
    id: 'variante-1',
    // La prima e' l'esercizio richiesto, senza interpretazioni. Se qui il
    // modello "migliora" l'esercizio, l'allenatore riceve qualcosa che non
    // ha chiesto e non lo nota: il difetto piu' subdolo che ci sia.
    richiesta: (brief) =>
      `${brief}\n\nQuesta e' la variante 1: l'esercizio ESATTAMENTE come richiesto sopra, senza aggiunte e senza semplificazioni. Se l'esercizio cita un numero di giocatori, rispettalo. Se cita porticine, porte, coni o zone, mettili.`,
    progressione: false,
  },
  {
    id: 'variante-2',
    richiesta: (brief) =>
      `${brief}\n\nQuesta e' la variante 2: una progressione PIU' FACILE dello stesso esercizio. Scegli UNA leva e cambia solo quella: un tocco in meno prima di ricevere, spazio piu' ampio, pressione solo passiva, un giocatore in meno che pressa. Togli un vincolo, non aggiungerne. L'esercizio resta lo stesso obiettivo.`,
    progressione: true,
  },
  {
    id: 'variante-3',
    richiesta: (brief) =>
      `${brief}\n\nQuesta e' la variante 3: una progressione PIU' DIFFICILE dello stesso esercizio. Scegli UNA leva e irrigidiscila: doppio pallone per la ricezione, pressione attiva con l'uscita del portiere, spazio ridotto, o un vincolo di tempo (la ricezione va fatta entro due passaggi). Un vincolo solo, cosi' si sa cosa e' cambiato.`,
    progressione: true,
  },
];

const SYSTEM_PROMPT = `Sei un allenatore di calcio professionista che progetta esercizi su lavagna tattica.

Restituisci SOLO il JSON strutturato richiesto. Le coordinate sono percentuali da 0 a 100 con origine in ALTO a SINISTRA: x cresce verso destra, y cresce verso il basso. Tieni tutto dentro il campo. Descrizioni in italiano, brevi e concrete. Mantieni gli id degli oggetti stabili e il possesso della palla coerente.

REGOLE OBBLIGATORIE:
1. Esiste esattamente un oggetto con kind "ball", e il suo id e' "ball".
2. Un giocatore non diventa e non sostituisce la palla.
3. Le azioni "pass" e "shoot" hanno SEMPRE subject = "ball".
4. Il giocatore con hasBall=true parte con la palla, e la palla parte dalla sua posizione esatta.
5. Un giocatore CON la palla che si muove usa "dribble"; senza palla usa "run" o "move".
6. Il possesso deve essere coerente da uno step al successivo: chi riceve diventa il possessore.
7. Ogni subject, target e id citato deve esistere fra gli oggetti.
8. Un giocatore non passa mai a se stesso.
9. Un passaggio va a un GIOCATORE, mai a un cono e mai a una coordinata vuota se c'e' un ricevente valido.
10. Un giocatore vicino a un cono sta ACCANTO al cono, mai sopra: usa uno scarto di 4-6 unita'.
11. Clampa le coordinate dentro il campo ed evita sovrapposizioni impossibili.
12. Restituisci UN esercizio completo e coerente, non una lista di varianti.

Passaggio corretto:
{"type":"pass","subject":"ball","target":"cb1","duration":700,"easing":"easeOut"}

Passaggio sbagliato:
{"type":"pass","subject":"gk","target":"cb1","duration":700}

LE TRE VARIANTI:
- variants[0] e' ESATTAMENTE l'esercizio richiesto, con i vincoli che ha citato l'allenatore. Non lo semplificare.
- variants[1] e' una progressione piu' facile (un tocco in meno, spazio piu' ampio, pressione passiva).
- variants[2] e' una progressione piu' difficile (doppio pallone, pressione attiva, spazio ridotto, vincolo di tempo).
- Ogni variante e' un esercizio COMPLETO e AUTONOMO: i propri oggetti, i propri id, la propria sequenza. Non sono varianti parziali ne "patch" dell'esercizio base: l'allenatore deve poter salvare una progressione senza l'esercizio da cui dipende.

ESEMPIO DI UN PASSAGGIO CORRETTO, 2v2 con due porticine (4 giocatori, pallone, due porticine):
{
  "id": "variante-1",
  "name": "2v2 con ricezione spalle",
  "description": "Due attaccanti ricevono spalle alla porta, scaricano e attaccano la profondita'.",
  "category": "finalizzazione",
  "ageGroup": "U12",
  "pitch": { "shape": "rectangle", "width": 40, "height": 30 },
  "cycles": 1,
  "objects": [
    { "id": "gk", "kind": "player", "team": "blue", "label": "GK", "x": 10, "y": 50, "hasBall": true },
    { "id": "a1", "kind": "player", "team": "blue", "label": "9", "x": 45, "y": 30 },
    { "id": "a2", "kind": "player", "team": "blue", "label": "11", "x": 45, "y": 70 },
    { "id": "b1", "kind": "player", "team": "red", "label": "2", "x": 65, "y": 40 },
    { "id": "b2", "kind": "player", "team": "red", "label": "3", "x": 65, "y": 60 },
    { "id": "ball", "kind": "ball", "x": 10, "y": 50 },
    { "id": "g1", "kind": "goal", "x": 92, "y": 30 },
    { "id": "g2", "kind": "goal", "x": 92, "y": 70 }
  ],
  "sequence": [
    {
      "id": "s1",
      "description": "Il portiere apre alla destra.",
      "duration": 2000,
      "actions": [
        { "id": "s1-a1", "type": "pass", "subject": "ball", "target": "a1", "duration": 900, "easing": "easeOut" },
        { "id": "s1-a2", "type": "move", "subject": "b1", "to": { "x": 70, "y": 35 }, "duration": 1500, "startAt": 300 }
      ]
    }
  ]
}
`;

/**
 * Genera le tre varianti.
 *
 * Tre richieste indipendenti in PARALLELO, una per variante: vedi la nota su
 * RUOLI perche' non si chiede un array di tre esercizi in una risposta sola.
 *
 * Non lancia mai per un errore di servizio: risponde con quello che e'
 * riuscito, e se non e' rimasto niente risponde con il demo dichiarato come
 * tale. Un allenatore davanti a una lavagna vuole vedere qualcosa subito, e
 * "quello che non e' il tuo esercizio, guarda l'esempio" e' piu' utile di una
 * pagina vuota: dice subito che il problema e' il servizio e non l'app.
 */
export async function generateDrillVariants(
  prompt: string,
): Promise<GenerateResult> {
  const testo = prompt.trim();

  // Senza chiave non si chiama nessun servizio: si risponde con il demo,
  // dichiarato come tale.
  const haChiave = !!(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );

  if (!haChiave) {
    console.warn('[drill] nessuna GEMINI_API_KEY: rispondo con l\'esempio demo.');
    return {
      drills: [DEMO_DRILL],
      model: 'demo',
      fallbackUsed: false,
      source: 'demo',
      sources: ['demo'],
    };
  }

  const avvio = Date.now();

  // Promise.all e non allSettled perche' ogni variante promette gia' di
  // risolvere: una che fallisce va sul demo, non deve far fallire le altre.
  const esiti = await Promise.all(
    RUOLI.map((ruolo) => generaUnaVariante(testo, ruolo, avvio)),
  );

  // I token si sommano su tutti gli esiti, compresi quelli caduti sul demo:
  // il tentativo che ha fallito e' stata una chiamata a pagamento.
  const usage = esiti.reduce(
    (acc, e) => ({
      inputTokens: acc.inputTokens + (e.usage?.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (e.usage?.outputTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0 },
  );

  const drills = esiti.map((e) => e.drill).filter(Boolean) as Drill[];

  // Quante varianti sono davvero del modello. Il conteggio si fa sulle
  // varianti, non sulla lunghezza dell'array: il fallback al demo produce
  // comunque un esercizio, e dire "gemini" mentre si sta mostrando un esempio
  // scritto a mano e' il peggior modo di mentire su una lavagna.
  const risposteGemini = esiti.filter((e) => e.source === 'gemini');
  const quanteGemini = risposteGemini.length;
  const modelloUsato = risposteGemini[0]?.model ?? 'demo';

  // Gli id dei demo sono tutti uguali (per tutte le varianti arriva lo stesso
  // oggetto): senza rinumerarli la UI mostrerebbe tre schede con lo stesso
  // identificatore e i "Salva" potrebbero sovrascriversi.
  const drillFinali = drills.map((d, i) => ({
    ...d,
    id: risposteGemini.includes(esiti[i]) ? d.id : `demo-${i + 1}`,
  }));

  console.log(
    `[drill] ${quanteGemini}/3 varianti da ${modelloUsato} in ${Date.now() - avvio}ms`,
  );

  return {
    drills: drillFinali.length ? drillFinali : [DEMO_DRILL],
    model: quanteGemini ? modelloUsato : 'demo',
    fallbackUsed: quanteGemini
      ? risposteGemini.some((e) => e.fallbackUsed)
      : true,
    source: quanteGemini ? 'gemini' : 'demo',
    sources: esiti.map((e) => e.source),
    usage,
  };
}

/** Esito di una singola variante, incluso il fallback silenzioso al demo. */
interface EsitoVariante {
  drill: Drill;
  model: string;
  fallbackUsed: boolean;
  source: 'gemini' | 'demo';
  /** Token di QUESTA variante, per il log dei costi. */
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Genera UNA variante.
 *
 * Percorre la catena di modelli finche' uno risponde. Sul 429 (quota) non
 * ritenta: il messaggio dice "retry in 40s", e aspettare 40 secondi dentro
 * una richiesta da interfaccia non e' un ritardo, e' un abbandono. Sul 503
 * (affollamento) ritenta, perche' li' la finestra si riapre in pochi secondi.
 *
 * Non lancia mai: se tutto fallisce restituisce il demo. Un errore qui
 * farebbe fallire l'intera generazione anche quando le altre due varianti
 * sono perfettamente usabili, e la risposta all'allenatore sarebbe "genera
 * di nuovo" per un esercizio che aveva gia' tre risposte buone.
 */
async function generaUnaVariante(
  brief: string,
  ruolo: { id: string; richiesta: (b: string) => string; progressione: boolean },
  inizio: number,
): Promise<EsitoVariante> {
  const catena = catenaModelli();

  for (let i = 0; i < catena.length; i++) {
    const modello = catena[i];

    for (let tentativo = 0; tentativo < TENTATIVI_PER_MODELLO; tentativo++) {
      const attesa = ATTESA_TENTATIVI_MS[tentativo] ?? 0;

      // Non si comincia un tentativo che non puo' finire entro il budget: un
      // timeout che scatta qui lascia un esercizio a meta' e fa perdere piu'
      // tempo di quanto si sarebbe recuperato.
      if (Date.now() - inizio + attesa >= BUDGET_TOTALE_MS) {
        console.warn(`[drill] ${ruolo.id}: budget di ${BUDGET_TOTALE_MS}ms esaurito, uso il demo`);
        break;
      }
      if (attesa > 0) await new Promise((r) => setTimeout(r, attesa));

      try {
        const { output, usage } = await withTimeout(
          ai.generate({
            model: modello,
            system: SYSTEM_PROMPT,
            prompt: `USER BRIEF:\n${ruolo.richiesta(brief)}`,
            output: { schema: DrillSchema },
            config: { temperature: 0.35 },
          }),
          // Il timeout per singolo modello non puo' superare il budget
          // residuo: altrimenti l'ultima variante in coda aspetterebbe 18
          // secondi e uscirebbe comunque oltre il tetto di Vercel.
          Math.max(3000, Math.min(TIMEOUT_PER_MODELLO_MS, BUDGET_TOTALE_MS - (Date.now() - inizio))),
          `${modello}/${ruolo.id}`,
        );

        const drill = output as unknown as Drill | undefined;
        if (drill && Array.isArray(drill.objects) && drill.objects.length) {
          if (i > 0 || tentativo > 0) {
            console.warn(
              `[drill] ${ruolo.id} da ${modello} (tentativo ${tentativo + 1}${i > 0 ? ', modello di riserva' : ''})`,
            );
          }
          return {
            // Il modello puo' non dare un id alla variante: glielo diamo noi,
            // cosi' l'id riflette il ruolo e non una scelta arbitraria del
            // modello (che spesso mette "drill" in tutte e tre).
            drill: { ...drill, id: drill.id || ruolo.id },
            model: modello,
            fallbackUsed: i > 0,
            source: 'gemini',
            usage: {
              inputTokens: Number(usage?.inputTokens ?? 0),
              outputTokens: Number(usage?.outputTokens ?? 0),
            },
          };
        }

        console.warn(`[drill] ${ruolo.id}: ${modello} ha risposto vuoto`);
      } catch (e: any) {
        const testoErrore = String(e?.message || e);
        console.warn(
          `[drill] ${ruolo.id} ${modello} tentativo ${tentativo + 1}/${TENTATIVI_PER_MODELLO}: ${testoErrore.slice(0, 140)}`,
        );

        // 400 = schema rifiutato dal modello. Cambiare modello non lo risolve,
        // e fallire qui sarebbe un bug: e' il caso in cui conviene che l'errore
        // arrivi all'allenatore come messaggio, non che diventi un demo.
        if (/\[400\s*\]/.test(testoErrore)) {
          throw new Error(
            'Il generatore ha un problema tecnico nel formato dei dati. Riprova fra poco.',
          );
        }

        if (eQuotaEsaurita(testoErrore)) {
          console.warn(
            `[drill] ${ruolo.id}: ${modello} in quota esaurita, passo al successivo senza ritentare`,
          );
          break;
        }
      }
    }
  }

  // Tutti i modelli hanno fallito per questa variante: si usa il demo, che e'
  // un esercizio vero e animabile. Meglio un esempio che l'allenatore puo'
  // salvare e modificare di una lavagna vuota.
  return {
    drill: DEMO_DRILL,
    model: 'demo',
    fallbackUsed: true,
    source: 'demo',
  };
}

/**
 * Applica un timeout a una promise.
 *
 * Non annulla l'operazioneunderlying: una richiesta a Gemini che arriva dopo
 * il timeout consuma quota per un risultato che nessuno guardera'. E' uno
 * spreco accettato rispetto a tenere aperta la connessione del client, e il
 * retry successivo copre il caso in cui la risposta tardiva era quella buona.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  etichetta: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${etichetta}: timeout dopo ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}