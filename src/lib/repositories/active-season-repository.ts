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

const ACTIVE_SEASON_DOC = 'settings';

export const activeSeasonRepository = {
    /** Ritorna l'id della stagione attiva per QUESTO utente, o null. */
    async get(userId: string): Promise<string | null> {
        if (!userId) return null;
        try {
            const snap = await getDoc(doc(getFirestore(), 'users', userId, ACTIVE_SEASON_DOC));
            if (!snap.exists()) return null;
            const id = snap.data()?.seasonId;
            return typeof id === 'string' && id.length > 0 ? id : null;
        } catch (e) {
            console.error('[activeSeason] lettura fallita:', e);
            return null;
        }
    },

    /**
     * Salva la stagione attiva di questo utente.
     *
     * Write non è molto رسمي: scrive nel proprio documento, che le regole
     * autorizzano (isOwner(userId)). Non tocca il documento della stagione,
     * quindi non puo' essere negato per "non sono il proprietario".
     */
    async set(userId: string, seasonId: string): Promise<void> {
        if (!userId || !seasonId) return;
        await setDoc(
            doc(getFirestore(), 'users', userId, ACTIVE_SEASON_DOC),
            { seasonId, updatedAt: new Date().toISOString() },
            { merge: true }
        );
    },
};
