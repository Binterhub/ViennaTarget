'use strict';

/**
 * Simple in-memory cache with TTL.
 */
class MemoryCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.entry = null;
  }

  get() {
    if (!this.entry) return null;
    if (Date.now() >= this.entry.expiresAt) {
      return null;
    }
    return this.entry.value;
  }

  getStale() {
    return this.entry ? this.entry.value : null;
  }

  set(value) {
    this.entry = {
      value,
      expiresAt: Date.now() + this.ttlMs,
      storedAt: Date.now(),
    };
    return this.entry;
  }

  clear() {
    this.entry = null;
  }

  meta() {
    if (!this.entry) {
      return { cached: false, expiresAt: null, storedAt: null };
    }
    return {
      cached: Date.now() < this.entry.expiresAt,
      expiresAt: new Date(this.entry.expiresAt).toISOString(),
      storedAt: new Date(this.entry.storedAt).toISOString(),
      stale: Date.now() >= this.entry.expiresAt,
    };
  }
}

module.exports = { MemoryCache };
