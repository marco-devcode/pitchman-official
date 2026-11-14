"use client";

import * as React from "react";
import { useLiveTimerStore } from "@/store/useLiveTimerStore";
import { useMatchDetailStore } from "@/store/useMatchDetailStore";
import { Button } from "@/components/ui/button";
import { Play, Pause, Maximize2, Zap, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function FloatingMatchTimer() {
  const isRunning = useLiveTimerStore((s) => s.isRunning);
  const startTimer = useLiveTimerStore((s) => s.startTimer);
  const pauseTimer = useLiveTimerStore((s) => s.pauseTimer);
  const getElapsedTime = useLiveTimerStore((s) => s.getElapsedTime);
  const matchId = useLiveTimerStore((s) => s.matchId);
  const period = useLiveTimerStore((s) => s.period);
  const isTrackerOpen = useLiveTimerStore((s) => s.isTrackerOpen);
  const setIsTrackerOpen = useLiveTimerStore((s) => s.setIsTrackerOpen);
  const clearSession = useLiveTimerStore((s) => s.clearSession);
  const match = useMatchDetailStore((s) => s.match);
  const load = useMatchDetailStore((s) => s.load);
  const [displaySeconds, setDisplaySeconds] = React.useState(0);
  const router = useRouter();
  const pathname = usePathname();

  // If match detail is not loaded but we have a matchId in timer store, load it
  React.useEffect(() => {
    if (matchId && (!match || match.id !== matchId)) {
      load(matchId);
    }
  }, [matchId, match, load]);

  // Update display timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const update = () => {
      setDisplaySeconds(Math.floor(getElapsedTime() / 1000));
    };

    update();
    if (isRunning) {
      interval = setInterval(update, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, getElapsedTime]);

  // Don't show if no match or if the tracker dialog is open
  if (!matchId || !match || isTrackerOpen) return null;

  const handleReturnToMatch = () => {
    setIsTrackerOpen(true);
    // If we are not already on the match page, navigate there
    const matchUrl = `/calendario/${matchId}?s=${match.seasonId}`;
    if (!pathname.includes(matchId)) {
      router.push(matchUrl);
    }
  };

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;

  return (
    <div className="fixed bottom-24 right-4 z-[100] animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1.5 mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-brand-green fill-brand-green animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/70">LIVE MATCH</span>
        </div>
      </div>
      
      <div className="bg-black/90 dark:bg-black backdrop-blur-xl border border-brand-green/30 rounded-3xl p-3 pl-4 shadow-2xl flex items-center gap-4 group">
        <div className="flex flex-col items-center">
           <div className="flex items-center gap-1.5 mb-0.5">
             <span className="text-[9px] font-black uppercase tracking-widest text-brand-green/80">{period}</span>
           </div>
           <div className="text-2xl font-black tabular-nums text-white leading-none tracking-tight">
             {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
           </div>
        </div>

        <div className="h-10 w-px bg-white/10 mx-1" />

        <div className="flex items-center gap-1.5">
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 rounded-full hover:bg-brand-green/20 text-brand-green transition-all active:scale-90"
            onClick={() => isRunning ? pauseTimer() : startTimer(matchId)}
          >
            {isRunning ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
          </Button>

          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-90"
            onClick={handleReturnToMatch}
          >
            <Maximize2 className="h-5 w-5" />
          </Button>

          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 rounded-full hover:bg-rose-500/20 text-rose-500 transition-all active:scale-90"
            onClick={() => {
              clearSession();
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
