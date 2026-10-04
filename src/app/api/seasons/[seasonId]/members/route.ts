import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, requireSeasonMember, roleOf } from '@/lib/server/auth';

export const runtime = 'nodejs';

/**
 * GET /api/seasons/[seasonId]/members — chi partecipa alla stagione.
 *
 * STA QUI e non in `members/[uid]/route.ts`. Quello e' un percorso con un
 * parametro: in Next.js ogni metodo dentro `[uid]` vale per TUTTI gli uid, quindi
 * `GET /members` (senza uid) non ci arriva — rispondeva 404. Il pannello Staff
 * non avrebbe caricato nulla, senza nessun errore in console se non quello.
 *
 * I nomi si prendono dai documenti utente. Nessun dato della squadra passa di
 * qui: sono solo nome, email e ruolo, il minimo per riconoscere chi c'e'.
 *
 * `mioUid` serve al bottone "Esci dalla stagione": senza, il client dovrebbe
 * indovinare quale membro e' chi guarda, e puo' sbagliare. Viene dal token.
 */
export async function GET(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId);
  if (!member.ok) return member.response;

  const uids = new Set<string>();
  if (member.season.ownerId) uids.add(member.season.ownerId);
  for (const u of Object.keys(member.season.members ?? {})) uids.add(u);
  for (const u of member.season.memberUids ?? []) uids.add(u);
  for (const u of member.season.sharedWith ?? []) uids.add(u);

  const members = await Promise.all(
    [...uids].map(async (uid) => {
      let displayName: string | undefined;
      let email: string | undefined;
      try {
        const snap = await adminDb!.collection('users').doc(uid).get();
        displayName = snap.data()?.displayName ?? snap.data()?.username ?? undefined;
        email = snap.data()?.email ?? undefined;
      } catch {
        // Un utente senza documento profilo e' comunque membro: si mostra
        // l'uid, non si nasconde.
      }
      return { uid, role: roleOf(member.season, uid) ?? 'staff', displayName, email };
    }),
  );

  return NextResponse.json({ members, myRole: member.role, mioUid: auth.uid });
}
