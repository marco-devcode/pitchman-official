'use client';

/**
 * Builder della lavagna tattica manuale.
 *
 * Apre il player Konva in modalità editing: l'allenatore posiziona giocatori,
 * pallone, coni e zone direttamente sul campo. Nessun AI, nessuna API, nessun
 * timeout: è lo strumento per chi vuole disegnare l'esercizio a mano.
 *
 * Il player Konva (exercise-player-inner.tsx) ha già tutta la logica di
 * drag, aggiunta e rimozione entità. Qui serve solo:
 *   1. inizializzare una scena vuota o caricare una esistente
 *   2. esporre i comandi di aggiunta in una toolbar sopra il campo
 *   3. restituire il TacticalExercise risultante al dialog chiamante
 *
 * Gli step non vengono costruiti qui: sono un esercizio di posizionamento
 * statico. Gli step si aggiungono dopo, nella stessa libreria, con il
 * pulsante "Aggiungi step" del player (già esistente).
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, Save, X, Circle, Square, Target,
} from 'lucide-react';
import { GiSoccerBall } from 'react-icons/gi';
import ExercisePlayer from '@/components/allenamento/exercise-player';
import type { TacticalExercise, TacticalEntity } from '@/lib/tactical-exercise';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Esercizio esistente da modificare, se c'è. */
  initial?: TacticalExercise | null;
  /** Chiamato con il risultato quando l'allenatore salva. */
  onSave: (exercise: TacticalExercise) => void;
}

const TIPI_DISPONIBILI: { tipo: TacticalEntity['type']; label: string; icon: React.ReactNode }[] = [
  { tipo: 'player', label: 'Giocatore', icon: <Circle className="h-3.5 w-3.5" /> },
  { tipo: 'ball', label: 'Palla', icon: <GiSoccerBall className="h-3.5 w-3.5" /> },
  { tipo: 'cone', label: 'Cono', icon: <Target className="h-3.5 w-3.5" /> },
  { tipo: 'zone', label: 'Zona', icon: <Square className="h-3.5 w-3.5" /> },
];

export function TacticalExerciseBuilder({ open, onOpenChange, initial, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [entities, setEntities] = useState<TacticalEntity[]>([]);
  const [steps, setSteps] = useState<TacticalExercise['steps']>([]);
  const [selectedType, setSelectedType] = useState<TacticalEntity['type']>('player');

  // Reset all'apertura: carica l'esercizio esistente o parte da una scena
  // vuota con il campo base.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description);
      setEntities(initial.initialEntities);
      setSteps(initial.steps);
    } else {
      setTitle('');
      setDescription('');
      setEntities([
        { id: 'player-1', type: 'player', team: 'blue', label: '1', x: 50, y: 50 },
        { id: 'ball-1', type: 'ball', x: 50, y: 50 },
      ]);
      setSteps([]);
    }
  }, [open, initial]);

  const currentExercise: TacticalExercise = {
    title: title || 'Esercizio senza titolo',
    description: description || '',
    playersShown: entities.filter((e) => e.type === 'player').length,
    initialEntities: entities,
    steps,
  };

  function handlePlayerChange(data: TacticalExercise) {
    setEntities(data.initialEntities);
    setSteps(data.steps);
  }

  function handleSave() {
    onSave(currentExercise);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[92vh] bg-card dark:bg-zinc-950 border border-border dark:border-brand-green/30 rounded-[32px] shadow-2xl p-5 outline-none flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="mb-3 px-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-green/10 flex items-center justify-center border border-brand-green/20">
              <GiSoccerBall className="h-5 w-5 text-brand-green" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-xl font-black uppercase tracking-tighter text-foreground dark:text-white leading-none">
                Lavagna Tattica
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/50">
                Disegna l&apos;esercizio a mano
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide px-1 space-y-4">
          {/* Titolo e descrizione */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">
                Titolo
              </Label>
              <Input
                placeholder="Es. Rondo 4v2 con uscita"
                className="h-10 rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 text-sm font-bold"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">
                Descrizione
              </Label>
              <Textarea
                placeholder="Obiettivo e come si svolge..."
                className="min-h-[60px] rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 text-xs resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Toolbar: tipi di entità da aggiungere. E' un selettore di TIPO,
              non un pulsante che aggiunge: il player Konva ha già i propri
              comandi di aggiunta. Qui si sceglie solo cosa mette sul campo. */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">
              Tipo da aggiungere
            </Label>
            <div className="flex flex-wrap gap-2">
              {TIPI_DISPONIBILI.map((t) => (
                <Button
                  key={t.tipo}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedType(t.tipo)}
                  className={cn(
                    'h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider gap-1.5 transition-all',
                    selectedType === t.tipo
                      ? 'bg-brand-green text-black border-brand-green'
                      : 'border-border dark:border-brand-green/30 text-muted-foreground hover:text-foreground hover:border-brand-green/50',
                  )}
                >
                  {t.icon}
                  {t.label}
                </Button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60">
              Usa i pulsanti sopra il campo per posizionare il tipo selezionato.
            </p>
          </div>

          {/* Player Konva in editing */}
          <ExercisePlayer
            data={currentExercise}
            editable
            onChange={handlePlayerChange}
          />

          {/* Riepilogo */}
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
            <span>{entities.filter((e) => e.type === 'player').length} giocatori</span>
            <span>{entities.filter((e) => e.type === 'ball').length} palla</span>
            <span>{entities.filter((e) => e.type === 'cone').length} coni</span>
            <span>{entities.filter((e) => e.type === 'zone').length} zone</span>
            <span>{steps.length} step</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-4 mt-2 border-t border-border dark:border-brand-green/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl font-black uppercase tracking-widest text-[10px]"
          >
            <X className="h-3.5 w-3.5" /> Annulla
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase tracking-widest text-[10px]"
          >
            <Save className="h-3.5 w-3.5" /> Usa questa lavagna
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
