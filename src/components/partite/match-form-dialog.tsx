
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Match, MATCH_TYPES } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettingsStore } from "@/store/useSettingsStore";

import { Loader2 } from "lucide-react";

const safeParseDate = (dateSource?: any): Date => {
  if (!dateSource) return new Date();
  if (typeof dateSource === 'string') return new Date(dateSource);
  if (dateSource instanceof Date) return dateSource;
  if (dateSource && typeof dateSource.toDate === 'function') return dateSource.toDate();
  const d = new Date(dateSource);
  return isNaN(d.getTime()) ? new Date() : d;
};

const toDateInputValue = (dateSource?: any): string => {
  const date = safeParseDate(dateSource);
  return date.toISOString().split('T')[0];
};

const formSchema = z.object({
  opponent: z.string().min(2, { message: "Il nome dell'avversario è richiesto." }),
  date: z.string().min(1, { message: "La data è richiesta." }),
  isHome: z.boolean(),
  type: z.enum(MATCH_TYPES),
  duration: z.coerce.number().int().min(1, "Durata richiesta"),
  status: z.enum(['scheduled', 'completed', 'canceled']),
  round: z.coerce.number().int().optional().or(z.literal(0)),
});

type MatchFormValues = z.infer<typeof formSchema>;

interface MatchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any, matchId?: string) => Promise<void> | void;
  match?: Match | null;
}

export function MatchFormDialog({ open, onOpenChange, onSave, match }: MatchFormDialogProps) {
  const { defaultDuration } = useSettingsStore();
  const [isSaving, setIsSaving] = React.useState(false);
  
  const form = useForm<MatchFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      opponent: "",
      date: "",
      isHome: true,
      type: 'Campionato',
      duration: defaultDuration,
      status: 'completed',
      round: 0,
    },
  });

  React.useEffect(() => {
    if (open) {
      const initialDate = match ? toDateInputValue(match.date) : toDateInputValue(new Date());
      form.reset({
        opponent: match?.opponent || "",
        date: initialDate,
        isHome: match?.isHome ?? true,
        type: match?.type || 'Campionato',
        duration: match?.duration || defaultDuration,
        status: match?.status || 'completed',
        round: match?.round || 0,
      });
    }
  }, [open, match, form, defaultDuration]);


  async function onSubmit(data: MatchFormValues) {
    setIsSaving(true);
    try {
      await onSave({
          ...data,
          date: new Date(data.date).toISOString(), // Salviamo come stringa ISO a mezzanotte
      }, match?.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
    } finally {
      setIsSaving(false);
    }
  }

  const { min, max } = React.useMemo(() => {
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    const twoYearsLater = new Date(now);
    twoYearsLater.setFullYear(now.getFullYear() + 2);
    return {
      min: toDateInputValue(twoYearsAgo),
      max: toDateInputValue(twoYearsLater),
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
              <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto rounded-3xl bg-card dark:bg-background border border-primary/30 dark:border-brand-green/30 shadow-[0_0_25px_rgba(172,229,4,0.15)]">
        <DialogHeader>
          <DialogTitle className="font-black uppercase text-foreground">
            {match ? "Modifica Gara" : "Nuova Gara"}
          </DialogTitle>
          <DialogDescription className="text-xs uppercase font-bold text-muted-foreground dark:text-muted-foreground/60">
            {match
              ? "Aggiorna le informazioni della partita."
              : "Inserisci i dettagli per pianificare la gara."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="opponent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">Avversario</FormLabel>
                  <FormControl>
                    <Input placeholder="Es: Real Isola" {...field} className="h-11 rounded-xl font-bold uppercase text-xs bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4">
                <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">Tipo Gara</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger className="h-11 rounded-xl text-xs font-bold uppercase bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green text-foreground dark:text-white">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border border-primary/30 dark:border-brand-green/30 text-foreground">
                            {MATCH_TYPES.map(t => (
                              <SelectItem key={t} value={t} className="text-xs font-bold uppercase">{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">Durata (Min)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value.toString()}>
                        <FormControl>
                            <SelectTrigger className="h-11 rounded-xl text-xs font-bold uppercase bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green text-foreground dark:text-white">
                                <SelectValue placeholder="Durata" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border border-primary/30 dark:border-brand-green/30 text-foreground">
                            <SelectItem value="70" className="text-xs font-bold uppercase">70 min</SelectItem>
                            <SelectItem value="80" className="text-xs font-bold uppercase">80 min</SelectItem>
                            <SelectItem value="90" className="text-xs font-bold uppercase">90 min</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

              <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">Data della Gara</FormLabel>
                  <FormControl>
                      <Input
                      type="date"
                      min={min}
                      max={max}
                      {...field}
                      className="h-11 rounded-xl font-bold uppercase text-xs bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white"
                      />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="isHome"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border border-primary/30 dark:border-brand-green/30 p-3 bg-muted/40 dark:bg-black/40">
                        <div className="space-y-0.5">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">In Casa</FormLabel>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green"
                            />
                        </FormControl>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger className="h-[54px] rounded-xl text-xs font-bold uppercase bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green text-foreground dark:text-white">
                                <SelectValue placeholder="Stato" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border border-primary/30 dark:border-brand-green/30 text-foreground">
                                <SelectItem value="scheduled" className="text-xs font-bold uppercase">Programmata</SelectItem>
                                <SelectItem value="completed" className="text-xs font-bold uppercase">Finita</SelectItem>
                                <SelectItem value="canceled" className="text-xs font-bold uppercase">Annullata</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <DialogFooter className="pt-4 flex-row gap-2">
              <Button 
                type="button" 
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl font-black uppercase text-xs bg-muted dark:bg-black/40 border border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-black/60 transition-all" 
                onClick={() => onOpenChange(false)}
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white font-black uppercase text-xs shadow-[0_0_10px_rgba(172,229,4,0.2)] hover:opacity-90 dark:hover:bg-black/80 hover:scale-[1.02] transition-all"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  "Salva Gara"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
