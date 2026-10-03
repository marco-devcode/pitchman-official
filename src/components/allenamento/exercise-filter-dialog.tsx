"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Filter, Globe, Lock, Target, Users, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusFilter: string | null;
  setFocusFilter: (f: string | null) => void;
  visibilityFilter: 'all' | 'private' | 'global';
  setVisibilityFilter: (v: 'all' | 'private' | 'global') => void;
  playerCountFilter: string[];
  setPlayerCountFilter: (c: string[]) => void;
  uniqueFocuses: string[];
}

const COMMON_PLAYER_COUNTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '22+'];

export function ExerciseFilterDialog({
  open,
  onOpenChange,
  focusFilter,
  setFocusFilter,
  visibilityFilter,
  setVisibilityFilter,
  playerCountFilter,
  setPlayerCountFilter,
  uniqueFocuses
}: ExerciseFilterDialogProps) {
  
  const togglePlayerCountFilter = (c: string) => {
    setPlayerCountFilter(playerCountFilter.includes(c) 
      ? playerCountFilter.filter(x => x !== c) 
      : [...playerCountFilter, c]);
  };

  const resetFilters = () => {
    setFocusFilter(null);
    setVisibilityFilter('all');
    setPlayerCountFilter([]);
  };

  const activeFiltersCount = (focusFilter ? 1 : 0) + (visibilityFilter !== 'all' ? 1 : 0) + (playerCountFilter.length > 0 ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-card dark:bg-zinc-950 border border-border dark:border-brand-green/30 rounded-[32px] shadow-2xl p-5 outline-none overflow-hidden">
        <DialogHeader className="mb-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-foreground dark:text-white leading-none">Filtra Archivio</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground dark:text-muted-foreground/50">Ottimizza la ricerca tecnica</DialogDescription>
            </div>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-all">
                <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset ({activeFiltersCount})
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 overflow-y-auto max-h-[70vh] px-1 scrollbar-hide">
          {/* Left Column: Focus & Visibility */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary dark:text-brand-green" />
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Focus Tecnico</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button 
                  onClick={() => setFocusFilter(null)} 
                  className={cn(
                    "h-10 rounded-xl text-[10px] font-black uppercase border transition-all",
                    !focusFilter 
                      ? "bg-primary dark:bg-black border-primary dark:border-brand-green text-white dark:text-brand-green shadow-sm dark:shadow-theme-strong" 
                      : "bg-muted/10 dark:bg-black/20 border-transparent text-muted-foreground hover:bg-muted/20"
                  )}
                >
                  Tutti i Focus
                </button>
                {uniqueFocuses.map(f => (
                  <button 
                    key={f} 
                    onClick={() => setFocusFilter(f)} 
                    className={cn(
                      "h-10 rounded-xl text-[10px] font-black uppercase border transition-all whitespace-nowrap overflow-hidden text-ellipsis px-2",
                      focusFilter === f 
                        ? "bg-primary dark:bg-black border-primary dark:border-brand-green text-white dark:text-brand-green shadow-sm dark:shadow-theme-strong" 
                        : "bg-muted/10 dark:bg-black/20 border-transparent text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                {visibilityFilter === 'global' ? <Globe className="h-4 w-4 text-blue-500" /> : <Lock className="h-4 w-4 text-amber-500" />}
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visibilità Archivio</Label>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-1.5">
                {[
                  { id: 'all' as const, label: 'Tutto', icon: Filter },
                  { id: 'private' as const, label: 'Privati', icon: Lock },
                  { id: 'global' as const, label: 'Globali', icon: Globe }
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVisibilityFilter(v.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all text-left",
                      visibilityFilter === v.id
                        ? "bg-primary/10 dark:bg-brand-green/10 border-primary dark:border-brand-green text-primary dark:text-brand-green shadow-sm"
                        : "bg-muted/10 dark:bg-black/20 border-transparent text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <v.icon className={cn("h-3.5 w-3.5", visibilityFilter === v.id ? "text-primary dark:text-brand-green" : "text-muted-foreground dark:text-muted-foreground/40")} />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Player Count */}
          <div className="space-y-2">
             <div className="flex items-center gap-2 mb-1">
               <Users className="h-4 w-4 text-primary dark:text-brand-green" />
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">N. Giocatori (Filtro Multiplo)</Label>
             </div>
             <div className="bg-muted/20 dark:bg-black/20 p-3 rounded-2xl border border-border dark:border-brand-green/10">
               <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-4 gap-1.5">
                 {COMMON_PLAYER_COUNTS.map(c => (
                   <button
                     key={c}
                     onClick={() => togglePlayerCountFilter(c)}
                     className={cn(
                       "h-10 w-full rounded-lg text-xs font-black border transition-all flex items-center justify-center",
                       playerCountFilter.includes(c) 
                         ? "bg-primary dark:bg-black border-primary dark:border-brand-green text-white dark:text-brand-green shadow-sm dark:shadow-theme-strong scale-105 z-10" 
                         : "bg-background dark:bg-zinc-900 border-border dark:border-brand-green/5 text-muted-foreground hover:border-border"
                     )}
                   >
                     {c}
                   </button>
                 ))}
               </div>
               <p className="text-[8px] text-muted-foreground dark:text-muted-foreground/40 font-bold uppercase tracking-widest text-center mt-3 italic leading-none">
                * Filtro inclusivo (Almeno uno dei numeri selezionati).
               </p>
             </div>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-border dark:border-white/5">
          <Button 
            className="w-full h-12 rounded-2xl bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-xs shadow-xl dark:shadow-theme hover:scale-[1.02] active:scale-95 transition-all"
            onClick={() => onOpenChange(false)}
          >
            Applica Filtri <Filter className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
