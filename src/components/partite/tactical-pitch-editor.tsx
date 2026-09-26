"use client";

import * as React from "react";
import { cn, displayPlayerName } from "@/lib/utils";
import { isPlayerInjured } from "@/lib/player-utils";
import type { Player } from "@/lib/types";
import { getPositionAcronym, getPositionCoordinates } from "@/lib/lineup-mapping";
import { DraggablePlayer } from "./draggable-player";

interface TacticalPitchEditorProps {
  formation: string;
  starters: string[];
  allPlayers: Player[];
  onSlotClick: (index: number) => void;
  onSwap?: (source: { type: 'starter' | 'sub'; index: number }, target: { type: 'starter' | 'sub'; index: number }) => void;
  matchDate?: string;
  isEditing?: boolean;
}

export function TacticalPitchEditor({
  formation,
  starters,
  allPlayers,
  onSlotClick,
  onSwap,
  matchDate,
  isEditing = false,
}: TacticalPitchEditorProps) {
  return (
    <div className="relative aspect-[3/4] w-full max-w-lg mx-auto rounded-3xl bg-neutral-900 dark:bg-black overflow-hidden border-4 border-white/5 shadow-2xl flex flex-col p-4 select-none">
      {/* Linee del campo */}
      <div className="absolute inset-4 border-2 border-white/10 pointer-events-none rounded-sm">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-16 border-b-2 border-x-2 border-white/10" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-16 border-t-2 border-x-2 border-white/10" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/10 rounded-full" />
      </div>

      {/* Giocatori in Campo */}
      <div className="relative w-full h-full">
        {starters.map((playerId, index) => {
          const coords = getPositionCoordinates(formation, index);
          const acronym = getPositionAcronym(formation, index);
          const player = allPlayers.find((p) => p.id === playerId);
          const isPOR = index === 0;

          return (
            // key solo per indice, NON per playerId: includendo il playerId,
            // ogni swap faceva remountare il componente sotto il cursore
            // durante il drop, e il nodo veniva distrutto proprio mentre
            // elementFromPoint lo stava cercando. L'indice e' gia' univoco
            // perche' identifica lo slot, che e' cio' che non deve cambiare.
            <div
              key={index}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
              style={{ top: `${coords.top}%`, left: `${coords.left}%`, zIndex: isEditing ? 10 : 1 }}
            >
              <DraggablePlayer
                player={player}
                acronym={acronym}
                isPOR={isPOR}
                isInjured={player ? isPlayerInjured(player, matchDate ? new Date(matchDate) : undefined) : false}
                index={index}
                type="starter"
                isEditing={isEditing}
                onSwap={onSwap || (() => {})}
                onClick={() => onSlotClick(index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
