
import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Player, Match, PlayerMatchStats, MatchLineup, MatchEvent, Season } from './types';

export type SyncMutation = {
  id?: number;
  collection: 'players' | 'matches' | 'playerMatchStats' | 'matchLineups' | 'matchEvents' | 'seasons';
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
    players!: EntityTable<Player, 'id'>;
    matches!: EntityTable<Match, 'id'>;
    playerMatchStats!: Table<PlayerMatchStats, [string, string]>;
    matchLineups!: EntityTable<MatchLineup, 'matchId'>;
    matchEvents!: EntityTable<MatchEvent, 'id'>;
    seasons!: EntityTable<Season, 'id'>;
    syncQueue!: EntityTable<SyncMutation, 'id'>;

    constructor() {
        super('PitchManDB');
        // Versione 9: Aggiunta tabella matchLineups mancante e supporto multi-utente
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
        // Versione 11: Rimozione tabella morta matchAttendances
        this.version(11).stores({
            matchAttendances: null
        });
    }
}

export const db = new PitchManDB();
