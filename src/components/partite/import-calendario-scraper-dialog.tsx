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
import { Loader2, Globe, AlertCircle, Link2, CalendarCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMatchesStore } from '@/store/useMatchesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ImportCalendarioScraperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCalendarioScraperDialog({ open, onOpenChange }: ImportCalendarioScraperDialogProps) {
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const { toast } = useToast();
  const { bulkAdd } = useMatchesStore();
  const { defaultDuration } = useSettingsStore();

  const handleImport = async () => {
    if (!url.trim()) return;

    setIsScraping(true);
    try {
      const response = await fetch('/api/import-calendario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendarUrl: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante lo scraping del calendario');
      }

      if (!data.matches || data.matches.length === 0) {
        throw new Error("Nessuna partita trovata nell'URL fornito.");
      }

      const matchesToSave = data.matches.map((m: any) => ({
        opponent: m.opponent,
        date: m.date,
        isHome: m.isHome,
        type: m.type,
        duration: defaultDuration,
        status: m.status,
      }));

      await bulkAdd(matchesToSave);

      toast({
        title: "Calendario Importato",
        description: `Importate con successo ${data.matches.length} partite da Tuttocampo.`,
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
        <DialogHeader className="p-8 bg-card dark:bg-black text-foreground dark:text-white shrink-0 shadow-sm border-b border-border dark:border-brand-green/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted dark:bg-brand-green/10 rounded-2xl shadow-sm dark:shadow-theme">
              <CalendarCheck className="h-7 w-7 text-primary dark:text-brand-green" />
            </div>
            <div>
              <DialogTitle className="uppercase font-black text-2xl tracking-tighter text-white dark:text-white">Scraping Calendario</DialogTitle>
              <DialogDescription className="text-muted-foreground dark:text-brand-green/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                Importazione Automatica Stagione 25/26
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-background dark:bg-black transition-colors">
          <div className="p-8 space-y-8">
            <Alert className="bg-muted dark:bg-black/40 border-primary/20 dark:border-brand-green/20 rounded-[24px] p-5 shadow-sm dark:shadow-themesoft transition-all">
              <AlertCircle className="h-5 w-5 text-primary dark:text-brand-green" />
              <div className="ml-2">
                <AlertTitle className="text-[11px] font-black uppercase text-foreground dark:text-white tracking-widest mb-1.5 flex items-center gap-2">
                  Come fare
                </AlertTitle>
                <AlertDescription className="text-[11px] font-bold text-muted-foreground dark:text-white/40 uppercase leading-relaxed tracking-wide">
                  Inserisci l'URL del calendario della tua squadra su Tuttocampo.
                  <span className="text-foreground dark:text-white block mt-2 p-3 bg-background/50 dark:bg-black rounded-xl border border-border dark:border-brand-green/10 break-all">
                    Esempio: https://www.tuttocampo.it/Italia/.../1049515/Calendario
                  </span>
                </AlertDescription>
              </div>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                 <Link2 className="h-4 w-4 text-primary dark:text-brand-green" />
                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">URL Calendario Squadra</p>
              </div>
              <Input
                placeholder="Incolla l'URL del calendario qui..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isScraping}
                className="h-14 text-xs font-black uppercase rounded-2xl bg-muted/30 dark:bg-black border-border dark:border-brand-green/20 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green focus-visible:border-primary dark:focus-visible:border-brand-green transition-all px-5 placeholder:text-muted-foreground/30"
              />
            </div>

            {isScraping && (
              <div className="flex flex-col items-center justify-center p-10 bg-muted/20 dark:bg-brand-green/5 rounded-[28px] border border-dashed border-primary/20 dark:border-brand-green/30 space-y-4 animate-in fade-in zoom-in duration-500">
                <Loader2 className="h-12 w-12 text-primary dark:text-brand-green animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-black uppercase text-primary dark:text-brand-green animate-pulse tracking-[0.3em]">Scraping in Corso...</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Lettura gare e avversari</p>
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
            className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green hover:opacity-90 dark:hover:bg-black/80 rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 shadow-lg dark:shadow-theme-strong hover:scale-[1.02] active:scale-95 transition-all" 
            disabled={isScraping || !url.trim()}
          >
            {isScraping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Importa Calendario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
