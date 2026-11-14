'use client';

/**
 * Generatore di esercizi animati con AI (stile FootballGPT).
 *
 * Genera subito UN esercizio animato ad alta precisione (`base`), poi permette
 * di generare on-demand le progressioni (`Più semplice` / `Più difficile`)
 * tramite i pulsanti sopra il player Konva.
 */

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { authHeaders } from '@/lib/api-client';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Loader2,
  Save,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  Camera,
  Upload,
  ImageIcon,
  X,
} from 'lucide-react';

import type { Drill } from '@/lib/drill';
import { drillToTactical } from '@/lib/drill-to-tactical';
import type { TacticalExercise } from '@/lib/tactical-exercise';
import { ESEMPI_ESERCIZI } from '@/lib/demo-drill';
import { useExerciseStore } from '@/store/useExerciseStore';
import ExercisePlayer from '@/components/allenamento/exercise-player';
import { cn } from '@/lib/utils';

export type DrillSlotKey = 'base' | 'easier' | 'harder';

export interface DrillSlotEntry {
  drill: Drill;
  source: 'gemini' | 'demo';
  model: string;
  fallbackUsed: boolean;
  fixes: string[];
}

export interface GenerateRequestPayload {
  seasonId?: string;
  prompt?: string;
  imageDataUrl?: string;
  mode?: DrillSlotKey;
  baseDrill?: Drill;
}

/**
 * Chiama POST /api/generate gestendo errori HTTP, timeout serverless (504) e
 * formato risposta in un unico punto condiviso fra Prompt e Vision.
 */
export async function requestGeneratedDrill(
  payload: GenerateRequestPayload,
): Promise<DrillSlotEntry> {
  const risposta = await fetch('/api/generate', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!risposta.ok) {
    let messaggio = `Il generatore ha risposto con errore ${risposta.status}.`;
    try {
      const corpo = await risposta.json();
      if (corpo?.error) messaggio = corpo.error;
    } catch {
      if (risposta.status === 504 || risposta.status === 408) {
        messaggio =
          "La generazione ci ha messo troppo e il server l'ha interrotta. Riprova: il servizio è congestionato.";
      }
    }
    throw new Error(messaggio);
  }

  let dati: any;
  try {
    dati = await risposta.json();
  } catch {
    throw new Error('Il generatore ha risposto in un formato imprevisto. Riprova.');
  }

  if (!dati?.drills?.length) {
    throw new Error('Il generatore ha risposto senza esercizi. Riprova.');
  }

  return {
    drill: dati.drills[0] as Drill,
    source: dati.source === 'gemini' ? 'gemini' : 'demo',
    model: String(dati.model ?? 'demo'),
    fallbackUsed: Boolean(dati.fallbackUsed),
    fixes: Array.isArray(dati.fixes) ? dati.fixes : [],
  };
}

interface GeneratedDrillResultPanelProps {
  slots: Partial<Record<DrillSlotKey, DrillSlotEntry>>;
  attiva: DrillSlotKey;
  loadingProgression: DrillSlotKey | null;
  scenaModificata: TacticalExercise | null;
  saving: boolean;
  saved: boolean;
  onSelectSlot: (slot: DrillSlotKey) => void;
  onScenaChange: (next: TacticalExercise) => void;
  onSave: () => void;
}

/**
 * Pannello risultato condiviso fra "Crea con AI" e "Scansiona Lavagna":
 * selettore Esercizio Base / progressioni on-demand, player Konva editabile,
 * pannello debug/provenienza e salvataggio in libreria.
 */
export function GeneratedDrillResultPanel({
  slots,
  attiva,
  loadingProgression,
  scenaModificata,
  saving,
  saved,
  onSelectSlot,
  onScenaChange,
  onSave,
}: GeneratedDrillResultPanelProps) {
  const [mostraDebug, setMostraDebug] = useState(false);

  const entry = slots[attiva] ?? slots.base;
  if (!entry) return null;

  const tattico = scenaModificata ?? drillToTactical(entry.drill);
  const provenienzaAttiva = entry.source;

  const progressionButtons: {
    key: DrillSlotKey;
    label: string;
    readyLabel: string;
    icon?: 'easier' | 'harder';
  }[] = [
    { key: 'base', label: 'Esercizio', readyLabel: 'Esercizio' },
    { key: 'easier', label: 'Più semplice', readyLabel: 'Più semplice', icon: 'easier' },
    { key: 'harder', label: 'Più difficile', readyLabel: 'Più difficile', icon: 'harder' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {progressionButtons.map((btn) => {
          const exists = Boolean(slots[btn.key]);
          const isLoading = loadingProgression === btn.key;
          const isActive = attiva === btn.key;
          const isDemo = slots[btn.key]?.source === 'demo';
          return (
            <button
              key={btn.key}
              type="button"
              disabled={loadingProgression !== null}
              onClick={() => onSelectSlot(btn.key)}
              className={cn(
                'flex-1 px-2 py-2 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1 disabled:opacity-60',
                isDemo && 'border-amber-500/60',
                isActive
                  ? 'bg-brand-green text-black border-brand-green'
                  : exists
                    ? 'bg-transparent border-border dark:border-brand-green/40 text-foreground hover:border-brand-green'
                    : 'bg-transparent border-dashed border-border dark:border-brand-green/30 text-muted-foreground hover:text-foreground hover:border-brand-green/60',
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : btn.icon === 'easier' ? (
                <TrendingDown className="h-3 w-3" />
              ) : btn.icon === 'harder' ? (
                <TrendingUp className="h-3 w-3" />
              ) : null}
              <span>{exists ? btn.readyLabel : `+ ${btn.label}`}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {entry.drill.description}
      </p>

      <ExercisePlayer
        key={`${attiva}-${entry.drill.id}`}
        data={tattico}
        editable
        onChange={onScenaChange}
      />

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setMostraDebug((v) => !v)}
          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 hover:text-foreground"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', mostraDebug && 'rotate-180')}
          />
          {provenienzaAttiva === 'demo'
            ? 'Esempio di riserva, non il tuo esercizio'
            : `Generato da ${entry.model.replace('googleai/', '')}${entry.fallbackUsed ? ' (fallback)' : ''}`}
        </button>

        {mostraDebug && (
          <div className="text-[10px] text-muted-foreground/80 bg-black/30 rounded-lg p-2 space-y-1">
            {provenienzaAttiva === 'demo' && (
              <p className="text-amber-500">
                Questa scheda è l'esempio di riserva perché il servizio AI non ha
                risposto in tempo utile. Riprova fra poco.
              </p>
            )}
            <p>Correzioni automatiche applicate: {entry.fixes.length}</p>
            {entry.fixes.map((f, i) => (
              <p key={i} className="flex gap-1">
                <span>·</span>
                <span>{f}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {saved ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-green/40 bg-brand-green/10 p-2.5">
          <Save className="h-3.5 w-3.5 text-brand-green" />
          <p className="text-[11px] text-brand-green font-bold">
            Salvato in libreria.
          </p>
        </div>
      ) : (
        <Button
          onClick={onSave}
          disabled={saving || loadingProgression !== null}
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
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiExerciseGenerator({ open, onOpenChange }: Props) {
  const activeSeason = useSeasonsStore((s) => s.activeSeason);
  const addExercise = useExerciseStore((s) => s.addExercise);

  const [prompt, setPrompt] = useState('');
  const [slots, setSlots] = useState<Partial<Record<DrillSlotKey, DrillSlotEntry>> | null>(null);
  const [attiva, setAttiva] = useState<DrillSlotKey>('base');
  const [loadingProgression, setLoadingProgression] = useState<DrillSlotKey | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [scenaModificata, setScenaModificata] = useState<TacticalExercise | null>(null);

  function reset() {
    setSlots(null);
    setAttiva('base');
    setLoadingProgression(null);
    setError(null);
    setSaved(false);
    setScenaModificata(null);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
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
    setSlots(null);
    setAttiva('base');
    setLoadingProgression(null);
    setSaved(false);
    setScenaModificata(null);

    try {
      const baseResult = await requestGeneratedDrill({
        prompt: testo,
        mode: 'base',
        seasonId: activeSeason?.id,
      });
      setSlots({ base: baseResult });
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Non sono riuscito a contattare il generatore. Controlla la connessione.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectSlot(slot: DrillSlotKey) {
    if (!slots?.base) return;
    setError(null);

    if (slots[slot]) {
      setAttiva(slot);
      setScenaModificata(null);
      setSaved(false);
      return;
    }

    setLoadingProgression(slot);
    try {
      const progResult = await requestGeneratedDrill({
        prompt: prompt.trim() || slots.base.drill.name,
        mode: slot,
        baseDrill: slots.base.drill,
        seasonId: activeSeason?.id,
      });
      setSlots((prev) => ({ ...(prev ?? {}), [slot]: progResult }));
      setAttiva(slot);
      setScenaModificata(null);
      setSaved(false);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Impossibile generare la progressione richiesta.',
      );
    } finally {
      setLoadingProgression(null);
    }
  }

  async function handleSave() {
    const entry = slots?.[attiva] ?? slots?.base;
    if (!entry) return;
    const tattico = scenaModificata ?? drillToTactical(entry.drill);

    setSaving(true);
    setError(null);
    try {
      await addExercise({
        name: entry.drill.name,
        description: entry.drill.description,
        focus: [],
        visibility: 'private',
        media: [],
        playerCount: [String(tattico.playersShown)],
        duration: `${tattico.steps.length} step`,
        tactical: tattico,
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
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
            Descrivi l'esercizio a parole: l'AI crea la lavagna animata e, se vuoi,
            puoi adattarla subito in versione più semplice o più difficile.
          </DialogDescription>
        </DialogHeader>

        {!slots?.base && !generating && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                L'esercizio
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es. Rondo 4v2 in un quadrato con 4 coni, passa e muoviti dopo ogni ricezione."
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
              Disegno la lavagna animata...
            </p>
            <p className="text-[10px] text-muted-foreground/60 text-center max-w-[260px]">
              Sto posizionando pedine, spazi e sequenza di passaggi e corse.
            </p>
          </div>
        )}

        {slots?.base && !generating && (
          <GeneratedDrillResultPanel
            slots={slots}
            attiva={attiva}
            loadingProgression={loadingProgression}
            scenaModificata={scenaModificata}
            saving={saving}
            saved={saved}
            onSelectSlot={handleSelectSlot}
            onScenaChange={setScenaModificata}
            onSave={handleSave}
          />
        )}

        <DialogFooter className="gap-2">
          {slots?.base && !saved && (
            <Button
              onClick={reset}
              disabled={saving || loadingProgression !== null}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Rifai
            </Button>
          )}
          {slots?.base && (
            <Button
              onClick={() => handleClose(false)}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              Chiudi
            </Button>
          )}
          {!slots?.base && (
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

const MAX_IMAGE_DIM = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Ridimensiona e comprime la foto caricata su canvas client-side per ridurre
 * latenza di rete e payload verso l'API Vision (~150-350 KB).
 */
async function compressImageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleziona un file immagine valido (JPG, PNG, WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Impossibile leggere l'immagine selezionata."));
      image.src = objectUrl;
    });

    const maxSide = Math.max(img.width, img.height);
    const scale = maxSide > MAX_IMAGE_DIM ? MAX_IMAGE_DIM / maxSide : 1;
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Elaborazione immagine non supportata su questo browser.');
    }

    // Sfondo bianco nel caso l'utente carichi uno schema PNG trasparente.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Scanner Vision per convertire foto di fogli disegnati a mano o lavagne
 * tattiche in esercizi calcistici animati e modificabili.
 */
export function VisionExerciseScanner({ open, onOpenChange }: Props) {
  const activeSeason = useSeasonsStore((s) => s.activeSeason);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [slots, setSlots] = useState<Partial<Record<DrillSlotKey, DrillSlotEntry>> | null>(null);
  const [attiva, setAttiva] = useState<DrillSlotKey>('base');
  const [loadingProgression, setLoadingProgression] = useState<DrillSlotKey | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showOriginalPhoto, setShowOriginalPhoto] = useState(false);
  const [scenaModificata, setScenaModificata] = useState<TacticalExercise | null>(null);

  function resetGenerated() {
    setSlots(null);
    setAttiva('base');
    setLoadingProgression(null);
    setError(null);
    setSaved(false);
    setShowOriginalPhoto(false);
    setScenaModificata(null);
  }

  function clearAll() {
    resetGenerated();
    setImageDataUrl(null);
    setImageName('');
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      resetGenerated();
    }
    onOpenChange(nextOpen);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setError(null);
    resetGenerated();
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setImageDataUrl(compressed);
      setImageName(file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento della foto.');
      setImageDataUrl(null);
    } finally {
      setCompressing(false);
    }
  }

  async function handleAnalyze() {
    if (!imageDataUrl) {
      setError('Carica o scatta prima una foto del disegno o della lavagna.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSlots(null);
    setAttiva('base');
    setLoadingProgression(null);
    setSaved(false);
    setScenaModificata(null);

    try {
      const baseResult = await requestGeneratedDrill({
        imageDataUrl,
        prompt: notes.trim(),
        mode: 'base',
        seasonId: activeSeason?.id,
      });
      setSlots({ base: baseResult });
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossibile analizzare la foto. Controlla la connessione e riprova.',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectSlot(slot: DrillSlotKey) {
    if (!slots?.base) return;
    setError(null);

    if (slots[slot]) {
      setAttiva(slot);
      setScenaModificata(null);
      setSaved(false);
      return;
    }

    setLoadingProgression(slot);
    try {
      const promptForProgression =
        notes.trim() || `${slots.base.drill.name}: ${slots.base.drill.description}`;
      const progResult = await requestGeneratedDrill({
        prompt: promptForProgression,
        mode: slot,
        baseDrill: slots.base.drill,
        seasonId: activeSeason?.id,
      });
      setSlots((prev) => ({ ...(prev ?? {}), [slot]: progResult }));
      setAttiva(slot);
      setScenaModificata(null);
      setSaved(false);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Impossibile generare la progressione richiesta.',
      );
    } finally {
      setLoadingProgression(null);
    }
  }

  async function handleSave() {
    const entry = slots?.[attiva] ?? slots?.base;
    if (!entry) return;
    const tattico = scenaModificata ?? drillToTactical(entry.drill);

    setSaving(true);
    setError(null);
    try {
      await addExercise({
        name: entry.drill.name,
        description: entry.drill.description,
        focus: [],
        visibility: 'private',
        media: [],
        playerCount: [String(tattico.playersShown)],
        duration: `${tattico.steps.length} step`,
        tactical: tattico,
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border-border dark:border-brand-green/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-widest">
            <Camera className="h-4 w-4 text-brand-green" />
            Scansiona Lavagna (Vision)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Carica una foto di un esercizio disegnato su foglio o lavagna tattica:
            l'AI lo converte in una lavagna animata e modificabile.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {!slots?.base && !generating && (
          <div className="space-y-3">
            {!imageDataUrl ? (
              <button
                type="button"
                disabled={compressing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 px-4 rounded-2xl border-2 border-dashed border-border dark:border-brand-green/30 bg-muted/10 dark:bg-black/30 hover:border-brand-green/60 hover:bg-brand-green/5 transition-all flex flex-col items-center justify-center gap-2 text-center"
              >
                {compressing ? (
                  <Loader2 className="h-7 w-7 animate-spin text-brand-green" />
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-brand-green" />
                  </div>
                )}
                <p className="text-xs font-black uppercase tracking-wider text-foreground">
                  {compressing ? 'Ottimizzo foto...' : 'Carica o scatta foto del disegno'}
                </p>
                <p className="text-[10px] text-muted-foreground max-w-[260px]">
                  Foglio con appunti a mano, lavagna magnetica o lavagna pennarello (JPG, PNG, WebP).
                </p>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-border dark:border-brand-green/30 bg-black/40">
                  <img
                    src={imageDataUrl}
                    alt={imageName || 'Anteprima lavagna'}
                    className="w-full max-h-56 object-contain bg-black/60"
                  />
                  <div className="flex items-center justify-between px-3 py-2 bg-black/60 border-t border-white/10">
                    <span className="text-[10px] text-white/80 truncate max-w-[200px]">
                      {imageName || 'Immagine caricata'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 px-2 text-[9px] font-black uppercase tracking-wider text-brand-green hover:bg-brand-green/10"
                      >
                        Cambia
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Rimuovi immagine"
                        onClick={clearAll}
                        className="h-7 w-7 text-rose-400 hover:bg-rose-500/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Indicazioni per l'AI (opzionale)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es. Rondo 4v2, i blu tengono palla, frecce tratteggiate = smarcamenti, X = difensori."
                className="min-h-[76px] text-xs rounded-xl border-border dark:border-brand-green/25"
                disabled={generating}
              />
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
              Analisi lavagna in corso...
            </p>
            <p className="text-[10px] text-muted-foreground/60 text-center max-w-[260px]">
              Sto leggendo pedine, frecce e spazi dalla foto per ricreare l'animazione.
            </p>
          </div>
        )}

        {slots?.base && !generating && (
          <div className="space-y-3">
            {imageDataUrl && (
              <div className="rounded-xl border border-border dark:border-brand-green/20 bg-muted/10 dark:bg-black/30 p-2">
                <button
                  type="button"
                  onClick={() => setShowOriginalPhoto((v) => !v)}
                  className="w-full flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3 text-brand-green" />
                    Foto originale caricata
                  </span>
                  <span>{showOriginalPhoto ? 'Nascondi' : 'Confronta'}</span>
                </button>
                {showOriginalPhoto && (
                  <img
                    src={imageDataUrl}
                    alt="Foto originale"
                    className="mt-2 w-full max-h-44 object-contain rounded-lg border border-white/10 bg-black/50"
                  />
                )}
              </div>
            )}

            <GeneratedDrillResultPanel
              slots={slots}
              attiva={attiva}
              loadingProgression={loadingProgression}
              scenaModificata={scenaModificata}
              saving={saving}
              saved={saved}
              onSelectSlot={handleSelectSlot}
              onScenaChange={setScenaModificata}
              onSave={handleSave}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          {slots?.base && !saved && (
            <Button
              onClick={resetGenerated}
              disabled={saving || loadingProgression !== null}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Nuova scansione
            </Button>
          )}
          {slots?.base && (
            <Button
              onClick={() => handleClose(false)}
              variant="outline"
              className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
            >
              Chiudi
            </Button>
          )}
          {!slots?.base && (
            <>
              <Button
                onClick={() => handleClose(false)}
                variant="outline"
                className="rounded-xl font-black uppercase tracking-widest text-[10px] flex-1"
              >
                Annulla
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={generating || compressing || !imageDataUrl}
                className="rounded-xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase tracking-widest text-[10px] flex-1"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Converti
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
