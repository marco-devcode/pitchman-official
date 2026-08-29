'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTestsStore } from '@/store/useTestsStore';
import { usePlayersStore } from '@/store/usePlayersStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { PhysicalTest } from '@/lib/types';
import { sortResults, formatValue, formatDate } from '@/lib/test-utils';
import { testRepository } from '@/lib/repositories/test-repository';
import { Plus, Activity, Users, Trophy, Save, ArrowLeft, Trash2, Edit3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { PhysicalTestDialog } from '@/components/allenamento/physical-test-dialog';

type FilterType = 'all' | 'velocita' | 'resistenza';

export default function PhysicalTestsPage() {
  const router = useRouter();
  const { tests, subscribe } = useTestsStore();
  const { players } = usePlayersStore();
  const { activeSeason } = useSeasonsStore();
  const { user } = useAuthStore();

  // Usiamo una ref per subscribe così non è mai una dipendenza instabile del useEffect
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;

  useEffect(() => {
    if (!user?.id || !activeSeason?.id) return;
    const unsub = subscribeRef.current(user.id, activeSeason.id);
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [user?.id, activeSeason?.id]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getPlayerName = useCallback((id: string): string => {
    const p = players.find(pl => pl.id === id);
    return p ? `${p.lastName} ${p.firstName}` : '?';
  }, [players]);

  const filteredTests = useMemo(() => {
    return tests
      .filter(t => filter === 'all' || t.type === filter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [tests, filter]);

  const getTopResult = useCallback((test: PhysicalTest): { playerName: string; value: number } | null => {
    if (test.results.length === 0) return null;
    const sorted = sortResults(
      test.results.map(r => ({ playerId: r.playerId, value: r.value })),
      test.unit,
      getPlayerName
    );
    if (sorted.length === 0) return null;
    return { playerName: getPlayerName(sorted[0].playerId), value: sorted[0].value };
  }, [getPlayerName]);

  const handleTestCreated = useCallback((_id: string) => {
    setDialogOpen(false);
    setEditMode(false);
  }, []);

  const handleDelete = useCallback(async (testId: string) => {
    if (!user) return;
    setDeletingId(testId);
    try {
      await testRepository.deleteTest(testId, user.id);
    } catch (err) {
      console.error('Delete test error:', err);
    } finally {
      setDeletingId(null);
    }
  }, [user]);

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title="Test Fisici">
        {editMode ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditMode(false)}
              className="h-9 w-9 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20"
              title="Annulla"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={() => setEditMode(false)}
              className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
              title="Salva"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditMode(true)}
              className="h-9 w-9 rounded-full bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green hover:bg-primary/20 dark:hover:bg-brand-green/20"
              title="Modifica"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="h-9 text-[10px] font-black uppercase rounded-xl"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nuovo Test
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Filter — SEMPRE visibile (anche se la categoria selezionata è vuota) */}
      <div className="flex bg-muted/50 rounded-full p-0.5 w-fit">
        {(['all', 'velocita', 'resistenza'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ' +
              (filter === f
                ? 'bg-background dark:bg-black border border-primary dark:border-brand-green text-foreground'
                : 'text-muted-foreground/50')
            }
          >
            {f === 'all' ? 'Tutti' : f === 'velocita' ? 'Velocità' : 'Resistenza'}
          </button>
        ))}
      </div>

      {filteredTests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity className="h-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-black uppercase text-muted-foreground/60">
            Nessun test registrato
          </p>
          <p className="text-[10px] font-bold uppercase mt-1 text-muted-foreground/40">
            Registra il primo test fisico della stagione
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="mt-6 h-11 text-[10px] font-black uppercase rounded-xl"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Crea il tuo primo test
          </Button>
        </div>
      ) : (
        <>
          {/* Test cards */}
          <div className="space-y-2.5">
            {filteredTests.map(test => {
              const topResult = getTopResult(test);
              const isDeleting = deletingId === test.id;
              return (
                <div
                  key={test.id}
                  className="rounded-2xl border border-border dark:border-brand-green/20 bg-muted/10 dark:bg-card/5 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => { if (!editMode) router.push(`/allenamento/test/${test.id}`); }}
                    disabled={editMode}
                    className="w-full text-left disabled:cursor-default"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{test.name}</p>
                        <p className="text-[9px] text-muted-foreground/50 uppercase mt-0.5">
                          {formatDate(test.date)} • {test.type} • {test.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground/50 shrink-0">
                        <Users className="h-3 w-3" />
                        {test.results.length}
                      </div>
                    </div>

                    {topResult && (
                      <div className="flex items-center gap-2 px-4 pb-3">
                        <Trophy className="h-3 w-3 text-yellow-500 shrink-0" />
                        <span className="text-[9px] font-bold text-muted-foreground/70 truncate">
                          Migliore: <span className="text-yellow-500">{topResult.playerName}</span>
                        </span>
                        <span className="text-[10px] font-black text-foreground ml-auto shrink-0">
                          {formatValue(topResult.value, test.unit)}
                        </span>
                      </div>
                    )}
                  </button>

                  {editMode && (
                    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border dark:border-brand-green/10 bg-muted/20 dark:bg-card/10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditMode(false);
                          router.push(`/allenamento/test/${test.id}`);
                        }}
                        className="h-8 text-[9px] font-black uppercase rounded-lg text-primary dark:text-brand-green hover:bg-primary/10 dark:hover:bg-brand-green/10"
                      >
                        <Edit3 className="mr-1.5 h-3 w-3" />
                        Modifica
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => handleDelete(test.id)}
                        className="h-8 text-[9px] font-black uppercase rounded-lg text-red-500 hover:bg-red-500/10 ml-auto"
                      >
                        <Trash2 className="mr-1.5 h-3 w-3" />
                        {isDeleting ? 'Eliminando...' : 'Elimina'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <PhysicalTestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleTestCreated}
        players={players}
      />
    </div>
  );
}
