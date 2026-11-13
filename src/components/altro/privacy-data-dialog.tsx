"use client";

import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, RefreshCw, Loader2, FileText, ChevronRight } from 'lucide-react';
import type { Season } from '@/lib/types';

interface PrivacyDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSeason: Season | null;
  isExporting: boolean;
  onExport: () => void;
  isResetting: boolean;
  onResetSeason: () => void;
}

export function PrivacyDataDialog({
  open,
  onOpenChange,
  activeSeason,
  isExporting,
  onExport,
  isResetting,
  onResetSeason,
}: PrivacyDataDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-theme text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">Privacy & Dati</DialogTitle>
          <DialogDescription className="text-muted-foreground">Esporta i tuoi dati o formatta l'account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="space-y-2">
            <Button
              onClick={onExport}
              disabled={isExporting}
              className="w-full font-black uppercase text-xs h-12 bg-primary dark:bg-black border border-primary dark:border-brand-green/30 text-white dark:text-white hover:opacity-90 dark:hover:bg-black/80 hover:border-primary dark:hover:border-brand-green shadow-sm dark:shadow-themesoft transition-all rounded-xl"
            >
              <Download className="mr-2 h-4 w-4 text-white dark:text-brand-green" />
              {isExporting ? "Esportazione..." : "Esporta tutto (CSV)"}
            </Button>
            <p className="text-[10px] text-foreground/40 text-center px-4">
              Ricevi un file per la squadra e uno per le partite nel tuo dispositivo.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="font-black uppercase text-sm -mt-0.5">Zona Pericolo</h4>
            </div>
            <p className="text-[11px] text-foreground/60">
              Cancellare tutti i dati della stagione {activeSeason?.name}? Questa azione è irreversibile.
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full font-black uppercase text-xs rounded-xl h-10 mt-2">
                  <RefreshCw className="mr-2 h-4 w-4" /> Reset Stagione
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-2xl dark:shadow-theme text-foreground max-w-[90vw]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="uppercase font-black text-destructive">Resettare la stagione?</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground font-bold">
                    Cancellazione DEFINITIVA giocatori, partite e statistiche della stagione <strong>{activeSeason?.name}</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row gap-2 mt-4">
                  <AlertDialogCancel className="flex-1 mt-0 rounded-xl font-bold text-xs bg-card/40 hover:bg-card/50 text-foreground border-none" disabled={isResetting}>
                    Annulla
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onResetSeason}
                    className="flex-1 bg-destructive hover:bg-destructive/90 rounded-xl font-bold text-xs uppercase border-none"
                    disabled={isResetting}
                  >
                    {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Conferma Reset"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Documenti Legali */}
          <div className="space-y-2 border-t border-border/50 pt-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Informativa Legale</h4>
            <div className="grid grid-cols-1 gap-2">
              <Link
                href="/privacy"
                className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 dark:bg-card/30 dark:hover:bg-card/50 border border-border dark:border-brand-green/20 transition-all text-xs font-bold"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary dark:text-brand-green" />
                  Privacy Policy
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                href="/termini"
                className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 dark:bg-card/30 dark:hover:bg-card/50 border border-border dark:border-brand-green/20 transition-all text-xs font-bold"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary dark:text-brand-green" />
                  Termini di Servizio
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
