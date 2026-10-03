'use client';

import { FormationModule, ROLE_LABELS, getRoleCategory, ROLE_CATEGORY_COLORS, PlayerRole, FORMATION_SLOT_COORDS, FORMATION_ROLES, Player } from '@/lib/types';
import { FormationCoverage, CoverageLevel, getPlayersForRole } from '@/lib/rosa-coverage';
import { cn } from '@/lib/utils';

interface ObservedPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  note: string;
}

interface RosaPitchProps {
  formation: FormationModule;
  coverage: FormationCoverage;
  selectedSlot: number | null;
  onSelectSlot: (slotIdx: number) => void;
  slotPlayers: Record<string, string[]>;
  players: Player[];
  observedPlayers: ObservedPlayer[];
}

const COVERAGE_COLORS: Record<CoverageLevel, { bg: string; border: string; glow: string }> = {
  covered: { bg: '#22c55e', border: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
  warning: { bg: '#eab308', border: '#eab308', glow: 'rgba(234,179,8,0.4)' },
  critical: { bg: '#ef4444', border: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
};

function getPlayerById(id: string, players: Player[], observedPlayers: ObservedPlayer[]): { lastName: string; firstName: string } | null {
  const p = players.find(pl => pl.id === id);
  if (p) return { lastName: p.lastName, firstName: p.firstName };
  const obsId = id.replace(/^obs_/, '');
  const obs = observedPlayers.find(o => o.id === obsId);
  if (obs) {
    const parts = obs.name.split(/\s+/);
    return { lastName: parts.slice(1).join(' ') || parts[0], firstName: parts[0] };
  }
  return null;
}

export function RosaPitch({ formation, coverage, selectedSlot, onSelectSlot, slotPlayers, players, observedPlayers }: RosaPitchProps) {
  const positions = FORMATION_SLOT_COORDS[formation];
  const rolesInFormation = FORMATION_ROLES[formation];

  const getPlayerInfo = (slotIdx: number, playerIdx: number): string | null => {
    const key = `__slot${slotIdx}`;
    const slotIds = slotPlayers[key];
    if (slotIds && slotIds.length > playerIdx) {
      const info = getPlayerById(slotIds[playerIdx], players, observedPlayers);
      if (info) return info.lastName || info.firstName;
    }
    return null;
  };

  const getFirstPlayerName = (slotIdx: number): string | null => {
    // First priority: titolare from formation state
    const name = getPlayerInfo(slotIdx, 0);
    if (name) return name;
    // Fallback: any player with this role from Rosa
    const role = rolesInFormation[slotIdx];
    const rolePlayers = getPlayersForRole(players, role);
    if (rolePlayers.length > 0) return rolePlayers[0].lastName;
    return null;
  };

  const getSecondPlayerName = (slotIdx: number): string | null => {
    return getPlayerInfo(slotIdx, 1);
  };

  const getCountForRole = (role: PlayerRole): number => {
    const cov = coverage.roleCoverage.get(role);
    return cov?.count ?? 0;
  };

  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: '9/16', maxHeight: '500px' }}>
      {/* Darker field background */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-emerald-950 to-black border-2 border-white/10 overflow-hidden">
        {/* Field lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-[4%] border border-white/10 rounded-xl" />
          <div className="absolute top-1/2 left-[4%] right-[4%] h-px bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] aspect-square border border-white/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/20 rounded-full" />
          <div className="absolute top-0 left-[25%] right-[25%] h-[16%]" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }} />
          <div className="absolute bottom-0 left-[25%] right-[25%] h-[16%]" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }} />
        </div>

        {/* Role slots — one circle per slot */}
        {rolesInFormation.map((role, idx) => {
          const pos = positions[idx];
          const level = coverage.roleCoverage.get(role)?.level ?? 'critical';
          const count = getCountForRole(role);
          const colors = COVERAGE_COLORS[level];
          const isSelected = selectedSlot === idx;
          const topName = getFirstPlayerName(idx);
          const subName = getSecondPlayerName(idx);

          return (
            <button
              key={`slot-${idx}`}
              type="button"
              onClick={() => onSelectSlot(idx)}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex flex-col items-center justify-center transition-all duration-150',
                'border-2 text-[11px] font-black uppercase cursor-pointer',
                'hover:scale-110 active:scale-95',
                isSelected && 'ring-2 ring-[#00e5a0] ring-offset-2 ring-offset-emerald-950'
              )}
              style={{
                top: pos.top,
                left: pos.left,
                backgroundColor: colors.bg,
                borderColor: isSelected ? '#00e5a0' : colors.border,
                boxShadow: `0 0 10px ${colors.glow}`,
              }}
            >
              <span className="text-white drop-shadow-md leading-none">{role}</span>
              <span className="text-[8px] text-white/70 leading-none mt-0.5">{count}</span>
            </button>
          );
        })}

        {/* Player names — positioned below each circle */}
        {rolesInFormation.map((role, idx) => {
          const pos = positions[idx];
          const topName = getFirstPlayerName(idx);
          const subName = getSecondPlayerName(idx);
          if (!topName && !subName) return null;

          const posTop = parseFloat(pos.top);
          const posLeft = parseFloat(pos.left);

          return (
            <div
              key={`name-${idx}`}
              className="absolute flex flex-col items-center -translate-x-1/2 pointer-events-none"
              style={{
                top: `${posTop + 5}%`,
                left: `${posLeft}%`,
              }}
            >
              {topName && (
                <span className="text-[11px] sm:text-xs font-black text-white whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] max-w-[90px] truncate leading-tight">
                  {topName}
                </span>
              )}
              {subName && (
                <span className="text-[10px] sm:text-[11px] font-bold text-white/50 whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] max-w-[85px] truncate leading-tight">
                  {subName}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
