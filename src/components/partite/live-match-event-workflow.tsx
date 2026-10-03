"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronLeft, User, Goal, Star, AlertTriangle, Trash2, Handshake, ArrowRightLeft } from "lucide-react";
import { cn, displayPlayerName } from "@/lib/utils";
import { getPositionCoordinates, getPositionAcronym } from "@/lib/lineup-mapping";
import { Player, MatchLineup, MatchEventType, GoalType, GOAL_TYPES, ROLES, getPrimaryRole } from "@/lib/types";

interface LiveMatchEventWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: MatchEventType;
  team: 'home' | 'away';
  isOurTeam: boolean;
  lineup: MatchLineup | null;
  allPlayers: Player[];
  onComplete: (data: {
    playerId?: string;
    playerName?: string;
    goalType?: GoalType;
    assistPlayerId?: string;
    assistPlayerName?: string;
    subOutPlayerId?: string;
    subOutPlayerName?: string;
  }) => void;
  opponentName?: string;
}

type Step = 'player' | 'goal_type' | 'assist' | 'sub_in';

export function LiveMatchEventWorkflow({
  open,
  onOpenChange,
  eventType,
  team,
  isOurTeam,
  lineup,
  allPlayers,
  onComplete,
  opponentName
}: LiveMatchEventWorkflowProps) {
  const [step, setStep] = React.useState<Step>('player');
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | undefined>();
  const [selectedGoalType, setSelectedGoalType] = React.useState<GoalType>('azione');
  const [selectedAssistId, setSelectedAssistId] = React.useState<string | undefined>();
  const [selectedSubOutId, setSelectedSubOutId] = React.useState<string | undefined>();
  const [customPlayerName, setCustomPlayerName] = React.useState("");
  const [customAssistName, setCustomAssistName] = React.useState("");
  const [customSubOutName, setCustomSubOutName] = React.useState("");

  // Reset state when opening
  React.useEffect(() => {
    if (open) {
      setStep('player');
      setSelectedPlayerId(undefined);
      setSelectedGoalType('azione');
      setSelectedAssistId(undefined);
      setSelectedSubOutId(undefined);
      setCustomPlayerName("");
      setCustomAssistName("");
      setCustomSubOutName("");
    }
  }, [open]);

  const handlePlayerSelect = (playerId: string) => {
    const player = allPlayers.find(p => p.id === playerId);
    if (step === 'player') {
      if (eventType === 'substitution') {
        setSelectedSubOutId(playerId);
        if (isOurTeam) setStep('sub_in');
      } else {
        setSelectedPlayerId(playerId);
        if (eventType === 'goal' && isOurTeam) {
          setStep('goal_type');
        } else {
          onComplete({ playerId, playerName: player ? displayPlayerName(player) : "" });
          onOpenChange(false);
        }
      }
    } else if (step === 'sub_in') {
      const subOutPlayer = allPlayers.find(p => p.id === selectedSubOutId);
      onComplete({ 
        playerId, 
        playerName: player ? displayPlayerName(player) : "",
        subOutPlayerId: selectedSubOutId,
        subOutPlayerName: subOutPlayer ? displayPlayerName(subOutPlayer) : ""
      });
      onOpenChange(false);
    } else if (step === 'assist') {
      setSelectedAssistId(playerId);
      const mainPlayer = allPlayers.find(p => p.id === selectedPlayerId);
      onComplete({
        playerId: selectedPlayerId,
        playerName: mainPlayer ? displayPlayerName(mainPlayer) : (customPlayerName.trim() || opponentName || "Avversario"),
        goalType: selectedGoalType,
        assistPlayerId: playerId === 'none' ? undefined : playerId,
        assistPlayerName: playerId === 'none' ? undefined : (player ? displayPlayerName(player) : "")
      });
      onOpenChange(false);
    }
  };

  const handleGoalTypeConfirm = () => {
    if (selectedGoalType === 'rigore') {
      const mainPlayer = allPlayers.find(p => p.id === selectedPlayerId);
      onComplete({
        playerId: selectedPlayerId,
        playerName: mainPlayer ? displayPlayerName(mainPlayer) : (customPlayerName.trim() || opponentName || "Avversario"),
        goalType: selectedGoalType,
      });
      onOpenChange(false);
    } else {
      setStep('assist');
    }
  };

  const renderPitch = (isAssist: boolean = false, isSubIn: boolean = false) => {
    if (!lineup || !lineup.formation) return renderPlayerList(isAssist, isSubIn);

    const starters = lineup.starters.map(s => typeof s === 'string' ? s : s.playerId);
    const substitutes = lineup.substitutes.map(s => typeof s === 'string' ? s : s.playerId);

    return (
      <div className="space-y-4">
        {isAssist && (
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-dashed border-2 font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 transition-all border-white/10"
            onClick={() => handlePlayerSelect('none')}
          >
            Nessun Assist
          </Button>
        )}
        
        <div className="relative aspect-[3/4] w-full max-w-[320px] mx-auto rounded-2xl bg-neutral-900 border-4 border-white/5 overflow-hidden shadow-xl p-4">
           {/* Pitch lines */}
           <div className="absolute inset-4 border border-white/10 pointer-events-none rounded-sm">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-b border-x border-white/10" />
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-t border-x border-white/10" />
             <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-1/2" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/10 rounded-full" />
           </div>

           <div className="relative w-full h-full">
             {starters.map((pid, idx) => {
               const coords = getPositionCoordinates(lineup.formation!, idx);
               const acronym = getPositionAcronym(lineup.formation!, idx);
               const player = allPlayers.find(p => p.id === pid);
               const isSelected = isAssist ? selectedAssistId === pid : (isSubIn ? selectedPlayerId === pid : selectedSubOutId === pid);

               return (
                 <div 
                   key={idx}
                   className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 w-12 transition-all"
                   style={{ top: `${coords.top}%`, left: `${coords.left}%` }}
                   onClick={() => pid && handlePlayerSelect(pid)}
                 >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer",
                      pid ? (
                        isSelected 
                        ? "border-theme bg-theme-fill text-theme scale-110 shadow-theme"
                        : "bg-neutral-800 border-neutral-700 text-white hover:border-theme"
                      ) : "bg-neutral-900 border-neutral-800 border-dashed"
                    )}>
                      {pid ? <span className="text-[8px] font-black">{acronym}</span> : null}
                    </div>
                    <span className="text-[7px] font-black text-white/70 uppercase truncate w-full text-center">
                      {player ? displayPlayerName(player) : ""}
                    </span>
                 </div>
               );
             })}
           </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-3">
          <p className="text-[9px] font-black uppercase text-white/40 mb-2 tracking-widest">Panchina</p>
          <div className="grid grid-cols-2 gap-2">
            {substitutes.map(pid => {
              const player = allPlayers.find(p => p.id === pid);
              if (!player) return null;
              const isSelected = isAssist ? selectedAssistId === pid : (isSubIn ? selectedPlayerId === pid : selectedSubOutId === pid);
              return (
                <Button 
                  key={pid} 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "h-8 text-[9px] font-bold uppercase justify-start px-2 rounded-lg border-white/10",
                    isSelected && "border-theme bg-theme-fill text-theme"
                  )}
                  onClick={() => handlePlayerSelect(pid)}
                >
                  <User className="mr-1.5 h-3 w-3 opacity-50" />
                  <span className="truncate">{displayPlayerName(player)}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderPlayerList = (isAssist: boolean = false, isSubIn: boolean = false) => {
    return (
      <div className="space-y-4">
        {isAssist && (
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-dashed border-2 font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 transition-all border-white/10"
            onClick={() => handlePlayerSelect('none')}
          >
            Nessun Assist
          </Button>
        )}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {ROLES.map(role => {
              const playersInRole = allPlayers.filter(p => getPrimaryRole(p) === role.toUpperCase());
              if (playersInRole.length === 0) return null;
              return (
                <div key={role} className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-brand-green tracking-widest pl-1">{role}</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {playersInRole.map(player => {
                      const isSelected = isAssist ? selectedAssistId === player.id : (isSubIn ? selectedPlayerId === player.id : selectedSubOutId === player.id);
                      return (
                        <Button
                          key={player.id}
                          variant="outline"
                          className={cn(
                            "h-12 justify-start px-4 rounded-xl border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold transition-all",
                            isSelected && "border-theme bg-theme-fill-soft text-theme"
                          )}
                          onClick={() => handlePlayerSelect(player.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="uppercase text-xs">{displayPlayerName(player)}</span>
                            {isSelected && <Star className="h-4 w-4 fill-current" />}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const getTitle = () => {
    switch (step) {
      case 'player': 
        if (eventType === 'substitution') return "Chi esce?";
        return `Chi ha fatto ${eventType === 'goal' ? 'GOL' : eventType.replace('_', ' ')}?`;
      case 'sub_in': return "Chi entra?";
      case 'goal_type': return "Tipo di Gol";
      case 'assist': return "Chi ha fatto l'ASSIST?";
      default: return "Dettagli Evento";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md bg-black border-theme text-white p-6 rounded-[32px] shadow-2xl" style={{ borderWidth: 2 }}>
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between">
            {step !== 'player' && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white" onClick={() => {
                if (step === 'sub_in') setStep('player');
                else if (step === 'assist') setStep('goal_type');
                else if (step === 'goal_type') setStep('player');
              }}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-center flex-1">
              {getTitle()}
            </DialogTitle>
            <div className="w-8" />
          </div>
        </DialogHeader>

        {step === 'player' && (
          isOurTeam 
            ? (lineup?.starters?.length ? renderPitch() : renderPlayerList()) 
            : (
              <div className="space-y-6 py-4">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center">
                    {eventType === 'substitution' ? "Nome giocatore che esce" : "Inserisci il nome del protagonista"}
                  </p>
                  <div className="relative">
                    <input 
                      autoFocus
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-lg font-black uppercase tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:border-theme transition-all"
                      placeholder={opponentName || "AVVERSARIO"}
                      value={eventType === 'substitution' ? customSubOutName : customPlayerName}
                      onChange={(e) => eventType === 'substitution' ? setCustomSubOutName(e.target.value) : setCustomPlayerName(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <User className="h-5 w-5 text-white/20" />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-white/30 uppercase text-center">Lascia vuoto per usare il nome della squadra</p>
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full h-14 bg-brand-green text-black font-black uppercase tracking-widest rounded-2xl hover:bg-brand-green/80 shadow-[0_0_20px_rgba(172,229,4,0.3)] transition-all"
                    onClick={() => {
                        if (eventType === 'substitution') {
                            setStep('sub_in');
                        } else {
                            const finalName = customPlayerName.trim() || opponentName || "Avversario";
                            if (eventType === 'goal') {
                                setSelectedPlayerId(undefined);
                                setStep('goal_type');
                            } else {
                                onComplete({ playerName: finalName });
                                onOpenChange(false);
                            }
                        }
                    }}
                  >
                    {eventType === 'goal' ? 'Continua al tipo goal' : (eventType === 'substitution' ? 'Continua al sub-in' : 'Salva Evento')}
                  </Button>
                </div>
              </div>
            )
        )}

        {step === 'goal_type' && (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
               <p className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Seleziona come è stato segnato il gol</p>
               <Select value={selectedGoalType} onValueChange={(v) => setSelectedGoalType(v as GoalType)}>
                 <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-lg font-black uppercase tracking-widest focus:ring-brand-green">
                   <SelectValue placeholder="Tipo Gol" />
                 </SelectTrigger>
                 <SelectContent className="bg-neutral-900 border-white/10 text-white">
                   {GOAL_TYPES.map(type => (
                     <SelectItem key={type} value={type} className="font-bold uppercase py-3">{type.replace('_', ' ')}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>

            <Button 
              className="w-full h-14 bg-brand-green text-black font-black uppercase tracking-widest rounded-2xl hover:bg-brand-green/80 shadow-[0_0_20px_rgba(172,229,4,0.2)]"
              onClick={handleGoalTypeConfirm}
            >
              Continua all'Assist
            </Button>
          </div>
        )}

        {step === 'assist' && (
          isOurTeam 
            ? (lineup?.starters?.length ? renderPitch(true) : renderPlayerList(true))
            : (
              <div className="space-y-6 py-4">
                <Button 
                  variant="outline" 
                  className="w-full h-12 rounded-xl border-dashed border-2 font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 transition-all border-white/10"
                  onClick={() => handlePlayerSelect('none')}
                >
                  Nessun Assist
                </Button>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Inserisci il nome dell'assistman</p>
                  <div className="relative">
                    <input 
                      autoFocus
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-lg font-black uppercase tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:border-theme transition-all"
                      placeholder={opponentName || "AVVERSARIO"}
                      value={customAssistName}
                      onChange={(e) => setCustomAssistName(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Handshake className="h-5 w-5 text-white/20" />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-white/30 uppercase text-center">Lascia vuoto per usare il nome della squadra</p>
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full h-14 bg-brand-green text-black font-black uppercase tracking-widest rounded-2xl hover:bg-brand-green/80 shadow-[0_0_20px_rgba(172,229,4,0.3)] transition-all"
                    onClick={() => {
                      const finalAssistName = customAssistName.trim() || opponentName || "Avversario";
                      const mainPlayer = allPlayers.find(p => p.id === selectedPlayerId);
                      onComplete({
                        playerId: selectedPlayerId,
                        playerName: mainPlayer ? displayPlayerName(mainPlayer) : (customPlayerName.trim() || opponentName || "Avversario"),
                        goalType: selectedGoalType,
                        assistPlayerName: finalAssistName
                      });
                      onOpenChange(false);
                    }}
                  >
                    Salva Evento
                  </Button>
                </div>
              </div>
            )
        )}

        {step === 'sub_in' && (
          isOurTeam 
            ? (lineup?.starters?.length ? renderPitch(false, true) : renderPlayerList(false, true))
            : (
              <div className="space-y-6 py-4">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Nome giocatore che entra</p>
                  <div className="relative">
                    <input 
                      autoFocus
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-lg font-black uppercase tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:border-theme transition-all"
                      placeholder={opponentName || "AVVERSARIO"}
                      value={customPlayerName}
                      onChange={(e) => setCustomPlayerName(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <ArrowRightLeft className="h-5 w-5 text-white/20" />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-white/30 uppercase text-center">Lascia vuoto per usare il nome della squadra</p>
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full h-14 bg-brand-green text-black font-black uppercase tracking-widest rounded-2xl hover:bg-brand-green/80 shadow-[0_0_20px_rgba(172,229,4,0.3)] transition-all"
                    onClick={() => {
                      const finalSubInName = customPlayerName.trim() || opponentName || "Avversario";
                      const finalSubOutName = customSubOutName.trim() || opponentName || "Avversario";
                      onComplete({
                        playerName: finalSubInName,
                        subOutPlayerName: finalSubOutName
                      });
                      onOpenChange(false);
                    }}
                  >
                    Salva Sostituzione
                  </Button>
                </div>
              </div>
            )
        )}
      </DialogContent>
    </Dialog>
  );
}
