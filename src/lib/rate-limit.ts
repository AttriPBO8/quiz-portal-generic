// Counts requests per key (usually an IP address) in fixed time windows, in this server's memory.
// It stops one device or script from flooding the app. Each server copy keeps its own counts,
// so a determined attack is stopped at AWS WAF instead (see docs/DEPLOY-AWS.md).

type Window = { start: number; count: number };

export class RateLimiter {
  private hits = new Map<string, Window>();
  constructor(private limit: number, private windowMs: number, private maxKeys = 50_000) {}

  /** Records one request. Returns how many seconds to wait if the key is over its limit, else 0. */
  hit(key: string, now = Date.now()): number {
    let w = this.hits.get(key);
    if (!w || now - w.start >= this.windowMs) {
      if (this.hits.size >= this.maxKeys) this.sweep(now);
      w = { start: now, count: 0 };
      this.hits.set(key, w);
    }
    w.count++;
    return w.count > this.limit ? Math.ceil((w.start + this.windowMs - now) / 1000) : 0;
  }

  private sweep(now: number) {
    for (const [k, w] of this.hits) if (now - w.start >= this.windowMs) this.hits.delete(k);
    // Still full (a flood of new addresses): start over rather than grow without limit.
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}
