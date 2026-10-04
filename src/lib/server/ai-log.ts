import 'server-only';
import { createHash } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Log dei costi AI e cache, entrambe collection solo-server.
 *
 * REGOLA ASSOLUTA, in questa e in ogni funzione del file: NON si scrive mai il
 * testo del prompt ne' quello della risposta. I dati che arrivano al modello
 * sono i dati della squadra, cioe' nome, cognome e data di nascita di
 * minorenni. Un log di prompt e' un file di dati personali che nessuno ha
 * firmato per raccogliere. Qui si scrive solo il conteggio dei token: serve a
 * sapere quanto costa, e il numero non identifica nessuno.
 */

/** 90 giorni: le regole europee chiedono una durata dichiarata e limitata. */
export const USAGE_RETENTION_DAYS = 90;

/** 7 giorni: la cache serve a risparmiare una chiamata ravvicinata. */
export const CACHE_RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Timestamp di scadenza per TTL Firestore sul campo `expireAt`. */
export function ttlDate(days: number, from = new Date()): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

export interface UsageEntry {
  uid: string;
  seasonId?: string;
  route: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  /** Costo in USD se disponibile dall'API; assente se il modello non lo espone. */
  costUsd?: number;
  durationMs?: number;
}

/**
 * Scrive una riga di `aiUsage`.
 *
 * Non fallisce mai la richiesta: un errore di scrittura del log non deve
 * trasformare una generazione riuscita in un 500 all'utente. Il costo di
 * perdere una riga e' nullo; il costo di far fallire il prodotto no.
 */
export async function logUsage(entry: UsageEntry): Promise<void> {
  if (!adminDb) return;
  try {
    const now = new Date();
    await adminDb.collection('aiUsage').add({
      uid: entry.uid,
      seasonId: entry.seasonId ?? null,
      route: entry.route,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cached: entry.cached,
      costUsd: entry.costUsd ?? null,
      durationMs: entry.durationMs ?? null,
      createdAt: now,
      expireAt: ttlDate(USAGE_RETENTION_DAYS, now),
    });
  } catch (error) {
    console.warn('[aiUsage] scrittura fallita:', error instanceof Error ? error.message : error);
  }
}

/** Hash SHA-256 di una stringa: la chiave della cache. */
export function hashKey(...parts: (string | Buffer)[]): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(typeof p === 'string' ? p : p);
  return h.digest('hex');
}

export interface CacheHit<T> {
  hit: boolean;
  value?: T;
}

/**
 * Legge dalla cache AI. Non logga mai la chiave: e' un hash, ma un hash
 * leggibile insieme al resto dei log ricostruisce "chi ha chiesto cosa".
 */
export async function cacheGet<T>(key: string): Promise<CacheHit<T>> {
  if (!adminDb) return { hit: false };
  try {
    const snap = await adminDb.collection('aiCache').doc(key).get();
    if (!snap.exists) return { hit: false };
    const data = snap.data() as { value?: T };
    return { hit: true, value: data.value };
  } catch {
    return { hit: false };
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  if (!adminDb) return;
  try {
    const now = new Date();
    await adminDb.collection('aiCache').doc(key).set(
      { value, createdAt: now, expireAt: ttlDate(CACHE_RETENTION_DAYS, now) },
      { merge: true },
    );
  } catch (error) {
    console.warn('[aiCache] scrittura fallita:', error instanceof Error ? error.message : error);
  }
}

/**
 * Normalizza un prompt per la chiave di cache.
 *
 * "Genera un 4-3-3" e "genera   un   4-3-3  " sono la stessa richiesta e non
 * devono costare due chiamate: senza normalizzare, il cache colpisce solo se
 * l'utente digita identico, cioe' quasi mai.
 */
export function normalizeForCache(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}