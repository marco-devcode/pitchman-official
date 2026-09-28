/**
 * Stagione attiva PER UTENTE.
 *
 * Perche' non puo' stare sul documento della stagione: quel documento e'
 * condiviso fra proprietario e ospiti, quindi un `isActive` li e' condiviso.
 * Se l'ospite attiva una stagione, cambia anche la stagione attiva del
 * proprietario: due allenatori che lavorano su stagioni diverse si pestano
 * i piedi a vicenda. E la scrittura viene negata dalle regole, perche' un
 * membro puo' modificare solo `sharedWith` e `updatedAt`.
 *
 * Quindi: la stagione attiva e' una scelta per UTENTE e vive in
 * `users/{uid}/settings/activeSeason`, fuori dal documento condiviso.
 * I dati (giocatori, partite, presenze) restano sulla stagione: non si tocca
 * niente di esistente.
 */

import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

/**
 * Percorso del documento. `users/{uid}/settings/activeSeason` e' una
 * SOTTOcollezione con dentro un documento.
 *
 * Era `users/{uid}/settings` (il documento direttamente sotto l'utente, senza
 * sottoclezione) e non combaciava con la regola `match /settings/{settingId}`:
 * la richiesta cadeva nel catch-all `allow read, write: if false`, la scrittura
 * veniva negata, l'eccezione attraversava ensureDefaultSeason e faceva fallire
 * fetchAll — quindi NESSUNA stagione per nessuno. Il path e' qui in una
 * costante sola perche' la regola e' il contratto: se i due divergono, si
 * rompe tutto senza che nessun errore lo dica.
 */
const ACTIVE_SEASON_COLLECTION = 'settings';
const ACTIVE_SEASON_DOC = 'activeSeason';

export const activeSeasonRepository = {
    /** Ritorna l'id della stagione attiva per QUESTO utente, o null. */
    async get(userId: string): Promise<string | null> {
        if (!userId) return null;
        try {
            const snap = await getDoc(
                doc(getFirestore(), 'users', userId, ACTIVE_SEASON_COLLECTION, ACTIVE_SEASON_DOC)
            );
            if (!snap.exists()) return null;
            const id = snap.data()?.seasonId;
            return typeof id === 'string' && id.length > 0 ? id : null;
        } catch (e) {
            // NON deve propagare: questa e' una preferenza, non un dato
            // necessario. Se la lettura fallisce si torna a 'nessuna scelta
            // salvata' e si ripiega sulla stagione piu' recente.
            console.warn('[activeSeason] lettura non riuscita, uso il fallback:', e);
            return null;
        }
    },

    /**
     * Salva la stagione attiva di questo utente.
     *
     * Non solleva: e' una preferenza, e un errore qui non deve impedire di
     * usare l'app. Il fallback in ensureDefaultSeason fa scegliere comunque
     * una stagione per questa sessione.
     */
    async set(userId: string, seasonId: string): Promise<void> {
        if (!userId || !seasonId) return;
        try {
            await setDoc(
                doc(getFirestore(), 'users', userId, ACTIVE_SEASON_COLLECTION, ACTIVE_SEASON_DOC),
                { seasonId, updatedAt: new Date().toISOString() },
                { merge: true }
            );
        } catch (e) {
            console.warn('[activeSeason] scrittura non riuscita:', e);
        }
    },
};
