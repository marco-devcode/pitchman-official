'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTestsStore } from '@/store/useTestsStore';
import { usePlayersStore } from '@/store/usePlayersStore';
import { useAuthStore } from '@/store/useAuthStore';
import { testRepository } from '@/lib/repositories/test-repository';
import { sortResults, formatValue, formatDate, parseDecimal } from '@/lib/test-utils';
import { PhysicalTest, TestResult, Player } from '@/lib/types';
import { ArrowLeft, Trophy, Edit3, Save, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function TestDetailPage() {
  const params = useParams<{ id: string }>();
  const testId = params.id;
  const { tests } = useTestsStore();
  const { players } = usePlayersStore();
  const { user } = useAuthStore();

  const test = tests.find(t => t.id === testId) as PhysicalTest | undefined;

  const getPlayerName = useCallback((id: string): string => {
    const p = players.find(pl => pl.id === id);
    return p ? `${p.lastName} ${p.firstName}` : '?';
  }, [players]);

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

  return <TestDetail test={test} players={players} getPlayerName={getPlayerName} userId={user?.id} />;
}

function TestDetail({
  test,
  players,
  getPlayerName,
  userId,
}: {
  test: PhysicalTest;
  players: Player[];
  getPlayerName: (id: string) => string;
  userId: string | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [draftResults, setDraftResults] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    test.results.forEach(r => m.set(r.playerId, String(r.value)));
    return m;
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

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

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title={test.name} backAction={() => router.back()}>
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

      {/* Meta info */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-muted/20 dark:bg-card/10 border border-border dark:border-brand-green/20">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {formatDate(test.date)}
        </span>
        <span className="text-[10px] font-bold uppercase text-muted-foreground/60">• {test.type}</span>
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
              Classifica sessione
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
