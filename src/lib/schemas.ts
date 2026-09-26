
import { z } from 'zod';

export const RoleSchema = z.enum(['Portiere', 'Difensore', 'Centrocampista', 'Attaccante']);

export const PlayerStatsSchema = z.object({
  appearances: z.number().default(0),
  goals: z.number().default(0),
  assists: z.number().default(0),
  avgMinutes: z.number().default(0),
  yellowCards: z.number().optional().default(0),
  redCards: z.number().optional().default(0),
});

export const InjuryPeriodSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export const PlayerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  teamOwnerId: z.string(),
  teamId: z.string(),
  seasonId: z.string(),
  name: z.string(),
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  role: RoleSchema,
  secondaryRoles: z.array(RoleSchema).optional().default([]),
  stats: PlayerStatsSchema,
  injuries: z.array(InjuryPeriodSchema).optional().default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const MatchTypeSchema = z.enum(['Campionato', 'Torneo', 'Amichevole']);

export const MatchResultSchema = z.object({
  home: z.number().default(0),
  away: z.number().default(0),
});

export const MatchStatusSchema = z.enum(['scheduled', 'completed', 'canceled']);

export const MatchSchema = z.object({
  id: z.string(),
  userId: z.string(),
  teamOwnerId: z.string(),
  teamId: z.string(),
  seasonId: z.string(),
  opponent: z.string(),
  date: z.string(),
  isHome: z.boolean(),
  type: MatchTypeSchema,
  duration: z.number().default(60),
  // Recupero per periodo. z.record con chiavi 1TS/2TS: se non dichiarato
  // resta assente, e assente significa "nessun recupero" (non si deduce dagli
  // eventi). Vedi stoppage-time.ts.
  addedTime: z
    .object({
      '1TS': z.number().int().min(0).max(30).optional(),
      '2TS': z.number().int().min(0).max(30).optional(),
    })
    .optional(),
  result: MatchResultSchema.optional(),
  teamGoals: z.number().optional(),
  opponentGoals: z.number().optional(),
  resultType: z.enum(['W', 'D', 'L']).optional(),
  status: MatchStatusSchema.default('scheduled'),
  round: z.number().optional().default(0),
  notes: z.string().optional().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const StarterPlayerSchema = z.object({
  playerId: z.string(),
  role: z.string(),
  positionCode: z.string().optional(),
});

export const MatchLineupSchema = z.object({
  matchId: z.string(),
  starters: z.array(z.union([z.string(), StarterPlayerSchema])),
  substitutes: z.array(z.union([z.string(), StarterPlayerSchema])),
  formation: z.string().optional(),
  teamOwnerId: z.string().optional(),
});

export const MatchEventSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  type: z.string(), // Use string to support legacy types if needed
  team: z.enum(['home', 'away']),
  teamSide: z.enum(['our', 'opponent']).optional(),
  playerId: z.string().optional(),
  playerName: z.string().optional(),
  subOutPlayerId: z.string().optional(),
  minute: z.number(),
  period: z.enum(['1T', '2T', '1TS', '2TS']),
});

export const AdvancedStatsLeaderboardSchema = z.object({
  generatedAt: z.string(),
  seasonId: z.string(),
  filters: z.object({
    minStarterApps: z.number(),
    minPairMatches: z.number(),
  }),
  bestCbPair: z.array(z.any()),
  bestCbTrio: z.array(z.any()),
  bestGaPerStarter: z.array(z.any()),
  decisiveGoalsLeaders: z.array(z.any()),
  lowestStarterLossRate: z.array(z.any()),
  meta: z.object({
    warnings: z.array(z.string()).optional(),
  }).optional(),
});

export const TrainingStatusSchema = z.enum(['presente', 'ritardo', 'assente']);

export const TrainingAttendanceSchema = z.object({
  playerId: z.string(),
  status: TrainingStatusSchema,
});

export const TrainingSessionSchema = z.object({
  id: z.string(),
  index: z.number(),
  date: z.string(),
  notes: z.string().catch('').optional().default(''),
  focus: z.string().catch('').optional().default(''),
  seasonId: z.string(),
  userId: z.string(),
  exerciseIds: z.array(z.string()).optional().default([]),
  exercises: z.array(z.object({
    id: z.string(),
    duration: z.string().optional()
  })).optional().default([]),
  attendances: z.array(z.any()).optional().default([]), // Denormalized attendances in session doc
});

export const ExerciseMediaSchema = z.object({
  type: z.enum(['image', 'video', 'link']),
  url: z.string(),
});

export const ExerciseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ownerName: z.string(),
  name: z.string(),
  description: z.string(),
  objectives: z.string().optional().default(''),
  focus: z.array(z.string()),
  visibility: z.enum(['private', 'global']),
  media: z.array(ExerciseMediaSchema),
  playerCount: z.array(z.string()),
  duration: z.string().optional().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SeasonSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ownerId: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  sharedWith: z.array(z.string()).optional().default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ScoutCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  colorHex: z.string().default('#00FF00'),
});

export const ScoutPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().default('Attaccante'),
  currentTeam: z.string().default(''),
  categoryIds: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(''),
  userId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ── Physical Tests ──────────────────────────────────────
export const TestResultSchema = z.object({
  playerId: z.string(),
  value: z.number(),
});

export const PhysicalTestSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.string().default('velocita'),
  unit: z.string().default('secondi'),
  date: z.string(),
  seasonId: z.string(),
  userId: z.string(),
  results: z.array(TestResultSchema).default([]),
});
