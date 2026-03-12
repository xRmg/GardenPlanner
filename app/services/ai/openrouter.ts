/**
 * app/services/ai/openrouter.ts
 *
 * OpenRouter API client with:
 *   - Typed chat completion request/response
 *   - Model fallback chain (Gemini Flash → Mistral Small → Llama 3.3)
 *   - Per-request AbortSignal support
 *   - HTTP-Referer / X-Title headers for OpenRouter usage attribution
 */

import { withRetry } from "./retry";
import { RateLimiter } from "./rateLimiter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterConfig {
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
  model?: string;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class OpenRouterError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`OpenRouter API error: ${status}`);
  }
}

// ---------------------------------------------------------------------------
// Model fallback chain
// ---------------------------------------------------------------------------

export const MODEL_CHAIN = [
  "google/gemini-2.0-flash",
  "mistralai/mistral-small",
  "meta-llama/llama-3.3-70b-instruct",
];

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const rateLimiter = new RateLimiter(10, 60_000);

export class OpenRouterClient {
  private baseUrl = "https://openrouter.ai/api/v1";
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = config;
  }

  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: "json_object" };
      signal?: AbortSignal;
    } = {},
  ): Promise<OpenRouterResponse> {
    await rateLimiter.acquire();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          this.config.siteUrl ||
          (typeof window !== "undefined" ? window.location.origin : ""),
        "X-Title": this.config.siteName || "Garden Planner",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1024,
        response_format: options.responseFormat,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new OpenRouterError(response.status, error);
    }

    return response.json() as Promise<OpenRouterResponse>;
  }

  /**
   * Attempts the chat completion with the configured model first,
   * then falls back through MODEL_CHAIN on retryable errors.
   */
  async chatCompletionWithFallback(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: "json_object" };
      signal?: AbortSignal;
    } = {},
  ): Promise<{ content: string; model: string }> {
    const primary = this.config.model ?? MODEL_CHAIN[0];
    // Build the chain: configured model first, then the rest (deduplicated)
    const chain = [
      primary,
      ...MODEL_CHAIN.filter((m) => m !== primary),
    ];

    let lastError: unknown;
    for (const model of chain) {
      // Abort immediately if the signal is already aborted
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        const res = await withRetry(
          () =>
            this.chatCompletion(model, messages, {
              ...options,
              responseFormat: { type: "json_object" },
            }),
          { maxRetries: 2 },
        );
        const content = res.choices[0]?.message?.content ?? "";
        return { content, model };
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          throw error; // propagate cancellation immediately
        }
        lastError = error;
        if (model !== chain[chain.length - 1]) {
          console.warn(`[OpenRouter] Model ${model} failed, trying next…`);
        }
      }
    }
    throw lastError ?? new Error("All OpenRouter models failed");
  }
}
