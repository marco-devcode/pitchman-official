'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePlayersStore } from '@/store/usePlayersStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { scoutRepository } from '@/lib/repositories/scout-repository';
import {
  FormationModule,
  FORMATIONS,
  DEFAULT_FORMATION,
  PlayerRole,
  Player,
  ScoutPlayer,
  FORMATION_ROLES,
} from '@/lib/types';
import { calculateCoverage, getFirstCriticalSlot, FormationCoverage } from '@/lib/rosa-coverage';
import { RosaPitch } from '@/components/squadra/rosa-pitch';
import { RolePlayerList, ObservedPlayersList } from '@/components/squadra/rosa-player-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, AlertCircle, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { ScoutPlayerSchema } from '@/lib/schemas';

// ── Formation state ──────────────────────────────────────
interface FormationState {
  slotPlayers: Record<string, string[]>;
}

const slotKey = (index: number) => `__slot${index}`;

const createEmptyFormationState = (): FormationState => ({
  slotPlayers: {},
});

const STORAGE_KEY = 'rosa-overview-state';
const FORMATION_KEY = 'rosa-overview-formation';

export default function RosaOverviewPage() {
  const { players } = usePlayersStore();
  const { activeSeason } = useSeasonsStore();
  const { user } = useUser();
  const firestore = useFirestore();

  const [formation, setFormation] = useState<FormationModule>(() => {
    try {
      const stored = sessionStorage.getItem(FORMATION_KEY);
      if (stored && (FORMATIONS as string[]).includes(stored)) {
        return stored as FormationModule;
      }
    } catch { /* ignore */ }
    return DEFAULT_FORMATION;
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Persist formation selection
  useEffect(() => {
    try { sessionStorage.setItem(FORMATION_KEY, formation); } catch { /* ignore */ }
  }, [formation]);

  // sessionStorage-backed state: survives remount/reload
  const [formationStates, setFormationStates] = useState<Record<FormationModule, FormationState>>(() => {
    const init: Partial<Record<FormationModule, FormationState>> = {};
    FORMATIONS.forEach(f => { init[f] = createEmptyFormationState(); });
    return init as Record<FormationModule, FormationState>;
  });

  // Track dirty state (true when user made changes vs saved snapshot)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const prevFormationRef = useRef<FormationModule>(formation);

  const currentState = formationStates[formation];
  const { slotPlayers } = currentState;

  // ── Load from sessionStorage on mount ──────────────────
  useEffect(() => {
    try {
      let stateLoaded = false;
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<FormationModule, FormationState>;
        if (parsed && typeof parsed === 'object') {
          setFormationStates(parsed);
          stateLoaded = true;
        }
      }

      const formationStored = sessionStorage.getItem(FORMATION_KEY);
      if (formationStored && (FORMATIONS as string[]).includes(formationStored)) {
        setFormation(formationStored as FormationModule);
      }
    } catch {
      // ignore parse error
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // ── Save to sessionStorage whenever state changes ───────
  useEffect(() => {
    if (!isLoaded) return;
    // Mark dirty on any change after initial load
    setHasUnsavedChanges(true);
  }, [formationStates, isLoaded]);

  const updateFormationState = useCallback((updater: (prev: FormationState) => FormationState) => {
    setFormationStates(prev => ({
      ...prev,
      [formation]: updater(prev[formation]),
    }));
  }, [formation]);

  const activeCoverage: FormationCoverage = useMemo(
    () => calculateCoverage(players, formation),
    [players, formation]
  );

  // ── Scout / Observed players ──────────────────────────
  const scoutPlayersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeSeason) return null;
    return scoutRepository.ref(activeSeason.id);
  }, [firestore, user, activeSeason]);

  const { data: scoutPlayers } = useCollection<ScoutPlayer>(
    scoutPlayersQuery,
    ScoutPlayerSchema as any
  );

  const observedPlayers = useMemo(() => {
    if (!scoutPlayers) return [];
    return scoutPlayers.map(sp => ({
      id: sp.id,
      name: sp.name,
      role: (['POR','DC','TD','TS','ADA','ASA','CDC','TRQ','CD','CS','AD','AS','ATT'].includes(sp.role) ? sp.role : 'ATT') as PlayerRole,
      note: sp.notes ?? sp.currentTeam ?? '',
    }));
  }, [scoutPlayers]);

  // ── Auto-select first critical slot on formation change ─
  useEffect(() => {
    if (prevFormationRef.current !== formation) {
      prevFormationRef.current = formation;
      const criticalRole = getFirstCriticalSlot(formation, activeCoverage);
      const rolesInFormation = FORMATION_ROLES[formation];
      if (criticalRole) {
        const idx = rolesInFormation.findIndex(r => r === criticalRole);
        setSelectedSlot(idx >= 0 ? idx : 0);
      } else {
        setSelectedSlot(0);
      }
    }
  }, [formation, activeCoverage]);

  // ── Save to sessionStorage (explicit save) ─────────────
  const handleSaveFormation = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formationStates));
      setHasUnsavedChanges(false);
    } catch {
      // ignore quota error
    }
  }, [formationStates]);

  // ── Handlers ──────────────────────────────────────────

  const handleReorder = useCallback((slotIdx: number, playerId: string, direction: 'up' | 'down') => {
    const key = slotKey(slotIdx);
    updateFormationState(prev => {
      const current = prev.slotPlayers[key] ? [...prev.slotPlayers[key]] : [];
      const idx = current.indexOf(playerId);
      if (idx === -1) return prev;

      if (direction === 'up' && idx > 0) {
        [current[idx - 1], current[idx]] = [current[idx], current[idx - 1]];
      } else if (direction === 'down' && idx < current.length - 1) {
        [current[idx], current[idx + 1]] = [current[idx + 1], current[idx]];
      }

      return {
        ...prev,
        slotPlayers: { ...prev.slotPlayers, [key]: current },
      };
    });
  }, [updateFormationState]);

  const handleRemove = useCallback((playerId: string) => {
    // Rimuovi SOLO dal modulo attivo E dallo slot selezionato
    if (selectedSlot === null) return;
    const key = slotKey(selectedSlot);
    setFormationStates(prev => {
      const slotPlayers = { ...prev[formation].slotPlayers };
      slotPlayers[key] = (slotPlayers[key] ?? []).filter(id => id !== playerId);
      return {
        ...prev,
        [formation]: { ...prev[formation], slotPlayers },
      };
    });
  }, [formation, selectedSlot]);

  const handleAddPlayerToSlot = useCallback((playerId: string) => {
    if (selectedSlot === null) return;
    const key = slotKey(selectedSlot);
    updateFormationState(prev => {
      const current = prev.slotPlayers[key] ? [...prev.slotPlayers[key]] : [];
      if (!current.includes(playerId)) {
        current.push(playerId);
      }
      return {
        ...prev,
        slotPlayers: { ...prev.slotPlayers, [key]: current },
      };
    });
  }, [selectedSlot, updateFormationState]);

  const handleAddObservedPlayer = useCallback((observedId: string, name: string, role: PlayerRole) => {
    if (selectedSlot === null) return;
    const key = slotKey(selectedSlot);
    const tempId = `obs_${observedId}`;
    updateFormationState(prev => {
      const current = prev.slotPlayers[key] ? [...prev.slotPlayers[key]] : [];
      if (!current.includes(tempId)) {
        current.push(tempId);
      }
      return {
        ...prev,
        slotPlayers: { ...prev.slotPlayers, [key]: current },
      };
    });
  }, [selectedSlot, updateFormationState]);

  const handleReset = useCallback(() => {
    setFormationStates(prev => ({
      ...prev,
      [formation]: createEmptyFormationState(),
    }));
  }, [formation]);

  // ── Derived for render ────────────────────────────────

  const rolesInFormation = FORMATION_ROLES[formation];
  const selectedRole: PlayerRole | null = selectedSlot !== null ? rolesInFormation[selectedSlot] ?? null : null;
  const selectedSlotKey = selectedSlot !== null ? slotKey(selectedSlot) : null;
  const selectedSlotOrderedIds = selectedSlotKey ? (slotPlayers[selectedSlotKey] ?? []) : [];

  const roleOrderedForSidebar: Partial<Record<PlayerRole, string[]>> = selectedRole
    ? { [selectedRole]: selectedSlotOrderedIds }
    : {};

  if (!activeSeason) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm font-black uppercase text-muted-foreground dark:text-muted-foreground/60">
          Nessuna stagione attiva
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={formation} onValueChange={(v) => setFormation(v as FormationModule)}>
          <SelectTrigger className="w-28 h-8 text-xs font-bold uppercase bg-background dark:bg-black border border-border dark:border-brand-green/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATIONS.map(f => (
              <SelectItem key={f} value={f} className="text-xs font-bold">{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest border border-border dark:border-brand-green/30 text-muted-foreground dark:hover:border-brand-green transition-all"
          title="Ripristina formazione"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>

        {/* Spacer to push save button right */}
        <div className="flex-1" />

        {/* Save button — appears when there are unsaved changes */}
        {hasUnsavedChanges && isLoaded && (
          <button
            type="button"
            onClick={handleSaveFormation}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#00e5a0]/10 border border-[#00e5a0]/40 text-[#00e5a0] hover:bg-[#00e5a0]/20 transition-all animate-pulse"
            title="Salva modifiche — le mantiene anche uscendo dalla schermata"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Salva modifica</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/30 dark:bg-card/20 border border-border dark:border-transparent">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Copertura:
        </span>
        <span className="text-xs font-black">
          {activeCoverage.coveredSlots + activeCoverage.warningSlots}/{activeCoverage.totalSlots}
        </span>
        {activeCoverage.criticalSlots > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500 ml-auto">
            <AlertCircle className="h-3 w-3" />
            {activeCoverage.criticalSlots} emergenze
          </span>
        )}
        {activeCoverage.warningSlots > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-yellow-500">
            <AlertTriangle className="h-3 w-3" />
            {activeCoverage.warningSlots} scoperti
          </span>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-[40%] shrink-0">
          <RosaPitch
            formation={formation}
            coverage={activeCoverage}
            selectedSlot={selectedSlot}
            onSelectSlot={(slotIdx) => setSelectedSlot(slotIdx)}
            slotPlayers={slotPlayers}
            players={players}
            observedPlayers={observedPlayers}
          />
        </div>

        <div className="md:w-[60%] flex-1 min-w-0">
          <ScrollArea className="h-[500px] pr-2">
            {selectedRole !== null ? (
              <div className="space-y-4">
                <RolePlayerList
                  players={players}
                  selectedRole={selectedRole}
                  isNextSeason={false}
                  orderedPlayerIds={roleOrderedForSidebar}
                  excludedIds={[]}
                  onReorder={(role, playerId, dir) => {
                    if (selectedSlot !== null) handleReorder(selectedSlot, playerId, dir);
                  }}
                  onRemove={handleRemove}
                  onAddPlayer={(player) => handleAddPlayerToSlot(player.id)}
                  allPlayers={players}
                  observedPlayers={observedPlayers}
                />

                <ObservedPlayersList
                  observedPlayers={observedPlayers}
                  selectedRole={selectedRole}
                  onAdd={handleAddObservedPlayer}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs font-black uppercase text-muted-foreground dark:text-muted-foreground/40">
                  Seleziona un ruolo sul campo
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
