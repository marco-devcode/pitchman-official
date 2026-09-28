'use client';

import { create } from 'zustand';
import {
    presenceRepository,
    PRESENCE_TIMEOUT_MS,
    type PresenceEntry,
} from '@/lib/repositories/presence-repository';

interface PresenceState {
    /** Altri utenti online sulla stagione attiva (io escluso). */
    online: PresenceEntry[];
    /** true se almeno un altro utente e' online. */
    hasOthers: boolean;
    /** true se l'utente ha gia' visto l'avviso in questa sessione (non ripetere). */
    warned: boolean;
    setOnline: (entries: PresenceEntry[]) => void;
    markWarned: () => void;
    reset: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
    online: [],
    hasOthers: false,
    warned: false,
    setOnline: (entries) => set({ online: entries, hasOthers: entries.length > 0 }),
    markWarned: () => set({ warned: true }),
    reset: () => set({ online: [], hasOthers: false, warned: false }),
}));

export { PRESENCE_TIMEOUT_MS };
