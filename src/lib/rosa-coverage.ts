'use client';

import { Player, PlayerRole, FormationModule, FORMATION_ROLES } from '@/lib/types';
import type { SlotPosition } from '@/lib/types';
import { FORMATION_SLOT_COORDS } from '@/lib/types';

export type CoverageLevel = 'covered' | 'warning' | 'critical';

export interface RoleCoverage {
  role: PlayerRole;
  count: number;
  level: CoverageLevel;
  players: Player[];
}

export interface FormationCoverage {
  totalSlots: number;
  coveredSlots: number;       // roles with 2+ players
  warningSlots: number;       // roles with 1 player
  criticalSlots: number;      // roles with 0 players
  roleCoverage: Map<PlayerRole, RoleCoverage>;
}

/**
 * Calculate coverage for each role in a formation.
 * A role is:
 *  - 'covered' (green) if 2+ players have it
 *  - 'warning' (yellow) if exactly 1 player has it
 *  - 'critical' (red) if 0 players have it
 */
export function calculateCoverage(
  players: Player[],
  formation: FormationModule
): FormationCoverage {
  const rolesInFormation = FORMATION_ROLES[formation];
  const roleCoverage = new Map<PlayerRole, RoleCoverage>();
  const seenRoles = new Set<PlayerRole>();

  // Initialize coverage for each unique role in formation
  for (const role of rolesInFormation) {
    if (!seenRoles.has(role)) {
      seenRoles.add(role);
      roleCoverage.set(role, { role, count: 0, level: 'critical', players: [] });
    }
  }

  // Count players per role
  for (const player of players) {
    for (const role of player.roles ?? []) {
      const coverage = roleCoverage.get(role);
      if (coverage) {
        coverage.count++;
        coverage.players.push(player);
      }
    }
  }

  // Count how many formation slots are covered/warning/critical
  // A role covers its slots if it has 2+ players (covered) or exactly 1 (warning)
  const roleSlots = new Map<PlayerRole, number>();
  for (const role of rolesInFormation) {
    roleSlots.set(role, (roleSlots.get(role) ?? 0) + 1);
  }

  let coveredSlots = 0;
  let warningSlots = 0;
  let criticalSlots = 0;

  for (const [role, coverage] of roleCoverage) {
    const slots = roleSlots.get(role) ?? 1;
    if (coverage.count >= 2) {
      coverage.level = 'covered';
      coveredSlots += slots;
    } else if (coverage.count === 1) {
      coverage.level = 'warning';
      warningSlots += slots;
    } else {
      coverage.level = 'critical';
      criticalSlots += slots;
    }
  }

  return {
    totalSlots: rolesInFormation.length,
    coveredSlots,
    warningSlots,
    criticalSlots,
    roleCoverage,
  };
}

/**
 * Get players sorted by relevance for a specific role.
 * Primary role matches first, then secondary, sorted by appearances.
 */
export function getPlayersForRole(players: Player[], role: PlayerRole): Player[] {
  return players
    .filter(p => p.roles?.includes(role))
    .sort((a, b) => {
      // Primary role first
      const aPrimary = a.roles?.[0] === role ? 0 : 1;
      const bPrimary = b.roles?.[0] === role ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      // Then by appearances descending
      return (b.stats?.appearances ?? 0) - (a.stats?.appearances ?? 0);
    });
}

/**
 * Find the first critical or warning role slot to auto-select on first load.
 */
export function getFirstCriticalSlot(formation: FormationModule, coverage: FormationCoverage): PlayerRole | null {
  const rolesInFormation = FORMATION_ROLES[formation];
  for (const role of rolesInFormation) {
    const c = coverage.roleCoverage.get(role);
    if (c && c.level !== 'covered') return role;
  }
  // If everything covered, select the first role
  return rolesInFormation[0];
}

/**
 * Get the position of each slot in a formation.
 */
export function getFormationSlotPositions(formation: FormationModule): SlotPosition[] {
  return FORMATION_SLOT_COORDS[formation];
}
