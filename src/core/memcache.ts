/**
 * Lightweight in-memory cache for route-level caching.
 * No Redis required — works on Render free tier.
 *
 * Features:
 *  - TTL-based expiration
 *  - Max entry limit to prevent memory leaks
 *  - Request deduplication (coalesce concurrent identical requests)
 *  - Stale-while-revalidate support
 */

const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

const store = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

function cleanup() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  // First pass: remove expired
  for (const [key, entry] of store.entries()) {
    if (now - entry.cachedAt > entry.ttlMs * 2) store.delete(key);
  }
  // If still too large, remove oldest entries
  if (store.size > MAX_ENTRIES) {
    const sorted = [...store.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toDelete = sorted.slice(0, store.size - MAX_ENTRIES + 50);
    for (const [key] of toDelete) store.delete(key);
  }
}

/**
 * Get-or-fetch with in-memory caching.
 *
 * @param key     Unique cache key (e.g. "animekai:search:naruto:1")
 * @param ttlMs   Cache duration in milliseconds
 * @param fetcher Async function that produces the data if cache misses
 * @returns       Cached or freshly fetched data
 */
export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  // 1. Check fresh cache
  const hit = store.get(key);
  if (hit && Date.now() - hit.cachedAt <= hit.ttlMs) {
    return hit.data;
  }

  // 2. Deduplicate concurrent requests for the same key
  const pending = inFlight.get(key);
  if (pending) return pending;

  // 3. Fetch, cache, return
  const task = (async () => {
    try {
      const data = await fetcher();
      store.set(key, { data, cachedAt: Date.now(), ttlMs });
      cleanup();
      return data;
    } catch (err) {
      // On error, serve stale cache if available
      const stale = store.get(key);
      if (stale) return stale.data;
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

/** Pre-defined TTLs for common use cases */
export const TTL = {
  /** 5 minutes — for rapidly changing data (recent episodes, home page) */
  SHORT: 5 * 60 * 1000,
  /** 15 minutes — for search results, info pages */
  MEDIUM: 15 * 60 * 1000,
  /** 1 hour — for relatively stable data (genres, media info) */
  LONG: 60 * 60 * 1000,
  /** 6 hours — for very stable data (genre lists) */
  VERY_LONG: 6 * 60 * 60 * 1000,
} as const;
