import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, requireSeasonMember } from '@/lib/server/auth';
import type { PollPlayerEntry, PollQuestion, TeamPoll } from '@/lib/types';

export const runtime = 'nodejs';

const questionInputSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  text: z.string().trim().min(1, 'Inserisci il testo della domanda.').max(300),
  type: z.enum(['single_choice', 'multiple_choice', 'scale', 'open_text']),
  required: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  scaleMax: z.union([z.literal(5), z.literal(10)]).optional(),
  scaleMinLabel: z.string().trim().max(60).optional(),
  scaleMaxLabel: z.string().trim().max(60).optional(),
});

const createPollSchema = z.object({
  title: z.string().trim().min(1, 'Inserisci il titolo del sondaggio.').max(120),
  description: z.string().trim().max(500).optional(),
  anonymous: z.boolean().default(false),
  questions: z.array(questionInputSchema).min(1, 'Aggiungi almeno una domanda.').max(20),
  players: z.array(
    z.object({
      playerId: z.string().trim().min(1).max(128),
      playerName: z.string().trim().min(1).max(120),
    }),
  ).min(1, 'La rosa deve contenere almeno un giocatore.').max(100),
});

function normalizeQuestions(raw: z.infer<typeof questionInputSchema>[]): { ok: true; questions: PollQuestion[] } | { ok: false; message: string } {
  const questions: PollQuestion[] = [];
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i];
    const id = q.id || `q_${i + 1}_${randomBytes(3).toString('hex')}`;

    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      const uniqueOptions = Array.from(new Set((q.options ?? []).map((opt) => opt.trim()).filter(Boolean)));
      if (uniqueOptions.length < 2) {
        return {
          ok: false,
          message: `La domanda "${q.text}" deve avere almeno 2 opzioni valide.`,
        };
      }
      questions.push({
        id,
        text: q.text,
        type: q.type,
        required: q.required,
        options: uniqueOptions,
      });
    } else if (q.type === 'scale') {
      const item: PollQuestion = {
        id,
        text: q.text,
        type: 'scale',
        required: q.required,
        scaleMax: q.scaleMax === 10 ? 10 : 5,
      };
      if (q.scaleMinLabel) item.scaleMinLabel = q.scaleMinLabel;
      if (q.scaleMaxLabel) item.scaleMaxLabel = q.scaleMaxLabel;
      questions.push(item);
    } else {
      questions.push({
        id,
        text: q.text,
        type: 'open_text',
        required: q.required,
      });
    }
  }
  return { ok: true, questions };
}

/**
 * GET /api/seasons/[seasonId]/polls
 * Restituisce tutti i sondaggi spogliatoio della stagione (staff o owner).
 */
export async function GET(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'staff');
  if (!member.ok) return member.response;

  try {
    const snap = await adminDb.collection('polls').where('seasonId', '==', seasonId).get();
    const polls: TeamPoll[] = snap.docs
      .map((doc) => ({
        ...(doc.data() as Omit<TeamPoll, 'id'>),
        id: doc.id,
      }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return NextResponse.json({ polls });
  } catch (error) {
    console.error('[api/polls GET] Errore lettura sondaggi:', error instanceof Error ? error.message : error);
    return apiError(500, 'POLLS_LOAD_FAILED', 'Non riesco a caricare i sondaggi.');
  }
}

/**
 * POST /api/seasons/[seasonId]/polls
 * Crea un nuovo sondaggio generando un groupToken condivisibile e un token personale per giocatore.
 */
export async function POST(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'staff');
  if (!member.ok) return member.response;

  const rawBody = await request.json().catch(() => null);
  const parsed = createPollSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || 'Dati del sondaggio non validi.';
    return apiError(400, 'VALIDATION_ERROR', firstIssue);
  }

  const normalized = normalizeQuestions(parsed.data.questions);
  if (!normalized.ok) {
    return apiError(400, 'VALIDATION_ERROR', normalized.message);
  }

  // Deduplica giocatori mantenendo l'ordine originale
  const seenPlayers = new Set<string>();
  const players: PollPlayerEntry[] = [];
  for (const p of parsed.data.players) {
    if (seenPlayers.has(p.playerId)) continue;
    seenPlayers.add(p.playerId);
    players.push({
      playerId: p.playerId,
      playerName: p.playerName,
      token: randomBytes(16).toString('hex'),
    });
  }

  if (players.length === 0) {
    return apiError(400, 'VALIDATION_ERROR', 'La rosa deve contenere almeno un giocatore.');
  }

  const now = new Date().toISOString();
  const seasonName = typeof member.season.name === 'string' && member.season.name.trim()
    ? member.season.name.trim()
    : 'Squadra';

  const docRef = adminDb.collection('polls').doc();
  const payload: Omit<TeamPoll, 'id'> = {
    seasonId,
    seasonName,
    createdByUid: auth.uid,
    title: parsed.data.title,
    anonymous: parsed.data.anonymous,
    status: 'open',
    groupToken: randomBytes(16).toString('hex'),
    players,
    completedPlayerIds: [],
    questions: normalized.questions,
    responses: [],
    createdAt: now,
    updatedAt: now,
  };
  if (parsed.data.description) {
    payload.description = parsed.data.description;
  }

  try {
    await docRef.set(payload);
    const created: TeamPoll = { id: docRef.id, ...payload };
    return NextResponse.json({ poll: created }, { status: 201 });
  } catch (error) {
    console.error('[api/polls POST] Errore creazione sondaggio:', error instanceof Error ? error.message : error);
    return apiError(500, 'POLL_CREATE_FAILED', 'Non riesco a salvare il sondaggio. Riprova.');
  }
}

