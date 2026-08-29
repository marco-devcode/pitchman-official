'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { testRepository } from '@/lib/repositories/test-repository';
import { Loader2 } from 'lucide-react';

interface RenameTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testId: string | null;
  currentName: string;
  userId: string | undefined;
  onRenamed: () => void;
}

export function RenameTestDialog({
  open,
  onOpenChange,
  testId,
  currentName,
  userId,
  onRenamed,
}: RenameTestDialogProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const handleSave = async () => {
    if (!testId || !userId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await testRepository.renameTest(testId, userId, trimmed);
      onRenamed();
      onOpenChange(false);
    } catch (err) {
      console.error('Rename test error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl bg-card dark:bg-black border-border dark:border-brand-green/20">
        <DialogHeader>
          <DialogTitle className="text-sm font-black uppercase tracking-widest text-foreground dark:text-white">
            Rinomina Test
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground">
            Modifica il nome del test fisico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="rename-test" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Nome
          </Label>
          <Input
            id="rename-test"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 text-sm font-bold rounded-xl bg-background dark:bg-black border-border dark:border-brand-green/20 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green"
            placeholder="Es. 30 metri"
          />
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 text-[10px] font-black uppercase rounded-xl text-muted-foreground hover:bg-muted"
          >
            Annulla
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="h-10 text-[10px] font-black uppercase rounded-xl"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
