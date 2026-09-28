import { db, type SyncMutation } from './db';
import { lineupRepository } from './repositories/lineup-repository';
import { eventRepository } from './repositories/event-repository';
import { playerRepository } from './repositories/player-repository';
import { matchRepository } from './repositories/match-repository';
import { statsRepository } from './repositories/stats-repository';
import { countGoals } from './goal-utils';
/**
 * Queue a mutation when the device is offline. The mutation is persisted in
 * Dexie and flushed to Firestore when connectivity returns.
 */
export async function enqueueMutation(m: Omit<SyncMutation, 'id' | 'createdAt'>): Promise<void> {
  await db.syncQueue.add({ ...m, createdAt: Date.now() });
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Flush all queued mutations to Firestore in creation order. Only collections
 * that have an explicit offline mapping are applied; others are dropped with a
 * warning (they can be wired progressively). A failing mutation is kept in the
 * queue so one bad write doesn't block the rest. Returns mutations applied.
 */
export async function flushQueue(userId: string): Promise<number> {
  const pending = await db.syncQueue.orderBy('createdAt').toArray();
  if (pending.length === 0) return 0;

  let applied = 0;
  for (const mutation of pending) {
    try {
      if (mutation.collection === 'matchLineups') {
        // payload already includes matchId; repository signature: save(data, seasonId, userId)
        await lineupRepository.save(mutation.payload as any, mutation.seasonId!, userId);
      } else if (mutation.collection === 'matchEvents') {
        // eventRepository signatures:
        //   add(event, seasonId, userId)        -> event.matchId required
        //   update(id, matchId, seasonId, data)
        //   delete(id, matchId, seasonId)
        const payload = mutation.payload as any;
        if (mutation.action === 'add') {
          await eventRepository.add(payload, mutation.seasonId!, userId);
        } else if (mutation.action === 'update') {
          await eventRepository.update(mutation.docId, mutation.matchId!, mutation.seasonId!, payload);
        } else if (mutation.action === 'delete') {
          await eventRepository.delete(mutation.docId, mutation.matchId!, mutation.seasonId!);
        }
      } else if (mutation.collection === 'players') {
        // playerRepository.update(id, seasonId, updates)
        await playerRepository.update(mutation.docId, mutation.seasonId!, mutation.payload as any);
      } else if (mutation.collection === 'matches') {
        // matchRepository.update(id, seasonId, updates)
        await matchRepository.update(mutation.docId, mutation.seasonId!, mutation.payload as any);
      } else if (mutation.collection === 'playerMatchStats') {
        // statsRepository.upsert(matchId, seasonId, playerId, stats, userId)
        if (!mutation.matchId || !mutation.playerId) {
          console.warn('[sync] dropping playerMatchStats mutation missing matchId/playerId');
        } else {
          await statsRepository.upsert(mutation.matchId, mutation.seasonId!, mutation.playerId, mutation.payload as any, userId);
        }
      } else {
        // Not yet wired for offline — drop to avoid applying with wrong signature
        console.warn(`[sync] dropping unhandled offline mutation for ${mutation.collection}`);
      }
      await db.syncQueue.delete(mutation.id!);
      applied++;
    } catch (e) {
      console.error('[sync] mutation failed, keeping in queue', mutation, e);
    }
  }
  await recalcResultsForTouchedMatches(userId, pending);
  return applied;
}

/**
 * Ricalcola e scrive il risultato delle partite toccate dalla coda.
 *
 * Finche' la coda scrive solo gli eventi, il risultato resta indietro: la
 * partita mostra i gol corretti dentro (arrivano dalla coda) ma il calendario
 * continua a leggere il campo `result` salvato, che non e' mai stato
 * aggiornato. Il sintomo e' "il gol c'e' ma fuori non si vede", che e'
 * indistinguibile da una scrittura fallita.
 *
 * Il risultato e' derivato: si conta dagli eventi, che sono la fonte di
 * verita'. Non e' un quarto campo da mantenere allineato a mano.
 *
 * Va fatto DOPO il ciclo di flush, non dentro: cosi' conta gli eventi di tutte
 * le mutazioni applicate, non solo gli ultimi.
 */
async function recalcResultsForTouchedMatches(
  userId: string,
  appliedMutations: Array<Omit<SyncMutation, 'id'> & { id?: number }>
): Promise<void> {
  const byKey = new Map<string, { matchId: string; seasonId: string }>();
  for (const m of appliedMutations) {
    // Solo gli eventi incidono sul risultato: formazione, presenze e
    // statistiche non cambiano i gol segnati.
    if (m.collection !== 'matchEvents') continue;
    if (!m.matchId || !m.seasonId) continue;
    byKey.set(`${m.seasonId}/${m.matchId}`, { matchId: m.matchId, seasonId: m.seasonId });
  }

  for (const { matchId, seasonId } of byKey.values()) {
    try {
      const [match, events] = await Promise.all([
        matchRepository.getById(matchId, seasonId),
        eventRepository.getForMatch(matchId, seasonId, userId),
      ]);
      // Nessun gol registrato: il risultato salvato e' l'unica fonte (puo'
      // essere stato inserito a mano) e non va toccato. Un'ammonizione o una
      // sostituzione non sono gol e non devono azzerare un punteggio digitato.
      if (!match || !events || events.length === 0) continue;
      const conGol = events.some(e => e.type === 'goal' || e.type === 'own_goal');
      if (!conGol) continue;
      const { home, away } = countGoals(events);
      const salvato = match.result;
      if (salvato && salvato.home === home && salvato.away === away) continue;
      await matchRepository.update(matchId, seasonId, { result: { home, away } });
    } catch (e) {
      console.error('[sync] ricalcolo risultato fallito', matchId, e);
    }
  }
}

/**
 * Wire online/offline listeners. Flushes the queue when the browser regains
 * connectivity. Returns a cleanup function.
 */
export function startSyncListeners(userId: string): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => {
    flushQueue(userId).then((n) => {
      if (n > 0) console.info(`[sync] flushed ${n} offline mutation(s)`);
    });
  };
  window.addEventListener('online', onOnline);
  // Attempt an initial flush in case we loaded already online with a backlog
  onOnline();
  return () => window.removeEventListener('online', onOnline);
}
