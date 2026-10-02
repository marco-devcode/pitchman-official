
"use client";

import * as React from "react";
import { useMatchDetailStore } from "@/store/useMatchDetailStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchEventType, MatchEvent, GoalType } from "@/lib/types";
import { displayPlayerName, cn } from "@/lib/utils";

import { Loader2 } from "lucide-react";

import { PERIOD_ORDER, getStoppageFromEvent } from "@/lib/match-events";

type UIEventType = 'goal' | 'own_goal' | 'yellow_card' | 'red_card' | 'substitution' | 'penalty_saved' | 'penalty_missed' | 'chance' | 'woodwork' | 'stoppage' | 'note';

interface MatchEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventToEdit?: MatchEvent;
}

export function MatchEventDialog({ open, onOpenChange, eventToEdit }: MatchEventDialogProps) {
  const { allPlayers, events: allEvents, lineup, addEvents, updateEvent, match } = useMatchDetailStore();
  const teamName = useSettingsStore((state) => state.teamName);

  const [uiType, setUiType] = React.useState<UIEventType>('goal');
  const [team, setTeam] = React.useState<'home' | 'away'>('home');

  const [playerId, setPlayerId] = React.useState<string>("");
  const [playerName, setPlayerName] = React.useState<string>("");
  const [assistPlayerId, setAssistPlayerId] = React.useState<string>("");
  const [assistPlayerName, setAssistPlayerName] = React.useState<string>("");

  const [subInPlayerId, setSubInPlayerId] = React.useState<string>("");
  const [subInPlayerName, setSubInPlayerName] = React.useState<string>("");
  const [subOutPlayerId, setSubOutPlayerId] = React.useState<string>("");
  const [subOutPlayerName, setSubOutPlayerName] = React.useState<string>("");

  const [minute, setMinute] = React.useState<number | null>(null);
  const [period, setPeriod] = React.useState<'1T' | '2T' | '1TS' | '2TS'>('1T');
  const [goalType, setGoalType] = React.useState<GoalType>('azione');
  const [notes, setNotes] = React.useState<string>("");

  // Minuti aggiuntivi: periodo (1TS/2TS) e numero di minuti. Tenuti separati
  // dal `period`/`minute` generali perche' il recupero ha una semantica
  // diversa: il periodo dice a QUALE tempo si aggiungono i minuti, e il
  // numero dice QUANTI. Il minute assoluto dell'evento non serve.
  const [stoppagePeriod, setStoppagePeriod] = React.useState<'1TS' | '2TS'>('1TS');
  const [stoppageMinutes, setStoppageMinutes] = React.useState<number>(1);

  const [openSelect, setOpenSelect] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Pre-fill if editing
  React.useEffect(() => {
    if (eventToEdit && open) {
      setUiType(eventToEdit.type as UIEventType);
      setTeam(eventToEdit.team);
      setMinute(eventToEdit.minute);
      setPeriod(eventToEdit.period);
      setNotes(eventToEdit.notes || "");
      
      if (eventToEdit.type === 'goal') {
        setGoalType(eventToEdit.goalType || 'azione');
        setPlayerId(eventToEdit.playerId || "");
        setPlayerName(eventToEdit.playerName || "");
        setAssistPlayerId(eventToEdit.assistPlayerId || "");
        setAssistPlayerName(eventToEdit.assistPlayerName || "");
      } else if (eventToEdit.type === 'own_goal') {
        setPlayerId(eventToEdit.playerId || "");
        setPlayerName(eventToEdit.playerName || "");
      } else if (eventToEdit.type === 'substitution') {
        setSubInPlayerId(eventToEdit.playerId || "");
        setSubInPlayerName(eventToEdit.playerName || "");
        setSubOutPlayerId(eventToEdit.subOutPlayerId || "");
        setSubOutPlayerName(eventToEdit.subOutPlayerName || "");
      } else if (eventToEdit.type === 'stoppage') {
        // Il recupero va ricaricato nei suoi due selettori: senza questo,
        // aprire in modifica un 2TS da 5 mostrerebbe 1° Tempo e 1 minuto, e
        // il salvataggio sovrascriverebbe il dato con valori sbagliati.
        setStoppagePeriod(eventToEdit.period === '2TS' ? '2TS' : '1TS');
        setStoppageMinutes(getStoppageFromEvent(eventToEdit) || 1);
      } else {
        setPlayerId(eventToEdit.playerId || "");
        setPlayerName(eventToEdit.playerName || "");
      }
    } else if (open) {
      resetForm();
    }
  }, [eventToEdit, open]);

  const maxMinutes = (period === '1T' || period === '2T') ? 60 : 20;

  const isPitchManSide = match?.isHome ? team === 'home' : team === 'away';

  const playersStatus = React.useMemo(() => {
    if (!isPitchManSide || !lineup) return { onPitch: allPlayers, onBench: [], allInLineup: allPlayers };

    const lineupIds = new Set([
      ...lineup.starters.map(p => typeof p === "string" ? p : p.playerId),
      ...lineup.substitutes.map(p => typeof p === "string" ? p : p.playerId)
    ].filter(Boolean));

    const allInLineup = allPlayers.filter(p => lineupIds.has(p.id));

    let currentPitch = new Set<string>(lineup.starters.map(p => typeof p === "string" ? p : p.playerId).filter(id => id !== ""));
    let currentBench = new Set<string>(lineup.substitutes.map(p => typeof p === "string" ? p : p.playerId).filter(id => id !== ""));

    const sortedEvents = [...allEvents].sort((a, b) => {
      if (PERIOD_ORDER[a.period] !== PERIOD_ORDER[b.period]) {
        return PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period];
      }
      return (a.minute ?? 0) - (b.minute ?? 0);
    });

    for (const event of sortedEvents) {
      const isBefore = (event.minute !== null && minute !== null) ? (
        PERIOD_ORDER[event.period] < PERIOD_ORDER[period] ||
        (event.period === period && event.minute < minute)
      ) : true;

      if (!isBefore) break;

      if (event.team === (match?.isHome ? 'home' : 'away')) {
        if (event.type === 'substitution') {
          if (event.subOutPlayerId) currentPitch.delete(event.subOutPlayerId);
          if (event.subOutPlayerId) currentBench.add(event.subOutPlayerId);
          if (event.playerId) currentBench.delete(event.playerId);
          if (event.playerId) currentPitch.add(event.playerId);
        }
      }
    }

    return {
      onPitch: allPlayers.filter(p => currentPitch.has(p.id)),
      onBench: allPlayers.filter(p => currentBench.has(p.id)),
      allInLineup
    };
  }, [allPlayers, allEvents, lineup, minute, period, isPitchManSide, match]);

  React.useEffect(() => {
    if (minute !== null && minute > maxMinutes) setMinute(maxMinutes);
  }, [period, minute, maxMinutes]);

  const resetForm = () => {
    setPlayerId("");
    setPlayerName("");
    setAssistPlayerId("");
    setAssistPlayerName("");
    setSubInPlayerId("");
    setSubInPlayerName("");
    setSubOutPlayerId("");
    setSubOutPlayerName("");
    setMinute(null);
    setPeriod('1T');
    setGoalType('azione');
    setNotes("");
    setStoppagePeriod('1TS');
    setStoppageMinutes(1);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const eventsToSave: Omit<MatchEvent, 'id'>[] = [];
      const baseEvent = { matchId: match?.id || "", minute, period, team };

      if (uiType === 'goal') {
        const selectedScorer = allPlayers.find(p => p.id === playerId);
        const selectedAssist = allPlayers.find(p => p.id === assistPlayerId);

        const goalEvent: any = {
          ...baseEvent,
          type: 'goal',
          goalType,
        };

        if (isPitchManSide) {
          if (playerId) goalEvent.playerId = playerId;
          goalEvent.playerName = displayPlayerName(selectedScorer) || "GIOCATORE";
          if (assistPlayerId && assistPlayerId !== "none") {
            goalEvent.assistPlayerId = assistPlayerId;
            if (selectedAssist) goalEvent.assistPlayerName = selectedAssist.name;
          }
        } else {
          goalEvent.playerName = playerName || match?.opponent || "Avversario";
          if (assistPlayerName) goalEvent.assistPlayerName = assistPlayerName;
        }
        eventsToSave.push(goalEvent);
      } else if (uiType === 'own_goal') {
        const selectedPlayer = allPlayers.find(p => p.id === playerId);
        const ownGoalEvent: any = {
          ...baseEvent,
          type: 'own_goal',
        };

        if (isPitchManSide) {
          if (playerId) ownGoalEvent.playerId = playerId;
          ownGoalEvent.playerName = displayPlayerName(selectedPlayer) || "GIOCATORE";
        } else {
          ownGoalEvent.playerName = playerName || match?.opponent || "Avversario";
        }
        eventsToSave.push(ownGoalEvent);
      } else if (uiType === 'substitution') {
        const selectedIn = allPlayers.find(p => p.id === subInPlayerId);
        const selectedOut = allPlayers.find(p => p.id === subOutPlayerId);

        const subEvent: any = {
          ...baseEvent,
          type: 'substitution',
        };

        if (isPitchManSide) {
          if (subInPlayerId) subEvent.playerId = subInPlayerId;
          subEvent.playerName = displayPlayerName(selectedIn) || "Subentrante";
          if (subOutPlayerId) subEvent.subOutPlayerId = subOutPlayerId;
          subEvent.subOutPlayerName = selectedOut?.name || "Uscente";
        } else {
          subEvent.playerName = subInPlayerName || "Subentrante";
          subEvent.subOutPlayerName = subOutPlayerName || "Uscente";
        }
        eventsToSave.push(subEvent);
      } else if (uiType === 'note') {
        eventsToSave.push({
          ...baseEvent,
          type: 'note',
          notes: notes || "Nota",
          playerName: ""
        });
      } else if (uiType === 'stoppage') {
        // Nessun giocatore: il recupero e' della partita. Il numero di
        // minuti sta in notes come numero semplice, e il periodo e' 1TS o
        // 2TS (non 1T/2T): sono i due tempi a cui il recupero si riferisce.
        eventsToSave.push({
          ...baseEvent,
          type: 'stoppage',
          period: stoppagePeriod,
          minute: stoppageMinutes,
          notes: String(stoppageMinutes),
          playerName: "",
        });
      } else {
        const selectedPlayer = allPlayers.find(p => p.id === playerId);
        const simpleEvent: any = {
          ...baseEvent,
          type: uiType as MatchEventType,
          notes: notes || undefined
        };

        if (isPitchManSide) {
          if (playerId) simpleEvent.playerId = playerId;
          simpleEvent.playerName = displayPlayerName(selectedPlayer) || "Giocatore";
        } else {
          simpleEvent.playerName = playerName || match?.opponent || "Avversario";
        }
        eventsToSave.push(simpleEvent);
      }

      if (eventToEdit) {
        const { ...dataToUpdate } = eventsToSave[0];
        await updateEvent(eventToEdit.id, dataToUpdate);
      } else {
        await addEvents(eventsToSave);
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Errore durante il salvataggio dell'evento:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm bg-card dark:bg-black border border-border dark:border-brand-green/30 text-foreground p-6 rounded-[28px] shadow-2xl dark:shadow-[0_0_20px_rgba(172,229,4,0.05)]">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-black uppercase text-center text-foreground dark:text-white tracking-widest leading-none">
            Evento
          </DialogTitle>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/80 dark:text-muted-foreground/30 text-center mt-1">Tempo Reale</p>
        </DialogHeader>

        <div className="space-y-2">
          {/* SQUADRA */}
          <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Squadra</span>
            <Select
              value={team}
              onValueChange={(v) => { setTeam(v as any); setPlayerId(""); setSubInPlayerId(""); setSubOutPlayerId(""); }}
              open={openSelect === 'team'}
              onOpenChange={(open) => setOpenSelect(open ? 'team' : null)}
              disabled={isSaving}
            >
              <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                <SelectValue placeholder="Seleziona" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                <SelectItem value="home" className="text-[10px] font-black uppercase">{match?.isHome ? (teamName || "PITCHMAN") : match?.opponent || "AVVERSARIO"}</SelectItem>
                <SelectItem value="away" className="text-[10px] font-black uppercase">{!match?.isHome ? (teamName || "PITCHMAN") : match?.opponent || "AVVERSARIO"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* EVENTO */}
          <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Tipo</span>
            <Select
              value={uiType}
              onValueChange={(v) => setUiType(v as UIEventType)}
              open={openSelect === 'type'}
              onOpenChange={(open) => setOpenSelect(open ? 'type' : null)}
              disabled={isSaving}
            >
              <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                <SelectValue placeholder="Seleziona" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                <SelectItem value="goal" className="text-[10px] font-black uppercase text-foreground">Goal</SelectItem>
                <SelectItem value="own_goal" className="text-[10px] font-black uppercase text-foreground">Autogol</SelectItem>
                <SelectItem value="yellow_card" className="text-[10px] font-black uppercase text-foreground">Ammonizione</SelectItem>
                <SelectItem value="red_card" className="text-[10px] font-black uppercase text-foreground">Espulsione</SelectItem>
                <SelectItem value="substitution" className="text-[10px] font-black uppercase text-foreground">Sostituzione</SelectItem>
                <SelectItem value="penalty_saved" className="text-[10px] font-black uppercase text-foreground">Rigore Parato</SelectItem>
                <SelectItem value="penalty_missed" className="text-[10px] font-black uppercase text-foreground">Rigore Sbagliato</SelectItem>
                <SelectItem value="chance" className="text-[10px] font-black uppercase text-foreground">Occasione</SelectItem>
                <SelectItem value="woodwork" className="text-[10px] font-black uppercase text-foreground">Palo/Traversa</SelectItem>
                <SelectItem value="stoppage" className="text-[10px] font-black uppercase text-foreground">Minuti Aggiuntivi</SelectItem>
                <SelectItem value="note" className="text-[10px] font-black uppercase text-foreground">Nota / Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* MINUTI AGGIUNTIVI: periodo in cascata, poi il numero. */}
          {uiType === 'stoppage' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Tempo</span>
                <div className="flex gap-1.5">
                  {(['1TS', '2TS'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      disabled={isSaving}
                      onClick={() => setStoppagePeriod(p)}
                      className={cn(
                        "h-9 px-4 rounded-lg border text-xs font-black transition-colors",
                        stoppagePeriod === p
                          ? "bg-primary text-primary-foreground dark:bg-brand-green dark:text-black border-primary dark:border-brand-green"
                          : "bg-transparent border-border dark:border-brand-green/30 text-foreground dark:text-brand-green",
                      )}
                    >
                      {p === '1TS' ? '1° Tempo' : '2° Tempo'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1 block mb-2">Minuti</span>
                <div className="grid grid-cols-9 gap-1.5">
                  {Array.from({ length: 9 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      type="button"
                      disabled={isSaving}
                      aria-pressed={stoppageMinutes === n}
                      onClick={() => setStoppageMinutes(n)}
                      className={cn(
                        "h-9 rounded-lg border text-xs font-black tabular-nums transition-colors",
                        stoppageMinutes === n
                          ? "bg-primary text-primary-foreground dark:bg-brand-green dark:text-black border-primary dark:border-brand-green"
                          : "bg-transparent border-border dark:border-brand-green/30 text-foreground dark:text-brand-green",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TIPO GOAL (SOTTO TIPO EVENTO) */}
          {uiType === 'goal' && (
            <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Tipo Goal</span>
              <Select 
                value={goalType} 
                onValueChange={(v) => {
                  setGoalType(v as GoalType);
                  if (v === 'rigore') {
                    setAssistPlayerId("");
                    setAssistPlayerName("");
                  }
                }}
                open={openSelect === 'goalDetail'}
                onOpenChange={(open) => setOpenSelect(open ? 'goalDetail' : null)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                  <SelectItem value="azione" className="text-[10px] font-black uppercase">Azione</SelectItem>
                  <SelectItem value="rigore" className="text-[10px] font-black uppercase">Rigore</SelectItem>
                  <SelectItem value="punizione" className="text-[10px] font-black uppercase">Punizione</SelectItem>
                  <SelectItem value="calcio_angolo" className="text-[10px] font-black uppercase">Calcio d&apos;angolo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* GOAL SECTION */}
          {uiType === 'goal' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Marcatore</span>
                {isPitchManSide ? (
                  <Select
                    value={playerId}
                    onValueChange={setPlayerId}
                    open={openSelect === 'scorer'}
                    onOpenChange={(open) => setOpenSelect(open ? 'scorer' : null)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                      <SelectValue placeholder="Giocatore" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                      {playersStatus.onPitch.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{displayPlayerName(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:outline-none text-foreground dark:text-brand-green pr-8 disabled:opacity-50" placeholder="Nome" value={playerName} onChange={e => setPlayerName(e.target.value)} disabled={isSaving} />
                )}
              </div>
              {goalType !== 'rigore' && (
                <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Assist</span>
                  {isPitchManSide ? (
                    <Select
                      value={assistPlayerId}
                      onValueChange={setAssistPlayerId}
                      open={openSelect === 'assist'}
                      onOpenChange={(open) => setOpenSelect(open ? 'assist' : null)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                        <SelectValue placeholder="OPZIONALE" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                        <SelectItem value="none" className="text-[10px] font-black uppercase">-- nessuno --</SelectItem>
                        {playersStatus.onPitch.filter(p => p.id !== playerId).map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{displayPlayerName(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:outline-none text-foreground dark:text-brand-green pr-8 disabled:opacity-50" placeholder="Nome" value={assistPlayerName} onChange={e => setAssistPlayerName(e.target.value)} disabled={isSaving} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* OWN GOAL SECTION */}
          {uiType === 'own_goal' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Autogol di</span>
                {isPitchManSide ? (
                  <Select
                    value={playerId}
                    onValueChange={setPlayerId}
                    open={openSelect === 'ownGoalPlayer'}
                    onOpenChange={(open) => setOpenSelect(open ? 'ownGoalPlayer' : null)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                      <SelectValue placeholder="Giocatore" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                      {playersStatus.allInLineup.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{displayPlayerName(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:outline-none text-foreground dark:text-brand-green pr-8 disabled:opacity-50" placeholder="Nome" value={playerName} onChange={e => setPlayerName(e.target.value)} disabled={isSaving} />
                )}
              </div>
            </div>
          )}

          {/* SUBSTITUTION SECTION */}
          {uiType === 'substitution' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500/50">Out</span>
                {isPitchManSide ? (
                  <Select
                    value={subOutPlayerId}
                    onValueChange={setSubOutPlayerId}
                    open={openSelect === 'subOut'}
                    onOpenChange={(open) => setOpenSelect(open ? 'subOut' : null)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0 text-rose-500">
                      <SelectValue placeholder="Esce" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                      {playersStatus.onPitch.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{displayPlayerName(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:outline-none text-rose-500 pr-8 disabled:opacity-50" placeholder="Esce" value={subOutPlayerName} onChange={e => setSubOutPlayerName(e.target.value)} disabled={isSaving} />
                )}
              </div>
              <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-green/50">In</span>
                {isPitchManSide ? (
                  <Select
                    value={subInPlayerId}
                    onValueChange={setSubInPlayerId}
                    open={openSelect === 'subIn'}
                    onOpenChange={(open) => setOpenSelect(open ? 'subIn' : null)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0 text-brand-green">
                      <SelectValue placeholder="Entra" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                      {playersStatus.onBench.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{displayPlayerName(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:outline-none text-brand-green pr-8 disabled:opacity-50" placeholder="Entra" value={subInPlayerName} onChange={e => setSubInPlayerName(e.target.value)} disabled={isSaving} />
                )}
              </div>
            </div>
          )}

          {/* PLAYER SELECTION FOR OTHERS */}
          {['penalty_saved', 'penalty_missed', 'chance', 'woodwork'].includes(uiType) && (
            <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Player</span>
              {isPitchManSide ? (
                <Select
                  value={playerId}
                  onValueChange={setPlayerId}
                  open={openSelect === 'pitchPlayer'}
                  onOpenChange={(open) => setOpenSelect(open ? 'pitchPlayer' : null)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                    <SelectValue placeholder="NOME" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                    {playersStatus.onPitch.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{displayPlayerName(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:outline-none text-foreground dark:text-brand-green pr-8 disabled:opacity-50" placeholder="Nome" value={playerName} onChange={e => setPlayerName(e.target.value)} disabled={isSaving} />
              )}
            </div>
          )}

          {/* CARDS SECTION (ALL IN LINEUP) */}
          {['yellow_card', 'red_card'].includes(uiType) && (
            <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Giocatore</span>
              {isPitchManSide ? (
                <Select
                  value={playerId}
                  onValueChange={setPlayerId}
                  open={openSelect === 'cardPlayer'}
                  onOpenChange={(open) => setOpenSelect(open ? 'cardPlayer' : null)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                    {playersStatus.allInLineup.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{displayPlayerName(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input className="w-[220px] h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:outline-none text-foreground dark:text-brand-green pr-8 disabled:opacity-50" placeholder="Nome" value={playerName} onChange={e => setPlayerName(e.target.value)} disabled={isSaving} />
              )}
            </div>
          )}

          {/* NOTES FIELD */}
          {uiType === 'note' && (
            <div className="bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1 block mb-2">Testo Nota</span>
              <textarea
                className="w-full bg-transparent border-none text-[12px] font-medium focus:outline-none text-foreground min-h-[80px] resize-none disabled:opacity-50"
                placeholder="Inserisci i dettagli dell'evento..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={isSaving}
              />
            </div>
          )}

          {/* TIME SECTION
              Per il recupero NON si mostra: il blocco dedicato qui sopra
              (periodo 1TS/2TS + numero di minuti) e' l'unica sorgente dei dati
              salvati, e la select periodo/minuto qui sotto verrebbe ignorata
              al submit. Mostrarla insieme era pura ridondanza. */}
          {uiType !== 'stoppage' && (
          <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border border-transparent hover:border-brand-green/20 p-3 rounded-xl transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/50 ml-1">Tempo</span>
            <div className="flex items-center gap-2">
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as any)}
                open={openSelect === 'period'}
                onOpenChange={(open) => setOpenSelect(open ? 'period' : null)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-16 h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                  <SelectItem value="1T" className="text-[10px] font-black uppercase">1T</SelectItem>
                  <SelectItem value="2T" className="text-[10px] font-black uppercase">2T</SelectItem>
                  <SelectItem value="1TS" className="text-[10px] font-black uppercase">1TS</SelectItem>
                  <SelectItem value="2TS" className="text-[10px] font-black uppercase">2TS</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={minute === null ? "none" : minute.toString()}
                onValueChange={(v) => setMinute(v === "none" ? null : parseInt(v))}
                open={openSelect === 'minute'}
                onOpenChange={(open) => setOpenSelect(open ? 'minute' : null)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-24 h-10 bg-transparent border-none text-right font-black uppercase text-xs focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border dark:border-brand-green/30 bg-card dark:bg-background">
                  <SelectItem value="none" className="text-[10px] font-black uppercase">NO MIN.</SelectItem>
                  {Array.from({ length: maxMinutes + 1 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()} className="text-[10px] font-black uppercase">{i}&apos;</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          )}

          <div className="flex items-center gap-3 mt-6 pt-2">
            <Button
              variant="ghost"
              className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest h-12 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Annulla
            </Button>
            <Button
              className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-[10px] tracking-widest h-12 shadow-md dark:shadow-[0_0_15px_rgba(172,229,4,0.1)] hover:scale-[1.02] active:scale-95 transition-all"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                "Salva"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
