'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTestsStore } from '@/store/useTestsStore';
import { usePlayersStore } from '@/store/usePlayersStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { testRepository } from '@/lib/repositories/test-repository';
import { sortResults, formatValue, formatDate, parseDecimal } from '@/lib/test-utils';
import { PhysicalTest, TestResult, Player } from '@/lib/types';
import { ArrowLeft, Trophy, Edit3, Save, Loader2, Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TestDetailPage() {
  const params = useParams<{ id: string }>();
  const testId = params.id;
  const { tests } = useTestsStore();
  const { players, fetchAll: fetchPlayers } = usePlayersStore();
  const { user } = useAuthStore();
  const { activeSeason } = useSeasonsStore();

  const test = tests.find(t => t.id === testId) as PhysicalTest | undefined;

  // Tutti i test con lo stesso nome (raggruppa i "set" dello stesso esercizio)
  const siblingTests = useMemo(() => {
    if (!test) return [] as PhysicalTest[];
    return tests
      .filter(t => t.name === test.name)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [tests, test]);

  // Mappa setNumber (1-based) -> PhysicalTest
  const setIndex = useMemo(() => {
    const map = new Map<number, PhysicalTest>();
    siblingTests.forEach((t, idx) => map.set(idx + 1, t));
    return map;
  }, [siblingTests]);

  const currentSetNumber = useMemo(() => {
    if (!test) return 1;
    const idx = siblingTests.findIndex(t => t.id === test.id);
    return idx + 1;
  }, [siblingTests, test]);

  const getPlayerName = useCallback((id: string): string => {
    const p = players.find(pl => pl.id === id);
    return p ? `${p.lastName} ${p.firstName}` : '?';
  }, [players]);

  useEffect(() => {
    if (user && activeSeason && players.length === 0) {
      fetchPlayers();
    }
  }, [user, activeSeason, players.length, fetchPlayers]);

  if (!test) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-sm font-black uppercase text-muted-foreground/60">Test non trovato</p>
        <Link href="/allenamento/test" className="mt-4 text-xs font-bold uppercase text-foreground hover:text-primary">
          ← Torna ai test
        </Link>
      </div>
    );
  }

  return (
    <TestDetail
      test={test}
      players={players}
      getPlayerName={getPlayerName}
      userId={user?.id}
      seasonId={activeSeason?.id}
      setIndex={setIndex}
      currentSetNumber={currentSetNumber}
    />
  );
}

function TestDetail({
  test,
  players,
  getPlayerName,
  userId,
  seasonId,
  setIndex,
  currentSetNumber,
}: {
  test: PhysicalTest;
  players: Player[];
  getPlayerName: (id: string) => string;
  userId: string | undefined;
  seasonId: string | undefined;
  setIndex: Map<number, PhysicalTest>;
  currentSetNumber: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draftResults, setDraftResults] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    test.results.forEach(r => m.set(r.playerId, String(r.value)));
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  // Quando cambia il test attivo, resetta i draft
  useEffect(() => {
    const m = new Map<string, string>();
    test.results.forEach(r => m.set(r.playerId, String(r.value)));
    setDraftResults(m);
    setEditing(false);
  }, [test.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedLive = useMemo(() => {
    const live: { playerId: string; value: number }[] = [];
    for (const [playerId, val] of draftResults) {
      const num = parseDecimal(val);
      if (!isNaN(num) && val.trim() !== '') live.push({ playerId, value: num });
    }
    return sortResults(live, test.unit, getPlayerName);
  }, [draftResults, test.unit, getPlayerName]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const results: TestResult[] = [];
      for (const [playerId, val] of draftResults) {
        const num = parseDecimal(val);
        if (!isNaN(num) && val.trim() !== '') results.push({ playerId, value: num });
      }
      await testRepository.updateResults(test.id, userId, results);
      setEditing(false);
    } catch (err) {
      console.error("Update test error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const m = new Map<string, string>();
    test.results.forEach(r => m.set(r.playerId, String(r.value)));
    setDraftResults(m);
    setEditing(false);
  };

  const handleAddNewSet = async () => {
    if (!userId || !seasonId || creating) return;
    setCreating(true);
    try {
      const newSetNumber = setIndex.size + 1;
      const id = await testRepository.create(userId, seasonId, {
        name: test.name,
        type: test.type,
        unit: test.unit,
        date: new Date().toISOString(),
        results: [],
      });
      router.push(`/allenamento/test/${id}`);
      // Opzionale: rinominare il test con " (Set N)"? No, il tab SET N lo gestisce già
      void newSetNumber;
    } catch (err) {
      console.error("Create new set error:", err);
    } finally {
      setCreating(false);
    }
  };

  const switchSet = (setNumber: string) => {
    const num = parseInt(setNumber, 10);
    const target = setIndex.get(num);
    if (target && target.id !== test.id) {
      router.push(`/allenamento/test/${target.id}`);
    }
  };

  // Costruisci tab triggers: uno per ogni set esistente + un "+ NUOVO" se vuoi
  const setNumbers = Array.from(setIndex.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title={test.name} backAction={() => router.push('/allenamento/test')}>
        <div className="flex gap-2">
          {editing ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={handleCancel}
                className="h-9 px-3 rounded-full text-red-500 hover:bg-red-500/10 font-black uppercase text-[10px]"
                title="Annulla"
              >
                Annulla
              </Button>
              <Button
                size="icon"
                disabled={saving}
                onClick={handleSave}
                className="h-9 w-9 rounded-full bg-primary dark:bg-brand-green text-white dark:text-black shadow-sm hover:opacity-90 transition-all"
                title="Salva"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
              className="h-9 w-9 rounded-full bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green hover:bg-primary/20 dark:hover:bg-brand-green/20"
              title="Modifica"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Tab set */}
      {setNumbers.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              {setNumbers.length === 1 ? '1 tentativo' : `${setNumbers.length} tentativi`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={creating}
              onClick={handleAddNewSet}
              className="h-8 px-3 rounded-full bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green hover:bg-primary/20 dark:hover:bg-brand-green/20 font-black uppercase text-[9px] gap-1"
              title="Aggiungi un nuovo tentativo per tutti i giocatori"
            >
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Aggiungi Tentativo
            </Button>
          </div>
          <Tabs value={String(currentSetNumber)} onValueChange={switchSet} className="w-full">
            <TabsList className="w-full h-11 bg-muted/40 dark:bg-black/40 border border-border dark:border-brand-green/20 p-1 rounded-2xl gap-1">
              {setNumbers.map(num => {
                const t = setIndex.get(num);
                if (!t) return null;
                const isActive = num === currentSetNumber;
                return (
                  <TabsTrigger
                    key={num}
                    value={String(num)}
                    className="flex-1 text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white dark:data-[state=active]:bg-brand-green/20 dark:data-[state=active]:text-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all"
                  >
                    SET {num}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Meta info */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/20 dark:bg-card/10 border border-border dark:border-brand-green/20 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          SET {currentSetNumber}
        </span>
        <span className="text-[10px] font-bold uppercase text-muted-foreground/60">• {formatDate(test.date)}</span>
        <span className="text-[10px] font-bold uppercase text-muted-foreground/60">• {test.unit}</span>
        <span className="text-[10px] font-bold uppercase text-muted-foreground/60 ml-auto">
          {test.results.length} {test.results.length === 1 ? 'giocatore' : 'giocatori'}
        </span>
      </div>

      {/* Results list / edit form */}
      <div className="flex items-center gap-2 px-1">
        <Edit3 className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          {editing ? 'Modifica risultati' : 'Risultati'}
        </span>
      </div>

      <div className="rounded-2xl border border-border dark:border-brand-green/20 overflow-hidden">
        {players.map(player => {
          const existingResult = test.results.find(r => r.playerId === player.id);
          const draftValue = draftResults.get(player.id) ?? '';
          return (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-border dark:border-brand-green/10 last:border-b-0"
            >
              <span className="text-[10px] font-bold flex-1 truncate">
                {player.lastName} {player.firstName}
              </span>
              {editing ? (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={draftValue}
                    onChange={e => setDraftResults(prev => {
                      const next = new Map(prev);
                      next.set(player.id, e.target.value);
                      return next;
                    })}
                    className="w-24 h-9 text-right text-xs font-black rounded-lg bg-background dark:bg-black border border-border dark:border-brand-green/20 pr-8 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green focus-visible:border-primary dark:focus-visible:border-brand-green"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40 font-bold">
                    {test.unit === 'secondi' ? 's' : test.unit === 'metri' ? 'm' : ''}
                  </span>
                </div>
              ) : (
                <span className={cn(
                  'text-[11px] font-black',
                  existingResult ? 'text-foreground' : 'text-muted-foreground/30'
                )}>
                  {existingResult ? formatValue(existingResult.value, test.unit) : '—'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Standings */}
      {sortedLive.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Trophy className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Classifica SET {currentSetNumber}
            </span>
          </div>
          <div className="rounded-2xl border border-border dark:border-brand-green/20 overflow-hidden">
            {sortedLive.map((entry, idx) => (
              <div
                key={entry.playerId}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-border dark:border-brand-green/10 last:border-b-0"
              >
                <span className="w-5 text-center text-[11px] font-black text-muted-foreground/60">
                  {idx + 1}
                </span>
                <span className="flex-1 text-xs font-bold truncate">{getPlayerName(entry.playerId)}</span>
                <span className="text-[11px] font-black">{formatValue(entry.value, test.unit)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
