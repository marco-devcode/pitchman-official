
"use client";

import { create } from 'zustand';
import { seasonRepository } from '@/lib/repositories/season-repository';
import { activeSeasonRepository } from '@/lib/repositories/active-season-repository';
import type { Season } from '@/lib/types';
import { useAuthStore } from './useAuthStore';
import { getErrorMessage } from '@/lib/error-utils';

interface SeasonsState {
    seasons: Season[];
    activeSeason: Season | null;
    loading: boolean;
    error: string | null;
    fetchAll: () => Promise<void>;
    addSeason: (name: string) => Promise<Season>;
    setActiveSeason: (id: string) => Promise<void>;
    removeSeason: (id: string) => Promise<void>;
    renameSeason: (id: string, name: string) => Promise<void>;
    joinSeason: (id: string) => Promise<void>;
}

export const useSeasonsStore = create<SeasonsState>((set, get) => ({
    seasons: [],
    activeSeason: null,
    loading: true,
    error: null,

    fetchAll: async () => {
        const user = useAuthStore.getState().user;
        if (!user) {
            set({ loading: false, seasons: [], activeSeason: null, error: null });
            return;
        }

        if (get().seasons.length === 0) set({ loading: true, error: null });
        try {
            const active = await seasonRepository.ensureDefaultSeason(user.id);
            const all = await seasonRepository.getAll(user.id);

            // Ordiniamo le stagioni per data di creazione (dalla più recente alla meno recente)
            const sorted = all.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            // Una sola stagione attiva, e la sua identita' viene dalla
            // scelta PERSONALE salvata nel documento utente, non dal campo
            // `isActive` di ogni stagione.
            //
            // Il campo isActive esiste ancora sui documenti delle stagioni ma
            // e' STANTIO: era la sorgente unica quando la stagione non era
            // condivisa, e su piu' stagioni porta a piu' righe con il badge
            // "Attiva" contemporaneamente — perche' nessuno le puliva piu'. La
            // sorgente vera e' activeSeasonId, quindi si DERIVA isActive da
            // qui invece di leggerlo dal documento.
            const activeId = active?.id ?? (sorted.length > 0 ? sorted[0].id : null);
            const seasonsWithActive = sorted.map((s) => ({ ...s, isActive: s.id === activeId }));

            set({
                seasons: seasonsWithActive,
                activeSeason: activeId ? seasonsWithActive.find((s) => s.id === activeId) ?? null : null,
                loading: false,
                error: null,
            });
        } catch (error) {
            console.error("Error fetching seasons:", error);
            set({ loading: false, error: getErrorMessage(error) });
        }
    },

    addSeason: async (name) => {
        const user = useAuthStore.getState().user;
        if (!user) return undefined as unknown as Season;
        // Prevent duplicates: check if a season with this name already exists
        const existing = get().seasons.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            await get().setActiveSeason(existing.id);
            return existing;
        }
        const newSeason = await seasonRepository.add(name, user.id);
        await get().fetchAll();
        return newSeason;
    },

    setActiveSeason: async (id) => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        // Salva nel documento DELL'UTENTE, non su quello della stagione.
        //
        // Il motivo e' che la stagione e' condivisa: scrivere isActive sul suo
        // documento cambierebbe anche la stagione attiva del proprietario, e
        // le regole Firestore negano la scrittura a un ospite perche' puo'
        // toccare solo sharedWith e updatedAt. Quel diniego faceva fallire
        // l'intero fetchAll: la stagione appena unita non compariva in lista.
        // La scelta della stagione attiva e' personale, quindi vive da parte.
        await activeSeasonRepository.set(user.id, id);
        // Update local state immediately (no fetchAll — prefetch handles refresh)
        const sortedSeasons = get().seasons.map((s) => ({ ...s, isActive: s.id === id }));
        const newActive = sortedSeasons.find((s) => s.id === id) || null;
        set({ seasons: sortedSeasons, activeSeason: newActive, loading: false });
    },

    removeSeason: async (id) => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        const wasActive = get().activeSeason?.id === id;
        const remainingBeforeDelete = get().seasons.filter(s => s.id !== id);
        const newActive = wasActive
            ? (remainingBeforeDelete.length > 0 ? remainingBeforeDelete[0] : null)
            : get().activeSeason;

        // 1. Snapshot for rollback
        const previousSeasons = get().seasons;
        const previousActive = get().activeSeason;

        // 2. Update local state IMMEDIATELY — UI responds instantly
        set({ seasons: remainingBeforeDelete, activeSeason: newActive });

        // 3. Try Firestore operations — if anything fails, rollback UI
        try {
            // If deleted season was active, switch the flag to another one.
            // Scrive nel documento dell'utente, non su quello della stagione:
            // la stagione cancellata potrebbe essere condivisa con altri e la
            // scrittura li riguarderebbe. Vedi activeSeasonRepository.
            if (wasActive && remainingBeforeDelete.length > 0) {
                await activeSeasonRepository.set(user.id, remainingBeforeDelete[0].id);
            }
            // Delete all subcollections + season document
            await seasonRepository.delete(id);
        } catch (err: any) {
            console.error("Failed to delete season from Firestore:", err);
            console.error("Error code:", err?.code, "message:", err?.message);
            // Rollback: restore previous UI state
            set({ seasons: previousSeasons, activeSeason: previousActive });
            // Re-throw with detailed message for the UI
            throw new Error(`Delete failed: ${err?.code || 'unknown'} — ${err?.message || 'no message'}`);
        }
    },

    renameSeason: async (id, name) => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        await seasonRepository.rename(id, name);
        await get().fetchAll();
    },

    joinSeason: async (id) => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        await seasonRepository.joinSeason(id, user.id);
        // La stagione appena unita DIVENTA quella attiva.
        //
        // Senza questo l'utente entra nella stagione e si ritrova su un'altra,
        // quella di prima: la app funziona, ma lui sta guardando una stagione
        // vuota e pensa che la condivisione non abbia funzionato. Il codice
        // che ha appena inserito indica esattamente dove voleva andare.
        await activeSeasonRepository.set(user.id, id);
        await get().fetchAll();
    }
}));
