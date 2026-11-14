
import Dexie, { type EntityTable } from 'dexie';

export type SyncMutation = {
  id?: number;
  collection: 'players' | 'matches' | 'playerMatchStats' | 'matchLineups' | 'matchEvents' | 'seasons' | 'scouts';
  docId: string;
  action: 'add' | 'update' | 'delete' | 'upsert';
  payload: unknown;
  userId?: string;
  seasonId?: string;
  matchId?: string;
  playerId?: string;
  createdAt: number;
};

class PitchManDB extends Dexie {
    syncQueue!: EntityTable<SyncMutation, 'id'>;

    constructor() {
        super('PitchManDB');
        // Versione 9: Schema storico multi-tabella (mantenuto per compatibilità upgrade)
        this.version(9).stores({
            players: 'id, userId, seasonId, name',
            matches: 'id, userId, seasonId, date, status',
            matchAttendances: '[matchId+playerId], matchId, status',
            playerMatchStats: '[matchId+playerId], matchId',
            matchLineups: 'matchId',
            matchEvents: 'id, matchId, playerId, type',
            seasons: 'id, userId, isActive'
        });
        // Versione 10: Coda di sincronizzazione offline
        this.version(10).stores({
            syncQueue: '++id, collection, docId, createdAt'
        });
        // Versione 11: Cache entità affidata a Firestore persistentLocalCache + Zustand persist; Dexie conserva solo syncQueue
        this.version(11).stores({
            players: null,
            matches: null,
            matchAttendances: null,
            playerMatchStats: null,
            matchLineups: null,
            matchEvents: null,
            seasons: null
        });
    }
}

export const db = new PitchManDB();
