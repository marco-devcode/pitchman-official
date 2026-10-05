import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { accountRoleOf, requireAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';

/**
 * GET /api/director/seasons — le stagioni condivise col direttore, con i
 * riassunti che il suo mestiere richiede.
 *
 * PERCHE' UNA ROUTE E NON UNA QUERY CLIENT. Il direttore e' dentro
 * `directorUids`, che e' una lista di uid dentro il documento stagione. Firestore
 * non sa chiedere "le stagioni che contengono il mio uid in questa lista" con
 * una query dal client: servirebbe un indice composito per ogni possibile
 * posizione nella lista. Con l'Admin SDK la query `array-contains` su
 * `directorUids` funziona ed e' una sola.
 *
 * PERCHE' IL SERVER, E NON LE RULES. Anche se il client potesse elencare le
 * stagioni, i contaggi (quanti giocatori, quanti infortunati) richiedono di
 * contare i documenti figli: una `list` client su `players` scaricherebbe
 * l'intera rosa per contarla. Qui si conta sul server e si restituisce il numero.
 *
 * COSA NON VIENE LETTO, e' una scelta: partite, eventi, presenze, test fisici.
 * Il direttore valuta chi c'e' e chi e' osservato; il resto e' il lavoro
 * dell'allenatore e non gli serve. Leggerlo qui sarebbe un allargamento dei
 * permessi che nessuno ha chiesto.
 */

type Riassunto = {
  seasonId: string;
  name: string;
  ownerId: string;
  /** Rosa: un nome per ruolo, come la vede l'allenatore. */
  rosa: { nome: string; ruolo: string; infortunato: boolean }[];
  /** Totale rosa, per il numero in grande. */
  totRosa: number;
  /** Osservati non ancora promossi in rosa. */
  osservati: { nome: string; ruolo: string; squadra: string }[];
  /** Infortunati attivi al giorno di oggi (o con infortunio senza data fine). */
  infortunati: number;
  /** Calcolato lato server: il client non sa quando e' scaduto un infortunio. */
  aggiornatoIl: string;
};

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) {
    return NextResponse.json({ error: 'Configurazione del server incompleta.' }, { status: 500 });
  }

  // Solo i direttori. Un developer non e' direttore: vede tutto perche' puo',
  // ma questa schermata risponde a una domanda diversa e non deve essere il suo
  // modo per guardare i dati delle squadre.
  const role = await accountRoleOf(auth.uid);
  if (role !== 'director') {
    return NextResponse.json(
      { error: 'Questa sezione e\' riservata ai direttori sportivi.' },
      { status: 403 },
    );
  }

  try {
    const stagioni = await adminDb
      .collection('teams')
      .where('directorUids', 'array-contains', auth.uid)
      .get();

    const oggi = new Date().toISOString().slice(0, 10);
    const riassunti: Riassunto[] = [];

    for (const snap of stagioni.docs) {
      const data = snap.data() as {
        name?: string;
        ownerId?: string;
        playerCount?: number;
      };

      const playersSnap = await adminDb.collection('teams').doc(snap.id).collection('players').get();
      const scoutsSnap = await adminDb.collection('teams').doc(snap.id).collection('scouts').get();

      const rosa = playersSnap.docs.map((d) => {
        const p = d.data() as {
          firstName?: string;
          lastName?: string;
          name?: string;
          role?: string;
          injuries?: { startDate?: string; endDate?: string }[];
        };
        const nome = [p.lastName, p.firstName].filter(Boolean).join(' ').trim() || p.name || '';
        // Infortunato se un intervallo non e' ancora scaduto. Un infortunio con
        // `endDate` vuota o futura conta; uno passato no.
        const infortunato = (p.injuries ?? []).some(
          (i) => !i.endDate || i.endDate >= oggi,
        );
        return { nome, ruolo: p.role ?? '—', infortunato };
      });

      rosa.sort((a, b) => a.nome.localeCompare(b.nome));

      const osservati = scoutsSnap.docs
        .map((d) => {
          const s = d.data() as { name?: string; role?: string; currentTeam?: string };
          return {
            nome: s.name ?? '',
            ruolo: s.role ?? '—',
            squadra: s.currentTeam ?? '',
          };
        })
        .filter((s) => s.nome !== '')
        .sort((a, b) => a.nome.localeCompare(b.nome));

      riassunti.push({
        seasonId: snap.id,
        name: data.name ?? 'Senza nome',
        ownerId: data.ownerId ?? '',
        rosa,
        totRosa: rosa.length,
        osservati,
        infortunati: rosa.filter((p) => p.infortunato).length,
        aggiornatoIl: new Date().toISOString(),
      });
    }

    riassunti.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ seasons: riassunti });
  } catch (error) {
    console.error('[api/director/seasons] fallito:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Non riesco a leggere le squadre condivise. Riprova.' },
      { status: 500 },
    );
  }
}