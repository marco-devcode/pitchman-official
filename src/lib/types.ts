export type AccountRole = 'developer' | 'director' | 'coach' | 'player';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: AccountRole;
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

// 4-3-1-2 mancava dalla lista pur essendo presente in lineup-mapping: nella
// rosa non era selezionabile, e i salvataggi di quel modulo venivano scartati
// dal guard (FORMATIONS as string[]).includes(stored) al ricaricamento.
export const FORMATIONS: FormationModule[] = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-4-2-1', '3-4-3', '3-4-1-2', '4-3-1-2'];

export const DEFAULT_FORMATION: FormationModule = '4-3-3';

// Mapping of formation -> roles on the pitch (order matters for layout)
// This is used by the Rosa Overview screen
// CS = Centrocampista Sinistro (sta a sinistra), CD = Centrocampista Destro (sta a destra)
export const FORMATION_ROLES: Record<FormationModule, PlayerRole[]> = {
  '4-3-3':   ['POR', 'TS', 'DC', 'DC', 'TD', 'CS', 'CDC', 'CD', 'AS', 'ATT', 'AD'],
  '4-2-3-1': ['POR', 'TS', 'DC', 'DC', 'TD', 'CS', 'CD', 'AS', 'TRQ', 'AD', 'ATT'],
  '4-4-2':   ['POR', 'TS', 'DC', 'DC', 'TD', 'AS', 'CS', 'CD', 'AD', 'ATT', 'ATT'],
  // 3-5-2: CS a sinistra, CD a destra, CDC al centro. Era invertito.
  '3-5-2':   ['POR', 'DC', 'DC', 'DC', 'ASA', 'CS', 'CDC', 'CD', 'ADA', 'ATT', 'ATT'],
  '3-4-2-1': ['POR', 'DC', 'DC', 'DC', 'ASA', 'CS', 'CD', 'ADA', 'TRQ', 'TRQ', 'ATT'],
  '3-4-3':   ['POR', 'DC', 'DC', 'DC', 'ASA', 'CS', 'CD', 'ADA', 'AS', 'ATT', 'AD'],
  '3-4-1-2': ['POR', 'DC', 'DC', 'DC', 'ASA', 'CS', 'CD', 'ADA', 'TRQ', 'ATT', 'ATT'],
  // 4-3-1-2: era "CS, CD, CS" — due sinistri e nessun mediano. Il CDC sta
  // davanti alla difesa, il CD a destra.
  '4-3-1-2': ['POR', 'TS', 'DC', 'DC', 'TD', 'CS', 'CDC', 'CD', 'TRQ', 'ATT', 'ATT'],
};

// Map a role slot position to pitch coordinates (top %, left %)
// Each formation has its own layout for realistic positioning
export interface SlotPosition { top: string; left: string }

export const FORMATION_POSITIONS: Record<FormationModule, SlotPosition[]> = {
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

export const EVENT_TYPES = ['goal', 'own_goal', 'yellow_card', 'red_card', 'substitution', 'assist', 'sub_in', 'sub_out', 'penalty_saved', 'penalty_missed', 'chance', 'woodwork', 'note'] as const;
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
  createdAt: string;
  updatedAt: string;
}
