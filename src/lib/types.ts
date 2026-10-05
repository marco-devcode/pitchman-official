import { MATCH_FORMATIONS } from './formation-modules';
import type { TacticalExercise } from './tactical-exercise';
import type { PlanId } from './plans';

export type AccountRole = 'developer' | 'director' | 'coach' | 'player';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: AccountRole;
  /**
   * Piano di ABBONAMENTO dell'account, deciso dal backend (non dall'utente).
   *
   * Distinto dal `plan` che sta sul documento STAGIONE: quello e' la copia dei
   * limiti applicata a una stagione specifica, e serve perche' le Firestore
   * rules non possono fare query su un'altra collection. Questo e' la fonte di
   * verita' del piano dell'account, letta dal client per cosa mostrare e dai
   * server per i controlli.
   *
   * ASSENTE non significa free: `normalizePlan` (in `lib/plans.ts`) mappa
   * qualunque valore sconosciuto, `undefined` compreso, a `beta`. Un campo
   * assente lascia quindi tutti col massimo di permessi, mai senza accesso.
   */
  plan?: PlanId;
  teamIds?: string[];
  linkedPlayerId?: string;
  createdAt: string;
  updatedAt: string;
}

export const ROLES = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'] as const;
export type Role = typeof ROLES[number];

// ── Italian Nomenclature Roles ──────────────────────────────
export type PlayerRole =
  | 'POR'
  | 'DC' | 'TD' | 'TS' | 'ADA' | 'ASA'
  | 'CDC' | 'TRQ' | 'CD' | 'CS'
  | 'AD' | 'AS' | 'ATT';

export type RoleCategory = 'POR' | 'DIF' | 'CEN' | 'ATT';

export const ALL_ROLES: PlayerRole[] = [
  'POR',
  'DC', 'TD', 'TS', 'ADA', 'ASA',
  'CDC', 'TRQ', 'CD', 'CS',
  'AD', 'AS', 'ATT',
];

export const ROLE_CATEGORIES: Record<RoleCategory, PlayerRole[]> = {
  POR: ['POR'],
  DIF: ['DC', 'TD', 'TS', 'ADA', 'ASA'],
  CEN: ['CDC', 'TRQ', 'CD', 'CS'],
  ATT: ['AD', 'AS', 'ATT'],
};

export const ROLE_LABELS: Record<PlayerRole, string> = {
  POR: 'Portiere',
  DC:  'Difensore Centrale',
  TD:  'Terzino Destro',
  TS:  'Terzino Sinistro',
  ADA: 'Ala Destra Arretrata',
  ASA: 'Ala Sinistra Arretrata',
  CDC: 'Centrocampista Centrale',
  TRQ: 'Trequartista',
  CD:  'Centrocampista Destro',
  CS:  'Centrocampista Sinistro',
  AD:  'Ala Destra',
  AS:  'Ala Sinistra',
  ATT: 'Attaccante',
};

export const ROLE_CATEGORY_LABELS: Record<RoleCategory, string> = {
  POR: 'Portiere',
  DIF: 'Difensori',
  CEN: 'Centrocampisti',
  ATT: 'Attaccanti',
};

export const ROLE_CATEGORY_COLORS: Record<RoleCategory, string> = {
  POR: '#fbbf24',
  DIF: '#00e5a0',
  CEN: '#3b82f6',
  ATT: '#ef4444',
};

// ── Formation Modules ──────────────────────────────────────

export type FormationModule = '4-3-3' | '4-2-3-1' | '4-4-2' | '3-5-2' | '3-4-2-1' | '3-4-3' | '3-4-1-2' | '4-3-1-2';

// Elenco canonico dei moduli: unica fonte per la rosa E per la partita.
// Vive in formation-modules.ts (file base senza dipendenze) perche' types.ts
// e lineup-mapping.ts si referenziano fra loro: mettere la lista in uno dei
// due creerebbe un ciclo di import e l'assertion cross-map, che usa require
// lazy, salterebbe in silenzio.
//
// Prima erano due liste indipendenti che divergevano — il 3-4-3 c'era in rosa
// e non in partita, il 4-3-1-2 il contrario — e in partita la lista era
// hardcoded in TRE file (match-lineup-tab, un dialog di lineup rimosso,
// smart-lineup-dialog), quindi bastava dimenticarsi uno per avere un modulo
// disponibile in meta' dell'app.
// Riferimento diretto, non una copia: una copia ([...MATCH_FORMATIONS])
// continuerebbe a poter divergere dalla lista canonica in silenzio, che e'
// esattamente il difetto che questo refactor elimina.
export const FORMATIONS: FormationModule[] = MATCH_FORMATIONS;

// Alias per i componenti di partita, che parlano di "moduli" e non di rosa:
// importarli da qui rende chiaro che la lista e' condivisa, non una copia.
export { MATCH_FORMATIONS, type MatchFormation } from './formation-modules';

// Unica copia dei RUOLI: vedi FORMATION_ROLES piu' in basso. Nessun ciclo:
// lineup-mapping importa solo formation-modules, che non importa nulla.
import { FORMATION_SLOT_ROLES } from './lineup-mapping';

export const DEFAULT_FORMATION: FormationModule = '4-3-3';

/**
 * Ruoli di ogni formazione, nell'ordine dei slot.
 *
 * Non li ripeto: vengono da `lineup-mapping.FORMATION_POSITIONS`, che e' l'unica
 * copia. Erano due tavole identiche in due moduli, e la regola del progetto e'
 * che i due schermi non devono contraddirsi sul ruolo di uno slot — quindi due
 * copie non erano una ridondanza, erano una divergenza che aspettava di
 * succedere (era gia' successo sul 4-3-1-2 e sul 3-5-2).
 *
 * `scripts/verify-formations.ts` confronta le due copie voce per voce: dopo
 * questa modifica la verifica deve dire che coincidono per costruzione.
 *
 * NOTA: le COORDINATE qui sotto NON vengono da lineup-mapping, e non devono.
 * Sono diverse in tutte e otto le formazioni di proposito — la rosa e' una
 * vista di copertura, il campo partita e' il posizionamento tattico. Sono
 * l'unica duplicazione che va tenuta, e per questo il nome dice `SLOT`.
 */
// CS = Centrocampista Sinistro (sta a sinistra), CD = Centrocampista Destro
export const FORMATION_ROLES: Record<FormationModule, PlayerRole[]> =
  FORMATION_SLOT_ROLES as Record<FormationModule, PlayerRole[]>;

/**
 * Dove cade ogni slot, in percentuale, per il campo della ROSA.
 *
 * Queste coordinate sono diverse da quelle di `lineup-mapping` in tutte e otto
 * le formazioni, di proposito: qui la rosa e' una vista di copertura, li'
 * formation-mapping il posizionamento tattico reale. Non vanno unificate.
 *
 * Il nome dice COORDS per non confonderlo con i ruoli: il vecchio nome era
 * `FORMATION_POSITIONS`, identico a quello della tabella dei RUOLI in
 * lineup-mapping, e i due contenuti non avevano niente in comune.
 */
export interface SlotPosition { top: string; left: string }

export const FORMATION_SLOT_COORDS: Record<FormationModule, SlotPosition[]> = {
  '4-3-3': [
    { top: '90%', left: '50%' },  // POR
    { top: '72%', left: '15%' },  // TS (sinistra)
    { top: '75%', left: '35%' },  // DC sx
    { top: '75%', left: '65%' },  // DC dx
    { top: '72%', left: '85%' },  // TD (destra)
    { top: '52%', left: '28%' },  // CD (sx)
    { top: '55%', left: '50%' },  // CDC (centro) abbassato
    { top: '52%', left: '72%' },  // CS (dx)
    { top: '25%', left: '20%' },  // AS (sinistra)
    { top: '12%', left: '50%' },  // ATT (centro)
    { top: '25%', left: '80%' },  // AD (destra)
  ],
  '4-2-3-1': [
    { top: '90%', left: '50%' },  // POR
    { top: '72%', left: '15%' },  // TS (sinistra)
    { top: '75%', left: '35%' },  // DC sx
    { top: '75%', left: '65%' },  // DC dx
    { top: '72%', left: '85%' },  // TD (destra)
    { top: '58%', left: '38%' },  // CD sx
    { top: '58%', left: '62%' },  // CDC dx
    { top: '35%', left: '20%' },  // AS (sinistra)
    { top: '35%', left: '50%' },  // TRQ centrale
    { top: '35%', left: '80%' },  // AD (destra)
    { top: '15%', left: '50%' },  // ATT punta
  ],
  '4-4-2': [
    { top: '90%', left: '50%' },  // POR
    { top: '72%', left: '15%' },  // TS (sinistra)
    { top: '75%', left: '35%' },  // DC sx
    { top: '75%', left: '65%' },  // DC dx
    { top: '72%', left: '85%' },  // TD (destra)
    { top: '52%', left: '18%' },  // AS (sinistra)
    { top: '52%', left: '38%' },  // CDC sx
    { top: '52%', left: '62%' },  // CDC dx
    { top: '52%', left: '82%' },  // AD (destra)
    { top: '18%', left: '38%' },  // ATT sx
    { top: '18%', left: '62%' },  // ATT dx
  ],
  '3-5-2': [
    { top: '90%', left: '50%' },  // POR
    { top: '75%', left: '28%' },  // DC sx
    { top: '78%', left: '50%' },  // DC centro
    { top: '75%', left: '72%' },  // DC dx
    { top: '55%', left: '12%' },  // ASA (sinistra)
    { top: '52%', left: '30%' },  // CS (sx) — CS = centrocampista SINISTRO
    { top: '52%', left: '50%' },  // CDC (centro) abbassato
    { top: '52%', left: '70%' },  // CD (dx) — CD = centrocampista DESTRO
    { top: '55%', left: '88%' },  // ADA (destra)
    { top: '18%', left: '38%' },  // ATT sx
    { top: '18%', left: '62%' },  // ATT dx
  ],
  '3-4-2-1': [
    { top: '90%', left: '50%' },  // POR
    { top: '75%', left: '28%' },  // DC sx
    { top: '78%', left: '50%' },  // DC centro
    { top: '75%', left: '72%' },  // DC dx
    { top: '55%', left: '12%' },  // ASA (sinistra)
    { top: '52%', left: '32%' },  // CD sx
    { top: '52%', left: '68%' },  // CS dx
    { top: '55%', left: '88%' },  // ADA (destra)
    { top: '35%', left: '38%' },  // TRQ sx
    { top: '35%', left: '62%' },  // TRQ dx
    { top: '15%', left: '50%' },  // ATT punta
  ],
  '3-4-3': [
    { top: '90%', left: '50%' },  // POR
    { top: '75%', left: '28%' },  // DC sx
    { top: '78%', left: '50%' },  // DC centro
    { top: '75%', left: '72%' },  // DC dx
    { top: '55%', left: '12%' },  // ASA (sinistra)
    { top: '52%', left: '32%' },  // CD sx
    { top: '52%', left: '68%' },  // CS dx
    { top: '55%', left: '88%' },  // ADA (destra)
    { top: '25%', left: '20%' },  // AS (sinistra)
    { top: '12%', left: '50%' },  // ATT (centro)
    { top: '25%', left: '80%' },  // AD (destra)
  ],
  '3-4-1-2': [
    { top: '90%', left: '50%' },  // POR
    { top: '75%', left: '28%' },  // DC sx
    { top: '78%', left: '50%' },  // DC centro
    { top: '75%', left: '72%' },  // DC dx
    { top: '55%', left: '12%' },  // ASA (sinistra)
    { top: '52%', left: '32%' },  // CD sx
    { top: '52%', left: '68%' },  // CS dx
    { top: '55%', left: '88%' },  // ADA (destra)
    { top: '35%', left: '50%' },  // TRQ (centro)
    { top: '15%', left: '35%' },  // ATT sx
    { top: '15%', left: '65%' },  // ATT dx
  ],
  '4-3-1-2': [
    { top: '90%', left: '50%' },  // POR
    { top: '72%', left: '15%' },  // TS (sinistra)
    { top: '75%', left: '35%' },  // DC sx
    { top: '75%', left: '65%' },  // DC dx
    { top: '72%', left: '85%' },  // TD (destra)
    { top: '55%', left: '25%' },  // CS (sx)
    { top: '60%', left: '50%' },  // CDC (centro) davanti alla difesa
    { top: '55%', left: '75%' },  // CD (dx)
    { top: '35%', left: '50%' },  // TRQ (centro)
    { top: '15%', left: '35%' },  // ATT sx
    { top: '15%', left: '65%' },  // ATT dx
  ],
};

/**
 * Le due mappe di formazione (questa e lineup-mapping.ts) dovevano concordare
 * sugli ACRONIMI di ogni slot. Non e' piu' necessario: i ruoli hanno una sola
 * copia, `FORMATION_SLOT_ROLES` in lineup-mapping, e `FORMATION_ROLES` qui ne
 * e' un semplice alias. L'asserzione che controllava la concordanza e' stata
 * tolta perche' confrontava un valore con se stesso: non poteva piu' fallire,
 * e una verifica che non puo' fallire e' peggio di nessuna, perche' sembra
 * garantire ancora qualcosa.
 *
 * Le COORDINATE restano due tabelle distinte, e devono restarlo: la rosa e' una
 * vista di copertura, il campo partita il posizionamento tattico.
 */

export function getRoleCategory(role: PlayerRole): RoleCategory {
  for (const [cat, roles] of Object.entries(ROLE_CATEGORIES) as [RoleCategory, PlayerRole[]][]) {
    if (roles.includes(role)) return cat;
  }
  return 'CEN';
}

// ── Migration helpers ──────────────────────────────────────
// Mappa i valori storici (etichette italiane lunghe, abbreviazioni legacy
// DCD/DCS/CCD/CCS) ai ruoli canonici. Sono incluse anche le chiavi identitarie
// dei ruoli canonici stessi: senza, migrateRole('TS') cadeva nel fallback e
// restituiva 'CDC', facendo consigliare i mediani al posto di terzini e
// difensori centrali.
const MIGRATION_MAP: Record<string, PlayerRole> = {
  // Canonici (identità)
  'POR': 'POR', 'DC': 'DC', 'TD': 'TD', 'TS': 'TS',
  'ADA': 'ADA', 'ASA': 'ASA',
  'CDC': 'CDC', 'TRQ': 'TRQ', 'CD': 'CD', 'CS': 'CS',
  'AD': 'AD', 'AS': 'AS', 'ATT': 'ATT',

  // Etichette italiane lunghe
  'Portiere': 'POR', 'portiere': 'POR',
  'Difensore Centrale': 'DC', 'Difensore': 'DC',
  'Terzino Destro': 'TD', 'Terzino Destro ': 'TD',
  'Terzino Sinistro': 'TS',
  'Ala Destra': 'ADA', 'Ala Sinistra': 'ASA',
  'Mediano': 'CDC', ' mediano': 'CDC',
  'Trequartista': 'TRQ',
  'Attaccante': 'ATT', 'attaccante': 'ATT',

  // Abbreviazioni legacy
  'DCD': 'TD', 'DCS': 'TS',
  'CCD': 'CD', 'CCS': 'CS',
  'CO': 'CD', 'CSX': 'CS',
  'ED': 'ADA', 'ES': 'ASA',
};

export function migrateRole(oldRole: string): PlayerRole {
  const direct = MIGRATION_MAP[oldRole];
  if (direct) return direct;

  // Fallback robust: normalizza spazi/case e riprova, così un valore
  // " ts " o "ts" non finisce più nel default. Poi per categoria.
  const norm = String(oldRole ?? '').trim().toUpperCase();
  const retry = MIGRATION_MAP[norm];
  if (retry) return retry;

  return 'CDC';
}

// Player type now uses `roles: PlayerRole[]` with primaryRole = roles[0]
// For backwards compatibility, primaryRole is derived from roles[0]
// ── Types ──────────────────────────────────────────────────

export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
  avgMinutes: number;
  yellowCards?: number;
  redCards?: number;
}

export type Season = {
  id: string;
  userId: string;
  ownerId: string;
  name: string;
  isActive: boolean;
  sharedWith?: string[];
  createdAt: string;
  updatedAt: string;
};

export type InjuryPeriod = {
  id: string;
  startDate: string; // ISO formato YYYY-MM-DD
  endDate: string; // ISO formato YYYY-MM-DD
};

export type Player = {
  id: string;
  userId: string;
  teamOwnerId: string;
  teamId: string;
  seasonId: string;
  name: string;
  firstName: string;
  lastName: string;
  roles?: PlayerRole[];
  /** @deprecated Use roles[0] instead. Kept for migration compatibility. */
  role?: Role;
  /** @deprecated Use roles.slice(1) instead. Kept for migration compatibility. */
  secondaryRoles?: Role[];
  stats: PlayerStats;
  injuries?: InjuryPeriod[];
  createdAt?: string;
  updatedAt?: string;
};

/** Helper to get the primary role (roles[0]) with fallback to legacy role */
export function getPrimaryRole(player: Player): PlayerRole {
  if (player.roles && player.roles.length > 0) return player.roles[0];
  if (player.role) return migrateRole(player.role);
  return 'CDC';
}

export const MATCH_TYPES = ['Campionato', 'Torneo', 'Amichevole'] as const;
export type MatchType = typeof MATCH_TYPES[number];

export type MatchResult = {
  home: number;
  away: number;
};

export type MatchStatus = 'scheduled' | 'completed' | 'canceled';

export type Match = {
  id: string;
  userId: string;
  teamOwnerId: string;
  teamId: string;
  seasonId: string;
  opponent: string;
  date: string;
  isHome: boolean;
  type: MatchType;
  duration: number;
  /**
   * Minuti di recupero per periodo (1TS = primo tempo, 2TS = secondo).
   * Assente per le partite senza recupero dichiarato: NON si deduce dagli
   * eventi registrati in 1TS/2TS, perche' registrarne uno non dichiara quanto
   * recupero ci fosse. Vedi stoppage-time.ts.
   */
  addedTime?: Partial<Record<'1TS' | '2TS', number>>;
  result?: MatchResult;
  teamGoals?: number; // Normalized
  opponentGoals?: number; // Normalized
  resultType?: 'W' | 'D' | 'L'; // Normalized
  status: MatchStatus;
  round?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const ATTENDANCE_STATUSES = ['presente', 'assente', 'in dubbio'] as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

export type MatchAttendance = {
  matchId: string;
  playerId: string;
  status: AttendanceStatus;
  teamOwnerId?: string;
};

export type StarterPlayer = {
  playerId: string;
  role: string;
  positionCode?: string;
};

export type MatchLineup = {
    matchId: string;
    starters: (string | StarterPlayer)[];
    substitutes: (string | StarterPlayer)[];
    formation?: string;
    teamOwnerId?: string;
}

export type PlayerMatchStats = {
  matchId: string;
  playerId: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  teamOwnerId?: string;
};

export const EVENT_TYPES = ['goal', 'own_goal', 'yellow_card', 'red_card', 'substitution', 'assist', 'sub_in', 'sub_out', 'penalty_saved', 'penalty_missed', 'chance', 'woodwork', 'stoppage', 'note'] as const;
export type MatchEventType = typeof EVENT_TYPES[number];

export const GOAL_TYPES = ['azione', 'rigore', 'punizione', 'calcio_angolo'] as const;
export type GoalType = typeof GOAL_TYPES[number];

export type MatchEvent = {
  id: string;
  matchId: string;
  type: MatchEventType;
  team: 'home' | 'away';
  teamSide?: 'our' | 'opponent'; // Normalized
  playerId?: string;
  playerName?: string; 
  subOutPlayerId?: string; 
  subOutPlayerName?: string; 
  assistPlayerId?: string; 
  assistPlayerName?: string; 
  minute: number | null;
  period: '1T' | '2T' | '1TS' | '2TS';
  goalType?: GoalType;
  notes?: string;
  teamOwnerId?: string;
};

export interface AdvancedStatsLeaderboard {
    generatedAt: string;
    seasonId: string;
    filters: { 
        minStarterApps: number; 
        minPairMatches: number;
    };
    bestCbPair: Array<{ 
        pairKey: string; 
        playerIds: string[]; 
        matchesTogether: number; 
        goalsConceded: number; 
        goalsConcededPerMatch: number;
    }>;
    bestCbTrio: Array<{ 
        trioKey: string; 
        playerIds: string[]; 
        matchesTogether: number; 
        goalsConceded: number; 
        goalsConcededPerMatch: number;
    }>;
    bestGaPerStarter: Array<{ 
        playerId: string; 
        goals: number; 
        assists: number; 
        starterApps: number; 
        gaPerStarter: number;
    }>;
    decisiveGoalsLeaders: Array<{ 
        playerId: string; 
        decisiveGoals: number; 
        confidence: 'high' | 'mixed';
    }>;
    lowestStarterLossRate: Array<{ 
        playerId: string; 
        starterApps: number; 
        starterLosses: number; 
        lossRate: number;
    }>;
    meta?: {
        warnings?: string[];
    }
}

export type TrainingStatus = 'presente' | 'ritardo' | 'assente';

export type TrainingSession = {
  id: string;
  index: number;
  date: string;
  notes?: string;
  focus?: string;
  seasonId: string;
  userId: string;
  exerciseIds?: string[];
  exercises?: { id: string; duration?: string }[];
  attendances?: TrainingAttendance[];
};

export type TrainingAttendance = {
  playerId: string;
  status: TrainingStatus;
};

export interface ScoutCategory {
  id: string;
  name: string;
  colorHex: string;
}

export interface ScoutPlayer {
  id: string;
  name: string;
  role: string;
  currentTeam: string;
  categoryIds?: string[];
  notes?: string;
}

// ── Physical Tests ──────────────────────────────────────

export type TestType = 'velocita' | 'resistenza' | string;
export type TestUnit = 'secondi' | 'metri' | string;

export interface TestResult {
  playerId: string;
  value: number;
}

export interface PhysicalTest {
  id: string;
  name: string;
  type: TestType;
  unit: TestUnit;
  date: string;  // ISO string
  seasonId: string;
  userId: string;
  results: TestResult[];
}

export type ExerciseMediaType = 'image' | 'video' | 'link';

export interface ExerciseMedia {
  type: ExerciseMediaType;
  url: string;
}

export interface Exercise {
  id: string;
  userId: string;
  ownerName: string;
  name: string;
  description: string;
  objectives?: string;
  focus: string[];
  visibility: 'private' | 'global';
  media: ExerciseMedia[];
  playerCount: string[];
  duration?: string;
  /**
   * Dati tattici per l'animazione 2D, quando l'esercizio e' stato generato
   * con AI. Assente per gli esercizi creati a mano: in quel caso non c'e'
   * animazione da mostrare e i componenti devono degradare senza rompere.
   */
  tactical?: TacticalExercise;
  createdAt: string;
  updatedAt: string;
}
