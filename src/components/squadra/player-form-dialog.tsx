
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Sparkles, Globe, Loader2, Shirt } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Input } from "@/components/ui/input";
import { Player, Role, ROLES, PlayerRole, migrateRole, ROLE_LABELS } from "@/lib/types";
import { PitchRoleSelector } from "./PitchRoleSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  firstName: z.string().min(2, { message: "Il nome è richiesto." }),
  lastName: z.string().min(2, { message: "Il cognome è richiesto." }),
  roles: z.array(z.string().refine((val): val is PlayerRole =>
    ['POR','DC','TD','TS','ADA','ASA','CDC','TRQ','CD','CS','AD','AS','ATT'].includes(val),
    { message: "Ruolo non valido" }
  )).min(1, { message: "Seleziona almeno un ruolo." }).default([]),
});

type FormValues = z.infer<typeof formSchema>;

type PlayerSaveData = {
  name: string;
  firstName: string;
  lastName: string;
  roles: PlayerRole[];
};

interface PlayerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PlayerSaveData, playerId?: string) => Promise<void> | void;
  player?: Player | null;
  onAIImport?: () => void;
  onTuttocampoImport?: () => void;
}

export function PlayerFormDialog({ open, onOpenChange, onSave, player, onAIImport, onTuttocampoImport }: PlayerFormDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRolesDialogOpen, setIsRolesDialogOpen] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      roles: [],
    },
  });

  const roles = form.watch("roles");

  React.useEffect(() => {
    if (open) {
      if (player) {
        const nameParts = player.name.split(' ');
        const firstName = nameParts.shift() || '';
        const lastName = nameParts.join(' ');

        // Migrate legacy role/secondaryRoles to roles array
        let roles: PlayerRole[];
        if (player.roles && player.roles.length > 0) {
          roles = player.roles;
        } else if (player.role) {
          roles = [migrateRole(player.role), ...(player.secondaryRoles?.map(migrateRole) || [])];
        } else {
          roles = [];
        }

        form.reset({
          firstName,
          lastName,
          roles,
        });
      } else {
        form.reset({
          firstName: "",
          lastName: "",
          roles: [],
        });
      }
    }
  }, [player, open, form]);

  async function onSubmit(data: FormValues) {
    setIsSaving(true);
    try {
      const saveData: PlayerSaveData = {
        name: `${data.firstName} ${data.lastName}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        roles: data.roles,
      };
      await onSave(saveData, player?.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
    } finally {
      setIsSaving(false);
    }
  }

  const handleRolesSave = (selectedRoles: PlayerRole[]) => {
    form.setValue("roles", selectedRoles, { shouldValidate: true });
    setIsRolesDialogOpen(false);
  };

  return (
    <>
      {/* Main Player Form Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideClose className="sm:max-w-[425px] rounded-[28px] bg-card dark:bg-black border border-border dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_25px_rgba(172,229,4,0.05)] p-6 overflow-hidden">
          <DialogHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1 text-left">
              <DialogTitle className="text-foreground dark:text-white font-black uppercase text-xl md:text-2xl tracking-tight">
                {player ? "Modifica Giocatore" : "Nuovo Giocatore"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">
                Dettagli anagrafici e ruolo tecnico in rosa.
              </DialogDescription>
            </div>
            {!player && (
              <div className="flex gap-2 ml-4">
                <Button 
                  onClick={onAIImport}
                  variant="ghost"
                  size="icon"
                  disabled={isSaving}
                  className="h-10 w-10 rounded-full bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green hover:bg-primary/20 dark:hover:bg-brand-green/20"
                  title="Importazione AI"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
                <RoleGuard allowedRoles={['developer']}>
                  <Button 
                    onClick={onTuttocampoImport}
                    variant="ghost"
                    size="icon"
                    disabled={isSaving}
                    className="h-10 w-10 rounded-full bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green hover:bg-primary/20 dark:hover:bg-brand-green/20"
                    title="Importa da Tuttocampo"
                  >
                    <Globe className="h-5 w-5" />
                  </Button>
                </RoleGuard>
              </div>
            )}
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/80 ml-1">Nome</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Mario" 
                          {...field} 
                          disabled={isSaving}
                          className="h-11 text-xs font-black uppercase rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green focus-visible:border-primary dark:focus-visible:border-brand-green transition-all" 
                        />
                      </FormControl>
                      <FormMessage className="text-[9px] font-bold uppercase" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/80 ml-1">Cognome</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Rossi" 
                          {...field} 
                          disabled={isSaving}
                          className="h-11 text-xs font-black uppercase rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green focus-visible:border-primary dark:focus-visible:border-brand-green transition-all" 
                        />
                      </FormControl>
                      <FormMessage className="text-[9px] font-bold uppercase" />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Roles Button + Selected Badges */}
              <FormField
                control={form.control}
                name="roles"
                render={() => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/80 ml-1">Ruoli del giocatore</FormLabel>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSaving}
                        onClick={() => setIsRolesDialogOpen(true)}
                        className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest bg-background dark:bg-black border border-border dark:border-brand-green/30 hover:bg-muted dark:hover:bg-white/5 transition-all"
                      >
                        <Shirt className="mr-1.5 h-3.5 w-3.5" />
                        Ruoli
                        {roles.length > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary dark:bg-brand-green text-white dark:text-black text-[8px] font-black">
                            {roles.length}
                          </span>
                        )}
                      </Button>
                      {/* Selected roles preview */}
                      <div className="flex flex-wrap gap-1 flex-1">
                        {roles.length === 0 ? (
                          <span className="text-[9px] font-bold uppercase text-muted-foreground dark:text-muted-foreground/40">Nessun ruolo selezionato</span>
                        ) : (
                          roles.map((role, idx) => (
                            <Badge
                              key={role}
                              className={cn(
                                "text-[8px] font-black uppercase py-0.5 px-1.5",
                                idx === 0 && "ring-1 ring-yellow-400"
                              )}
                            >
                              {idx === 0 && <span className="mr-0.5 text-yellow-400">★</span>}
                              {role}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <FormMessage className="text-[9px] font-bold uppercase" />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-6 flex-row gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  disabled={isSaving}
                  className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest h-12 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all" 
                  onClick={() => onOpenChange(false)}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-[10px] tracking-widest h-12 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    "Salva"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Roles Pop-up Dialog */}
      <Dialog open={isRolesDialogOpen} onOpenChange={setIsRolesDialogOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-[28px] bg-card dark:bg-black border border-border dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_25px_rgba(172,229,4,0.05)] p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground dark:text-white font-black uppercase text-lg tracking-tight">
              Seleziona Ruoli
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">
              Tocca le posizioni sul campo per selezionare i ruoli. Il primo selezionato è il ruolo principale.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <PitchRoleSelector
              selectedRoles={roles}
              onChange={(newRoles) => form.setValue("roles", newRoles)}
            />
          </div>
          <DialogFooter className="flex-row gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest h-11 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all" 
              onClick={() => setIsRolesDialogOpen(false)}
            >
              Annulla
            </Button>
            <Button 
              type="button" 
              onClick={() => handleRolesSave(roles)}
              className="flex-1 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-[10px] tracking-widest h-11 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
