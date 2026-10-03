"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useMatchDetailStore } from '@/store/useMatchDetailStore';
import * as AIService from '@/services/ai.service';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';
import { AsyncFeedback } from '@/components/ui/async-feedback';
import { MATCH_FORMATIONS } from '@/lib/lineup-mapping';

interface SmartLineupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmartLineupDialog({ open, onOpenChange }: SmartLineupDialogProps) {
  const [rawList, setRawList] = useState('');
  const { allPlayers, saveLineup, lineup } = useMatchDetailStore();
  const [modulo, setModulo] = useState('4-4-2');
  const { toast } = useToast();
  const { run: runSuggest, loading: isAnalyzing, error } = useAsyncAction(
    (args: { rawList: string; formation: string }) =>
      AIService.suggestLineup({
        rawList: args.rawList,
        availablePlayers: allPlayers.map(p => ({ id: p.id, name: p.name })),
        formation: args.formation,
      }),
  );

  useEffect(() => {
    if (open && lineup?.formation) {
      setModulo(lineup.formation);
    }
  }, [open, lineup]);

  const handleSmartAnalyze = async () => {
    if (!rawList.trim()) return;

    const result = await runSuggest({ rawList: rawList.trim(), formation: modulo });
    if (!result) return; // error captured in `error` state

    await saveLineup({
      matchId: "", // Gestito dallo store
      starters: result.starters,
      substitutes: result.substitutes,
      formation: modulo,
    });

    toast({
      title: "Formazione Elaborata",
      description: "L'AI ha associato i giocatori. Controlla le posizioni prima di confermare.",
    });
    onOpenChange(false);
    setRawList('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh] bg-background dark:bg-black">
        <DialogHeader className="p-6 bg-card dark:bg-black border-b border-border dark:border-brand-green/30 text-foreground dark:text-white shrink-0 relative transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted dark:bg-white/5 border border-border dark:border-white/10 rounded-xl">
              <Sparkles className="h-6 w-6 text-primary dark:text-brand-green" />
            </div>
            <div>
              <DialogTitle className="uppercase font-black tracking-tight">AI Smart Lineup</DialogTitle>
              <DialogDescription className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">
                Associazione Automatica Giocatori
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-card dark:bg-card/50 border-b border-border dark:border-white/10 px-6 py-3 flex items-center justify-between text-[10px] uppercase font-black tracking-widest shadow-inner shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground dark:text-white/60">SELEZIONA MODULO</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={modulo} onValueChange={setModulo}>
              <SelectTrigger className="bg-background dark:bg-black text-foreground dark:text-white h-8 text-[11px] w-28 py-0 font-black border border-primary/50 dark:border-brand-green/50 shadow-sm uppercase focus:ring-1 focus:ring-primary dark:focus:ring-brand-green">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card dark:bg-black border-border dark:border-brand-green/50 text-foreground dark:text-white">
                {MATCH_FORMATIONS.map((f) => (
                  <SelectItem key={f} value={f} className="text-[11px] font-black">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1 bg-background dark:bg-black transition-colors">
          <div className="p-6 space-y-6">
            <Alert className="bg-muted dark:bg-card/50 border-border dark:border-brand-green/30 rounded-2xl transition-colors">
              <AlertCircle className="h-4 w-4 text-primary dark:text-white" />
              <AlertTitle className="text-[10px] font-black uppercase text-foreground dark:text-white mb-1">Attenzione</AlertTitle>
              <AlertDescription className="text-[11px] font-bold text-muted-foreground dark:text-white/40 uppercase leading-relaxed">
                Se l'AI non riconosce un nome, lascerà la posizione vuota. 
                <span className="text-foreground dark:text-white block mt-1">Verifica sempre la formazione dopo l'inserimento automatico.</span>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/30 tracking-widest ml-1">Incolla la lista (es. da WhatsApp):</p>
              <Textarea
                placeholder="1. Rossi&#10;2. Bianchi&#10;3. Neri..."
                value={rawList}
                onChange={(e) => setRawList(e.target.value)}
                disabled={isAnalyzing}
                className="min-h-[200px] text-xs font-bold rounded-2xl bg-background dark:bg-black border-border dark:border-brand-green/30 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white placeholder:text-muted-foreground dark:text-muted-foreground/30 dark:placeholder:text-white/10"
              />
            </div>

            <AsyncFeedback
              loading={isAnalyzing}
              error={error}
              loadingText="L'AI sta leggendo la lista… mappatura nomi in corso"
            />
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-0 flex-row gap-3 shrink-0 bg-background dark:bg-black transition-colors">
          <Button variant="ghost" className="flex-1 rounded-2xl font-black uppercase text-[10px] h-12 text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/5 transition-colors" onClick={() => onOpenChange(false)} disabled={isAnalyzing}>
            Annulla
          </Button>
          <Button 
            onClick={handleSmartAnalyze} 
            className="flex-1 bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-white hover:opacity-90 dark:hover:bg-brand-green/10 rounded-2xl font-black uppercase text-[10px] h-12 shadow-md dark:shadow-theme transition-all" 
            disabled={isAnalyzing || !rawList.trim()}
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Inserisci Formazione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
