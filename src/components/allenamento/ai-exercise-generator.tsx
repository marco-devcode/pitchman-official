'use client';

/**
 * Generatore di esercizi animati con AI.
 *
 * Flusso: descrizione in testo -> Gemini (Genkit) -> dati tattici -> player
 * animato -> salvataggio nella libreria.
 *
 * Il salvataggio passa da useExerciseStore come gli esercizi creati a mano:
 * l'esercizio generato e' un esercizio normale, con in piu' il campo
 * `tactical`. Niente percorso di scrittura parallelo da mantenere.
 */

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Save, RotateCcw, AlertTriangle } from 'lucide-react';

import { generateExercise, type GenerateExerciseOutput } from '@/ai/flows/generate-exercise-flow';
import type { TacticalExercise } from '@/lib/tactical-exercise';
import { useExerciseStore } from '@/store/useExerciseStore';
import ExercisePlayer from '@/components/allenamento/exercise-player';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Uscita dalla pressione con cambio di gioco laterale',
  'Costruzione dal basso con portiere uscente',
  'Ampiezza e sovrappasso sulle fasce',
  'Pressing alto a cinque con uscita del centrocampo',
  'Transizione difensiva rapente dopo perdita',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiExerciseGenerator({ open, onOpenChange }: Props) {
  const addExercise = useExerciseStore((s) => s.addExercise);

  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<GenerateExerciseOutput | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function reset() {
    setResult(null);
    setError(null);
    setSaved(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      // Non azzerare il prompt: se riapri la finestra per correggere una
      // riga, non si vuole riscriverlo. Solo lo stato generato si pulisce.
      reset();
    }
    onOpenChange(nextOpen);
  }

  async function handleGenerate() {
    const testo = prompt.trim();
    if (!testo) {
      setError('Scrivi una descrizione dell\'esercizio.');
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const data = await generateExercise({ prompt: testo });
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Generazione non riuscita. Riprova.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const tactical: TacticalExercise = {
        title: result.title,
        description: result.description,
        playersShown: result.playersShown,
        initialEntities: result.initialEntities,
        steps: result.steps,
      };
      await addExercise({
        name: result.title,
        description: result.description,
        // focus vuoto: l'AI non classifica l'esercizio, e inventare una
        // categoria sarebbe peggio che lasciarla all'allenatore.
        focus: [],
        visibility: 'private',
        media: [],
        playerCount: [String(result.playersShown)],
        duration: `${result.steps.length} step`,
        tactical,
      });
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-border dark:border-brand-green/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-widest">
            <Sparkles className="h-4 w-4 text-brand-green" />
            Crea con AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Descrivi l'esercizio a parole: l'AI lo trasforma in una lavagna tattica
            animata, che puoi rivedere e salvare in libreria.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                L'esercizio
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es. Uscita dalla pressione con un cambio di gioco in diagonale verso la fascia destra, 8 giocatori contro 6."
                className="min-h-[110px] text-xs rounded-xl border-border dark:border-brand-green/25"
                disabled={generating}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                Esempi
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={generating}
                    onClick={() => setPrompt(s)}
                    className={cn(
                      'text-[9px] font-bold px-2 py-1 rounded-lg border border-border/60',
                      'text-muted-foreground hover:text-foreground hover:border-brand-green/40',
                      'transition-colors disabled:opacity-40 text-left',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-[11px] text-amber-500">{error}</p>
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Disegno la lavagna...
            </p>
          </div>
        )}

        {result && !generating && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {result.description}
            </p>

            <ExercisePlayer
              data={{
                title: result.title,
                description: result.description,
                playersShown: result.playersShown,
                initialEntities: result.initialEntities,
                steps: result.steps,
              }}
            />

            {saved ? (
              <div className="flex items-center gap-2 rounded-lg border border-brand-green/40 bg-brand-green/10 p-2.5">
                <Save className="h-3.5 w-3.5 text-brand-green" />
                <p className="text-[11px] text-brand-green font-bold">
                  Salvato in libreria.
                </p>
              </div>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase tracking-widest text-[10px] h-11"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salva in libreria
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result && !saved && (
            <Button
              onClick={reset}
              disabled={saving}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Rifai
            </Button>
          )}
          {result && (
            <Button
              onClick={() => handleClose(false)}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              Chiudi
            </Button>
          )}
          {!result && (
            <>
              <Button
                onClick={() => handleClose(false)}
                variant="outline"
                className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
              >
                Annulla
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase tracking-widest text-[10px] flex-1"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Genera
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
