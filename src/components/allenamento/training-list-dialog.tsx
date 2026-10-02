
"use client";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronRight, Target } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { TrainingSession } from "@/lib/types";

interface TrainingListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: TrainingSession[];
}

export function TrainingListDialog({ open, onOpenChange, sessions }: TrainingListDialogProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSessions = useMemo(() => {
    return [...sessions].sort((a,b) => b.date.localeCompare(a.date)).filter(s => {
      const dateStr = format(s.date.includes('T') ? parseISO(s.date) : new Date(s.date), "dd MMMM yyyy", { locale: it }).toLowerCase();
      const focusStr = (s.focus || "").toLowerCase();
      const indexStr = `allenamento #${s.index.toString().padStart(2, '0')}`;
      return dateStr.includes(searchTerm.toLowerCase()) || 
             focusStr.includes(searchTerm.toLowerCase()) || 
             indexStr.includes(searchTerm.toLowerCase());
    });
  }, [sessions, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-[32px] bg-background dark:bg-black border-border dark:border-brand-green/30 p-0 overflow-hidden shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.4)]">
        <DialogHeader className="p-6 border-b border-border dark:border-brand-green/20 space-y-4">
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground dark:text-white">Archivio Allenamenti</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/40 dark:text-brand-green/40" />
            <Input 
              placeholder="Cerca per data, focus o numero..."
              className="pl-10 h-11 rounded-2xl bg-muted/30 dark:bg-white/5 border border-transparent focus:border-primary/30 dark:focus:border-brand-green/30 text-sm font-bold placeholder:text-muted-foreground/80 dark:text-muted-foreground/30 dark:placeholder:text-white/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] p-4">
          <div className="space-y-2">
            {filteredSessions.map((session) => {
              const d = session.date.includes('T') ? parseISO(session.date) : new Date(session.date);
              return (
                <button 
                  key={session.id}
                  onClick={() => {
                    onOpenChange(false);
                    router.push(`/allenamento/${session.id}`);
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl group border border-transparent hover:border-border/50 dark:hover:border-brand-green/30 bg-card/50 dark:bg-white/[0.02] hover:bg-muted/50 dark:hover:bg-brand-green/[0.05] shadow-sm hover:shadow-md dark:shadow-none transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted dark:bg-black border border-border dark:border-brand-green/20 flex flex-col items-center justify-center transition-colors group-hover:border-primary/30 dark:group-hover:border-brand-green/50">
                      <span className="text-[10px] font-black uppercase text-muted-foreground/80 dark:text-muted-foreground/60 leading-none group-hover:text-primary dark:group-hover:text-brand-green transition-colors">{format(d, "MMM", { locale: it })}</span>
                      <span className="text-lg font-black text-foreground dark:text-white leading-none mt-0.5">{format(d, "dd")}</span>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-black uppercase tracking-widest text-foreground dark:text-white group-hover:text-primary dark:group-hover:text-brand-green transition-colors">Allenamento #{session.index.toString().padStart(2, '0')}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Target className="h-3 w-3 text-primary dark:text-brand-green opacity-40 group-hover:opacity-100 transition-opacity" />
                        <span className="text-[10px] font-bold text-muted-foreground dark:text-white/40 uppercase tracking-tighter">{session.focus || "Nessun focus"}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/80 dark:text-muted-foreground/30 group-hover:text-primary dark:group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                </button>
              )
            })}
            {filteredSessions.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                <Search className="h-10 w-10 text-muted-foreground/10 dark:text-brand-green/10" />
                <p className="text-[10px] font-black uppercase text-muted-foreground/80 dark:text-muted-foreground/30 dark:text-white/20 tracking-widest">Nessun allenamento trovato</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
