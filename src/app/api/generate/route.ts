/**
 * POST /api/generate — genera l'esercizio tattico da una descrizione libera.
 *
 * E' l'unico contratto fra il client e la generazione. Il client non chiama
 * Genkit direttamente perche' cosi' la chiave resta nel server e perche' la
 * risposta porta con se' la provenienza del dato (modello, fallback, correzioni
 * applicate): senza, un esercizio sbagliato e' indistinguibile da uno giusto.
 *
 * Risposta:
 *   { drills, drill, fixes, source, engine, model, fallbackUsed }
 *
 * - `drills`  tutte le varianti riparate e utilizzabili
 * - `drill`   quella attiva, cioe' drills[0]
 * - `fixes`   le correzioni deterministiche applicate, in chiaro
 * - `source`  'gemini' oppure 'demo' quando non ha risposto nessun modello
 * - `model`   il modello che ha risposto, o 'demo'
 * - `fallbackUsed` se ha risposto il modello di riserva
 *
 * Errori: 400 per una richiesta malformata, 502 quando la generazione fallisce
 * per un errore non recuperabile. MAI una richiesta appesa: il flusso ha un
 * timeout per modello.
 */

import { NextResponse } from 'next/server';
import {
  generateDrillVariants,
} from '@/ai/flows/generate-drill-variants-flow';
import { repairVariants } from '@/lib/repair-drill';
import { requireAuth } from '@/lib/api-auth';
import type { Drill } from '@/lib/drill';

// La generazione chiama un servizio esterno: senza questo limite, un doppio
// tocco su Genera apre due richieste da 18 secondi e il server si trova a
// fare il doppio lavoro per un risultato che il primo getto gia' copre.
export const maxDuration = 60;

export async function POST(request: Request) {
  // Nessun controllo prima: chiunque poteva far generare esercizi e quindi
  // consumare crediti Gemini. Coach e developer possono, come dice
  // `canCreateGlobalExercises` in `hooks/usePermissions.ts`.
  const auth = await requireAuth(request, ['coach', 'director', 'developer']);
  if (!auth) return;

  let prompt = '';

  try {
    const body = await request.json();
    prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  } catch {
    return NextResponse.json(
      { error: 'Il corpo della richiesta non è JSON valido.' },
      { status: 400 },
    );
  }

  if (!prompt) {
    return NextResponse.json(
      { error: "Scrivi una descrizione dell'esercizio." },
      { status: 400 },
    );
  }

  // Limite sul testo: oltre qualche riga il prompt non descrive un esercizio,
  // descrive un capitolo, e il modello risponde con un muro di passaggi.
  if (prompt.length > 2000) {
    return NextResponse.json(
      { error: 'La descrizione è troppo lunga. Bastano due-tre frasi.' },
      { status: 400 },
    );
  }

  const started = Date.now();

  try {
    const result = await generateDrillVariants(prompt);

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

    return NextResponse.json({
      drills,
      drill: drills[0],
      fixes,
      source: result.source,
      // Provenienza per variante: senza, la UI non puo' dire se la scheda che
      // sta mostrando e' stata generata o e' l'esempio di riserva. Vedi la
      // nota su `sources` in generate-drill-variants-flow.
      sources: result.sources,
      engine: 'genkit',
      model: result.model,
      fallbackUsed: result.fallbackUsed,
    });
  } catch (error: any) {
    // 502 e non 500: il fallimento e' del servizio AI, non dell'app. La
    // differenza serve a chi legge i log per capire dove guardare.
    console.error('[api/generate] errore:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Generazione non riuscita. Riprova.' },
      { status: 502 },
    );
  }
}