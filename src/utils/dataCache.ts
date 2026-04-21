// ─── Generic in-memory TTL cache ─────────────────────────────────────────────
// Eliminates repeated Prisma round-trips to Supabase Postgres for hot read
// paths (competition list, dashboard stats, registration detail, paged list).
//
// All reads/writes are O(1).  Expired entries are pruned lazily on access and
// in a full sweep at most once per 60 seconds to avoid memory leaks.
//
// On serverless (Vercel), the cache lives for the lifetime of the warm
// function instance — same guarantee as the existing token & actions caches.

interface Entry<T> {
    value: T
    cachedAt: number
    ttl: number   // milliseconds
}

const store = new Map<string, Entry<unknown>>()
let lastPrune = Date.now()

function pruneExpired(): void {
    const now = Date.now()
    if (now - lastPrune < 60_000) return   // at most once per 60 s
    lastPrune = now
    for (const [key, entry] of store) {
        if (now - entry.cachedAt > entry.ttl) store.delete(key)
    }
}

/** Return the cached value if it is still fresh, otherwise `undefined`. */
export function cacheGet<T>(key: string): T | undefined {
    pruneExpired()
    const entry = store.get(key) as Entry<T> | undefined
    if (!entry) return undefined
    if (Date.now() - entry.cachedAt > entry.ttl) {
        store.delete(key)
        return undefined
    }
    return entry.value
}

/** Store a value with the given TTL in milliseconds. */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, { value, cachedAt: Date.now(), ttl: ttlMs })
}

/** Remove a single cached entry. */
export function cacheDelete(key: string): void {
    store.delete(key)
}

/**
 * Remove all cached entries whose key starts with the given prefix.
 * Use this to invalidate an entire family of related keys (e.g. `reg:list:`).
 */
export function cacheDeletePrefix(prefix: string): void {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key)
    }
}
