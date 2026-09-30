'use client';

/**
 * Generatore di esercizi animati con AI.
 *
 * Flusso: descrizione in testo -> POST /api/generate -> varianti validate e
 * riparate -> player animato -> salvataggio nella libreria.
 *
 * Perche' passa dall'endpoint e non chiama il flusso Genkit direttamente
 * (come faceva prima):
 *
 *  - la chiave resta nel server. Un import diretto del flusso in un
 *    componente client porta Genkit nel bundle del browser, e con lei
 *    l'inizializzazione del plugin: un passo da non fare.
 *  - la risposta porta la provenienza del dato (modello, fallback, correzioni
 *    applicate). Senza, un esercizio sbagliato e' indistinguibile da uno
 *    giusto, e l'allenatore non ha modo di accorgersene.
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
import {
  Sparkles, Loader2, Save, RotateCcw, AlertTriangle, ChevronDown,
} from 'lucide-react';

import type { Drill } from '@/lib/drill';
import { drillToTactical } from '@/lib/drill-to-tactical';
import type { TacticalExercise } from '@/lib/tactical-exercise';
import { ESEMPI_ESERCIZI } from '@/lib/demo-drill';
import { useExerciseStore } from '@/store/useExerciseStore';
import ExercisePlayer from '@/components/allenamento/exercise-player';
import { cn } from '@/lib/utils';

/** Forma della risposta di /api/generate. */
interface GenerateResponse {
  drills: Drill[];
  drill: Drill;
  fixes: string[];
  source: 'gemini' | 'demo';
  engine: string;
  model: string;
  fallbackUsed: boolean;
}

/**
 * Etichetta della variante: la prima e' l'esercizio richiesto, le altre due
 * sono le progressioni. Non si prende il nome dal modello perche' due
 * progressioni si chiamerebbero spesso "Rondo 4v2" e l'allenatore non saprebbe
 * quale sta guardando.
 */
function etichettaVariante(i: number): string {
  if (i === 0) return 'Esercizio';
  if (i === 1) return 'Più facile';
  if (i === 2) return 'Più difficile';
  return `Variante ${i + 1}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiExerciseGenerator({ open, onOpenChange }: Props) {
  const addExercise = useExerciseStore((s) => s.addExercise);

  const [prompt, setPrompt] = useState('');
  const [varianti, setVarianti] = useState<Drill[] | null>(null);
  const [attiva, setAttiva] = useState(0);
  const [meta, setMeta] = useState<
    Pick<GenerateResponse, 'source' | 'model' | 'fallbackUsed' | 'fixes'> | null
  >(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mostraDebug, setMostraDebug] = useState(false);
  // La scena dopo le modifiche a mano, se l'allenatore ha spostato qualcosa.
  // E' la base per il salvataggio, non una modifica dell'esercizio generato.
  const [scenaModificata, setScenaModificata] = useState<TacticalExercise | null>(null);

  function reset() {
    setVarianti(null);
    setMeta(null);
    setError(null);
    setSaved(false);
    setAttiva(0);
    setScenaModificata(null);
    setMostraDebug(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      // Non azzerare il prompt: se si riapre la finestra per correggere una
      // riga, non si vuole riscriverlo. Solo lo stato generato si pulisce.
      reset();
    }
    onOpenChange(nextOpen);
  }

  async function handleGenerate(testoDaGenerare?: string) {
    const testo = (testoDaGenerare ?? prompt).trim();
    if (!testo) {
      setError("Scrivi una descrizione dell'esercizio.");
      return;
    }
    setPrompt(testo);
    setGenerating(true);
    setError(null);
    setVarianti(null);
    setMeta(null);
    setSaved(false);
    setAttiva(0);
    setScenaModificata(null);
    try {
      const risposta = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testo }),
      });

      const dati = await risposta.json();

      if (!risposta.ok) {
        setError(dati?.error || 'Generazione non riuscita. Riprova.');
        return;
      }
      if (!dati?.drills?.length) {
        setError('Il generatore ha risposto senza esercizi. Riprova.');
        return;
      }

      setVarianti(dati.drills);
      setMeta({
        source: dati.source,
        model: dati.model,
        fallbackUsed: dati.fallbackUsed,
        fixes: dati.fixes ?? [],
      });
      setScenaModificata(null);
    } catch (e: any) {
      // Rete assente o richiesta abortita: qui non c'e' un modello da
      // incolpare, quindi il messaggio parla di connessione e non di AI.
      setError(
        e?.name === 'AbortError'
          ? 'Generazione annullata.'
          : 'Non sono riuscito a contattare il generatore. Controlla la connessione.',
      );
    } finally {
      setGenerating(false);
    }
  }

  const scelta = varianti?.[attiva] ?? null;
  // Si mostra cio' che e' stato modificato, se c'e' una modifica: e' il modo
  // perche' il salvataggio e la visualizzazione non possano divergere.
  const tattico = scelta ? (scenaModificata ?? drillToTactical(scelta)) : null;

  async function handleSave() {
    if (!scelta || !tattico) return;

    setSaving(true);
    setError(null);
    try {
      await addExercise({
        name: scelta.name,
        description: scelta.description,
        // focus vuoto: l'AI non classifica l'esercizio, e inventare una
        // categoria sarebbe peggio che lasciarla all'allenatore.
        focus: [],
        visibility: 'private',
        media: [],
        playerCount: [String(tattico.playersShown)],
        duration: `${tattico.steps.length} step`,
        tactical: tattico,
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
            animata, che puoi correggere e salvare in libreria.
          </DialogDescription>
        </DialogHeader>

        {!varianti && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                L'esercizio
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es. Rondo 4v2 in un quadrato, passa e muoviti dopo ogni ricezione."
                className="min-h-[110px] text-xs rounded-xl border-border dark:border-brand-green/25"
                disabled={generating}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                Esempi
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ESEMPI_ESERCIZI.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={generating}
                    onClick={() => handleGenerate(s.prompt)}
                    className={cn(
                      'text-[9px] font-bold px-2 py-1 rounded-lg border border-border/60',
                      'text-muted-foreground hover:text-foreground hover:border-brand-green/40',
                      'transition-colors disabled:opacity-40 text-left',
                    )}
                  >
                    {s.label}
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
            <p className="text-[10px] text-muted-foreground/60 text-center max-w-[260px]">
              Sto generando l'esercizio e due progressioni. Se il servizio è
              congestionato ci mette fino a un minuto.
            </p>
          </div>
        )}

        {varianti && !generating && scelta && tattico && (
          <div className="space-y-3">
            {/* Selettore varianti: la prima è l'esercizio richiesto, le altre
                due sono progressioni. Senza questo l'allenatore non sa che ne
                ha ricevute altre e le ignora. */}
            {varianti.length > 1 && (
              <div className="flex gap-1.5">
                {varianti.map((v, i) => (
                  <button
                    key={`${v.id}-${i}`}
                    type="button"
                    onClick={() => {
                      setAttiva(i);
                      setScenaModificata(null);
                      setSaved(false);
                    }}
                    className={cn(
                      'flex-1 px-2 py-2 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-colors',
                      attiva === i
                        ? 'bg-brand-green text-black border-brand-green'
                        : 'bg-transparent border-border dark:border-brand-green/30 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {etichettaVariante(i)}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {scelta.description}
            </p>

            <ExercisePlayer
              data={tattico}
              editable
              onChange={setScenaModificata}
            />

            {/* Provenienza e correzioni: dichiarare cosa e' successo vale piu'
                di un esercizio che sembra giusto. Senza questo, un esercizio
                generato con 12 correzioni e' indistinguibile da uno perfetto. */}
            {meta && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setMostraDebug((v) => !v)}
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 hover:text-foreground"
                >
                  <ChevronDown
                    className={cn('h-3 w-3 transition-transform', mostraDebug && 'rotate-180')}
                  />
                  {meta.source === 'demo'
                    ? 'Esempio, non generato'
                    : `Generato da ${meta.model.replace('googleai/', '')}${meta.fallbackUsed ? ' (riserva)' : ''}`}
                </button>

                {mostraDebug && (
                  <div className="text-[10px] text-muted-foreground/80 bg-black/30 rounded-lg p-2 space-y-1">
                    {meta.source === 'demo' && (
                      <p className="text-amber-500">
                        Questo non è il tuo esercizio: è un esempio mostrato perché
                        il servizio AI non ha risposto. Riprova fra poco.
                      </p>
                    )}
                    <p>Correzioni applicate: {meta.fixes.length}</p>
                    {meta.fixes.map((f, i) => (
                      <p key={i} className="flex gap-1">
                        <span>·</span>
                        <span>{f}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

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
          {varianti && !saved && (
            <Button
              onClick={reset}
              disabled={saving}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Rifai
            </Button>
          )}
          {varianti && (
            <Button
              onClick={() => handleClose(false)}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              Chiudi
            </Button>
          )}
          {!varianti && (
            <>
              <Button
                onClick={() => handleClose(false)}
                variant="outline"
                className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
              >
                Annulla
              </Button>
              <Button
                onClick={() => handleGenerate()}
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