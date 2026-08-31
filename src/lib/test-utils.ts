import type { PhysicalTest, TestResult } from '@/lib/types';
import type { Player } from '@/lib/types';

/** Parsifica un numero decimale accettando sia '.' che ',' come separatore (notazione italiana) */
export function parseDecimal(raw: string): number {
  if (!raw) return NaN;
  // Normalizza la virgola decimale italiana in punto
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}

/** Estrae l'unità base (secondi/metri/altro) anche dai valori con direzione */
export function baseUnit(unit: string): string {
  return unit.split('_')[0];
}

/** True se l'unità è dichiarata discendente (o è il vecchio 'metri' retrocompatibile) */
export function isDescendingUnit(unit: string): boolean {
  if (unit.endsWith('_discendente')) return true;
  if (unit === 'metri') return true; // retrocompatibilità dati esistenti
  return false;
}

/** Sort results by unit: "metri" → descending, "secondi"/"altro" → ascending */
export function sortResults(
  results: TestResult[],
  unit: string,
  getPlayerName: (id: string) => string
): (TestResult & { playerName: string })[] {
  const enriched = results.map(r => ({
    ...r,
    playerName: getPlayerName(r.playerId),
  }));
  const isDescending = isDescendingUnit(unit);
  return enriched.sort((a, b) =>
    isDescending ? b.value - a.value : a.value - b.value
  );
}

/** Get the latest result per player for a given test name */
export function getLatestPerPlayer(
  tests: PhysicalTest[],
  testName: string
): (TestResult & { date: string; playerName: string })[] {
  const filtered = tests
    .filter(t => t.name === testName)
    .sort((a, b) => b.date.localeCompare(a.date));

  const map = new Map<string, { result: TestResult; date: string }>();
  for (const t of filtered) {
    for (const r of t.results) {
      if (!map.has(r.playerId)) {
        map.set(r.playerId, { result: r, date: t.date });
      }
    }
  }

  return Array.from(map.entries()).map(([playerId, { result, date }]) => ({
    ...result,
    playerId,
    date,
    playerName: '',  // to be filled by caller
  }));
}

export function formatValue(value: number, unit: string): string {
  const base = baseUnit(unit);
  if (base === 'secondi') return `${value.toFixed(2)}s`;
  if (base === 'metri') return `${Number(value.toFixed(2))}m`;
  return value.toString();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** Compute delta between a result and the previous one for the same test name */
export function computeDelta(
  tests: PhysicalTest[],
  playerId: string,
  testName: string,
  currentValue: number,
  currentDate: string,
  unit: string
): { delta: number; isImprovement: boolean } | null {
  const previous = tests
    .filter(t => t.name === testName && t.date < currentDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => t.results.find(r => r.playerId === playerId))
    .find(r => r !== undefined);

  if (!previous) return null;

  const delta = currentValue - previous.value;
  // Miglioramento: per "metri" il valore sale, altrimenti scende.
  // Se l'unità è ascendente, il miglioramento è il valore che sale.
  const base = baseUnit(unit);
  const descending = isDescendingUnit(unit);
  const isImprovement = descending ? delta < 0 : delta > 0;
  // Per metri/altro logicamente: se base è metri, "migliore" = più alto.
  // Ma la direzione esplicita comanda: discendente => migliore = più basso.
  void base;
  return { delta, isImprovement };
}
