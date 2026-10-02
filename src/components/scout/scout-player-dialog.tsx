
"use client";

import { useState, useEffect } from "react";
import { useSWRConfig } from "swr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser, useFirestore } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { PlayerRole, getPrimaryRole } from '@/lib/types';
import type { ScoutPlayer, ScoutCategory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PitchRoleSelector } from "@/components/squadra/PitchRoleSelector";

interface ScoutPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: ScoutPlayer | null;
  categories: ScoutCategory[];
}

export function ScoutPlayerDialog({ open, onOpenChange, player, categories }: ScoutPlayerDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { mutate } = useSWRConfig();

  const [loading, setLoading] = useState(false);
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "ATT" as PlayerRole,
    roles: [] as PlayerRole[],
    currentTeam: "",
    notes: "",
    categoryIds: [] as string[]
  });

  useEffect(() => {
    if (player) {
      setFormData({
        name: player.name || "",
        role: player.role ? getPrimaryRole({...player, role: player.role} as any) as PlayerRole : 'ATT',
        roles: player.role ? [getPrimaryRole({...player, role: player.role} as any) as PlayerRole] : [],
        currentTeam: player.currentTeam || "",
        notes: player.notes || "",
        categoryIds: player.categoryIds || []
      });
    } else {
      setFormData({
        name: "",
        role: "ATT",
        roles: [],
        currentTeam: "",
        notes: "",
        categoryIds: []
      });
    }
  }, [player, open]);

  const handleSave = async () => {
    if (!user || !firestore || !formData.name) return;

    setLoading(true);
    try {
      if (player) {
        await setDoc(doc(firestore, 'users', user.uid, 'scoutPlayers', player.id), {
          ...formData,
          id: player.id,
          userId: user.uid,
          role: formData.roles[0] || formData.role,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        const id = `SP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        await setDoc(doc(firestore, 'users', user.uid, 'scoutPlayers', id), {
          ...formData,
          id,
          userId: user.uid,
          role: formData.roles[0] || formData.role,
          createdAt: new Date().toISOString()
        });
      }
      await mutate(`users/${user.uid}/scoutPlayers`);
      onOpenChange(false);
    } catch (e: any) {
      console.error("Save Player Error:", e);
      toast({ variant: "destructive", title: "Errore di salvataggio", description: e.message || "Non è stato possibile salvare le info dell'osservato." });
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (id: string) => {
    setFormData(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter(i => i !== id)
        : [...prev.categoryIds, id]
    }));
  };

  const handleRolesSave = (selectedRoles: PlayerRole[]) => {
    setFormData(prev => ({
      ...prev,
      roles: selectedRoles,
      role: selectedRoles[0] || prev.role
    }));
    setIsRolesDialogOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] md:max-w-md rounded-3xl p-0 overflow-hidden bg-background dark:bg-black border border-border dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] transition-colors duration-300">
          <DialogHeader className="p-6 bg-card dark:bg-black border-b border-border dark:border-brand-green/30 text-foreground dark:text-white shrink-0">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              {player ? "Modifica Osservato" : "Nuovo Osservato"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Nome Giocatore</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Mario Rossi"
                  className="h-11 rounded-xl font-bold uppercase text-xs bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white shadow-sm"
                />
              </div>

              {/* Roles selector button */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Ruolo</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => setIsRolesDialogOpen(true)}
                    className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest bg-background dark:bg-black border border-border dark:border-brand-green/30 hover:bg-muted dark:hover:bg-white/5 transition-all"
                  >
                    <Shirt className="mr-1.5 h-3.5 w-3.5" />
                    Ruoli
                    {formData.roles.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary dark:bg-brand-green text-white dark:text-black text-[8px] font-black">
                        {formData.roles.length}
                      </span>
                    )}
                  </Button>
                  {/* Selected roles preview */}
                  <div className="flex flex-wrap gap-1 flex-1">
                    {formData.roles.length === 0 ? (
                      <span className="text-[9px] font-bold uppercase text-muted-foreground dark:text-muted-foreground/40">Nessun ruolo</span>
                    ) : (
                      formData.roles.map((role, idx) => (
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Squadra Attuale</Label>
                <Input
                  value={formData.currentTeam}
                  onChange={e => setFormData({ ...formData, currentTeam: e.target.value })}
                  placeholder="Es: Real Isola"
                  className="h-11 rounded-xl font-bold uppercase text-xs bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Etichette (Seleziona)</Label>
                <div className="flex flex-wrap gap-2 pt-1 border border-border dark:border-brand-green/20 rounded-xl p-3 bg-muted dark:bg-card/50 text-foreground">
                  {categories.length === 0 ? (
                    <p className="text-[9px] font-bold text-muted-foreground uppercase italic p-2 bg-background dark:bg-muted/30 w-full rounded-lg">
                      Nessuna etichetta creata. Creale dal tasto &quot;Etichette&quot; in home scout.
                    </p>
                  ) : (
                    categories.map(cat => (
                      <Badge
                        key={cat.id}
                        style={{
                          backgroundColor: formData.categoryIds.includes(cat.id) ? cat.colorHex : 'transparent',
                          borderColor: cat.colorHex,
                          color: formData.categoryIds.includes(cat.id) ? 'white' : cat.colorHex
                        }}
                        className={cn(
                          "cursor-pointer uppercase font-black text-[8px] px-2 py-0.5 rounded border transition-all",
                          !formData.categoryIds.includes(cat.id) && "opacity-50"
                        )}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        {formData.categoryIds.includes(cat.id) && <Check className="h-2 w-2 mr-1" />}
                        {cat.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Note Tecniche</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ottimo piede sinistro, veloce nel breve..."
                  className="min-h-[100px]] rounded-xl text-xs font-medium bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white shadow-sm"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-2 flex-row gap-2">
            <Button className="flex-1 rounded-xl font-black uppercase text-xs h-12 bg-muted dark:bg-black/40 border border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted/80 dark:hover:bg-black/60 shadow-none dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] transition-all" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button
              className="flex-1 rounded-xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white font-black uppercase text-xs h-12 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)] hover:opacity-90 dark:hover:bg-black/80 hover:scale-105 transition-all"
              onClick={handleSave}
              disabled={loading || !formData.name}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-white dark:text-brand-green" /> : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roles selector dialog */}
      <Dialog open={isRolesDialogOpen} onOpenChange={setIsRolesDialogOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-[28px] bg-card dark:bg-black border border-border dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_25px_rgba(172,229,4,0.05)] p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground dark:text-white font-black uppercase text-lg tracking-tight">
              Seleziona Ruoli
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <PitchRoleSelector
              selectedRoles={formData.roles}
              onChange={(newRoles) => setFormData(prev => ({ ...prev, roles: newRoles, role: newRoles[0] || prev.role }))}
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
              onClick={() => handleRolesSave(formData.roles)}
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
