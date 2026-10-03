"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, AlertCircle, Info } from 'lucide-react';
import * as AIService from '@/services/ai.service';
import { useToast } from '@/hooks/use-toast';
import { PlayerRole, Role } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';
import { AsyncFeedback } from '@/components/ui/async-feedback';

interface SmartPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (players: { name: string, roles: PlayerRole[] }[]) => Promise<void>;
}

export function SmartPlayerDialog({ open, onOpenChange, onSave }: SmartPlayerDialogProps) {
  const [rawText, setRawText] = useState('');
  const { toast } = useToast();
  const { run: runImport, loading: isAnalyzing, error } = useAsyncAction(
    (text: string) => AIService.importPlayers({ rawText: text }),
  );

  const handleSmartImport = async () => {
    if (!rawText.trim() || rawText.trim().length < 5) return;

    const result = await runImport(rawText.trim());
    if (!result) return; // error already captured in `error` state

    if (result.players.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Errore Importazione Smart',
        description: 'Nessun giocatore individuato. Controlla il formato del testo.',
      });
      return;
    }

    const players = result.players.map(p => ({
      name: p.name,
      roles: p.roles as unknown as PlayerRole[],
    }));
    await onSave(players);

    toast({
      title: 'Rosa Aggiornata',
      description: `Importati con successo ${result.players.length} giocatori.`,
    });
    onOpenChange(false);
    setRawText('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-xl rounded-[32px] p-0 overflow-hidden border border-border dark:border-brand-green/30 shadow-2xl flex flex-col max-h-[90vh] bg-card dark:bg-black">
        <DialogHeader className="p-8 bg-card dark:bg-black text-foreground dark:text-white shrink-0 shadow-sm border-b border-border dark:border-brand-green/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted dark:bg-brand-green/10 rounded-2xl shadow-sm dark:shadow-theme">
              <Sparkles className="h-7 w-7 text-primary dark:text-brand-green" />
            </div>
            <div>
              <DialogTitle className="uppercase font-black text-2xl tracking-tighter text-white dark:text-white">Smart Rosa Import</DialogTitle>
              <DialogDescription className="text-muted-foreground dark:text-brand-green/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                Potenziato da Intelligenza Artificiale
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-background dark:bg-black transition-colors">
          <div className="p-8 space-y-8">
            <Alert className="bg-muted dark:bg-black/40 border-primary/20 dark:border-brand-green/20 rounded-[24px] p-5 shadow-sm dark:shadow-themesoft transition-all">
              <Info className="h-5 w-5 text-primary dark:text-brand-green" />
              <div className="ml-2">
                <AlertTitle className="text-[11px] font-black uppercase text-foreground dark:text-white tracking-widest mb-1.5 flex items-center gap-2">
                  Guida Rapida
                </AlertTitle>
                <AlertDescription className="text-[11px] font-bold text-muted-foreground dark:text-white/40 uppercase leading-relaxed tracking-wide">
                  Copia e incolla la lista dei giocatori. Puoi specificare i ruoli come intestazioni.
                  <span className="text-foreground dark:text-white block mt-2 p-3 bg-background/50 dark:bg-black rounded-xl border border-border dark:border-brand-green/10">
                    Esempio: "POR: Buffon. Difensori: Chiellini, Bonucci. Centrocampisti: Verratti, Barella. Attaccanti: Immobile, Chiesa."
                  </span>
                  <span className="text-foreground dark:text-brand-green/80 block mt-3 font-black">L'AI riconoscerà automaticamente nomi e ruoli (POR, DC, TD, TS, CDC, CD, CS, TRQ, AD, AS, ATT, ADA, ASA).</span>
                </AlertDescription>
              </div>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">Input Testuale</p>
                {rawText.length > 0 && <span className="text-[9px] font-black text-primary dark:text-brand-green uppercase">{rawText.length} Caratteri</span>}
              </div>
              <Textarea
                placeholder={"Incolla qui la lista...\nEs: POR: Buffon; DC: Chiellini, Bonucci; CDC: Verratti; ATT: Immobile"}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={isAnalyzing}
                className="min-h-[280px] text-xs font-black uppercase rounded-[24px] bg-muted/30 dark:bg-black border-border dark:border-brand-green/20 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green focus-visible:border-primary dark:focus-visible:border-brand-green transition-all p-5 placeholder:text-muted-foreground dark:text-muted-foreground/30"
              />
            </div>
            <div className="px-8 pb-4 pt-2">
              <AsyncFeedback
                loading={isAnalyzing}
                error={error}
                loadingText="Analisi AI in corso… organizzazione rosa e categorizzazione ruoli"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-8 pt-0 flex-row gap-4 shrink-0 bg-background dark:bg-black transition-colors">
          <Button 
            variant="ghost" 
            className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all" 
            onClick={() => onOpenChange(false)} 
            disabled={isAnalyzing}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleSmartImport} 
            className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green hover:opacity-90 dark:hover:bg-black/80 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 shadow-lg dark:shadow-theme-strong hover:scale-[1.02] active:scale-95 transition-all" 
            disabled={isAnalyzing || !rawText.trim()}
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Importa Giocatori"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
