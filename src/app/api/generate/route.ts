/**
 * POST /api/generate — genera l'esercizio tattico da una descrizione libera.
 *
 * E' l'unico contratto fra il client e la generazione. Il client non chiama
 * Genkit direttamente perche' cosi' la chiave resta nel server e perche' la
 * risposta porta con se' la provenienza del dato (modello, fallback, correzioni
 * applicate): senza, un esercizio sbagliato e' indistinguibile da uno giusto.
 *
 * Risposta:
 *   { drills, drill, fixes, source, engine, model, fallbackUsed, cacheHit }
 *
 * - `drills`  tutte le varianti riparate e utilizzabili
 * - `drill`   quella attiva, cioe' drills[0]
 * - `fixes`   le correzioni deterministiche applicate, in chiaro
 * - `source`  'gemini' oppure 'demo' quando non ha risposto nessun modello
 * - `model`   il modello che ha risposto, o 'demo'
 * - `fallbackUsed` se ha risposto il modello di riserva
 *
 * Errori: 400 per una richiesta malformata, 401 senza token, 403 senza
 * appartenenza alla stagione, 429 oltre il limite, 503 con l'app AI spenta,
 * 502 quando la generazione fallisce per un errore non recuperabile. MAI una
 * richiesta appesa: il flusso ha un timeout per modello.
 */

import { NextResponse } from 'next/server';
import { generateDrillVariants } from '@/ai/flows/generate-drill-variants-flow';
import { repairVariants } from '@/lib/repair-drill';
import { aiGuardWithBody, generateInputSchema, readJson } from '@/lib/server/ai-guard';
import { cacheGet, cacheSet, hashKey, logUsage, normalizeForCache } from '@/lib/server/ai-log';
import { apiError } from '@/lib/server/auth';
import type { Drill } from '@/lib/drill';

// La generazione chiama un servizio esterno: senza questo limite, un doppio
// tocco su Genera apre due richieste da 18 secondi e il server si trova a
// fare il doppio lavoro per un risultato che il primo getto gia' copre.
export const maxDuration = 60;

export const runtime = 'nodejs';

interface GeneratePayload {
  drills: Drill[];
  drill: Drill;
  fixes: unknown[];
  source: string;
  sources: string[];
  engine: string;
  model: string;
  fallbackUsed: boolean;
  cacheHit: boolean;
}

export async function POST(request: Request) {
  const json = await readJson(request);
  if (!json.ok) return json.response;

  // `seasonId` non viene creduto: serve solo a scegliere QUALE stagione
  // verificare, e la verifica la fa il guard con l'uid del token. Senza token
  // la risposta e' 401 PRIMA di guardare il corpo.
  const guard = await aiGuardWithBody(request, generateInputSchema, json.body, {
    limit: 'generate',
    extraDailyLimit: 'generateDaily',
  });
  if (!guard.ok) return guard.response;

  const promptTesto = guard.data.prompt;

  const started = Date.now();

  // Cache su prompt normalizzato + uid. La chiave include l'uid perche' il
  // risultato dipende dalla squadra a cui si riferisce, non solo dal testo: due
  // allenatori che scrivono "4-3-3" per due squadre diverse non possono
  // condividere la stessa risposta.
  const cacheKey = hashKey('drill', guard.uid, normalizeForCache(promptTesto));
  const cached = await cacheGet<GeneratePayload>(cacheKey);

  if (cached.hit && cached.value) {
    // Il costo e' gia' stato pagato da chi ha fatto la cache. Si registra
    // comunque una riga, con `cached: true` e zero token: senza, il tetto
    // globale conterebbe una chiamata che non e' avvenuta, e l'utente che ha
    // fatto la cache vedrebbe il proprio budget consumato da un risultato che
    // ha gia' ottenuto.
    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: 'generate',
      model: cached.value.model,
      inputTokens: 0,
      outputTokens: 0,
      cached: true,
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ ...cached.value, cacheHit: true });
  }

  try {
    const result = await generateDrillVariants(promptTesto);

    // Il repair gira SEMPRE, anche sull'output del modello principale e anche
    // sul demo. Il demo e' gia' pulito e non produrra' correzioni: e' un test
    // in produzione che la pipeline non corrompe l'esercizio buono.
    const { drills, fixes } = repairVariants(result.drills as Drill[]);

    if (drills.length === 0) {
      console.error(
        `[api/generate] nessuna variante riparabile dopo ${Date.now() - started}ms`,
      );
      return NextResponse.json(
        { error: "L'esercizio generato non era disegnabile. Riprova con una descrizione più semplice." },
        { status: 502 },
      );
    }

    const durata = Date.now() - started;
    console.log(
      `[api/generate] ${drills.length} varianti da ${result.model} in ${durata}ms, ${fixes.length} correzioni (source=${result.source})`,
    );

    const payload: GeneratePayload = {
      drills,
      drill: drills[0],
      fixes,
      source: result.source,
      // Provenienza per variante: senza, la UI non puo' dire se la scheda che
      // sta mostrando e' stata generata o e' l'esempio di riserva.
      sources: result.sources,
      engine: 'genkit',
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      cacheHit: false,
    };

    // Il testo del prompt NON entra nel log: solo il conteggio dei token. Il
    // prompt descrive l'esercizio che l'allenatore sta preparando, e un log di
    // prompt e' un archivio di dati che nessuno ha dichiarato.
    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: 'generate',
      model: result.model,
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      cached: false,
      durationMs: durata,
    });

    // In cache solo le risposte davvero del modello: mettere in cache il demo
    // continuerebbe a restituire un esempio scritto a mano anche quando il
    // modello e' tornato disponibile, e l'allenatore non avrebbe modo di
    // accorgersene.
    if (result.source === 'gemini') {
      await cacheSet(cacheKey, payload);
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    // 502 e non 500: il fallimento e' del servizio AI, non dell'app. La
    // differenza serve a chi legge i log per capire dove guardare.
    console.error('[api/generate] errore:', error?.message || error);
    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: 'generate',
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      cached: false,
      durationMs: Date.now() - started,
    });
    if (/troppo lunga|vuoto|descrivi/i.test(String(error?.message ?? ''))) {
      return apiError(400, 'VALIDATION_ERROR', 'Controlla la descrizione e riprova.');
    }
    return NextResponse.json(
      { error: error?.message || 'Generazione non riuscita. Riprova.' },
      { status: 502 },
    );
  }
}