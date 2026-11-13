"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface NotificationsSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchEnabled: boolean;
  onMatchEnabledChange: (enabled: boolean) => void;
  matchTime: string;
  onMatchTimeChange: (time: string) => void;
  trainingEnabled: boolean;
  onTrainingEnabledChange: (enabled: boolean) => void;
  trainingTime: string;
  onTrainingTimeChange: (time: string) => void;
  onSave: () => void;
}

export function NotificationsSettingsDialog({
  open,
  onOpenChange,
  matchEnabled,
  onMatchEnabledChange,
  matchTime,
  onMatchTimeChange,
  trainingEnabled,
  onTrainingEnabledChange,
  trainingTime,
  onTrainingTimeChange,
  onSave,
}: NotificationsSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-theme text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">Notifiche Push</DialogTitle>
          <DialogDescription className="text-muted-foreground">Configura gli avvisi pre-gara e pre-allenamento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Notifica Partita */}
          <div className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/30 dark:bg-card/20 border border-border dark:border-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-bold uppercase tracking-tight">Giorno della Partita</Label>
              </div>
              <Switch
                checked={matchEnabled}
                onCheckedChange={onMatchEnabledChange}
                className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green"
              />
            </div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              "Prendi nota della formazione e inserisci il risultato!"
            </p>
            {matchEnabled && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Orario Notifica</Label>
                <Input
                  type="time"
                  value={matchTime}
                  onChange={(e) => onMatchTimeChange(e.target.value)}
                  className="w-28 h-8 text-xs font-bold bg-background dark:bg-black border-border dark:border-brand-green/30"
                />
              </div>
            )}
          </div>

          {/* Notifica Allenamento */}
          <div className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/30 dark:bg-card/20 border border-border dark:border-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-bold uppercase tracking-tight">Giorno dell'Allenamento</Label>
              </div>
              <Switch
                checked={trainingEnabled}
                onCheckedChange={onTrainingEnabledChange}
                className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green"
              />
            </div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              "Chi c'era oggi? Segna le presenze e gli esercizi svolti!"
            </p>
            {trainingEnabled && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Orario Notifica</Label>
                <Input
                  type="time"
                  value={trainingTime}
                  onChange={(e) => onTrainingTimeChange(e.target.value)}
                  className="w-28 h-8 text-xs font-bold bg-background dark:bg-black border-border dark:border-brand-green/30"
                />
              </div>
            )}
          </div>

          <Button
            onClick={onSave}
            className="w-full bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green hover:opacity-90 dark:hover:bg-brand-green/10 h-12 rounded-2xl font-black uppercase shadow-lg dark:shadow-theme-strong"
          >
            Salva Notifiche
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

