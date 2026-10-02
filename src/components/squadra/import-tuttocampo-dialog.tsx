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
import { Input } from '@/components/ui/input';
import { Loader2, Globe, AlertCircle, CheckCircle2, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Role, PlayerRole } from "@/lib/types";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ImportTuttocampoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (players: { name: string, roles: PlayerRole[] }[]) => Promise<void>;
}

export function ImportTuttocampoDialog({ open, onOpenChange, onSave }: ImportTuttocampoDialogProps) {
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!url.trim()) return;

    setIsScraping(true);
    try {
      const response = await fetch('/api/import-rosa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ squadraUrl: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante lo scraping');
      }

      if (!data.giocatori || data.giocatori.length === 0) {
        throw new Error("Nessun giocatore trovato nell'URL fornito.");
      }

      const playersToSave = data.giocatori.map((g: any) => ({
        name: g.name,
        roles: [g.role as PlayerRole],
      }));

      await onSave(playersToSave);

      toast({
        title: "Importazione Completata",
        description: `Importati con successo ${data.giocatori.length} giocatori da Tuttocampo.`,
      });
      
      onOpenChange(false);
      setUrl('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore Importazione",
        description: error.message,
      });
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-xl rounded-[32px] p-0 overflow-hidden border border-border dark:border-brand-green/30 shadow-2xl flex flex-col max-h-[90vh] bg-card dark:bg-black">
        <DialogHeader className="p-8 bg-primary dark:bg-black text-white dark:text-brand-green shrink-0 shadow-sm border-b border-white/10 dark:border-brand-green/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 dark:bg-brand-green/10 rounded-2xl shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.1)]">
              <Globe className="h-7 w-7 text-white dark:text-brand-green" />
            </div>
            <div>
              <DialogTitle className="uppercase font-black text-2xl tracking-tighter text-white dark:text-white">Importa da Tuttocampo</DialogTitle>
              <DialogDescription className="text-white/70 dark:text-brand-green/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                Scraping diretto della rosa ufficiale
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-background dark:bg-black transition-colors">
          <div className="p-8 space-y-8">
            <Alert className="bg-muted dark:bg-black/40 border-primary/20 dark:border-brand-green/20 rounded-[24px] p-5 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.05)] transition-all">
              <AlertCircle className="h-5 w-5 text-primary dark:text-brand-green" />
              <div className="ml-2">
                <AlertTitle className="text-[11px] font-black uppercase text-foreground dark:text-white tracking-widest mb-1.5 flex items-center gap-2">
                  Come fare
                </AlertTitle>
                <AlertDescription className="text-[11px] font-bold text-muted-foreground dark:text-white/40 uppercase leading-relaxed tracking-wide">
                  Inserisci l'URL della pagina squadra di Tuttocampo.
                  <span className="text-foreground dark:text-white block mt-2 p-3 bg-background/50 dark:bg-black rounded-xl border border-border dark:border-brand-green/10 break-all">
                    Esempio: https://www.tuttocampo.it/Italia/Veneto/Treviso/SecondaCategoria/GironeP/Squadra/Cessalto/1029344
                  </span>
                  <p className="mt-3 text-foreground dark:text-brand-green/80 font-black">
                    Attenzione: l'operazione può richiedere fino a 15-20 secondi.
                  </p>
                </AlertDescription>
              </div>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                 <Link2 className="h-4 w-4 text-primary dark:text-brand-green" />
                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">URL Pagina Squadra</p>
              </div>
              <Input
                placeholder="Incolla l'URL di Tuttocampo qui..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isScraping}
                className="h-14 text-xs font-black uppercase rounded-2xl bg-muted/30 dark:bg-black border-border dark:border-brand-green/20 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green focus-visible:border-primary dark:focus-visible:border-brand-green transition-all px-5 placeholder:text-muted-foreground/80 dark:text-muted-foreground/30"
              />
            </div>

            {isScraping && (
              <div className="flex flex-col items-center justify-center p-10 bg-muted/20 dark:bg-brand-green/5 rounded-[28px] border border-dashed border-primary/20 dark:border-brand-green/30 space-y-4 animate-in fade-in zoom-in duration-500">
                <Loader2 className="h-12 w-12 text-primary dark:text-brand-green animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-black uppercase text-primary dark:text-brand-green animate-pulse tracking-[0.3em]">Scraping in Corso...</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Connessione ai server di Tuttocampo</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-8 pt-0 flex-row gap-4 shrink-0 bg-background dark:bg-black transition-colors">
          <Button 
            variant="ghost" 
            className="flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all" 
            onClick={() => onOpenChange(false)} 
            disabled={isScraping}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleImport} 
            className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green hover:opacity-90 dark:hover:bg-black/80 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 shadow-lg dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] hover:scale-[1.02] active:scale-95 transition-all" 
            disabled={isScraping || !url.trim()}
          >
            {isScraping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Importa Rosa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
