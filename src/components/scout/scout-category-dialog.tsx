
"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/firebase";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { scoutRepository } from "@/lib/repositories/scout-repository";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRESET_COLORS = [
  "#FFFD66", // Brand Yellow
  "#ACE504", // Brand Green
  "#005A71", // Brand Cyan
  "#f87171", // Soft Red
  "#fb923c", // Orange
  "#c084fc", // Purple
  "#2dd4bf", // Teal
  "#94a3b8", // Slate
];

interface ScoutCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: any[];
}

export function ScoutCategoryDialog({ open, onOpenChange, categories }: ScoutCategoryDialogProps) {
  const { user } = useUser();
  const { activeSeason } = useSeasonsStore();
  const seasonId = activeSeason?.id ?? null;
  const { mutate } = useSWRConfig();
  
  const [loading, setLoading] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  // Le categorie stanno sulla stagione, come gli osservati che etichettano.
  const handleAddCategory = async () => {
    if (!user || !seasonId || !newCatName.trim()) return;

    setLoading(true);
    try {
      await scoutRepository.createCategory(seasonId, {
        name: newCatName.trim(),
        colorHex: selectedColor,
      });
      await mutate(`teams/${seasonId}/scoutCategories`);
      setNewCatName("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user || !seasonId) return;
    await scoutRepository.removeCategory(seasonId, id);
    await mutate(`teams/${seasonId}/scoutCategories`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-md rounded-3xl p-0 overflow-hidden bg-background dark:bg-black border border-border dark:border-brand-green/30 shadow-sm dark:shadow-theme transition-colors duration-300">
        <DialogHeader className="p-6 bg-card dark:bg-black border-b border-border dark:border-brand-green/30 text-foreground dark:text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight">
            Gestisci Etichette
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Form nuova categoria */}
          <div className="space-y-4 p-4 rounded-2xl bg-muted dark:bg-card/50 border border-border dark:border-brand-green/20">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Nuova Etichetta</Label>
              <div className="flex gap-2">
                <Input 
                  value={newCatName} 
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="Es: Piede Sinistro"
                  className="h-10 rounded-xl font-bold uppercase text-xs bg-background dark:bg-black border border-primary/50 dark:border-brand-green/50 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-foreground dark:text-white shadow-sm"
                />
                <Button 
                  size="sm" 
                  className="bg-primary border border-primary text-white hover:bg-primary/90 hover:text-white dark:bg-black dark:border-brand-green dark:text-brand-green dark:hover:bg-brand-green dark:hover:text-black shadow-sm dark:shadow-theme h-10 rounded-xl font-black uppercase px-4 transition-all"
                  onClick={handleAddCategory}
                  disabled={loading || !newCatName.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Scegli Colore</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <div 
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className="h-6 w-6 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center border-2 border-white"
                    style={{ backgroundColor: color, boxShadow: selectedColor === color ? `0 0 0 2px ${color}` : 'none' }}
                  >
                    {selectedColor === color && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lista categorie esistenti */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green ml-1">Etichette Esistenti</Label>
            <ScrollArea className="h-[200px] w-full rounded-xl bg-muted dark:bg-card/50 border border-border dark:border-brand-green/20 p-2">
              <div className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-[10px] text-center py-10 text-muted-foreground font-bold uppercase italic">Nessuna etichetta salvata.</p>
                ) : (
                  categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-background dark:hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                        <span className="text-[10px] font-black uppercase tracking-tight text-foreground dark:text-white">{cat.name}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:text-red-500 dark:hover:bg-red-500/10 transition-all"
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-6 pt-0">
          <Button className="w-full rounded-xl font-black uppercase text-xs h-12 bg-primary dark:bg-black border border-primary/30 dark:border-brand-green/30 text-white hover:opacity-90 dark:hover:bg-black/80 hover:border-primary dark:hover:border-brand-green shadow-sm dark:shadow-theme transition-all" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
