"use client";

import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlayersStore } from "@/store/usePlayersStore";
import { displayPlayerName, cn } from "@/lib/utils";
import { Hospital, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Player, InjuryPeriod } from "@/lib/types";

export function InjuryFormDialog({ 
    open, 
    onOpenChange 
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
}) {
    const { players, update } = usePlayersStore();
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [startOpen, setStartOpen] = useState(false);
    const [endOpen, setEndOpen] = useState(false);

    const selectedPlayer = players.find(p => p.id === selectedPlayerId);

    const handleSave = async () => {
        if (!selectedPlayerId || !startDate || !endDate || !selectedPlayer) return;

        const newInjury: InjuryPeriod = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd')
        };

        const updatedInjuries = [...(selectedPlayer.injuries || []), newInjury];
        await update(selectedPlayerId, { injuries: updatedInjuries });
        
        // Reset form
        setSelectedPlayerId("");
        setStartDate(undefined);
        setEndDate(undefined);
        onOpenChange(false);
    };

    const handleRemoveInjury = async (player: Player, injuryId: string) => {
        const updatedInjuries = (player.injuries || []).filter(i => i.id !== injuryId);
        await update(player.id, { injuries: updatedInjuries });
    };

    const calendarClassNames = {
        weekday: "text-muted-foreground dark:text-muted-foreground/30 rounded-md w-9 font-black text-[0.6rem] uppercase tracking-tighter text-center",
        caption_label: "text-sm font-black uppercase tracking-[0.2em] text-foreground dark:text-white",
        day: "h-10 w-10 p-0 m-0 flex items-center justify-center relative",
        day_button: "text-foreground/80 dark:text-white/60 hover:bg-muted dark:hover:bg-black hover:text-foreground dark:hover:text-white hover:border hover:border-primary/30 dark:hover:border-brand-green/30 hover:shadow-sm dark:hover:shadow-[0_0_15px_rgba(172,229,4,0.4)] rounded-xl h-10 w-10 flex items-center justify-center p-0 font-black transition-all cursor-pointer relative z-10",
        selected: "!bg-transparent border-2 border-primary dark:border-brand-green text-primary dark:text-brand-green shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] hover:!bg-muted dark:hover:!bg-black hover:!text-foreground dark:hover:!text-white rounded-xl",
        today: "bg-muted/50 dark:bg-white/5 text-foreground/50 dark:text-white/40 rounded-xl",
        button_previous: "hover:bg-primary/10 dark:hover:bg-brand-green/10 hover:text-primary dark:hover:text-brand-green rounded-lg transition-colors p-1 text-foreground/50 dark:text-white/50",
        button_next: "hover:bg-primary/10 dark:hover:bg-brand-green/10 hover:text-primary dark:hover:text-brand-green rounded-lg transition-colors p-1 text-foreground/50 dark:text-white/50",
    };

    const allInjuries = players.flatMap(p => 
        (p.injuries || []).map(injury => ({
            ...injury,
            player: p
        }))
    ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-[28px] bg-card dark:bg-black border border-primary/30 dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_25px_rgba(172,229,4,0.15)] p-6 overflow-hidden">
                <DialogHeader className="space-y-1">
                    <div className="mx-auto bg-primary/10 dark:bg-brand-green/10 p-3 rounded-full mb-2 border border-primary/20 dark:border-brand-green/20">
                        <Hospital className="h-6 w-6 text-primary dark:text-brand-green" />
                    </div>
                    <DialogTitle className="text-foreground dark:text-white font-black uppercase text-xl md:text-2xl tracking-tight text-center">
                        Infermeria
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60 text-center">
                        Aggiungi o rimuovi un periodo di infortunio
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="infortuni" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 dark:bg-black/40 rounded-xl p-1 mb-4 h-auto border border-border dark:border-brand-green/10">
                        <TabsTrigger value="infortuni" className="text-xs font-black uppercase rounded-lg h-10 data-[state=active]:bg-primary dark:data-[state=active]:bg-brand-green data-[state=active]:text-white dark:data-[state=active]:text-black transition-all">Infortuni</TabsTrigger>
                        <TabsTrigger value="aggiungi" className="text-xs font-black uppercase rounded-lg h-10 data-[state=active]:bg-primary dark:data-[state=active]:bg-brand-green data-[state=active]:text-white dark:data-[state=active]:text-black transition-all">Aggiungi</TabsTrigger>
                    </TabsList>

                    <TabsContent value="infortuni" className="max-h-[50vh] overflow-y-auto pr-2 space-y-4 mt-0">
                        {allInjuries.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border dark:border-brand-green/20 rounded-2xl">
                                Nessun Infortunio Registrato
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-2 px-3 pb-2 border-b border-border dark:border-brand-green/20 text-[9px] font-black uppercase tracking-widest text-foreground dark:text-white/70">
                                    <div className="col-span-5">Giocatore</div>
                                    <div className="col-span-3">Da</div>
                                    <div className="col-span-4">A</div>
                                </div>
                                {allInjuries.map(injury => (
                                    <div key={injury.id} className="grid grid-cols-12 gap-2 px-3 py-3.5 bg-muted/50 dark:bg-black/60 rounded-xl items-center text-[10px] font-bold uppercase relative group border border-border/50 dark:border-brand-green/10 hover:border-primary/30 dark:hover:border-brand-green/30 transition-colors">
                                        <div className="col-span-5 truncate text-foreground dark:text-white pr-2">{displayPlayerName(injury.player)}</div>
                                        <div className="col-span-3 text-foreground dark:text-white/80">{format(new Date(injury.startDate), 'dd MMM yyyy', {locale: it})}</div>
                                        <div className="col-span-4 text-foreground dark:text-white flex justify-between items-center">
                                            <span>{format(new Date(injury.endDate), 'dd MMM yyyy', {locale: it})}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute right-2 opacity-0 group-hover:opacity-100 h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all"
                                                onClick={() => handleRemoveInjury(injury.player, injury.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="pt-4 flex justify-end">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-6 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all" 
                                onClick={() => onOpenChange(false)}
                            >
                                Chiudi
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="aggiungi" className="space-y-5 mt-0">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-primary dark:text-brand-green/80 ml-1">Seleziona Giocatore</label>
                            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                                <SelectTrigger className="h-11 text-xs font-black uppercase rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green transition-all">
                                    <SelectValue placeholder="Scegli..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border bg-card">
                                    {players.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">
                                            {displayPlayerName(p)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-primary dark:text-brand-green/80 ml-1">Data Inizio</label>
                                <Popover open={startOpen} onOpenChange={setStartOpen} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"ghost"}
                                            className={cn(
                                                "w-full h-11 justify-start text-left font-bold uppercase text-xs rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary dark:text-brand-green" />
                                            {startDate ? format(startDate, "dd MMM yyyy", { locale: it }) : <span>Inizio</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-2xl bg-card dark:bg-background border-border dark:border-brand-green/30 shadow-xl z-[9999]" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={(val) => {
                                                setStartDate(val);
                                                if (val) setTimeout(() => setStartOpen(false), 200);
                                            }}
                                            initialFocus
                                            locale={it}
                                            className="p-3 bg-card dark:bg-background rounded-2xl"
                                            classNames={calendarClassNames}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-primary dark:text-brand-green/80 ml-1">Data Fine</label>
                                <Popover open={endOpen} onOpenChange={setEndOpen} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"ghost"}
                                            className={cn(
                                                "w-full h-11 justify-start text-left font-bold uppercase text-xs rounded-xl bg-background dark:bg-black border border-border dark:border-brand-green/20 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary dark:text-brand-green" />
                                            {endDate ? format(endDate, "dd MMM yyyy", { locale: it }) : <span>Fine</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-2xl bg-card dark:bg-background border-border dark:border-brand-green/30 shadow-xl z-[9999]" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={(val) => {
                                                setEndDate(val);
                                                if (val) setTimeout(() => setEndOpen(false), 200);
                                            }}
                                            initialFocus
                                            locale={it}
                                            className="p-3 bg-card dark:bg-background rounded-2xl"
                                            classNames={calendarClassNames}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <DialogFooter className="pt-6 flex-row gap-3">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest h-12 text-muted-foreground hover:bg-muted dark:hover:bg-white/5 transition-all" 
                                onClick={() => onOpenChange(false)}
                            >
                                Annulla
                            </Button>
                            <Button 
                                type="button" 
                                onClick={handleSave}
                                disabled={!selectedPlayerId || !startDate || !endDate}
                                className="flex-1 bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-[10px] tracking-widest h-12 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                Registra
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
