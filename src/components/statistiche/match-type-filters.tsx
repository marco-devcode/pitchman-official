import { useMemo } from 'react';
import { MATCH_FILTERS, type FilterType } from '@/lib/aggregators/filter';
import type { SeasonDataContext } from '@/lib/repositories/aggregation-repository';
import type { Match } from '@/lib/types';

interface Props {
  context: SeasonDataContext | undefined;
  loadingContext: boolean;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function MatchTypeFilters({ context, loadingContext, filter, onFilterChange }: Props) {
  const counts = useMemo(() => {
    const c: Record<FilterType, number> = { all: 0, Campionato: 0, Torneo: 0, Amichevole: 0 };
    if (!context) return c;
    for (const m of context.matches as Match[]) {
      c.all++;
      if (m.type === 'Campionato' || m.type === 'Torneo' || m.type === 'Amichevole') {
        c[m.type]++;
      }
    }
    return c;
  }, [context]);

  if (loadingContext) {
    return (
      <div className="grid w-full grid-cols-4 gap-2 h-12 bg-muted/40 dark:bg-black/30 border border-border dark:border-brand-green/10 p-1 rounded-2xl">
        {MATCH_FILTERS.map(t => (
          <div key={t} className="h-full rounded-xl bg-muted/30 dark:bg-black/20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-4 gap-2 h-12 bg-muted/60 dark:bg-black/40 border border-border dark:border-brand-green/20 p-1 rounded-2xl transition-colors">
      {MATCH_FILTERS.map(type => {
        const active = filter === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onFilterChange(type)}
            className={`flex items-center justify-center gap-1.5 text-[10px] font-black uppercase rounded-xl transition-all ${
              active
                ? 'bg-primary text-white dark:bg-brand-green/20 dark:text-brand-green border border-primary/60 dark:border-brand-green shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)]'
                : 'text-muted-foreground hover:bg-primary/5 dark:hover:bg-brand-green/5 border border-transparent'
            }`}
          >
            <span>{type === 'all' ? 'Totale' : type}</span>
            <span className={`text-[9px] font-black ${active ? 'opacity-80' : 'opacity-50'}`}>({counts[type]})</span>
          </button>
        );
      })}
    </div>
  );
}
