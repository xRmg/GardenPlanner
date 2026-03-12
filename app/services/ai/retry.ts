/**
 * app/services/ai/retry.ts
 *
 * Exponential-backoff retry helper used by the OpenRouter client.
 */

import { OpenRouterError } from "./openrouter";

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    retryableStatuses?: number[];
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    retryableStatuses = [429, 500, 502, 503, 504],
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable =
        error instanceof OpenRouterError &&
        retryableStatuses.includes(error.status);

      if (!isRetryable || attempt === maxRetries) throw error;

      // Exponential backoff with jitter
      const delay =
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Unreachable — the loop always returns or throws before here
  throw new Error("Unreachable");
}
