
"use client";

import { useState, useMemo, Suspense } from "react";
import { useSWRConfig } from "swr";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Tag, Search, Filter, Trash2, Edit, UserPlus, Info } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { ScoutPlayerDialog } from "@/components/scout/scout-player-dialog";
import { ScoutCategoryDialog } from "@/components/scout/scout-category-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScoutPlayerSchema, ScoutCategorySchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import * as React from "react";
import type { ScoutPlayer, ScoutCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "next/navigation";
import { displayPlayerName } from "@/lib/utils";

// Sub-component to safely use useSearchParams
function ScoutContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { mutate } = useSWRConfig();
  const searchParams = useSearchParams();

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<ScoutPlayer | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<ScoutPlayer | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const observerTarget = React.useRef<HTMLDivElement>(null);

  // Check URL params specifically on mount or when they change
  React.useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setEditingPlayer(null);
      setIsPlayerDialogOpen(true);
    }
  }, [searchParams]);

  // Debounce ricerca
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Infinite scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 12);
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, []);

  // Reset paginazione su nuovi filtri
  React.useEffect(() => {
    setVisibleCount(12);
  }, [debouncedSearchTerm, selectedCategoryIds]);

  // Queries Firestore
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'scoutCategories');
  }, [firestore, user]);

  const playersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'scoutPlayers');
  }, [firestore, user]);

  const { data: categories, isLoading: catLoading } = useCollection<ScoutCategory>(categoriesQuery, ScoutCategorySchema as any);
  const { data: players, isLoading: playersLoading } = useCollection<ScoutPlayer>(playersQuery, ScoutPlayerSchema as any);

  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    return players.filter(p => {
      const matchCat = selectedCategoryIds.length === 0 || selectedCategoryIds.every(catId => p.categoryIds?.includes(catId));
      const matchSearch = p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [players, selectedCategoryIds, debouncedSearchTerm]);

  const visiblePlayers = filteredPlayers.slice(0, visibleCount);

  const toggleFilter = (id: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const confirmDeletePlayer = async () => {
    if (!playerToDelete || !user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'scoutPlayers', playerToDelete.id));
      await mutate(`users/${user.uid}/scoutPlayers`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile eliminare l'osservato." });
      console.error("Delete Error:", err);
    } finally {
      setPlayerToDelete(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Osservazioni">
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-9 text-[10px] font-black uppercase rounded-xl bg-card border border-border dark:bg-black dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted dark:hover:bg-black/60 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)] transition-all"
            onClick={() => setIsCategoryDialogOpen(true)}
          >
            <Tag className="mr-1.5 h-3.5 w-3.5 text-primary dark:text-brand-green" /> Etichette
          </Button>
          <Button
            size="sm"
            className="h-9 text-[10px] font-black uppercase rounded-xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-white hover:opacity-90 dark:hover:bg-black/80 shadow-md dark:shadow-[0_0_10px_rgba(172,229,4,0.15)] hover:scale-105 transition-all"
            onClick={() => { setEditingPlayer(null); setIsPlayerDialogOpen(true); }}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5 text-white dark:text-brand-green" /> Nuovo
          </Button>
        </div>
      </PageHeader>

      {/* Sezione Filtri */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary dark:text-brand-green" />
            <Input
              placeholder="Cerca osservato per nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 w-full rounded-2xl border-border dark:border-brand-green/30 bg-card dark:bg-black/40 text-foreground dark:text-white font-bold text-sm focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] placeholder:text-muted-foreground dark:text-muted-foreground/30 dark:placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-1">
          <Filter className="h-3 w-3 text-primary dark:text-brand-green" />
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Filtra per etichetta:</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <div className="flex gap-2">
            <Badge
              variant={selectedCategoryIds.length === 0 ? "default" : "outline"}
              className={cn(
                "cursor-pointer uppercase font-black text-[9px] px-3 py-1 rounded-lg transition-all border",
                selectedCategoryIds.length === 0
                  ? "bg-muted dark:bg-black border-primary dark:border-brand-green text-foreground dark:text-brand-green shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)]"
                  : "bg-card dark:bg-black/40 border-border dark:border-white/10 text-muted-foreground"
              )}
              onClick={() => setSelectedCategoryIds([])}
            >
              Tutti
            </Badge>
            {categories?.map((cat) => (
              <Badge
                key={cat.id}
                style={{
                  backgroundColor: selectedCategoryIds.includes(cat.id) ? cat.colorHex : 'transparent',
                  borderColor: cat.colorHex,
                  color: selectedCategoryIds.includes(cat.id) ? 'white' : cat.colorHex
                }}
                className={cn(
                  "cursor-pointer uppercase font-black text-[9px] px-3 py-1 rounded-lg border",
                  !selectedCategoryIds.includes(cat.id) && "opacity-60 hover:opacity-100"
                )}
                onClick={() => toggleFilter(cat.id)}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Lista Giocatori */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {playersLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))
        ) : filteredPlayers.length === 0 ? (
          <Card className="col-span-full border border-dashed border-border dark:border-brand-green/30 bg-muted/20 dark:bg-black/20 hover:bg-muted/30 dark:hover:bg-black/30 rounded-3xl">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-12 w-12 text-primary dark:text-brand-green mb-4 opacity-40" />
              <h3 className="text-sm font-black uppercase text-foreground dark:text-white">Nessun osservato trovato</h3>
              <p className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/60 dark:text-white/30 uppercase tracking-widest mt-1">
                {players?.length === 0 ? "Inizia aggiungendo il primo osservato alla tua lista." : "Prova a cambiare i filtri selezionati."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {visiblePlayers.map((player) => (
              <Card key={player.id} className="overflow-hidden border border-border dark:border-brand-green/30 bg-card dark:bg-black/40 backdrop-blur-sm shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.1)] rounded-3xl transition-all group hover:opacity-90">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <h4 className="text-sm font-black uppercase tracking-tight text-foreground dark:text-white leading-tight">
                        {displayPlayerName(player as any)}
                      </h4>
                      <span className="text-[9px] font-bold text-muted-foreground dark:text-muted-foreground/60 dark:text-white/30 uppercase tracking-wider mt-0.5">
                        {player.role} • {player.currentTeam}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 dark:hover:text-brand-green dark:hover:bg-brand-green/10 transition-all"
                        onClick={(e) => { e.stopPropagation(); setEditingPlayer(player); setIsPlayerDialogOpen(true); }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:text-red-500 dark:hover:bg-red-500/10 transition-all"
                        onClick={(e) => { e.stopPropagation(); setPlayerToDelete(player); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {player.notes && (
                    <p className="text-[10px] text-foreground/70 dark:text-white/70 leading-relaxed mb-3 line-clamp-2 italic select-text">
                      "{player.notes}"
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 mt-auto">
                    {player.categoryIds?.map((catId: string) => {
                      const cat = categories?.find(c => c.id === catId);
                      if (!cat) return null;
                      return (
                        <span
                          key={catId}
                          style={{ backgroundColor: cat.colorHex + '20', color: cat.colorHex, borderColor: cat.colorHex + '40' }}
                          className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border"
                        >
                          {cat.name}
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Observer Target per Infinite Scroll */}
            {visiblePlayers.length < filteredPlayers.length && (
              <div ref={observerTarget} className="col-span-full h-10 flex items-center justify-center">
                <Skeleton className="h-8 w-8 rounded-full animate-pulse" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <ScoutPlayerDialog
        open={isPlayerDialogOpen}
        onOpenChange={setIsPlayerDialogOpen}
        player={editingPlayer}
        categories={categories || []}
      />
      <ScoutCategoryDialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        categories={categories || []}
      />

      {/* Alert Dialog per Delete */}
      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent className="max-w-md rounded-3xl bg-card dark:bg-black border border-border dark:border-brand-green/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground dark:text-white font-black uppercase">Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Vuoi eliminare definitivamente il osservato <strong className="text-foreground dark:text-brand-green uppercase">{playerToDelete?.name}</strong>? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-xs h-10 border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted dark:hover:bg-black/40">Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePlayer}
              className="rounded-xl font-bold uppercase text-xs h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ScoutPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Caricamento scout...</div>}>
      <ScoutContent />
    </Suspense>
  );
}
