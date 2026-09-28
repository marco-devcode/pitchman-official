/**
 * Presence: chi e' online su una stagione condivisa.
 *
 * Un documento per utente in `teams/{seasonId}/presence/{uid}`, con un solo
 * campo `lastSeen`. Un `onSnapshot` su quella collezione restituisce chi c'e'
 * e si aggiorna da solo quando qualcuno entra o esce, senza refresh.
 *
 * Il cuore e' l'HEARTBEAT, non il listener: Firestore non ha un notion di
 * "connesso", quindi l'utente e' online se ha scritto negli ultimi N secondi.
 * Il battito viene inviato subito all'avvio, poi ogni HEARTBEAT_MS, e
 * l'uscita e' esplicita (beforeunload / visibilitychange) per non aspettare la
 * scadenza.
 *
 * Nota sui limiti, da non confondere:
 * - Dice che l'app e' APERTA, non che la persona sta guardando la partita
 *   che stai modificando. L'avviso e' utile, non e' un blocco.
 * - La soglia e' un compromesso: troppo breve e un utente con rete lenta
 *   sembra offline, troppo lunga e resta "online" dopo la chiusura.
 */

import {
    collection, doc, setDoc, deleteDoc, onSnapshot,
    getFirestore, type Unsubscribe,
} from 'firebase/firestore';

/** Battito ogni 20s: abbastanza fitto da non sparire, non tanto da fare sprechi. */
const HEARTBEAT_MS = 20_000;
/** Dopo quanti secondi senza battito l'utente e' considerato offline. */
export const PRESENCE_TIMEOUT_MS = 55_000;

export interface PresenceEntry {
    uid: string;
    lastSeen: number;
}

export const presenceRepository = {
    /** Scrive il proprio battito. `merge` evita di creare il doc a ogni tick. */
    async touch(seasonId: string, uid: string): Promise<void> {
        if (!seasonId || !uid) return;
        await setDoc(
            doc(getFirestore(), 'teams', seasonId, 'presence', uid),
            { lastSeen: Date.now() },
            { merge: true }
        );
    },

    /** Uscita esplicita: cancella il proprio documento. */
    async leave(seasonId: string, uid: string): Promise<void> {
        if (!seasonId || !uid) return;
        try {
            await deleteDoc(doc(getFirestore(), 'teams', seasonId, 'presence', uid));
        } catch (e) {
            // Se la rete e' gia' caduta non c'e' niente da fare: la soglia
            // di PRESENCE_TIMEOUT_MS copre il caso. Non deve interrompere
            // l'uscita dell'utente con un errore.
            console.warn('[presence] uscita non riuscita:', e);
        }
    },

    /**
     * Avvia il battito e restituisce la funzione di teardown.
     *
     * `onHiddenChange` permette di NON scrivere il battito quando la scheda e'
     * in background: un utente che ha l'app aperta ma non la sta guardando non
     * deve generare un avviso "un altro allenatore e' qui" agli altri. E'
     * anche il comportamento giusto: risparmia una scrittura ogni 20s.
     */
    startHeartbeat(
        seasonId: string,
        uid: string,
        onHiddenChange?: (hidden: boolean) => void
    ): () => void {
        if (!seasonId || !uid) return () => {};

        const beat = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            this.touch(seasonId, uid).catch((e) => {
                console.warn('[presence] battito non riuscito:', e);
            });
        };

        const onVisibility = () => {
            const hidden = document.visibilityState === 'hidden';
            onHiddenChange?.(hidden);
            if (hidden) {
                // Esci subito: non e' piu' "qui", e far aspettare gli altri
                // 55s sarebbe un avviso falso.
                this.leave(seasonId, uid);
            } else {
                beat();
            }
        };

        const onUnload = () => { this.leave(seasonId, uid); };

        beat();
        const interval = setInterval(beat, HEARTBEAT_MS);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('beforeunload', onUnload);
        window.addEventListener('pagehide', onUnload);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('beforeunload', onUnload);
            window.removeEventListener('pagehide', onUnload);
            this.leave(seasonId, uid);
        };
    },

    /**
     * Ascolta chi e' online. `onChange` riceve gli utenti VIVI al momento
     * della chiamata, escluso quello indicato in `selfUid`.
     */
    subscribe(
        seasonId: string,
        selfUid: string,
        onChange: (online: PresenceEntry[]) => void,
        onError?: (e: unknown) => void
    ): Unsubscribe {
        if (!seasonId) return () => {};
        const ref = collection(getFirestore(), 'teams', seasonId, 'presence');
        return onSnapshot(
            ref,
            (snapshot) => {
                const now = Date.now();
                const online: PresenceEntry[] = [];
                snapshot.forEach((d) => {
                    const uid = d.id;
                    const lastSeen = d.data()?.lastSeen;
                    if (uid === selfUid) return;
                    if (typeof lastSeen !== 'number') return;
                    if (now - lastSeen > PRESENCE_TIMEOUT_MS) return;
                    online.push({ uid, lastSeen });
                });
                onChange(online);
            },
            (err) => {
                console.error('[presence] onSnapshot error:', err);
                onError?.(err);
            }
        );
    },
};
