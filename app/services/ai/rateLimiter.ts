/**
 * app/services/ai/rateLimiter.ts
 *
 * Simple client-side rate limiter: allows at most `maxRequests` calls
 * within a rolling `windowMs` window before delaying further calls.
 */

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number = 10,
    private windowMs: number = 60_000, // 1 minute
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      // Add a small buffer (50ms) to account for timer imprecision
      const waitMs = this.windowMs - (now - oldestInWindow) + 50;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    this.timestamps.push(Date.now());
  }
}
