/**
 * POST /api/chatbot — l'assistente tattico.
 *
 * Il CONTESTO SQUADRA si legge dal server, dalla stagione verificata, e non
 * arriva dal client.
 *
 * Prima il client costruiva `teamContext` (tutti i giocatori, tutte le partite)
 * e lo mandava nella server action. Con l'Admin SDK questo non e' accettabile:
 * il server non aveva modo di sapere se quei dati erano davvero della squadra
 * di chi chiede. Chiunque poteva mandare una lista di giocatori inventata e
 * farsi rispondere analisi su una squadra che non esiste, o — peggio — chiedere
 * "chi ha piu' gol" usando i dati di una squadra a cui non ha accesso, copiati
 * da un export. Il contesto ora viene letto con `requireSeasonMember`, quindi
 * e' per definizione quello a cui l'utente ha gia' accesso.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { aiGuardWithBody, chatbotInputSchema, readJson } from '@/lib/server/ai-guard';
import { logUsage } from '@/lib/server/ai-log';
import { chatbotFlow } from '@/ai/flows/chatbot-flow';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Quante partite e quanti giocatori entrano nel prompt. */
const MAX_MATCHES = 30;
const MAX_PLAYERS = 40;

interface TeamContext {
  seasonName?: string;
  matches?: Array<{
    opponent: string; date: string; isHome: boolean; status: string;
    result?: { home: number; away: number };
  }>;
  players?: Array<{
    name: string; role?: string;
    stats?: {
      appearances?: number; goals?: number; assists?: number;
      avgMinutes?: number; yellowCards?: number; redCards?: number;
    };
  }>;
}

export async function POST(request: Request) {
  const json = await readJson(request);
  if (!json.ok) return json.response;

  // 401 senza token, prima di guardare il corpo: una richiesta non
  // autenticata non deve ricevere indicazioni su quali campi la rotta pretende.
  const guard = await aiGuardWithBody(request, chatbotInputSchema, json.body, {
    limit: 'chatbot',
  });
  if (!guard.ok) return guard.response;

  if (!adminDb) {
    return NextResponse.json(
      { error: { code: 'ADMIN_NOT_CONFIGURED', message: 'Configurazione del server incompleta.' } },
      { status: 500 },
    );
  }

  const started = Date.now();
  const teamContext = await readTeamContext(guard.seasonId);

  // La cronologia NON e' in cache e non viene mandata al client: la risposta
  // dipende dai dati correnti della squadra e dalla conversazione, e una
  // risposta invecchiata su una rosa cambiata e' una risposta sbagliata. I
  // ruoli sono gia' ristretti a `user`/`assistant` dallo schema e il flusso li
  // marca come ALLENATORE/ASSISTENTE prima di metterli nel prompt: `system`
  // non e' accettato, perche' un ruolo inviato dal client non puo' avere la
  // stessa autorita' del prompt di sistema.
  const conversation = [
    ...guard.data.history.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const result = await chatbotFlow({
      message: guard.data.message,
      teamContext,
      formation: guard.data.formation,
      history: conversation,
    });

    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: 'chatbot',
      model: 'gemini',
      inputTokens: 0,
      outputTokens: 0,
      cached: false,
      durationMs: Date.now() - started,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[api/chatbot] errore:', error?.message || error);
    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: 'chatbot',
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      cached: false,
      durationMs: Date.now() - started,
    });
    return NextResponse.json(
      {
        error: {
          code: 'CHATBOT_FAILED',
          message: 'Scusa coach, ho avuto un problema tecnico. Riprova tra un momento.',
        },
      },
      { status: 502 },
    );
  }
}

/**
 * Legge il contesto squadra dalla stagione verificata, con l'Admin SDK.
 *
 * Il troncamento a 30 partite e 40 giocatori non e' un ottimizzazione: oltre,
 * il prompt supera la finestra utile del modello e il risultato peggiora. E'
 * comunque piu' di quello che un allenatore guarda in una volta, quindi non
 * si perde informazione utile.
 */
async function readTeamContext(seasonId: string): Promise<TeamContext> {
  const seasonRef = adminDb!.collection('teams').doc(seasonId);

  const [seasonSnap, matchesSnap, playersSnap] = await Promise.all([
    seasonRef.get(),
    seasonRef.collection('matches').limit(MAX_MATCHES).get(),
    seasonRef.collection('players').limit(MAX_PLAYERS).get(),
  ]);

  const context: TeamContext = { seasonName: (seasonSnap.data() as { name?: string })?.name };

  context.matches = matchesSnap.docs.map((d) => {
    const m = d.data() as {
      opponent?: string; date?: string; isHome?: boolean; status?: string;
      result?: { home: number; away: number };
    };
    return {
      opponent: m.opponent ?? 'sconosciuto',
      date: m.date ?? '',
      isHome: Boolean(m.isHome),
      status: m.status ?? 'scheduled',
      result: m.result,
    };
  });

  context.players = playersSnap.docs.map((d) => {
    const p = d.data() as {
      name?: string; role?: string; roles?: string[];
      stats?: Record<string, number | undefined>;
      appearances?: number; goals?: number; assists?: number; avgMinutes?: number;
    };
    return {
      name: p.name ?? 'senza nome',
      role: p.role ?? p.roles?.[0],
      stats: {
        appearances: p.stats?.appearances ?? p.appearances ?? 0,
        goals: p.stats?.goals ?? p.goals ?? 0,
        assists: p.stats?.assists ?? p.assists ?? 0,
        avgMinutes: p.stats?.avgMinutes ?? p.avgMinutes ?? 0,
        yellowCards: p.stats?.yellowCards ?? 0,
        redCards: p.stats?.redCards ?? 0,
      },
    };
  });

  return context;
}