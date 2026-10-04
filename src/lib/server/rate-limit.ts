import 'server-only';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/**
 * Limiti di frequenza, centralizzati.
 *
 * Un unico posto perche' i numeri sparsi in sei route sono numeri che divergono:
 * prima la tabella del prompt, poi quello scritto in ciascun file, e al primo
 * refactor due route ne hanno uno diverso senza che nulla fallisca.
 */
export const RATE_LIMITS = {
  chatbot: { requests: 30, window: '1 h' },
  generate: { requests: 10, window: '1 h' },
  generateDaily: { requests: 40, window: '1 d' },
  importImage: { requests: 10, window: '1 h' },
  redeemInvite: { requests: 10, window: '1 h' },
  exportAccount: { requests: 3, window: '1 d' },
  feedback: { requests: 10, window: '1 d' },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

let redis: Redis | null | undefined;

/**
 * Connessione Redis, o null se le variabili non ci sono.
 *
 * `undefined` = non ancora chiesto, `null` = non configurato. La distinzione
 * serve per non ripetere la lettura a ogni richiesta.
 */
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/**
 * C'e' un limiter configurato?
 *
 * In sviluppo, no: non si vuole costringere a configurare Upstash per far
 * girare l'app in locale, e un test che richiede una rete esterna non e' un
 * test. In produzione la risposta e' `false` e le route AI chiudono (vedi
 * `checkAiRoute`): fallire aperto significa niente limiti, il costo lo paga
 * l'utente.
 */
export function isRateLimitConfigured(): boolean {
  if (getRedis()) return true;
  return process.env.NODE_ENV !== 'production';
}

/** Secondi da aspettare prima di riprovare, dalla risposta di Upstash. */
function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number; limit: number };

/**
 * Applica il limite. Per utente, e dove serve anche per IP.
 *
 * L'IP serve solo per il riscatto invito: e' l'unico punto in cui si indovina
 * un codice, e il limite per utente non fermerebbe uno script che crea un
 * account per ogni tentativo.
 */
export async function rateLimit(
  key: RateLimitKey,
  ids: { uid?: string; ip?: string },
): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) return { ok: true };

  const spec = RATE_LIMITS[key];
  const parts = [
    `pitchman:rl:${key}`,
    ids.uid ? `u:${ids.uid}` : undefined,
    ids.ip ? `ip:${ids.ip}` : undefined,
  ].filter((p): p is string => Boolean(p));

  const limiter = new Ratelimit({
    redis: client,
    // slidingWindow vuole il numero di richieste come NUMERO e la finestra
    // come stringa tipo '1 h'. Inversi i due non compila.
    limiter: Ratelimit.slidingWindow(spec.requests, spec.window),
    prefix: parts.join(':'),
    analytics: true,
  });

  // Anche `limit()` vuole la quantita' come stringa, per coerenza con la
  // libreria. Passare 1 come numero e' un errore che compare solo al primo
  // deploy, quindi si corregge qui e non in un colpo solo.
  const res = await limiter.limit('1');
  if (res.success) return { ok: true };

  return {
    ok: false,
    retryAfter: retryAfterSeconds(res.reset),
    limit: res.limit,
  };
}

/**
 * Tetto GLOBALE giornaliero delle chiamate AI.
 *
 * Serve a una cosa sola: che un picco o un abuso non produca una fattura a
 * cinque cifre. E' un contatore in Redis con TTL di un giorno, quindi si
 * autodistrugge e non accumula stato.
 */
export async function globalDailyLimit(): Promise<RateLimitResult> {
  const client = getRedis();
  const cap = Number(process.env.AI_DAILY_GLOBAL_LIMIT ?? 0);
  if (!client || !Number.isFinite(cap) || cap <= 0) return { ok: true };

  const key = 'pitchman:ai:global';
  const used = await client.incr(key);
  if (used === 1) await client.expire(key, 60 * 60 * 24);

  if (used > cap) {
    const ttl = await client.ttl(key);
    return { ok: false, retryAfter: Math.max(1, ttl), limit: cap };
  }
  return { ok: true };
}

/** IP del chiamante, da trusted header di Vercel. `null` se assente. */
export function clientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip');
}