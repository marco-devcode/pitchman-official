'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Copy,
  Link2,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { initializeFirebase } from '@/firebase';
import { usePlayersStore } from '@/store/usePlayersStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { useToast } from '@/hooks/use-toast';
import { cn, displayPlayerName } from '@/lib/utils';
import type { PollQuestion, TeamPoll } from '@/lib/types';

export interface PollsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: 'list' | 'create';
  onPollsChanged?: (openCount: number) => void;
}

type BuilderQuestionType = 'single_choice' | 'multiple_choice' | 'scale_5' | 'scale_10' | 'open_text';

interface DraftQuestion {
  id: string;
  text: string;
  type: BuilderQuestionType;
  required: boolean;
  options: string[];
  scaleMinLabel: string;
  scaleMaxLabel: string;
}

function makeQuestionId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function createEmptyDraftQuestion(): DraftQuestion {
  return {
    id: makeQuestionId(),
    text: '',
    type: 'single_choice',
    required: true,
    options: ['Sì', 'No'],
    scaleMinLabel: '',
    scaleMaxLabel: '',
  };
}

interface PollPreset {
  label: string;
  title: string;
  description: string;
  anonymous: boolean;
  questions: () => DraftQuestion[];
}

const POLL_PRESETS: PollPreset[] = [
  {
    label: '⚡ Check RPE Post-Gara',
    title: 'Percezione fatica post-partita (RPE)',
    description: 'Compila entro domani mattina per calibrare il carico di ripresa.',
    anonymous: false,
    questions: () => [
      {
        id: makeQuestionId(),
        text: 'Quanto hai sentito faticosa la gara / allenamento? (1–10)',
        type: 'scale_10',
        required: true,
        options: ['Sì', 'No'],
        scaleMinLabel: 'Molto leggero',
        scaleMaxLabel: 'Massimo sforzo',
      },
      {
        id: makeQuestionId(),
        text: 'Come ti senti fisicamente oggi?',
        type: 'single_choice',
        required: true,
        options: ['Pronto al 100%', 'Leggermente affaticato', 'Dolore / fastidio da segnalare'],
        scaleMinLabel: '',
        scaleMaxLabel: '',
      },
      {
        id: makeQuestionId(),
        text: 'Eventuali fastidi muscolari o note per lo staff',
        type: 'open_text',
        required: false,
        options: ['Sì', 'No'],
        scaleMinLabel: '',
        scaleMaxLabel: '',
      },
    ],
  },
  {
    label: '🍽️ Disponibilità / Cena',
    title: 'Disponibilità evento di squadra',
    description: 'Conferma la tua presenza per organizzare al meglio.',
    anonymous: false,
    questions: () => [
      {
        id: makeQuestionId(),
        text: 'Ci sarai?',
        type: 'single_choice',
        required: true,
        options: ['Sì, confermato', 'No, assente', 'In forse'],
        scaleMinLabel: '',
        scaleMaxLabel: '',
      },
      {
        id: makeQuestionId(),
        text: 'Orari preferiti o esigenze alimentari',
        type: 'open_text',
        required: false,
        options: ['Sì', 'No'],
        scaleMinLabel: '',
        scaleMaxLabel: '',
      },
    ],
  },
  {
    label: '🔒 Feedback Settimana',
    title: 'Feedback spogliatoio della settimana',
    description: 'Sondaggio anonimo per raccogliere impressioni su ritmo, esercizi e clima di squadra.',
    anonymous: true,
    questions: () => [
      {
        id: makeQuestionId(),
        text: 'Come valuti il livello degli allenamenti di questa settimana?',
        type: 'scale_5',
        required: true,
        options: ['Sì', 'No'],
        scaleMinLabel: 'Poco intenso',
        scaleMaxLabel: 'Ottimo ritmo',
      },
      {
        id: makeQuestionId(),
        text: 'Su cosa vorresti lavorare di più?',
        type: 'multiple_choice',
        required: false,
        options: ['Possesso palla', 'Palle inattive', 'Finalizzazione', 'Fase difensiva', 'Atletico / Ritmo'],
        scaleMinLabel: '',
        scaleMaxLabel: '',
      },
      {
        id: makeQuestionId(),
        text: 'Suggerimenti liberi per il mister',
        type: 'open_text',
        required: false,
        options: ['Sì', 'No'],
        scaleMinLabel: '',
        scaleMaxLabel: '',
      },
    ],
  },
];

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = initializeFirebase().auth.currentUser;
  if (!user) {
    throw new Error('Sessione scaduta. Ricarica la pagina o accedi di nuovo.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function PollsDialog({ open, onOpenChange, initialView = 'list', onPollsChanged }: PollsDialogProps) {
  const activeSeason = useSeasonsStore((s) => s.activeSeason);
  const players = usePlayersStore((s) => s.players);
  const { toast } = useToast();

  const [view, setView] = useState<'list' | 'create' | 'detail'>(initialView);
  const [polls, setPolls] = useState<TeamPoll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'share' | 'results'>('share');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Builder state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([createEmptyDraftQuestion()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Action states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const titleInputId = useId();
  const descInputId = useId();
  const anonSwitchId = useId();
  const onPollsChangedRef = useRef(onPollsChanged);
  onPollsChangedRef.current = onPollsChanged;

  const loadPolls = useCallback(async () => {
    if (!activeSeason?.id) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/seasons/${encodeURIComponent(activeSeason.id)}/polls`, {
        headers,
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Impossibile caricare i sondaggi.');
      }
      const fetched = (data.polls ?? []) as TeamPoll[];
      setPolls(fetched);
      onPollsChangedRef.current?.(fetched.filter((p) => p.status === 'open').length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento sondaggi.');
    } finally {
      setLoading(false);
    }
  }, [activeSeason?.id]);

  useEffect(() => {
    if (open) {
      setView(initialView);
      setConfirmDeleteId(null);
      setFormError(null);
      void loadPolls();
    }
  }, [open, initialView, loadPolls]);

  const selectedPoll = useMemo(
    () => polls.find((p) => p.id === selectedPollId) ?? null,
    [polls, selectedPollId],
  );

  const resetBuilder = () => {
    setTitle('');
    setDescription('');
    setAnonymous(false);
    setQuestions([createEmptyDraftQuestion()]);
    setFormError(null);
  };

  const applyPreset = (preset: PollPreset) => {
    setTitle(preset.title);
    setDescription(preset.description);
    setAnonymous(preset.anonymous);
    setQuestions(preset.questions());
    setFormError(null);
  };

  const updateQuestion = (id: string, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSeason?.id || isSaving) return;

    setFormError(null);
    if (!title.trim()) {
      setFormError('Inserisci un titolo per il sondaggio.');
      return;
    }
    if (players.length === 0) {
      setFormError('Aggiungi prima almeno un giocatore in Rosa.');
      return;
    }

    const mappedQuestions: PollQuestion[] = [];
    for (const q of questions) {
      const text = q.text.trim();
      if (!text) {
        setFormError('Ogni domanda deve avere un testo valido.');
        return;
      }
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const cleanOpts = Array.from(new Set(q.options.map((o) => o.trim()).filter(Boolean)));
        if (cleanOpts.length < 2) {
          setFormError(`La domanda "${text}" richiede almeno 2 opzioni.`);
          return;
        }
        mappedQuestions.push({
          id: q.id,
          text,
          type: q.type,
          required: q.required,
          options: cleanOpts,
        });
      } else if (q.type === 'scale_5' || q.type === 'scale_10') {
        mappedQuestions.push({
          id: q.id,
          text,
          type: 'scale',
          required: q.required,
          scaleMax: q.type === 'scale_10' ? 10 : 5,
          ...(q.scaleMinLabel.trim() ? { scaleMinLabel: q.scaleMinLabel.trim() } : {}),
          ...(q.scaleMaxLabel.trim() ? { scaleMaxLabel: q.scaleMaxLabel.trim() } : {}),
        });
      } else {
        mappedQuestions.push({
          id: q.id,
          text,
          type: 'open_text',
          required: q.required,
        });
      }
    }

    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/seasons/${encodeURIComponent(activeSeason.id)}/polls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          anonymous,
          questions: mappedQuestions,
          players: players.map((p) => ({
            playerId: p.id,
            playerName: displayPlayerName(p),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Impossibile creare il sondaggio.');
      }

      const created = data.poll as TeamPoll;
      const nextPolls = [created, ...polls];
      setPolls(nextPolls);
      onPollsChanged?.(nextPolls.filter((p) => p.status === 'open').length);
      setSelectedPollId(created.id);
      setDetailTab('share');
      setView('detail');
      resetBuilder();
      toast({
        title: 'Sondaggio creato',
        description: 'Link di gruppo e link individuali pronti per la condivisione.',
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore durante la creazione.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (poll: TeamPoll) => {
    if (!activeSeason?.id || isMutating) return;
    const nextStatus = poll.status === 'open' ? 'closed' : 'open';
    setIsMutating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/seasons/${encodeURIComponent(activeSeason.id)}/polls/${encodeURIComponent(poll.id)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Aggiornamento fallito.');
      }
      const updated = data.poll as TeamPoll;
      const nextPolls = polls.map((p) => (p.id === updated.id ? updated : p));
      setPolls(nextPolls);
      onPollsChanged?.(nextPolls.filter((p) => p.status === 'open').length);
      toast({
        title: nextStatus === 'closed' ? 'Sondaggio chiuso' : 'Sondaggio riaperto',
        description:
          nextStatus === 'closed'
            ? 'Nessun altro giocatore potrà inviare nuove risposte.'
            : 'I giocatori possono nuovamente compilare il link.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: err instanceof Error ? err.message : 'Impossibile aggiornare lo stato.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!activeSeason?.id || isMutating) return;
    setIsMutating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/seasons/${encodeURIComponent(activeSeason.id)}/polls/${encodeURIComponent(pollId)}`,
        {
          method: 'DELETE',
          headers,
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Eliminazione fallita.');
      }
      const nextPolls = polls.filter((p) => p.id !== pollId);
      setPolls(nextPolls);
      onPollsChanged?.(nextPolls.filter((p) => p.status === 'open').length);
      setConfirmDeleteId(null);
      setSelectedPollId(null);
      setView('list');
      toast({ title: 'Sondaggio eliminato' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: err instanceof Error ? err.message : 'Impossibile eliminare il sondaggio.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const buildPollUrl = (pollId: string, query: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/sondaggio/${pollId}?${query}`;
  };

  const copyLink = async (key: string, url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
      toast({ title: 'Link copiato', description: label });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copia non riuscita',
        description: 'Seleziona manualmente il link o usa il tasto WhatsApp.',
      });
    }
  };

  const whatsAppShareUrl = (text: string) =>
    `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[660px] max-h-[88vh] overflow-y-auto rounded-[28px] bg-card dark:bg-black border border-primary/30 dark:border-brand-green/30 p-5 sm:p-6 shadow-xl dark:shadow-theme">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2.5">
              {view !== 'list' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Torna all'elenco sondaggi"
                  onClick={() => {
                    setConfirmDeleteId(null);
                    setView('list');
                  }}
                  className="h-9 w-9 rounded-xl border border-border dark:border-brand-green/20"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary dark:text-brand-green" aria-hidden="true" />
                  {view === 'create'
                    ? 'Crea Sondaggio'
                    : view === 'detail' && selectedPoll
                      ? selectedPoll.title
                      : 'Sondaggi Spogliatoio'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {view === 'create'
                    ? 'Genera automaticamente link per il gruppo WhatsApp e link personali per giocatore.'
                    : view === 'detail'
                      ? 'Condividi i link, controlla chi ha compilato e analizza le risposte.'
                      : `Raccolta rapida feedback dalla rosa (${activeSeason?.name || 'Stagione attiva'}).`}
                </DialogDescription>
              </div>
            </div>

            {view === 'list' && (
              <Button
                type="button"
                onClick={() => {
                  resetBuilder();
                  setView('create');
                }}
                className="min-h-10 rounded-xl bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase text-xs px-3.5 shrink-0"
              >
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Crea Sondaggio
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* VISTA ELENCO SONDAGGI */}
        {view === 'list' && (
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-3">
                <span>{error}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadPolls()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Riprova
                </Button>
              </div>
            ) : polls.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border dark:border-brand-green/25 p-7 text-center space-y-3">
                <ClipboardList className="h-8 w-8 mx-auto text-primary dark:text-brand-green opacity-80" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase tracking-tight">Nessun sondaggio creato</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Crea un sondaggio per la tua rosa e condividilo su WhatsApp senza far registrare i giocatori.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    resetBuilder();
                    setView('create');
                  }}
                  className="rounded-xl bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase text-xs"
                >
                  <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  Crea il primo sondaggio
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {polls.map((poll) => {
                  const total = poll.players.length || 0;
                  const done = poll.completedPlayerIds.length || 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <button
                      key={poll.id}
                      type="button"
                      onClick={() => {
                        setSelectedPollId(poll.id);
                        setConfirmDeleteId(null);
                        setDetailTab(done > 0 ? 'results' : 'share');
                        setView('detail');
                      }}
                      className="w-full text-left rounded-2xl border border-border dark:border-brand-green/20 bg-muted/20 dark:bg-white/[0.03] hover:bg-muted/40 dark:hover:bg-white/[0.06] p-4 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-black uppercase tracking-tight truncate text-foreground">
                            {poll.title}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {poll.questions.length} {poll.questions.length === 1 ? 'domanda' : 'domande'} •{' '}
                            {poll.anonymous ? 'Anonimo' : 'Nominale'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0 border',
                            poll.status === 'open'
                              ? 'bg-primary/10 dark:bg-brand-green/15 text-primary dark:text-brand-green border-primary/25 dark:border-brand-green/30'
                              : 'bg-muted text-muted-foreground border-border',
                          )}
                        >
                          {poll.status === 'open' ? 'Aperto' : 'Chiuso'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-muted-foreground">Compilazioni</span>
                          <span className="text-primary dark:text-brand-green">
                            {done}/{total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary dark:bg-brand-green transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA CREAZIONE SONDAGGIO */}
        {view === 'create' && (
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            {players.length === 0 && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs font-medium text-amber-700 dark:text-amber-300"
              >
                La rosa è vuota: aggiungi prima almeno un giocatore in Rosa per poter generare i link del sondaggio.
              </div>
            )}

            {/* Template rapidi */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Modelli rapidi
              </span>
              <div className="flex flex-wrap gap-2">
                {POLL_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="h-8 rounded-xl text-xs font-bold border-border dark:border-brand-green/25"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border dark:border-white/10 p-4 bg-muted/20 dark:bg-white/[0.02]">
              <div className="space-y-1.5">
                <Label htmlFor={titleInputId} className="text-xs font-black uppercase tracking-wider">
                  Titolo sondaggio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={titleInputId}
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Es. Fatica post-partita o Cena venerdì"
                  className="text-base rounded-xl bg-background dark:bg-black"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={descInputId} className="text-xs font-black uppercase tracking-wider">
                  Descrizione / Istruzioni (opzionale)
                </Label>
                <Textarea
                  id={descInputId}
                  rows={2}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve nota mostrata ai giocatori prima delle domande..."
                  className="text-base rounded-xl bg-background dark:bg-black"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-background dark:bg-black/60 border border-border dark:border-white/10 p-3">
                <div className="space-y-0.5">
                  <Label htmlFor={anonSwitchId} className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5 cursor-pointer">
                    <Lock className="h-3.5 w-3.5 text-primary dark:text-brand-green" aria-hidden="true" />
                    Risposte anonime
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Vedrai comunque chi ha già compilato (per evitare solleciti doppi), ma non chi ha dato ogni risposta.
                  </p>
                </div>
                <Switch
                  id={anonSwitchId}
                  checked={anonymous}
                  onCheckedChange={setAnonymous}
                />
              </div>
            </div>

            {/* Costruttore domande */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Domande ({questions.length})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestions((prev) => [...prev, createEmptyDraftQuestion()])}
                  className="h-8 rounded-xl text-xs font-bold border-primary/30 dark:border-brand-green/30 text-primary dark:text-brand-green"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  Aggiungi domanda
                </Button>
              </div>

              {questions.map((q, qIdx) => {
                const textId = `poll-q-text-${q.id}`;
                const typeId = `poll-q-type-${q.id}`;
                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-border dark:border-brand-green/20 bg-background dark:bg-black/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-primary dark:text-brand-green">
                        Domanda {qIdx + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground cursor-pointer">
                          <Switch
                            checked={q.required}
                            onCheckedChange={(checked) => updateQuestion(q.id, { required: checked })}
                          />
                          Obbligatoria
                        </label>
                        {questions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Elimina domanda ${qIdx + 1}`}
                            onClick={() =>
                              setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                            }
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2 space-y-1">
                        <Label htmlFor={textId} className="text-[11px] font-bold text-muted-foreground">
                          Testo domanda
                        </Label>
                        <Input
                          id={textId}
                          required
                          maxLength={300}
                          value={q.text}
                          onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                          placeholder="Scrivi la domanda..."
                          className="text-base rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={typeId} className="text-[11px] font-bold text-muted-foreground">
                          Tipo risposta
                        </Label>
                        <select
                          id={typeId}
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(q.id, { type: e.target.value as BuilderQuestionType })
                          }
                          className="w-full h-10 rounded-xl border border-input bg-background dark:bg-black px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-brand-green"
                        >
                          <option value="single_choice">Scelta singola</option>
                          <option value="multiple_choice">Scelta multipla</option>
                          <option value="scale_5">Scala 1–5</option>
                          <option value="scale_10">Scala 1–10</option>
                          <option value="open_text">Risposta aperta</option>
                        </select>
                      </div>
                    </div>

                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-bold text-muted-foreground block">
                          Opzioni di risposta
                        </span>
                        {q.options.map((opt, optIdx) => (
                          <div key={`${q.id}-opt-${optIdx}`} className="flex items-center gap-2">
                            <Input
                              value={opt}
                              maxLength={120}
                              aria-label={`Opzione ${optIdx + 1} domanda ${qIdx + 1}`}
                              onChange={(e) => {
                                const nextOpts = [...q.options];
                                nextOpts[optIdx] = e.target.value;
                                updateQuestion(q.id, { options: nextOpts });
                              }}
                              placeholder={`Opzione ${optIdx + 1}`}
                              className="text-sm rounded-xl h-9"
                            />
                            {q.options.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Rimuovi opzione ${optIdx + 1}`}
                                onClick={() =>
                                  updateQuestion(q.id, {
                                    options: q.options.filter((_, idx) => idx !== optIdx),
                                  })
                                }
                                className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {q.options.length < 10 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateQuestion(q.id, { options: [...q.options, ''] })
                            }
                            className="h-8 text-xs font-bold text-primary dark:text-brand-green px-2"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                            Aggiungi opzione
                          </Button>
                        )}
                      </div>
                    )}

                    {(q.type === 'scale_5' || q.type === 'scale_10') && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Input
                          value={q.scaleMinLabel}
                          maxLength={60}
                          aria-label={`Etichetta minimo domanda ${qIdx + 1}`}
                          onChange={(e) => updateQuestion(q.id, { scaleMinLabel: e.target.value })}
                          placeholder="Etichetta 1 (opz. es. Basso)"
                          className="text-xs rounded-xl h-9"
                        />
                        <Input
                          value={q.scaleMaxLabel}
                          maxLength={60}
                          aria-label={`Etichetta massimo domanda ${qIdx + 1}`}
                          onChange={(e) => updateQuestion(q.id, { scaleMaxLabel: e.target.value })}
                          placeholder={`Etichetta ${q.type === 'scale_10' ? '10' : '5'} (opz. es. Alto)`}
                          className="text-xs rounded-xl h-9"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {formError && (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setView('list')}
                className="rounded-xl text-xs font-bold uppercase h-11 px-4"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={isSaving || players.length === 0}
                className="rounded-xl bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase text-xs h-11 px-5"
              >
                {isSaving ? 'Creazione...' : 'Crea e Genera Link'}
              </Button>
            </div>
          </form>
        )}

        {/* VISTA DETTAGLIO SONDAGGIO */}
        {view === 'detail' && selectedPoll && (
          <div className="mt-4 space-y-4">
            {/* Badge stato & azioni rapide */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border dark:border-white/10 bg-muted/20 dark:bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border',
                    selectedPoll.status === 'open'
                      ? 'bg-primary/10 dark:bg-brand-green/15 text-primary dark:text-brand-green border-primary/25 dark:border-brand-green/30'
                      : 'bg-muted text-muted-foreground border-border',
                  )}
                >
                  {selectedPoll.status === 'open' ? 'Aperto' : 'Chiuso'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border border-border text-muted-foreground">
                  {selectedPoll.anonymous ? (
                    <>
                      <Lock className="h-3 w-3" aria-hidden="true" /> Anonimo
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-3 w-3" aria-hidden="true" /> Nominale
                    </>
                  )}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {selectedPoll.completedPlayerIds.length}/{selectedPoll.players.length} risposte
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isMutating}
                  onClick={() => void handleToggleStatus(selectedPoll)}
                  className="h-8 rounded-xl text-xs font-bold"
                >
                  {selectedPoll.status === 'open' ? 'Chiudi' : 'Riapri'}
                </Button>

                {confirmDeleteId === selectedPoll.id ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => void handleDeletePoll(selectedPoll.id)}
                      className="h-8 rounded-xl text-xs font-bold"
                    >
                      Conferma
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(null)}
                      className="h-8 rounded-xl text-xs"
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Elimina sondaggio"
                    onClick={() => setConfirmDeleteId(selectedPoll.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            <Tabs
              value={detailTab}
              onValueChange={(v) => setDetailTab(v as 'share' | 'results')}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/60 dark:bg-white/5 p-1">
                <TabsTrigger value="share" className="rounded-xl text-xs font-black uppercase">
                  <Share2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Condividi ({selectedPoll.completedPlayerIds.length}/{selectedPoll.players.length})
                </TabsTrigger>
                <TabsTrigger value="results" className="rounded-xl text-xs font-black uppercase">
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Risultati ({selectedPoll.responses.length})
                </TabsTrigger>
              </TabsList>

              {/* TAB CONDIVISIONE LINK */}
              <TabsContent value="share" className="mt-4 space-y-4">
                {/* Link unico per gruppo WhatsApp */}
                <div className="rounded-2xl border border-primary/30 dark:border-brand-green/30 bg-primary/5 dark:bg-brand-green/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-primary dark:text-brand-green flex items-center gap-1.5">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        Link Gruppo WhatsApp
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Un link unico per tutta la squadra: ogni giocatore apre il link e seleziona il proprio nome (1 invio per giocatore).
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const groupUrl = buildPollUrl(
                      selectedPoll.id,
                      `g=${encodeURIComponent(selectedPoll.groupToken)}`,
                    );
                    const waText = `Ciao ragazzi! Compilate il sondaggio "${selectedPoll.title}" su PitchMan:\n${groupUrl}`;
                    return (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => void copyLink('group', groupUrl, 'Link di gruppo copiato.')}
                          className="flex-1 min-h-10 rounded-xl bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase text-xs"
                        >
                          {copiedKey === 'group' ? (
                            <>
                              <Check className="h-4 w-4 mr-1.5" aria-hidden="true" />
                              Copiato!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1.5" aria-hidden="true" />
                              Copia Link Gruppo
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          asChild
                          className="min-h-10 rounded-xl border-primary/30 dark:border-brand-green/30 font-bold text-xs uppercase"
                        >
                          <a
                            href={whatsAppShareUrl(waText)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
                            WhatsApp
                          </a>
                        </Button>
                      </div>
                    );
                  })()}
                </div>

                {/* Lista giocatori + link personali */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Link personali per singolo giocatore
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {selectedPoll.completedPlayerIds.length}/{selectedPoll.players.length} compilati
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border dark:border-brand-green/20 divide-y divide-border dark:divide-white/10 overflow-hidden">
                    {selectedPoll.players.map((entry) => {
                      const done = selectedPoll.completedPlayerIds.includes(entry.playerId);
                      const personalUrl = buildPollUrl(
                        selectedPoll.id,
                        `t=${encodeURIComponent(entry.token)}`,
                      );
                      const waText = `Ciao ${entry.playerName}, ecco il tuo link personale per "${selectedPoll.title}":\n${personalUrl}`;
                      const key = `p-${entry.playerId}`;

                      return (
                        <div
                          key={entry.playerId}
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-background dark:bg-black/40"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            {done ? (
                              <CheckCircle2
                                className="h-4 w-4 text-primary dark:text-brand-green shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{entry.playerName}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                {done ? 'Compilato' : 'In attesa'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void copyLink(key, personalUrl, `Link personale per ${entry.playerName} copiato.`)
                              }
                              className="h-8 rounded-lg px-2.5 text-xs font-bold text-primary dark:text-brand-green"
                            >
                              {copiedKey === key ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                  Copiato
                                </>
                              ) : (
                                <>
                                  <Link2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                  Copia
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary dark:hover:text-brand-green"
                              title={`Invia su WhatsApp a ${entry.playerName}`}
                            >
                              <a
                                href={whatsAppShareUrl(waText)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Invia sondaggio su WhatsApp a ${entry.playerName}`}
                              >
                                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* TAB RISULTATI */}
              <TabsContent value="results" className="mt-4 space-y-3">
                {selectedPoll.responses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border dark:border-white/15 p-7 text-center space-y-2">
                    <BarChart3 className="h-7 w-7 mx-auto text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-bold">Nessuna risposta ancora ricevuta</p>
                    <p className="text-xs text-muted-foreground">
                      Condividi il link dalla tab &ldquo;Condividi&rdquo; per iniziare a raccogliere i voti.
                    </p>
                  </div>
                ) : (
                  selectedPoll.questions.map((question, qIdx) => (
                    <PollQuestionResultsCard
                      key={question.id}
                      question={question}
                      index={qIdx}
                      poll={selectedPoll}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PollQuestionResultsCard({
  question,
  index,
  poll,
}: {
  question: PollQuestion;
  index: number;
  poll: TeamPoll;
}) {
  const answers = poll.responses
    .map((resp) => ({
      playerName: resp.playerName,
      answer: resp.answers.find((a) => a.questionId === question.id),
    }))
    .filter((item) => item.answer !== undefined);

  if (question.type === 'open_text') {
    const texts = answers.filter((a) => Boolean(a.answer?.textValue?.trim()));
    return (
      <div className="rounded-2xl border border-border dark:border-brand-green/20 bg-background dark:bg-black/40 p-4 space-y-2.5">
        <h3 className="text-sm font-black tracking-tight">
          {index + 1}. {question.text}
        </h3>
        {texts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nessuna risposta testuale.</p>
        ) : (
          <div className="space-y-2">
            {texts.map((item, i) => (
              <div
                key={`${question.id}-txt-${i}`}
                className="rounded-xl bg-muted/40 dark:bg-white/5 px-3 py-2 text-xs space-y-0.5"
              >
                <span className="font-black uppercase tracking-wide text-[10px] text-primary dark:text-brand-green block">
                  {poll.anonymous ? 'Risposta anonima' : item.playerName || 'Giocatore'}
                </span>
                <p className="text-foreground leading-relaxed">{item.answer?.textValue}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'scale') {
    const max = question.scaleMax === 10 ? 10 : 5;
    const numericAnswers = answers.filter(
      (a) => typeof a.answer?.scaleValue === 'number',
    );
    const avg =
      numericAnswers.length > 0
        ? (
            numericAnswers.reduce((sum, a) => sum + (a.answer?.scaleValue ?? 0), 0) /
            numericAnswers.length
          ).toFixed(1)
        : '—';

    return (
      <div className="rounded-2xl border border-border dark:border-brand-green/20 bg-background dark:bg-black/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-black tracking-tight">
            {index + 1}. {question.text}
          </h3>
          <span className="rounded-xl bg-primary/10 dark:bg-brand-green/15 px-2.5 py-1 text-xs font-black text-primary dark:text-brand-green shrink-0">
            Media: {avg} / {max}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: max }, (_, idx) => idx + 1).map((val) => {
            const count = numericAnswers.filter((a) => a.answer?.scaleValue === val).length;
            return (
              <div
                key={val}
                className="rounded-xl border border-border dark:border-white/10 p-2 text-center bg-muted/20 dark:bg-white/[0.02]"
              >
                <span className="text-xs font-black block">{val}</span>
                <span className="text-[10px] text-muted-foreground font-bold">{count} voti</span>
              </div>
            );
          })}
        </div>

        {!poll.anonymous && numericAnswers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {numericAnswers.map((item, i) => (
              <span
                key={`${question.id}-voter-${i}`}
                className="rounded-lg bg-muted dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium"
              >
                {item.playerName}: <strong>{item.answer?.scaleValue}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // single_choice / multiple_choice
  const totalVoters = answers.filter(
    (a) => (a.answer?.selectedOptions?.length ?? 0) > 0,
  ).length;

  return (
    <div className="rounded-2xl border border-border dark:border-brand-green/20 bg-background dark:bg-black/40 p-4 space-y-3">
      <h3 className="text-sm font-black tracking-tight">
        {index + 1}. {question.text}
      </h3>
      <div className="space-y-2.5">
        {(question.options ?? []).map((opt) => {
          const matching = answers.filter((a) =>
            a.answer?.selectedOptions?.includes(opt),
          );
          const count = matching.length;
          const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;

          return (
            <div key={opt} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{opt}</span>
                <span className="text-primary dark:text-brand-green">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary dark:bg-brand-green transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {!poll.anonymous && count > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {matching.map((m) => m.playerName).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
