'use client';

import { Player, PlayerRole, ROLE_LABELS, getRoleCategory, ROLE_CATEGORY_COLORS } from '@/lib/types';
import { getPlayersForRole } from '@/lib/rosa-coverage';
import { ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ObservedPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  note: string;
}

/* ═══════════════════════════════════════════════════════
   RolePlayerList — shows players for the selected role,
   ordered (in formation) first, then compatibili.
   ═══════════════════════════════════════════════════════ */

interface RolePlayerListProps {
  players: Player[];
  selectedRole: PlayerRole;
  isNextSeason: boolean;
  orderedPlayerIds: Partial<Record<PlayerRole, string[]>>;
  excludedIds: string[];
  onReorder: (role: PlayerRole, playerId: string, direction: 'up' | 'down') => void;
  onRemove: (playerId: string) => void;
  onAddPlayer: (player: Player) => void;
  allPlayers: Player[];
  observedPlayers?: ObservedPlayer[];
}

export function RolePlayerList({
  players,
  selectedRole,
  isNextSeason,
  orderedPlayerIds,
  excludedIds,
  onReorder,
  onRemove,
  onAddPlayer,
  allPlayers,
  observedPlayers = [],
}: RolePlayerListProps) {
  const ordered = orderedPlayerIds[selectedRole] ?? [];

  // Separate Rosa players from observed (obs_ prefix)
  const rosaPlayerIds = ordered.filter(id => !id.startsWith('obs_'));
  const obsPlayerIds = ordered.filter(id => id.startsWith('obs_'));

  const compatiblePlayers = getPlayersForRole(players, selectedRole);
  const incompatiblePlayers = players.filter(
    (p) =>
      !p.roles?.includes(selectedRole) &&
      (p.roles?.some((r) => getRoleCategory(r) === getRoleCategory(selectedRole)) ?? false),
  );

  function getRosaPlayerById(id: string): Player | undefined {
    return allPlayers.find((p) => p.id === id);
  }

  function getObservedById(id: string): ObservedPlayer | undefined {
    const realId = id.replace(/^obs_/, '');
    return observedPlayers.find(o => o.id === realId);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Ruolo selezionato
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase text-white"
          style={{ backgroundColor: ROLE_CATEGORY_COLORS[getRoleCategory(selectedRole)] }}
        >
          {selectedRole}
        </span>
        <span className="text-[10px] font-bold uppercase text-muted-foreground/80 dark:text-muted-foreground/60">
          ({ROLE_LABELS[selectedRole]})
        </span>
      </div>

      {/* Ordered / Already in formation — Rosa players */}
      {rosaPlayerIds.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 dark:text-muted-foreground/40">
            In formazione
          </span>
          {rosaPlayerIds.map((playerId, idx) => {
            const player = getRosaPlayerById(playerId);
            if (!player) return null;
            const isExcluded = excludedIds.includes(playerId);
            return (
              <div
                key={playerId}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
                  isExcluded
                    ? 'opacity-40 border-red-500/30 bg-red-500/5'
                    : 'border-border dark:border-brand-green/20 bg-muted/20 dark:bg-card/10',
                )}
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => onReorder(selectedRole, playerId, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20"
                    title="Sposta su"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(selectedRole, playerId, 'down')}
                    disabled={idx === rosaPlayerIds.length - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20"
                    title="Sposta giù"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">
                    {player.lastName} {player.firstName}
                  </p>
                  <p className="text-[9px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase">
                    {player.roles?.join(', ')} {isExcluded && '• escluso'}
                  </p>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => onRemove(playerId)}
                  className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Rimuovi dalla formazione"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Observed players already in formation */}
      {obsPlayerIds.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500/60">
            In formazione (osservati)
          </span>
          {obsPlayerIds.map((obsId, idx) => {
            const obs = getObservedById(obsId);
            if (!obs) return null;
            return (
              <div
                key={obsId}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/5"
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => onReorder(selectedRole, obsId, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-orange-500/10 disabled:opacity-20"
                    title="Sposta su"
                  >
                    <ChevronUp className="h-3 w-3 text-orange-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(selectedRole, obsId, 'down')}
                    disabled={idx === obsPlayerIds.length - 1}
                    className="p-0.5 rounded hover:bg-orange-500/10 disabled:opacity-20"
                    title="Sposta giù"
                  >
                    <ChevronDown className="h-3 w-3 text-orange-500" />
                  </button>
                </div>

                {/* Player info — all orange */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-orange-500">
                    {obs.name}
                  </p>
                  <p className="text-[9px] font-medium uppercase text-orange-600">
                    {ROLE_LABELS[obs.role] ?? obs.role}
                    {obs.note && ` • ${obs.note}`}
                  </p>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => onRemove(obsId)}
                  className="p-1 rounded-lg hover:bg-red-500/10 text-orange-500 hover:text-red-500 transition-colors"
                  title="Rimuovi dalla formazione"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Compatible players (not yet in formation) */}
      {compatiblePlayers.filter((p) => !ordered.includes(p.id)).length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 dark:text-muted-foreground/40">
            Compatibili ({selectedRole})
          </span>
          {compatiblePlayers
            .filter((p) => !ordered.includes(p.id))
            .map((player) => {
              const isExcluded = excludedIds.includes(player.id);
              return (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
                    isExcluded
                      ? 'opacity-40 border-red-500/30 bg-red-500/5'
                      : 'border-border dark:border-brand-green/20 bg-muted/10 dark:bg-card/5 hover:bg-muted/20',
                  )}
                >
                  {/* Add button */}
                  <button
                    type="button"
                    onClick={() => onAddPlayer(player)}
                    className="p-1 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors"
                    title="Aggiungi alla formazione"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">
                      {player.lastName} {player.firstName}
                    </p>
                    <p className="text-[9px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase">
                      {player.roles?.join(', ')} {isExcluded && '• escluso'}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Incompatible / cross-role players */}
      {incompatiblePlayers.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 dark:text-muted-foreground/40">
            Altri giocatori della categoria
          </span>
          {incompatiblePlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border dark:border-brand-green/10 bg-muted/5 opacity-60"
            >
              <button
                type="button"
                onClick={() => onAddPlayer(player)}
                className="p-1 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors"
                title="Aggiungi comunque"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">
                  {player.lastName} {player.firstName}
                </p>
                <p className="text-[9px] font-medium text-muted-foreground/80 dark:text-muted-foreground/60 uppercase">
                  {player.roles?.join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ObservedPlayersList — shows players in "osservazione".
   These addable via "+" and shown in orange.
   ═══════════════════════════════════════════════════════ */

interface ObservedPlayersListProps {
  observedPlayers: ObservedPlayer[];
  selectedRole: PlayerRole;
  onAdd?: (id: string, name: string, role: PlayerRole) => void;
}

export function ObservedPlayersList({ observedPlayers, selectedRole, onAdd }: ObservedPlayersListProps) {
  if (observedPlayers.length === 0) return null;

  const relevantObserved = observedPlayers.filter(
    (obs) =>
      obs.role === selectedRole ||
      getRoleCategory(obs.role) === getRoleCategory(selectedRole),
  );

  if (relevantObserved.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500/80">
          Giocatori in osservazione
        </span>
      </div>

      {relevantObserved.map((obs, idx) => (
        <div
          key={`${obs.name}-${idx}`}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/5"
        >
          {/* Add button */}
          <button
            type="button"
            onClick={() => onAdd?.(obs.id, obs.name, obs.role)}
            className="p-1 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
            title="Aggiungi alla formazione"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* Player info — all in orange */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate text-orange-500">
              {obs.name}
            </p>
            <p className="text-[9px] font-medium uppercase text-orange-600">
              {ROLE_LABELS[obs.role] ?? obs.role}
            </p>
            {obs.note && (
              <p className="text-[9px] italic mt-0.5 text-orange-400">
                {obs.note}
              </p>
            )}
          </div>

          {/* Role badge */}
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-white bg-orange-500">
            {obs.role}
          </span>
        </div>
      ))}
    </div>
  );
}
