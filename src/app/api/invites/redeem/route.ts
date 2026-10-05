import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import {
  accountRoleOf,
  apiError,
  countMembers,
  isSeasonDirectorOf,
  memberLimit,
  requireAuth,
  roleOf,
  type SeasonDoc,
} from '@/lib/server/auth';
import { limitMessage } from '@/lib/plans';
import { clientIp, rateLimit } from '@/lib/server/rate-limit';
import { GENERIC_INVITE_ERROR } from '@/lib/server/invite-codes';

export const runtime = 'nodejs';

const redeemSchema = z.object({
  code: z.string().min(4).max(20),
  seasonId: z.string().min(1).max(120).optional(),
});

/**
 * POST /api/invites/redeem — entra in una stagione con un codice.
 *
 * TUTTO dentro una transazione. Le quattro condizioni (il codice non e' scaduto,
 * non e' revocato, ha usi disponibili, l'utente non e' gia' membro e c'e' posto)
 * vanno verificate insieme: controllarle una a una e poi scrivere lascia una
 * finestra in cui due utenti con lo stesso codice a uso singolo entrano
 * entrambi. La transazione fa fallire la seconda perche' la prima ha gia'
 * cambiato il documento su cui la seconda aveva letto.
 *
 * Il messaggio di errore e' UNO solo per i quattro casi di rifiuto (vedi
 * GENERIC_INVITE_ERROR): distinguerli direbbe a chi prova a indovinare quali
 * codici esistono.
 *
 * Nota sul rate limit: qui si indovina una stringa, quindi serve anche il
 * tetto per IP. Il tetto per utente da solo non serve a nulla: uno script crea
 * un account nuovo per ogni tentativo.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const ip = clientIp(request);

  const rl = await rateLimit('redeemInvite', { uid: auth.uid, ip: ip ?? undefined });
  if (!rl.ok) {
    return apiError(429, 'RATE_LIMITED', 'Hai provato tropi codici. Riprova fra poco.', {
      retryAfter: rl.retryAfter,
    });
  }

  const parsed = redeemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Codice non valido.');
  }

  const code = parsed.data.code.trim().toUpperCase();
  const inviteRef = adminDb.collection('invites').doc(code);

  // Il document ID della stagione lo scopriamo dentro la transazione, leggendo
  // l'invito: per farlo la transazione deve poter scrivere anche li due
  // documenti, e Firestore vuole i riferimenti noti prima. Si risolve in due
  // passi: lettura dell'invito (fuori transazione, non e' un dato che cambia),
  // poi transazione sui riferimenti cosi' noti.
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    return apiError(400, 'INVITE_INVALID', GENERIC_INVITE_ERROR);
  }

  const invite = inviteSnap.data() as {
    seasonId: string; role: 'staff'; revoked: boolean; usedCount: number;
    maxUses: number; usedBy: string[];
    expiresAt: { toMillis?: () => number } | string;
  };

  const targetSeason = adminDb.collection('teams').doc(invite.seasonId);

  // Ruolo ACCOUNT, letto FUORI dalla transazione: `get()` dentro una
  // transazione su Firestore deve precedere ogni scrittura della stessa
  // transazione, e questo documento (`users/{uid}`) non viene scritto qui.
  const accountRole = await accountRoleOf(auth.uid);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const invSnap = await tx.get(inviteRef);
      const seasonSnap = await tx.get(targetSeason);

      if (!invSnap.exists || !seasonSnap.exists) {
        return { ok: false as const, code: 'INVITE_INVALID' as const };
      }

      const inv = invSnap.data() as typeof invite;
      const season = { ...(seasonSnap.data() as Record<string, unknown>), id: seasonSnap.id } as SeasonDoc;

      const expiresAtMs =
        typeof inv.expiresAt === 'string'
          ? new Date(inv.expiresAt).getTime()
          : (inv.expiresAt?.toMillis?.() ?? 0);

      if (inv.revoked) return { ok: false as const, code: 'INVITE_INVALID' as const };
      if (expiresAtMs > 0 && expiresAtMs < Date.now()) return { ok: false as const, code: 'INVITE_INVALID' as const };
      if (inv.usedCount >= inv.maxUses) return { ok: false as const, code: 'INVITE_INVALID' as const };

      // Un codice legacy migrato puo' avere piu' usi: chi lo ha gia' riscosso
      // non deve essere bloccato dal fatto che il contatore sale.
      //
      // Il controllo comprende anche `isSeasonDirectorOf`: senza, un direttore
      // che riscatta due volte lo stesso codice su una stagione dove e' gia'
      // direttore passerebbe il controllo "gia' membro" (perche' non e' in
      // `sharedWith`) e verrebbe aggiunto due volte.
      if (roleOf(season as never, auth.uid) || isSeasonDirectorOf(season, auth.uid)) {
        return { ok: false as const, code: 'ALREADY_MEMBER' as const };
      }

      const limit = season.limits?.maxMembers ?? memberLimit(season as never);
      if (countMembers(season as never) >= limit) {
        return { ok: false as const, code: 'MEMBERS_FULL' as const, limit };
      }

      const ownerUid = season.ownerId ?? '';
      const existingMembers = season.members ?? (ownerUid ? { [ownerUid]: 'owner' } : {});
      const existingUids = season.memberUids ?? Object.keys(existingMembers);
      const existingShared = season.sharedWith ?? [];
      const existingDirectors = season.directorUids ?? [];

      // UN INVITO, DUE PERMESSI. Il ruolo e' quello dell'ACCOUNT, non quello
      // scritto sull'invito: il ruolo dell'invito dice "entra come staff",
      // ma se chi riscatta ha il ruolo `director` allora entra come direttore.
      //
      // Perche' cosi' e non con un codice separato: il coach condivide lo stesso
      // link che usa gia' per gli allenatori. La decisione "questa persona e' un
      // direttore" l'hai presa tu, fuori dall'app, quando gli hai assegnato il
      // ruolo — quindi il codice non deve decidere nulla.
      const isDirector = accountRole === 'director';

      // Il conteggio (`countMembers`) include gia' i direttori, quindi il tetto
      // dei 5 li considera: e' la decisione esplicita dell'utente.
      tx.update(targetSeason, {
        ...(isDirector
          // DIRETTORE: solo `directorUids`. NON entra in `sharedWith`,
          // `members` o `memberUids`, perche' da li' le rules gli darebbero
          // la scrittura su partite, eventi e test.
          ? {
                directorUids: [...new Set([...existingDirectors, auth.uid])],
              }
          : {
              members: { ...existingMembers, [auth.uid]: inv.role },
              memberUids: [...new Set([...existingUids, auth.uid])],
              // `sharedWith` resta allineata: le rules vecchie e il codigo client
              // che non e' ancora migrato la leggono. Senza questo, un utente che
              // riscatta un invito si ritrova con una stagione che non vede piu'.
              sharedWith: existingShared.includes(auth.uid) ? existingShared : [...existingShared, auth.uid],
            }),
        updatedAt: new Date().toISOString(),
      });

      tx.update(inviteRef, {
        usedCount: (inv.usedCount ?? 0) + 1,
        usedBy: [...(inv.usedBy ?? []), auth.uid],
      });

      return { ok: true as const, seasonId: targetSeason.id };
    });

    if (!result.ok) {
      switch (result.code) {
        case 'ALREADY_MEMBER':
          return apiError(409, 'ALREADY_MEMBER', 'Partecipi gia\' a questa stagione.');
        case 'MEMBERS_FULL':
          return apiError(403, 'MEMBERS_FULL', limitMessage('members', result.limit ?? 0));
        default:
          return apiError(400, 'INVITE_INVALID', GENERIC_INVITE_ERROR);
      }
    }

    return NextResponse.json({ ok: true, seasonId: result.seasonId });
  } catch (error) {
    // Un conflitto di transazione (due riscatti simultanei) e' previsto e non
    // e' un errore da mostrare: si riprova dal client come una normalita'.
    const code = (error as { code?: number })?.code;
    if (code === 10) {
      return apiError(409, 'INVITE_CONFLICT', 'Qualcuno ha riscattato questo codice in contemporanea. Riprova.');
    }
    console.error('[api/invites/redeem] fallito:', error instanceof Error ? error.message : error);
    return apiError(500, 'INVITE_REDEEM_FAILED', 'Non riesco a usare il codice. Riprova.');
  }
}