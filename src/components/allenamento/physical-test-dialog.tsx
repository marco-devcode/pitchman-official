'use client';

import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TestResult, Player, PhysicalTest } from '@/lib/types';
import { testRepository } from '@/lib/repositories/test-repository';
import { useAuthStore } from '@/store/useAuthStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { useTestsStore } from '@/store/useTestsStore';
import { useMemo } from 'react';
import { formatValue } from '@/lib/test-utils';
import { Loader2, Plus, Minus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sortResults } from '@/lib/test-utils';

interface PhysicalTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  players: Player[];
  test?: PhysicalTest | null;
}

type Step = 1 | 2;

const TYPE_PRESETS: Record<string, { name: string; suggestions: string[]; defaultUnit: string }> = {
  velocita: {
    name: 'Velocità',
    suggestions: ['30 metri', '60 metri', '100 metri'],
    defaultUnit: 'secondi',
  },
  resistenza: {
    name: 'Resistenza',
    suggestions: ['Test di Cooper (12 min)', 'Yo-Yo', 'Navetta'],
    defaultUnit: 'metri',
  },
};

export function PhysicalTestDialog({ open, onOpenChange, onCreated, players, test }: PhysicalTestDialogProps) {
  const { user } = useAuthStore();
  const { activeSeason } = useSeasonsStore();
  const { tests } = useTestsStore();

  // Nomi dei test già esistenti (distinti), con la loro unità/tipo più recente.
  // Servono a riusare lo stesso nome ed evitare typo che spezzano lo storico.
  const nomiEsistenti = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; type: string; date: string }>();
    for (const t of tests) {
      const cur = map.get(t.name);
      if (!cur || t.date > cur.date) {
        map.set(t.name, { name: t.name, unit: t.unit, type: t.type, date: t.date });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [tests]);

  const [step, setStep] = useState<Step>(1);
  const [testType, setTestType] = useState<string>('velocita');
  const [testName, setTestName] = useState('');
  const [unit, setUnit] = useState('secondi');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [results, setResults] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setStep(1);
    setTestType('velocita');
    setTestName('');
    setUnit('secondi');
    setDate(new Date().toISOString().split('T')[0]);
    setResults(new Map());
    setSaving(false);
    setSaveError(null);
  }, []);

  // Se viene passato un test esistente, prepopola il form per la modifica
  // (stesso schema di PlayerFormDialog con la prop 'player')
  useEffect(() => {
    if (open && test) {
      setStep(1);
      setTestType(test.type);
      setTestName(test.name);
      setUnit(test.unit);
      setDate(test.date.split('T')[0]);
      setResults(new Map(test.results.map(r => [r.playerId, String(r.value)])));
      setSaving(false);
      setSaveError(null);
    }
  }, [open, test]);

  const handleTypeChange = (type: string) => {
    setTestType(type);
    if (type !== 'personalizzato' && TYPE_PRESETS[type]) {
      setUnit(TYPE_PRESETS[type].defaultUnit);
      setTestName('');
    }
  };

  const handleSuggestionClick = (name: string) => {
    setTestName(name);
  };

  // Click su un tag di test esistente: riusa nome, unità e tipo così il nuovo
  // test si aggancia allo stesso grafico/confronto del vecchio.
  const handleExistingClick = (t: { name: string; unit: string; type: string }) => {
    setTestName(t.name);
    setUnit(t.unit);
    setTestType(t.type);
  };

  const handleResultChange = (playerId: string, value: string) => {
    setResults(prev => {
      const next = new Map(prev);
      next.set(playerId, value);
      return next;
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const getPlayerName = (id: string): string => {
    const p = players.find(pl => pl.id === id);
    return p ? `${p.lastName} ${p.firstName}` : '?';
  };

  const handleSave = async () => {
    if (!testName.trim() || !user || !activeSeason) return;
    setSaving(true);
    setSaveError(null);

    const testResults: TestResult[] = [];
    for (const [playerId, val] of results) {
      const num = parseFloat(val);
      if (!isNaN(num) && val.trim() !== '') {
        testResults.push({ playerId, value: num });
      }
    }

    try {
      // Fix: aggiunge T12:00:00 per evitare off-by-one UTC in fusi orari +02:00 (CEST)
      const isoDate = new Date(date + 'T12:00:00').toISOString();

      if (test) {
        // MODIFICA: aggiorna il test esistente (nome/tipo/unità/data/risultati)
        await testRepository.updateTest(test.id, user.id, {
          name: testName.trim(),
          type: testType,
          unit,
          date: isoDate,
          results: testResults,
        });
        resetForm();
        onOpenChange(false);
      } else {
        // CREAZIONE
        const id = await testRepository.create(user.id, activeSeason.id, {
          name: testName.trim(),
          type: testType,
          unit,
          date: isoDate,
          results: testResults,
        });

        onCreated(id);
        resetForm();
      }
    } catch (err: any) {
      console.error('❌ Save test error:', err);
      setSaveError(err?.message ?? 'Errore durante il salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = testName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-[28px] bg-card dark:bg-black border border-border dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_25px_rgba(172,229,4,0.05)] p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-foreground dark:text-white font-black uppercase text-xl tracking-tight">
            {test ? (step === 1 ? 'Modifica Test' : 'Risultati') : (step === 1 ? 'Nuovo Test' : 'Risultati')}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {step === 1 ? 'Seleziona tipo, nome e unità di misura' : 'Inserisci i risultati per ogni giocatore'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">Tipo</Label>
              <Select value={testType} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-11 text-xs font-bold uppercase rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="velocita" className="text-xs font-bold">Velocità</SelectItem>
                  <SelectItem value="resistenza" className="text-xs font-bold">Resistenza</SelectItem>
                  <SelectItem value="personalizzato" className="text-xs font-bold">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">Nome</Label>
              <Input
                value={testName}
                onChange={e => setTestName(e.target.value)}
                placeholder="Es. 30 metri"
                disabled={saving}
                className="h-11 text-xs font-bold uppercase rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20"
              />
              {nomiEsistenti.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 ml-1 mb-1">
                    Test esistenti (tocca per riusare)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {nomiEsistenti.map(t => {
                      const active = testName === t.name;
                      return (
                        <button
                          key={t.name}
                          type="button"
                          disabled={saving}
                          onClick={() => handleExistingClick(t)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[9px] font-black uppercase border transition-all',
                            active
                              ? 'bg-primary text-white border-primary dark:bg-brand-green/20 dark:text-brand-green dark:border-brand-green'
                              : 'border-border dark:border-brand-green/20 text-muted-foreground hover:border-primary dark:hover:border-brand-green'
                          )}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {testType !== 'personalizzato' && TYPE_PRESETS[testType] && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {TYPE_PRESETS[testType].suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSuggestionClick(s)}
                      className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-border dark:border-brand-green/20 text-muted-foreground hover:border-primary dark:hover:border-brand-green transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">Unità di misura</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-11 text-xs font-bold uppercase rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="secondi" className="text-xs font-bold">Secondi (meno = meglio)</SelectItem>
                  <SelectItem value="metri" className="text-xs font-bold">Metri (più = meglio)</SelectItem>
                  <SelectItem value="altro" className="text-xs font-bold">Altro (discendente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={saving}
                className="h-11 text-xs font-bold uppercase rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto">
            {saveError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">{saveError}</p>
              </div>
            )}
            <div className="space-y-2">
              {players.map(player => (
                <div key={player.id} className="flex items-center gap-2 px-2">
                  <span className="text-[10px] font-bold flex-1 truncate">
                    {player.lastName} {player.firstName}
                  </span>
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="—"
                      value={results.get(player.id) ?? ''}
                      onChange={e => handleResultChange(player.id, e.target.value)}
                      className="w-24 h-9 text-right text-xs font-black rounded-lg bg-background dark:bg-black border border-border dark:border-brand-green/20 pr-8"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40 font-bold">
                      {unit === 'secondi' ? 's' : unit === 'metri' ? 'm' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 flex-row gap-3">
          {step === 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest h-12 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all"
                onClick={() => handleOpenChange(false)}
              >
                Annulla
              </Button>
              <Button
                type="button"
                disabled={saving || !canAdvance}
                className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-[10px] tracking-widest h-12 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
                onClick={() => setStep(2)}
              >
                Avanti
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest h-12 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all"
                onClick={() => setStep(1)}
              >
                Indietro
              </Button>
              <Button
                type="button"
                disabled={saving}
                className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-[10px] tracking-widest h-12 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
                onClick={handleSave}
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio...</>
                ) : (
                  test ? 'Salva Modifiche' : 'Salva Test'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
