'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { usePresenceStore } from '@/store/usePresenceStore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Avviso: un altro allenatore e' online sulla stessa stagione.
 *
 * Compare UNA volta per sessione quando compare un altro utente, e si
 * richiama da solo se l'altro se ne va e torna: `warned` si azzera quando la
 * presenza torna a zero, cosi' il secondo avviso non e' un rumore ma
 * un'informazione nuova.
 *
 * Cosa NON promette: non blocca le scritture e non dice che l'altro sta
 * modificando proprio la partita che stai toccando. Firestore continua a
 * risolvere i conflitti con l'ultima scrittura che arriva. E' un avviso, non
 * un meccanismo di concorrenza.
 */
export function PresenceAlert() {
  const hasOthers = usePresenceStore((s) => s.hasOthers);
  const onlineCount = usePresenceStore((s) => s.online.length);
  const warned = usePresenceStore((s) => s.warned);
  const markWarned = usePresenceStore((s) => s.markWarned);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasOthers && !warned) {
      setOpen(true);
    }
    // Quando l'altro esce, si sblocca per un eventuale rientro successivo.
    if (!hasOthers && warned) {
      markWarned();
    }
  }, [hasOthers, warned, markWarned]);

  if (!hasOthers) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); markWarned(); } }}>
      <DialogContent className="max-w-[92vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-theme text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 dark:bg-brand-green/15 border border-primary/40 dark:border-brand-green/40 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary dark:text-brand-green" />
            </div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground">
              {onlineCount === 1 ? 'Un altro allenatore' : `${onlineCount} altri allenatori`}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">
            Stanno usando questa stagione adesso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {onlineCount === 1
              ? 'C\'è un altro allenatore collegato a questa stagione insieme a te.'
              : `Ci sono altri ${onlineCount} allenatori collegati a questa stagione insieme a te.`}
          </p>
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">
              Attenzione
            </p>
            <p className="text-xs text-foreground/80 leading-relaxed">
              Se modificate la stessa partita o gli stessi giocatori, l&apos;ultima modifica
              registrata sovrascrive l&apos;altra. Salva le tue modifiche e controlla i
              risultati prima di passare a altro.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => { setOpen(false); markWarned(); }}
            className="w-full bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase text-xs h-11 rounded-xl"
          >
            Ho Capito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
