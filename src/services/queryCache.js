/**
 * Lightweight in-memory TTL + in-flight deduplication cache for Firestore queries.
 * Eliminates duplicate network round-trips when switching pages or navigating dates.
 */

const cache = new Map();
const inflight = new Map();

export async function cachedQuery(key, fetcher, ttlMs = 60_000) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.timestamp < ttlMs) {
    return hit.data;
  }

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCachePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export function clearAllQueryCache() {
  cache.clear();
  inflight.clear();
}
