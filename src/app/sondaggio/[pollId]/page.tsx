'use client';

import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardCheck,
  Lock,
  AlertCircle,
  Loader2,
  UserCheck,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PollAnswerValue, PollQuestion, PublicPollView } from '@/lib/types';

type AnswerDraft = {
  selectedOptions?: string[];
  scaleValue?: number;
  textValue?: string;
};

function PublicPollContent() {
  const params = useParams<{ pollId: string }>();
  const searchParams = useSearchParams();
  const pollId = params?.pollId ?? '';
  const personalToken = searchParams.get('t')?.trim() ?? '';
  const groupToken = searchParams.get('g')?.trim() ?? '';

  const [poll, setPoll] = useState<PublicPollView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [hasSubmittedAttempt, setHasSubmittedAttempt] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedState, setSubmittedState] = useState<{
    playerName: string;
    anonymous: boolean;
  } | null>(null);

  const errorBannerRef = useRef<HTMLDivElement>(null);
  const playerSelectId = useId();

  const fetchPoll = useCallback(async () => {
    if (!pollId || (!personalToken && !groupToken)) {
      setLoadError('Link del sondaggio non valido o incompleto.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const qs = personalToken
        ? `t=${encodeURIComponent(personalToken)}`
        : `g=${encodeURIComponent(groupToken)}`;
      const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}?${qs}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Impossibile aprire il sondaggio.');
      }
      setPoll(data as PublicPollView);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Errore di connessione.');
    } finally {
      setLoading(false);
    }
  }, [pollId, personalToken, groupToken]);

  useEffect(() => {
    void fetchPoll();
  }, [fetchPoll]);

  useEffect(() => {
    if (submittedState) {
      document.title = 'Risposta inviata | PitchMan';
    } else if (poll?.title) {
      document.title = `${poll.title} | PitchMan`;
    } else {
      document.title = 'Sondaggio Spogliatoio | PitchMan';
    }
  }, [poll?.title, submittedState]);

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!poll) return errors;

    if (poll.mode === 'group' && !selectedPlayerId) {
      errors.__player = 'Seleziona il tuo nome dalla lista della squadra.';
    }

    for (const q of poll.questions) {
      if (!q.required) continue;
      const draft = answers[q.id];
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        if (!draft?.selectedOptions || draft.selectedOptions.length === 0) {
          errors[q.id] = 'Seleziona almeno una risposta.';
        }
      } else if (q.type === 'scale') {
        if (draft?.scaleValue === undefined) {
          errors[q.id] = `Scegli un valore da 1 a ${q.scaleMax === 10 ? 10 : 5}.`;
        }
      } else if (!draft?.textValue?.trim()) {
        errors[q.id] = 'Inserisci una risposta prima di inviare.';
      }
    }
    return errors;
  }, [poll, selectedPlayerId, answers]);

  const setSingleOption = (questionId: string, option: string) => {
    setTouchedFields((prev) => ({ ...prev, [questionId]: true }));
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], selectedOptions: [option] },
    }));
  };

  const toggleMultipleOption = (questionId: string, option: string) => {
    setTouchedFields((prev) => ({ ...prev, [questionId]: true }));
    setAnswers((prev) => {
      const current = prev[questionId]?.selectedOptions ?? [];
      const next = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return {
        ...prev,
        [questionId]: { ...prev[questionId], selectedOptions: next },
      };
    });
  };

  const setScaleValue = (questionId: string, value: number) => {
    setTouchedFields((prev) => ({ ...prev, [questionId]: true }));
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], scaleValue: value },
    }));
  };

  const setTextValue = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], textValue: text },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poll || isSubmitting) return;

    setHasSubmittedAttempt(true);
    setSubmitError(null);

    if (Object.keys(fieldErrors).length > 0) {
      setSubmitError('Controlla i campi obbligatori evidenziati prima di inviare.');
      setTimeout(() => errorBannerRef.current?.focus(), 0);
      return;
    }

    const payloadAnswers: PollAnswerValue[] = poll.questions.map((q) => {
      const draft = answers[q.id] ?? {};
      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        return { questionId: q.id, selectedOptions: draft.selectedOptions ?? [] };
      }
      if (q.type === 'scale') {
        return { questionId: q.id, scaleValue: draft.scaleValue };
      }
      return { questionId: q.id, textValue: (draft.textValue ?? '').trim() };
    });

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(poll.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenType: poll.mode,
          token: poll.mode === 'personal' ? personalToken : groupToken,
          ...(poll.mode === 'group' ? { playerId: selectedPlayerId } : {}),
          answers: payloadAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || 'Errore durante l\'invio.');
      }

      setSubmittedState({
        playerName: data.playerName,
        anonymous: Boolean(data.anonymous),
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Errore imprevisto.');
      setTimeout(() => errorBannerRef.current?.focus(), 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const shouldShowError = (key: string) =>
    Boolean(fieldErrors[key] && (hasSubmittedAttempt || touchedFields[key]));

  if (loading) {
    return (
      <div className="mx-auto max-w-xl py-8 space-y-4">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
      </div>
    );
  }

  if (loadError || !poll) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-3xl bg-card dark:bg-black/70 border border-border dark:border-brand-green/20 p-6 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">Sondaggio non disponibile</h1>
          <p className="text-sm text-muted-foreground">
            {loadError || 'Il link utilizzato non è più valido o è incompleto.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchPoll()}
            className="min-h-11 rounded-xl font-bold uppercase text-xs"
          >
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  if (submittedState) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div
          role="status"
          aria-live="polite"
          className="rounded-3xl bg-card dark:bg-black/70 border border-primary/30 dark:border-brand-green/30 p-7 text-center space-y-4 shadow-lg dark:shadow-theme"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 dark:bg-brand-green/15 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-primary dark:text-brand-green" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-primary dark:text-brand-green">
            {poll.seasonName}
          </p>
          <h1 className="text-2xl font-black uppercase tracking-tight">Risposta registrata!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Grazie <strong className="text-foreground">{submittedState.playerName}</strong>, il tuo contributo per{' '}
            <strong className="text-foreground">{poll.title}</strong> è stato salvato.
          </p>
          <div className="inline-flex items-center gap-2 rounded-xl bg-muted/60 dark:bg-white/5 px-3.5 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary dark:text-brand-green shrink-0" aria-hidden="true" />
            {submittedState.anonymous
              ? 'Le risposte sono state salvate in forma anonima.'
              : 'Le risposte sono state associate al tuo profilo.'}
          </div>
        </div>
      </div>
    );
  }

  if (poll.mode === 'personal' && poll.player.alreadyCompleted) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-3xl bg-card dark:bg-black/70 border border-primary/30 dark:border-brand-green/30 p-7 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 dark:bg-brand-green/10 flex items-center justify-center">
            <ClipboardCheck className="h-7 w-7 text-primary dark:text-brand-green" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">Sondaggio già compilato</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ciao <strong className="text-foreground">{poll.player.playerName}</strong>, hai già inviato la tua
            risposta per <strong className="text-foreground">{poll.title}</strong>. Non è necessario fare altro.
          </p>
        </div>
      </div>
    );
  }

  if (poll.status === 'closed') {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-3xl bg-card dark:bg-black/70 border border-border dark:border-brand-green/20 p-7 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Lock className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">Sondaggio chiuso</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La raccolta risposte per <strong className="text-foreground">{poll.title}</strong> è stata chiusa
            dall&apos;allenatore.
          </p>
        </div>
      </div>
    );
  }

  const allCompletedInGroup =
    poll.mode === 'group' && poll.roster.every((item) => item.alreadyCompleted);

  return (
    <div className="mx-auto max-w-xl py-4 pb-16 space-y-5">
      {/* Header del sondaggio */}
      <header className="rounded-3xl bg-card dark:bg-black/70 border border-border dark:border-brand-green/25 p-5 sm:p-6 space-y-3 shadow-sm dark:shadow-theme-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-primary dark:text-brand-green">
            {poll.seasonName} • Spogliatoio
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide border',
              poll.anonymous
                ? 'bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green border-primary/25 dark:border-brand-green/25'
                : 'bg-muted text-foreground border-border',
            )}
          >
            {poll.anonymous ? (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Anonimo
              </>
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Nominale
              </>
            )}
          </span>
        </div>

        <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">{poll.title}</h1>
        {poll.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{poll.description}</p>
        )}

        <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
          {poll.anonymous
            ? 'Privacy: il mister vedrà che hai completato il sondaggio, ma le tue risposte resteranno anonime.'
            : 'Le risposte verranno mostrate allo staff tecnico associate al tuo nome.'}
        </p>

        {poll.mode === 'personal' && (
          <div className="flex items-center gap-2 rounded-2xl bg-primary/10 dark:bg-brand-green/10 border border-primary/20 dark:border-brand-green/20 px-4 py-2.5 text-sm font-bold text-primary dark:text-brand-green">
            <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Giocatore: {poll.player.playerName}</span>
          </div>
        )}
      </header>

      {allCompletedInGroup ? (
        <div className="rounded-3xl bg-card dark:bg-black/70 border border-primary/30 dark:border-brand-green/30 p-6 text-center space-y-2">
          <CheckCircle2 className="h-8 w-8 text-primary dark:text-brand-green mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-black uppercase tracking-tight">Tutti i giocatori hanno risposto</h2>
          <p className="text-sm text-muted-foreground">
            Ogni membro della rosa risulta già registrato per questo sondaggio.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {submitError && (
            <div
              ref={errorBannerRef}
              tabIndex={-1}
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive flex items-start gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Selettore giocatore per link di gruppo */}
          {poll.mode === 'group' && (
            <div className="rounded-3xl bg-card dark:bg-black/60 border border-border dark:border-brand-green/20 p-5 space-y-2.5">
              <Label htmlFor={playerSelectId} className="text-sm font-black uppercase tracking-wide block">
                Chi sei? <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <p id={`${playerSelectId}-hint`} className="text-xs text-muted-foreground">
                Seleziona il tuo nome dalla lista. Chi ha già inviato non è più selezionabile.
              </p>
              <select
                id={playerSelectId}
                name="playerId"
                required
                value={selectedPlayerId}
                aria-invalid={shouldShowError('__player') ? 'true' : 'false'}
                aria-describedby={
                  shouldShowError('__player')
                    ? `${playerSelectId}-hint ${playerSelectId}-error`
                    : `${playerSelectId}-hint`
                }
                onBlur={() => setTouchedFields((prev) => ({ ...prev, __player: true }))}
                onChange={(e) => {
                  setTouchedFields((prev) => ({ ...prev, __player: true }));
                  setSelectedPlayerId(e.target.value);
                }}
                className="w-full min-h-12 rounded-xl border border-border dark:border-brand-green/30 bg-background dark:bg-black px-3.5 py-2.5 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-brand-green"
              >
                <option value="">-- Seleziona il tuo nome --</option>
                {poll.roster.map((item) => (
                  <option key={item.playerId} value={item.playerId} disabled={item.alreadyCompleted}>
                    {item.playerName}
                    {item.alreadyCompleted ? ' (già compilato)' : ''}
                  </option>
                ))}
              </select>
              {shouldShowError('__player') && (
                <p id={`${playerSelectId}-error`} className="text-xs font-semibold text-destructive">
                  {fieldErrors.__player}
                </p>
              )}
            </div>
          )}

          {/* Elenco domande */}
          {poll.questions.map((question, idx) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={idx}
              draft={answers[question.id]}
              error={shouldShowError(question.id) ? fieldErrors[question.id] : undefined}
              onSelectSingle={(opt) => setSingleOption(question.id, opt)}
              onToggleMultiple={(opt) => toggleMultipleOption(question.id, opt)}
              onSelectScale={(val) => setScaleValue(question.id, val)}
              onChangeText={(txt) => setTextValue(question.id, txt)}
              onBlurField={() => setTouchedFields((prev) => ({ ...prev, [question.id]: true }))}
            />
          ))}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-12 rounded-2xl bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase tracking-wider text-sm shadow-md dark:shadow-theme hover:opacity-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Invio in corso...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                Invia Risposte
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  index,
  draft,
  error,
  onSelectSingle,
  onToggleMultiple,
  onSelectScale,
  onChangeText,
  onBlurField,
}: {
  question: PollQuestion;
  index: number;
  draft?: AnswerDraft;
  error?: string;
  onSelectSingle: (option: string) => void;
  onToggleMultiple: (option: string) => void;
  onSelectScale: (value: number) => void;
  onChangeText: (text: string) => void;
  onBlurField: () => void;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const heading = `${index + 1}. ${question.text}`;

  if (question.type === 'open_text') {
    return (
      <div className="rounded-3xl bg-card dark:bg-black/60 border border-border dark:border-brand-green/20 p-5 space-y-2.5">
        <Label htmlFor={inputId} className="text-base font-bold text-foreground block leading-snug">
          {heading}
          {question.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </Label>
        <Textarea
          id={inputId}
          name={question.id}
          rows={3}
          required={question.required}
          maxLength={1000}
          placeholder="Scrivi qui la tua risposta..."
          value={draft?.textValue ?? ''}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
          onBlur={onBlurField}
          onChange={(e) => onChangeText(e.target.value)}
          className="text-base rounded-xl bg-background dark:bg-black border-border dark:border-brand-green/25"
        />
        {error && (
          <p id={errorId} className="text-xs font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (question.type === 'scale') {
    const max = question.scaleMax === 10 ? 10 : 5;
    const values = Array.from({ length: max }, (_, i) => i + 1);
    return (
      <fieldset
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        className="rounded-3xl bg-card dark:bg-black/60 border border-border dark:border-brand-green/20 p-5 space-y-3"
      >
        <legend className="text-base font-bold text-foreground leading-snug">
          {heading}
          {question.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </legend>

        <div className="grid grid-cols-5 gap-2">
          {values.map((n) => {
            const checked = draft?.scaleValue === n;
            const optId = `${inputId}-scale-${n}`;
            return (
              <label
                key={n}
                htmlFor={optId}
                className={cn(
                  'min-h-12 rounded-xl border flex items-center justify-center font-black text-base cursor-pointer transition-all select-none',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary dark:has-[:focus-visible]:ring-brand-green',
                  checked
                    ? 'bg-primary dark:bg-brand-green text-white dark:text-black border-primary dark:border-brand-green shadow-sm dark:shadow-theme-soft'
                    : 'bg-background dark:bg-black border-border dark:border-white/15 hover:border-primary/40 dark:hover:border-brand-green/40',
                )}
              >
                <input
                  id={optId}
                  type="radio"
                  name={question.id}
                  value={n}
                  checked={checked}
                  onChange={() => onSelectScale(n)}
                  className="sr-only"
                />
                {n}
              </label>
            );
          })}
        </div>

        {(question.scaleMinLabel || question.scaleMaxLabel) && (
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>{question.scaleMinLabel ? `1 = ${question.scaleMinLabel}` : ''}</span>
            <span>{question.scaleMaxLabel ? `${max} = ${question.scaleMaxLabel}` : ''}</span>
          </div>
        )}

        {error && (
          <p id={errorId} className="text-xs font-semibold text-destructive">
            {error}
          </p>
        )}
      </fieldset>
    );
  }

  const isMultiple = question.type === 'multiple_choice';
  const selectedList = draft?.selectedOptions ?? [];

  return (
    <fieldset
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? errorId : undefined}
      className="rounded-3xl bg-card dark:bg-black/60 border border-border dark:border-brand-green/20 p-5 space-y-2.5"
    >
      <legend className="text-base font-bold text-foreground leading-snug">
        {heading}
        {question.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
      </legend>
      {isMultiple && (
        <p className="text-xs text-muted-foreground">Puoi selezionare più opzioni.</p>
      )}

      <div className="space-y-2 pt-1">
        {(question.options ?? []).map((opt, optIdx) => {
          const checked = selectedList.includes(opt);
          const optId = `${inputId}-opt-${optIdx}`;
          return (
            <label
              key={opt}
              htmlFor={optId}
              className={cn(
                'flex items-center gap-3 min-h-12 w-full rounded-2xl border px-4 py-3 text-sm font-semibold cursor-pointer transition-all',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary dark:has-[:focus-visible]:ring-brand-green',
                checked
                  ? 'border-primary dark:border-brand-green bg-primary/10 dark:bg-brand-green/10 text-foreground'
                  : 'border-border dark:border-white/15 bg-background dark:bg-black hover:bg-muted/40 dark:hover:bg-white/5',
              )}
            >
              <input
                id={optId}
                type={isMultiple ? 'checkbox' : 'radio'}
                name={question.id}
                value={opt}
                checked={checked}
                onChange={() => (isMultiple ? onToggleMultiple(opt) : onSelectSingle(opt))}
                className="h-4 w-4 accent-primary dark:accent-brand-green shrink-0"
              />
              <span className="leading-snug">{opt}</span>
            </label>
          );
        })}
      </div>

      {error && (
        <p id={errorId} className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export default function PublicPollPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl py-8 space-y-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-44 w-full rounded-3xl" />
        </div>
      }
    >
      <PublicPollContent />
    </Suspense>
  );
}
