"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMatchDetailStore } from "@/store/useMatchDetailStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Play, Pause, Square, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

import { useLiveTimerStore } from "@/store/useLiveTimerStore";
import { LiveMatchEventWorkflow } from "./live-match-event-workflow";
import { MatchEventType } from "@/lib/types";

/**
 * Il GOL e i bottoni neutri prendono il gradiente: bordo a gradiente e
 * riempimento mescolato col nero, con testo `--t1`.
 *
 * Il testo NON va sul gradiente pieno: su due colori arbitrari nessun bianco
 * o nero supera 4.5:1 su entrambi gli estremi (vedi regola 6).
 *
 * Ammonizione ed espulsione restano gialle e rosse: sono esiti, non tema —
 * come il badge di vittoria, e valgono la stessa eccezione.
 */
const EVENT_BUTTONS = [
  { type: "goal", label: "GOL", color: "border-theme bg-theme-fill-soft text-theme hover:bg-theme-fill shadow-theme" },
  { type: "chance", label: "OCCASIONE", color: "border-theme bg-transparent text-foreground hover:bg-theme-fill-soft" },
  { type: "woodwork", label: "PALO / TRAVERSA", color: "border-theme bg-transparent text-foreground hover:bg-theme-fill-soft" },
  { type: "yellow_card", label: "AMMONIZIONE", color: "bg-brand-card-yellow text-white hover:opacity-90 border-transparent" },
  { type: "red_card", label: "ESPULSIONE", color: "bg-brand-card-red text-white hover:opacity-90 border-transparent" },
  { type: "substitution", label: "SOSTITUZIONE", color: "border-theme bg-transparent text-foreground hover:bg-theme-fill-soft" },
];

export function LiveMatchTracker({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { match, addEvent, lineup, allPlayers } = useMatchDetailStore();
  const teamName = useSettingsStore(state => state.teamName) || "PITCHMAN";
  
  const { 
    isRunning, 
    period, 
    startTimer, 
    pauseTimer, 
    resetTimer, 
    setPeriod, 
    getElapsedTime,
    setIsTrackerOpen
  } = useLiveTimerStore();

  const [seconds, setSeconds] = useState(0);
  const [simpleMode, setSimpleMode] = useState(true);
  
  // Workflow state
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [activeEventType, setActiveEventType] = useState<MatchEventType>("goal");
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');

  useEffect(() => {
    setIsTrackerOpen(open);
    // When unmounting or closing, ensure it's marked as closed
    return () => setIsTrackerOpen(false);
  }, [open, setIsTrackerOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const update = () => {
      setSeconds(Math.floor(getElapsedTime() / 1000));
    };

    update();
    if (isRunning) {
      interval = setInterval(update, 500);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, getElapsedTime]);

  const handleStartPause = () => {
    if (!match) return;
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer(match.id);
    }
  };

  const handleStop = () => { 
    if (!match) return;
    resetTimer(match.id);
  };

  const handlePeriodToggle = (checked: boolean) => {
    setPeriod(checked ? '2T' : '1T');
    if (match) resetTimer(match.id);
  };

  const handleEvent = async (type: string, team: 'home' | 'away') => {
    if (!match) return;
    
    if (!simpleMode) {
      setActiveEventType(type as MatchEventType);
      setActiveTeam(team);
      setWorkflowOpen(true);
      return;
    }

    const minute = Math.floor(seconds / 60);
    
    await addEvent({
      matchId: match.id,
      type: type as any,
      team,
      minute,
      period,
      playerName: type === 'own_goal' ? "Autogol" : "",
    });
  };

  const onWorkflowComplete = async (data: any) => {
    if (!match) return;
    const minute = Math.floor(seconds / 60);
    
    await addEvent({
      matchId: match.id,
      type: activeEventType,
      team: activeTeam,
      minute,
      period,
      ...data
    });
  };

  if (!match) return null;

  const homeName = match.isHome ? teamName : match.opponent;
  const awayName = !match.isHome ? teamName : match.opponent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md bg-card dark:bg-black border border-border dark:border-brand-green/30 text-foreground p-6 rounded-[32px] shadow-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-black uppercase text-center text-foreground dark:text-white tracking-widest leading-none flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-primary dark:text-brand-green" />
            LIVE MATCH
          </DialogTitle>
        </DialogHeader>

        {/* Timer Section */}
        <div className="flex items-center justify-between bg-muted/20 dark:bg-black/40 border-theme p-5 rounded-2xl mb-6 shadow-inner" style={{ borderWidth: 2 }}>
           <div className="flex flex-col items-center gap-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tempo</span>
             <Switch 
               checked={period === '2T'} 
               onCheckedChange={handlePeriodToggle}
               className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green"
             />
             <span className="text-xs font-black uppercase tracking-widest text-primary dark:text-brand-green">{period}</span>
           </div>

           <div className="text-6xl font-black tabular-nums tracking-tighter text-foreground dark:text-white">
             {String(Math.floor(seconds / 60)).padStart(2, '0')}<span className="opacity-50 animate-pulse">:</span>{String(seconds % 60).padStart(2, '0')}
           </div>

           <div className="flex flex-col gap-2">
             <Button size="icon" variant="outline" className="h-10 w-10 rounded-full border-theme text-theme hover:bg-theme-fill-soft shadow-theme" onClick={handleStartPause}>
               {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
             </Button>
             <Button size="icon" variant="outline" className="h-10 w-10 rounded-full border-rose-500 text-rose-500 hover:bg-rose-500/10" onClick={handleStop}>
               <Square className="h-4 w-4" />
             </Button>
           </div>
        </div>

        {/* Simple Mode Toggle */}
        <div className="flex items-center justify-between mb-6 px-4 py-3 bg-muted/10 dark:bg-white/5 rounded-xl border border-border dark:border-white/10 transition-all">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground dark:text-brand-green">Cronaca Dettagliata</span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase">Seleziona autore, assist e tipo gol</span>
          </div>
          <Switch 
            checked={!simpleMode} 
            onCheckedChange={(val) => setSimpleMode(!val)} 
            className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green scale-90"
          />
        </div>

        {/* Teams Tabs */}
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-14 bg-muted/50 dark:bg-black/40 border-theme p-1.5 rounded-2xl" style={{ borderWidth: 2 }}>
            <TabsTrigger value="home" className="text-xs font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-card dark:data-[state=active]:bg-black data-[state=active]:text-theme data-[state=active]:shadow-sm transition-all overflow-hidden">
              <span className="truncate w-full block px-2">{homeName}</span>
            </TabsTrigger>
            <TabsTrigger value="away" className="text-xs font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-card dark:data-[state=active]:bg-black data-[state=active]:text-theme data-[state=active]:shadow-sm transition-all overflow-hidden">
              <span className="truncate w-full block px-2">{awayName}</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="home" className="grid grid-cols-2 gap-3 outline-none">
            {EVENT_BUTTONS.map(btn => (
              <Button key={btn.type} className={cn("h-16 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-sm border-2 active:scale-95 transition-all", btn.color)} onClick={() => handleEvent(btn.type, 'home')}>
                {btn.label}
              </Button>
            ))}
          </TabsContent>
          
          <TabsContent value="away" className="grid grid-cols-2 gap-3 outline-none">
             {EVENT_BUTTONS.map(btn => (
              <Button key={btn.type} className={cn("h-16 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-sm border-2 active:scale-95 transition-all", btn.color)} onClick={() => handleEvent(btn.type, 'away')}>
                {btn.label}
              </Button>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>

      <LiveMatchEventWorkflow 
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        eventType={activeEventType}
        team={activeTeam}
        isOurTeam={activeTeam === (match.isHome ? 'home' : 'away')}
        lineup={lineup}
        allPlayers={allPlayers}
        opponentName={match.opponent}
        onComplete={onWorkflowComplete}
      />
    </Dialog>
  );
}
