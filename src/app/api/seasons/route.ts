import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth } from '@/lib/server/auth';
import { apiGuard } from '@/lib/server/ai-guard';
import { PLAN_LIMITS } from '@/lib/plans';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * POST /api/seasons — crea una stagione con l'Admin SDK.
 *
 * Il client non puo' piu' creare stagioni direttamente: `ownerId`, `members`,
 * `memberUids`, `plan` e `limits` devono essere scritti dal server, altrimenti
 * un utente che legge le regole puo' crearsi una stagione con 1000 membri
 * oppure scrivere `plan` su un documento che dovrebbe essere server-only.
 *
 * GET /api/seasons — le stagioni dell'utente. Il client le leggeva con una
 * query `ownerId == uid OR sharedWith contains uid`: con le nuove rules quella
 * query non e' piu' possibile (le rules non possono valutare un OR su due
 * campi con un `get()` dentro per ogni documento), quindi si passa dal server.
 */
export async function POST(request: Request) {
  const guard = await apiGuard(request);
  if (!guard.ok) return guard.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const parsed = z
    .object({ name: z.string().min(1).max(80), seasonId: z.string().max(120).optional() })
    .safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Serve un nome per la stagione (massimo 80 caratteri).');
  }

  const now = new Date();
  // ID lato server, non con Math.random: `Math.random()` e' predicibile e
  // `seasonRepository.add` lo usava per generare l'id della stagione, cioe'
  // l'id che autorizza l'accesso ai dati di una squadra.
  const id = parsed.data.seasonId ?? `S-${randomBytes(4).toString('hex').toUpperCase()}`;
  const seasonRef = adminDb.collection('teams').doc(id);

  try {
    const existing = await seasonRef.get();
    if (existing.exists) {
      return apiError(409, 'SEASON_EXISTS', 'Esiste gia\' una stagione con questo codice.');
    }

    await seasonRef.set({
      id,
      userId: guard.uid,
      ownerId: guard.uid,
      name: parsed.data.name.trim(),
      isActive: false,
      // Fonti di appartenenza ridondanti: `members` per le rules (lookup in un
      // solo documento), `memberUids` per le query "le mie stagioni". Se
      // divergono vanno allineate: il tetto membri prende il numero maggiore.
      members: { [guard.uid]: 'owner' },
      memberUids: [guard.uid],
      sharedWith: [],
      plan: 'beta',
      // `Infinity` dentro Firestore non e' serializzabile: viene scritto come
      // `null`. La season appena creata non ha limiti sui giocatori, e `null`
      // e' esattamente "nessun tetto": `Number.isFinite(null)` e' falso, quindi
      // `hasPlayerLimit` risponde no. I limiti membri invece sono un numero.
      limits: { maxPlayers: null, maxMembers: PLAN_LIMITS.beta.maxMembers },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return NextResponse.json({ id, name: parsed.data.name.trim() });
  } catch (error) {
    console.error('[api/seasons] creazione fallita:', error instanceof Error ? error.message : error);
    return apiError(500, 'SEASON_CREATE_FAILED', 'Non riesco a creare la stagione. Riprova.');
  }
}

/** GET /api/seasons — elenco delle stagioni in cui l'utente e' membro. */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  // Due query invece di una con OR: Firestore non accetta `array-contains`
  // insieme a un `==` su un altro campo nello stesso `where` (i due hanno
  // indici diversi). La regola che vale e' la stessa delle rules: e' membro se
  // e' il proprietario oppure se compare nelle liste.
  const ownerSnap = await adminDb.collection('teams').where('ownerId', '==', auth.uid).get();
  const memberSnap = await adminDb.collection('teams').where('memberUids', 'array-contains', auth.uid).get();
  const legacySnap = await adminDb.collection('teams').where('sharedWith', 'array-contains', auth.uid).get();

  const merged = new Map<string, Record<string, unknown>>();
  for (const s of [...ownerSnap.docs, ...memberSnap.docs, ...legacySnap.docs]) {
    merged.set(s.id, { id: s.id, ...s.data() });
  }

  // Fuori dal registro: quelle che hanno sharedWith ma non memberUids non
  // sarebbero incluse dalla query, e sono stagioni in cui l'utente e' dentro.
  // Il perimetro e' "le stagioni che l'utente vede nell'app", non "quelle che
  // la query sa trovare".
  return NextResponse.json({ seasons: [...merged.values()] });
}
