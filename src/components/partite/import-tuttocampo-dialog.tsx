"use client";

import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, AlertCircle, RefreshCw, ClipboardCopy, Info, Upload } from 'lucide-react';
import * as AIService from '@/services/ai.service';
import { useToast } from '@/hooks/use-toast';
import { useMatchesStore } from '@/store/useMatchesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAsyncAction } from '@/lib/hooks/useAsyncAction';
import { AsyncFeedback } from '@/components/ui/async-feedback';

interface ImportTuttocampoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportTuttocampoDialog({ open, onOpenChange }: ImportTuttocampoDialogProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [rawText, setRawText] = useState('');
  const [teamName, setTeamName] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string>('');
  
  const { toast } = useToast();
  const { bulkAdd } = useMatchesStore();
  const { defaultDuration, teamName: savedTeamName } = useSettingsStore();
  const { run: runImport, loading: isLoading, error } = useAsyncAction(
    (payload: {
      teamName?: string;
      rawContent?: string;
      fileDataUrl?: string;
    }) => AIService.importMatches(payload),
  );

  useEffect(() => {
    if (open) {
      setTeamName(savedTeamName || '');
      setActiveTab('text');
      setRawText('');
      setFileDataUrl(undefined);
      setFileName('');
    }
  }, [open, savedTeamName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImport = async () => {
    if (activeTab === 'file' && !teamName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome squadra mancante",
        description: "Inserisci il nome della tua squadra per permettere all'AI di filtrare le partite dal file.",
      });
      return;
    }

    if (activeTab === 'text' && (!rawText.trim() || rawText.trim().length < 10)) {
      toast({
        variant: "destructive",
        title: "Dati insufficienti",
        description: "Incolla il contenuto del calendario.",
      });
      return;
    }

    if (activeTab === 'file' && !fileDataUrl) {
      toast({
        variant: "destructive",
        title: "File mancante",
        description: "Carica un file valido.",
      });
      return;
    }

    const result = await runImport({
      teamName: teamName.trim() || undefined,
      rawContent: activeTab === 'text' ? rawText.trim() : undefined,
      fileDataUrl: activeTab === 'file' ? fileDataUrl : undefined,
    });
    if (!result) return; // error captured in `error` state

    const matchesToSave = result.matches.map(match => ({
      opponent: match.opponent,
      date: match.date,
      isHome: match.isHome,
      type: match.type as any,
      round: match.round,
      duration: defaultDuration,
      status: (new Date(match.date) < new Date() ? 'completed' : 'scheduled') as any,
    }));

    await bulkAdd(matchesToSave);

    toast({
      title: "Importazione completata",
      description: `Individuata squadra: ${result.teamName}. Aggiunte ${result.matches.length} partite.`,
    });
    onOpenChange(false);
    setRawText('');
    setFileDataUrl(undefined);
    setFileName('');
  };

  const isImportDisabled = isLoading || (activeTab === 'file' && !teamName.trim()) || (activeTab === 'text' && !rawText.trim()) || (activeTab === 'file' && !fileDataUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh] bg-background dark:bg-black">
        <DialogHeader className="p-6 bg-card dark:bg-background text-foreground shrink-0 relative border-b border-border dark:border-white/5 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted dark:bg-white/5 rounded-2xl">
              <ClipboardCopy className="h-6 w-6 text-primary dark:text-brand-green" />
            </div>
            <div>
              <DialogTitle className="uppercase font-black tracking-tight text-xl text-foreground">Importazione Calendario</DialogTitle>
              <DialogDescription className="text-muted-foreground dark:text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
                Metodo AI Intelligente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-background dark:bg-black transition-colors">
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-muted dark:bg-card/50 border border-border dark:border-brand-green/20 rounded-2xl border-dashed space-y-3 shadow-inner">
                <h4 className="text-[10px] font-black uppercase text-foreground dark:text-white tracking-widest flex items-center gap-2">
                  <Info className="h-3 w-3 text-primary dark:text-brand-green" /> Come fare:
                </h4>
                <div className="space-y-2 text-[11px] font-bold leading-relaxed text-muted-foreground dark:text-white/40 uppercase">
                  <p>Incolla i dati testuali o carica un file con il calendario. L'AI utilizzerà il nome della tua squadra per filtrare automaticamente solo le partite in cui è coinvolta.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'text' | 'file')} className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/30 tracking-widest ml-1">
                      {activeTab === 'text' ? 'INCOLLA QUI I TUOI DATI:' : 'SELEZIONA IL TUO FILE:'}
                    </p>
                    <TabsList className="h-8 bg-muted dark:bg-white/5 border border-border dark:border-white/10 rounded-lg p-0.5">
                      <TabsTrigger value="text" className="text-[9px] font-black uppercase h-full rounded-md data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:bg-brand-green dark:data-[state=active]:text-black transition-all px-3">
                        DA TESTO
                      </TabsTrigger>
                      <TabsTrigger value="file" className="text-[9px] font-black uppercase h-full rounded-md data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:bg-brand-green dark:data-[state=active]:text-black transition-all px-3">
                        DA FILE
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="text" className="mt-0">
                    <Textarea
                      placeholder="Esempio: 20/09/2024 15:00 OSL vs Arese..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      disabled={isLoading}
                      className="min-h-[160px] text-[11px] font-bold rounded-2xl bg-background dark:bg-black border-border dark:border-brand-green/30 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white placeholder:text-muted-foreground/30 dark:placeholder:text-white/10 transition-colors"
                    />
                  </TabsContent>
                  
                  <TabsContent value="file" className="mt-0 space-y-4">
                    <div className="border border-border/50 dark:border-white/10 p-4 rounded-xl bg-muted/20 dark:bg-card/20">
                      <label className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/30 tracking-widest block mb-1.5 ml-1">
                        Nome della tua squadra:
                      </label>
                      <Input 
                        placeholder="Es. OSL"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        disabled={isLoading}
                        className="h-10 text-xs font-bold rounded-xl bg-background dark:bg-black border-border dark:border-brand-green/30"
                      />
                      <p className="text-[9px] text-muted-foreground mt-1 ml-1 font-bold">L'AI selezionerà solo le partite che includono questo nome.</p>
                    </div>

                    <div className="border-2 border-dashed border-border dark:border-brand-green/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-muted/30 dark:bg-card/30 hover:bg-muted/50 dark:hover:bg-card/50 transition-colors relative">
                      <input 
                        type="file" 
                        accept=".pdf,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="p-3 bg-background dark:bg-black rounded-xl shadow-sm mb-3">
                        <Upload className="h-6 w-6 text-primary dark:text-brand-green" />
                      </div>
                      <h5 className="text-xs font-black text-foreground dark:text-white uppercase tracking-tight mb-1">
                        {fileName ? 'File Selezionato' : 'Carica Documento o Immagine'}
                      </h5>
                      <p className="text-[10px] font-bold text-muted-foreground dark:text-white/40">
                        {fileName ? fileName : 'Supportati: PDF, DOCX, JPG, PNG'}
                      </p>
                      {!fileName && (
                        <Button variant="secondary" size="sm" className="mt-4 rounded-lg h-8 text-[10px] font-black uppercase pointer-events-none">
                          Sfoglia File
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <AsyncFeedback
                loading={isLoading}
                error={error}
                loadingText={`L'AI sta analizzando i dati… filtraggio partite per ${teamName || 'la tua squadra'}`}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-0 flex-row gap-3 shrink-0 bg-background dark:bg-black transition-colors">
          <Button variant="ghost" className="flex-1 rounded-2xl font-black uppercase text-[10px] h-12 text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/5 transition-colors" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annulla
          </Button>
          <Button 
            onClick={handleImport} 
            className="flex-1 bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-white hover:opacity-90 dark:hover:bg-brand-green/10 rounded-2xl font-black uppercase text-[10px] h-12 shadow-md dark:shadow-[0_0_15px_rgba(172,229,4,0.1)] transition-all disabled:opacity-50" 
            disabled={isImportDisabled}
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : "Importa Calendario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
