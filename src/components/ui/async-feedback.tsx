'use client';

import { Loader2 } from 'lucide-react';

interface AsyncFeedbackProps {
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
  className?: string;
}

/**
 * Single, consistent way to render the state of an async action inside any
 * dialog/form. Pairs with `useAsyncAction`. Keeps loading + error visuals
 * identical across the whole app (previously each AI dialog reinvented this).
 */
export function AsyncFeedback({
  loading = false,
  error = null,
  loadingText = 'Operazione in corso…',
  className = '',
}: AsyncFeedbackProps) {
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{loadingText}</span>
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className={`rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive ${className}`}
      >
        {/* max-h con scroll: un errore lungo non deve spingere fuori dal
            dialog i pulsanti in basso, o l'utente non puo' piu' annullare. */}
        <div className="max-h-24 overflow-y-auto">{error}</div>
      </div>
    );
  }
  return null;
}
