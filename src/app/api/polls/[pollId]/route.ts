import { NextResponse } from 'next/server';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { apiError } from '@/lib/server/auth';
import type {
  PollAnswerValue,
  PollPlayerEntry,
  PollQuestion,
  PollResponseRecord,
  PublicPollView,
  TeamPoll,
} from '@/lib/types';

export const runtime = 'nodejs';

const submitAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(64),
  textValue: z.string().max(1000).optional(),
  selectedOptions: z.array(z.string().max(200)).max(20).optional(),
  scaleValue: z.number().int().min(1).max(10).optional(),
});

const submitBodySchema = z.object({
  tokenType: z.enum(['personal', 'group']),
  token: z.string().trim().min(8).max(128),
  playerId: z.string().trim().min(1).max(128).optional(),
  answers: z.array(submitAnswerSchema).max(30),
});

function safeTokenMatch(expected: unknown, provided: string): boolean {
  if (typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

class PollSubmitError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function validateAndNormalizeAnswers(
  questions: PollQuestion[],
  rawAnswers: z.infer<typeof submitAnswerSchema>[],
): PollAnswerValue[] {
  const byQuestionId = new Map<string, z.infer<typeof submitAnswerSchema>>();
  for (const a of rawAnswers) {
    byQuestionId.set(a.questionId, a);
  }

  const normalized: PollAnswerValue[] = [];

  for (const q of questions) {
    const ans = byQuestionId.get(q.id);

    if (q.type === 'single_choice') {
      const allowed = new Set(q.options ?? []);
      const picked = (ans?.selectedOptions ?? []).map((s) => s.trim()).filter(Boolean);
      const choice = picked[0];
      if (!choice) {
        if (q.required) {
          throw new PollSubmitError(400, 'VALIDATION_ERROR', `Rispondi alla domanda obbligatoria: "${q.text}"`);
        }
        continue;
      }
      if (!allowed.has(choice)) {
        throw new PollSubmitError(400, 'VALIDATION_ERROR', `Opzione non valida per la domanda "${q.text}".`);
      }
      normalized.push({ questionId: q.id, selectedOptions: [choice] });
    } else if (q.type === 'multiple_choice') {
      const allowed = new Set(q.options ?? []);
      const uniqueSelected = Array.from(
        new Set((ans?.selectedOptions ?? []).map((s) => s.trim()).filter(Boolean)),
      );
      if (uniqueSelected.some((opt) => !allowed.has(opt))) {
        throw new PollSubmitError(400, 'VALIDATION_ERROR', `Una o più opzioni non sono valide per "${q.text}".`);
      }
      if (uniqueSelected.length === 0) {
        if (q.required) {
          throw new PollSubmitError(400, 'VALIDATION_ERROR', `Seleziona almeno un'opzione per "${q.text}".`);
        }
        continue;
      }
      normalized.push({ questionId: q.id, selectedOptions: uniqueSelected });
    } else if (q.type === 'scale') {
      const max = q.scaleMax === 10 ? 10 : 5;
      const val = ans?.scaleValue;
      if (val === undefined || val === null) {
        if (q.required) {
          throw new PollSubmitError(400, 'VALIDATION_ERROR', `Seleziona un valore da 1 a ${max} per "${q.text}".`);
        }
        continue;
      }
      if (!Number.isInteger(val) || val < 1 || val > max) {
        throw new PollSubmitError(400, 'VALIDATION_ERROR', `Valore scala fuori intervallo (1–${max}) per "${q.text}".`);
      }
      normalized.push({ questionId: q.id, scaleValue: val });
    } else {
      const text = (ans?.textValue ?? '').trim();
      if (!text) {
        if (q.required) {
          throw new PollSubmitError(400, 'VALIDATION_ERROR', `Inserisci una risposta per "${q.text}".`);
        }
        continue;
      }
      normalized.push({ questionId: q.id, textValue: text });
    }
  }

  return normalized;
}

/**
 * GET /api/polls/[pollId]?t=<playerToken> | ?g=<groupToken>
 * Route pubblica per il calciatore: valida il token e restituisce solo i dati
 * necessari a compilare il sondaggio (mai risposte né altri token).
 */
export async function GET(request: Request, context: { params: Promise<{ pollId: string }> }) {
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { pollId } = await context.params;
  const url = new URL(request.url);
  const personalToken = (url.searchParams.get('t') ?? '').trim();
  const groupToken = (url.searchParams.get('g') ?? '').trim();

  if (!personalToken && !groupToken) {
    return apiError(403, 'INVALID_POLL_LINK', 'Link del sondaggio incompleto o non valido.');
  }

  try {
    const snap = await adminDb.collection('polls').doc(pollId).get();
    if (!snap.exists) {
      return apiError(404, 'POLL_NOT_FOUND', 'Sondaggio non trovato o eliminato.');
    }

    const poll = snap.data() as Omit<TeamPoll, 'id'>;
    const completedSet = new Set(Array.isArray(poll.completedPlayerIds) ? poll.completedPlayerIds : []);
    const players = Array.isArray(poll.players) ? poll.players : [];

    if (personalToken) {
      const matchedPlayer = players.find((p) => safeTokenMatch(p.token, personalToken));
      if (!matchedPlayer) {
        return apiError(403, 'INVALID_POLL_LINK', 'Link personale non valido.');
      }

      const payload: PublicPollView = {
        mode: 'personal',
        id: snap.id,
        title: poll.title,
        ...(poll.description ? { description: poll.description } : {}),
        seasonName: poll.seasonName,
        anonymous: Boolean(poll.anonymous),
        status: poll.status,
        questions: poll.questions ?? [],
        player: {
          playerId: matchedPlayer.playerId,
          playerName: matchedPlayer.playerName,
          alreadyCompleted: completedSet.has(matchedPlayer.playerId),
        },
      };
      return NextResponse.json(payload);
    }

    if (!safeTokenMatch(poll.groupToken, groupToken)) {
      return apiError(403, 'INVALID_POLL_LINK', 'Link del sondaggio non valido.');
    }

    const payload: PublicPollView = {
      mode: 'group',
      id: snap.id,
      title: poll.title,
      ...(poll.description ? { description: poll.description } : {}),
      seasonName: poll.seasonName,
      anonymous: Boolean(poll.anonymous),
      status: poll.status,
      questions: poll.questions ?? [],
      roster: players.map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        alreadyCompleted: completedSet.has(p.playerId),
      })),
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[api/polls/[pollId] GET] Errore lettura sondaggio pubblico:', error instanceof Error ? error.message : error);
    return apiError(500, 'POLL_LOAD_FAILED', 'Impossibile caricare il sondaggio.');
  }
}

/**
 * POST /api/polls/[pollId]
 * Registra in transazione la risposta di un giocatore tramite token personale o token di gruppo.
 */
export async function POST(request: Request, context: { params: Promise<{ pollId: string }> }) {
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { pollId } = await context.params;
  const rawBody = await request.json().catch(() => null);
  const parsed = submitBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Dati inviati non validi.');
  }

  const { tokenType, token, playerId, answers } = parsed.data;
  const pollRef = adminDb.collection('polls').doc(pollId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(pollRef);
      if (!snap.exists) {
        throw new PollSubmitError(404, 'POLL_NOT_FOUND', 'Sondaggio non trovato.');
      }

      const poll = snap.data() as Omit<TeamPoll, 'id'>;
      const players = Array.isArray(poll.players) ? poll.players : [];
      const completedIds = Array.isArray(poll.completedPlayerIds) ? poll.completedPlayerIds : [];
      const existingResponses = Array.isArray(poll.responses) ? poll.responses : [];

      let targetPlayer: PollPlayerEntry | undefined;
      if (tokenType === 'personal') {
        targetPlayer = players.find((p) => safeTokenMatch(p.token, token));
        if (!targetPlayer) {
          throw new PollSubmitError(403, 'INVALID_POLL_LINK', 'Link personale non valido.');
        }
      } else {
        if (!safeTokenMatch(poll.groupToken, token)) {
          throw new PollSubmitError(403, 'INVALID_POLL_LINK', 'Link del sondaggio non valido.');
        }
        if (!playerId) {
          throw new PollSubmitError(400, 'PLAYER_REQUIRED', 'Seleziona il tuo nome dalla lista prima di inviare.');
        }
        targetPlayer = players.find((p) => p.playerId === playerId);
        if (!targetPlayer) {
          throw new PollSubmitError(400, 'PLAYER_NOT_FOUND', 'Giocatore non presente nella rosa di questo sondaggio.');
        }
      }

      if (poll.status !== 'open') {
        throw new PollSubmitError(409, 'POLL_CLOSED', 'Questo sondaggio è stato chiuso dall\'allenatore.');
      }

      if (completedIds.includes(targetPlayer.playerId)) {
        throw new PollSubmitError(409, 'ALREADY_SUBMITTED', 'Hai già risposto a questo sondaggio.');
      }

      const normalizedAnswers = validateAndNormalizeAnswers(poll.questions ?? [], answers);
      const now = new Date().toISOString();

      // Se anonimo, omette intenzionalmente playerId e playerName dal record risposte.
      const record: PollResponseRecord = poll.anonymous
        ? {
            id: randomBytes(8).toString('hex'),
            submittedAt: now,
            answers: normalizedAnswers,
          }
        : {
            id: randomBytes(8).toString('hex'),
            submittedAt: now,
            playerId: targetPlayer.playerId,
            playerName: targetPlayer.playerName,
            answers: normalizedAnswers,
          };

      tx.update(pollRef, {
        completedPlayerIds: [...completedIds, targetPlayer.playerId],
        responses: [...existingResponses, record],
        updatedAt: now,
      });

      return {
        playerName: targetPlayer.playerName,
        anonymous: Boolean(poll.anonymous),
      };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof PollSubmitError) {
      return apiError(error.status, error.code, error.message);
    }
    console.error('[api/polls/[pollId] POST] Errore invio risposta:', error instanceof Error ? error.message : error);
    return apiError(500, 'POLL_SUBMIT_FAILED', 'Errore durante l\'invio della risposta. Riprova.');
  }
}
