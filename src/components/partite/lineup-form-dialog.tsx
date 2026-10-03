"use client";

import * as React from "react";
import { useMatchDetailStore } from "@/store/useMatchDetailStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Users, LayoutGrid, Loader2 } from "lucide-react";
import { getJerseyNumber, getSubstituteNumber, FORMATION_POSITIONS, getPositionAcronym, MATCH_FORMATIONS } from "@/lib/lineup-mapping";
import { displayPlayerName } from "@/lib/utils";
import { useSettingsStore } from "@/store/useSettingsStore";
import { TacticalPitchEditor } from "./tactical-pitch-editor";
import { SmartPlayerSelectDialog } from "./smart-player-select-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface LineupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LineupFormDialog({ open, onOpenChange }: LineupFormDialogProps) {
  const { allPlayers, lineup, saveLineup } = useMatchDetailStore();
  const teamName = useSettingsStore((state) => state.teamName);
  const [starters, setStarters] = React.useState<string[]>(Array(11).fill(""));
  const [substitutes, setSubstitutes] = React.useState<string[]>(Array(9).fill(""));
  const [modulo, setModulo] = React.useState("4-4-2");
  const [openSelect, setOpenSelect] = React.useState<string | null>(null);
  const [editingSlot, setEditingSlot] = React.useState<number | null>(null);
  const [activeTab, setActiveTab] = React.useState("starters");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      if (lineup) {
        const s = [...Array(11)].map((_, i) => {
          const p = lineup.starters[i];
          return (typeof p === "string" ? p : p?.playerId) || "";
        });
        const subs = [...Array(9)].map((_, i) => {
          const p = lineup.substitutes[i];
          return (typeof p === "string" ? p : p?.playerId) || "";
        });
        setStarters(s);
        setSubstitutes(subs);
        if (lineup.formation) setModulo(lineup.formation);
      } else {
        setStarters(Array(11).fill(""));
        setSubstitutes(Array(9).fill(""));
      }
    }
  }, [open, lineup]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveLineup({
        matchId: "", // Gestito dallo store
        starters,
        substitutes,
        formation: modulo,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante il salvataggio della formazione:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const allSelectedIds = React.useMemo(() => {
    return [...starters, ...substitutes].filter(id => id !== "" && id !== "none");
  }, [starters, substitutes]);

  const PlayerRow = ({
    label,
    value,
    onValueChange,
    open,
    onOpenChange
  }: {
    label: string | number,
    value: string,
    onValueChange: (val: string) => void,
    isStarter: boolean,
    open: boolean,
    onOpenChange: (open: boolean) => void
  }) => {
    const availablePlayers = allPlayers.filter(p =>
      !allSelectedIds.includes(p.id) || p.id === value
    );

    return (
      <div className="flex items-center gap-3 border-b border-border dark:border-white/5 py-3 last:border-0 hover:bg-muted/50 dark:hover:bg-white/5 transition-all px-4 rounded-xl group">
        <div className="bg-muted dark:bg-neutral-900 text-foreground dark:text-white w-10 h-10 flex items-center justify-center font-black text-[10px] uppercase rounded-full border border-border dark:border-white/10 shadow-none transition-transform group-hover:scale-110">
          {label}
        </div>
        <div className="flex-1">
          <Select 
            value={value || "none"} 
            onValueChange={onValueChange}
            open={open}
            onOpenChange={onOpenChange}
            disabled={isSaving}
          >
            <SelectTrigger className="border-none shadow-none h-10 text-foreground dark:text-white focus:ring-0 text-xs font-black uppercase hover:opacity-80 transition-opacity p-0 bg-transparent">
              <SelectValue placeholder="-- SELEZIONA --" />
            </SelectTrigger>
            <SelectContent className="bg-card dark:bg-black border-border dark:border-white/20 text-foreground dark:text-white">
              <SelectItem value="none" className="text-xs uppercase font-bold text-muted-foreground dark:text-white/50">-- nessuno --</SelectItem>
              {availablePlayers.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs uppercase font-black text-foreground dark:text-white">{displayPlayerName(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] sm:h-[85vh] p-0 overflow-hidden flex flex-col gap-0 border-none bg-background dark:bg-black text-foreground dark:text-white shadow-2xl rounded-3xl">
        <DialogHeader className="bg-muted dark:bg-black text-foreground dark:text-white p-6 flex-row items-center gap-4 space-y-0 border-b border-border dark:border-white/10 shrink-0">
          <Button variant="ghost" size="icon" disabled={isSaving} className="text-primary dark:text-brand-green hover:bg-primary/10 dark:hover:bg-white/10 rounded-full" onClick={() => onOpenChange(false)}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">Lineup Editor</DialogTitle>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Configura la formazione iniziale</p>
          </div>
        </DialogHeader>

        <div className="bg-card dark:bg-card/50 border-b border-border dark:border-white/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 dark:bg-brand-green/10 border border-primary/20 dark:border-brand-green/20 rounded-2xl flex items-center justify-center">
              <div className="w-4 h-4 bg-primary dark:bg-brand-green rounded-full animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black text-muted-foreground uppercase block">Squadra</span>
              <span className="text-sm font-black uppercase text-foreground dark:text-white">{teamName || 'PITCHMAN'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-background dark:bg-black p-2 rounded-2xl border border-border dark:border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">MODULO</span>
            <Select 
              value={modulo} 
              onValueChange={setModulo}
              disabled={isSaving}
              open={openSelect === 'modulo'}
              onOpenChange={(open) => setOpenSelect(open ? 'modulo' : null)}
            >
              <SelectTrigger className="bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green h-10 text-sm w-32 font-black border-none shadow-none uppercase focus:ring-0 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card dark:bg-black border-border dark:border-brand-green/50 text-foreground dark:text-white rounded-xl">
                {MATCH_FORMATIONS.map(f => (
                  <SelectItem key={f} value={f} className="text-sm font-black uppercase">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-2 border-b border-border dark:border-white/10">
            <TabsList className="grid grid-cols-2 bg-muted dark:bg-neutral-900 h-12 p-1 rounded-xl">
              <TabsTrigger value="starters" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Titolari
              </TabsTrigger>
              <TabsTrigger value="substitutes" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-primary dark:data-[state=active]:text-brand-green">
                <Users className="w-4 h-4 mr-2" />
                Panchina
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="starters" className="flex-1 overflow-y-auto m-0 p-4 sm:p-6 bg-muted/30 dark:bg-black/20">
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <TacticalPitchEditor
                formation={modulo}
                starters={starters}
                allPlayers={allPlayers}
                onSlotClick={(idx) => !isSaving && setEditingSlot(idx)}
              />
            </div>
          </TabsContent>

          <TabsContent value="substitutes" className="flex-1 overflow-y-auto m-0 p-6">
            <div className="bg-card dark:bg-neutral-900/30 rounded-3xl border border-border dark:border-white/5 p-2 animate-in slide-in-from-bottom-4 duration-500">
              {substitutes.map((s, i) => (
                <PlayerRow
                  key={i}
                  label={`R${i + 1}`}
                  value={s}
                  isStarter={false}
                  onValueChange={(val) => {
                    const newSubs = [...substitutes];
                    newSubs[i] = val === "none" ? "" : val;
                    setSubstitutes(newSubs);
                  }}
                  open={openSelect === `substitute-${i}`}
                  onOpenChange={(open) => setOpenSelect(open ? `substitute-${i}` : null)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="p-6 bg-background dark:bg-black border-t border-border dark:border-white/10 shrink-0">
          <Button
            className="w-full bg-primary dark:bg-brand-green text-white dark:text-black hover:opacity-90 font-black uppercase text-sm h-14 rounded-2xl shadow-lg dark:shadow-theme transition-all"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              "Conferma Formazioni"
            )}
          </Button>
        </div>
      </DialogContent>

      {editingSlot !== null && (
        <SmartPlayerSelectDialog
          open={editingSlot !== null}
          onOpenChange={(open) => !open && setEditingSlot(null)}
          slotIndex={editingSlot}
          formation={modulo}
          allPlayers={allPlayers}
          selectedPlayerIds={[...starters, ...substitutes]}
          onSelect={(playerId) => {
            const newStarters = [...starters];
            newStarters[editingSlot] = playerId;
            setStarters(newStarters);
          }}
        />
      )}
    </Dialog>
  );
}
