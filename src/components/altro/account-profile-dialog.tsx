"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface AccountProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { username: string; email: string } | null;
  onLogout: () => void;
}

export function AccountProfileDialog({
  open,
  onOpenChange,
  user,
  onLogout,
}: AccountProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-theme text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">Profilo Allenatore</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 dark:bg-card/20 hover:bg-muted/50 dark:hover:bg-card/30">
            <div className="h-12 w-12 rounded-full bg-background dark:bg-black border border-border dark:border-brand-green flex items-center justify-center text-primary dark:text-brand-green font-black uppercase text-xl shadow-sm dark:shadow-theme">
              {user?.username?.charAt(0) || "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight">{user?.username}</span>
              <span className="text-sm text-muted-foreground dark:text-muted-foreground/60">{user?.email}</span>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={onLogout}
              className="w-full rounded-xl font-black uppercase text-xs h-12 bg-background dark:bg-black border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500 shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.05)] transition-all"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Esci dall'Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

