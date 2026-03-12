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
    message: { content: string; reasoning_content?: string; [key: string]: unknown };
    finish_reason: string;
    native_finish_reason?: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: unknown;
}

export interface OpenRouterConfig {
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
  model?: string;
  /**
   * When set, all requests are routed through this backend proxy URL instead
   * of calling OpenRouter directly. The API key stays server-side and is
   * never sent from the browser.
   */
  proxyUrl?: string;
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
    const isDev = import.meta.env.DEV;
    await rateLimiter.acquire();

    // ── Backend proxy path (API key stays server-side) ────────────────────
    if (this.config.proxyUrl) {
      if (isDev) {
        console.log(`[OpenRouter] Routing via backend proxy → ${this.config.proxyUrl}`);
        console.log(`[OpenRouter] Model: ${model} | All logging will appear in the npm/terminal console`);
      }
      const response = await fetch(this.config.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.3, maxTokens: options.maxTokens ?? 1024 }),
        signal: options.signal,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (isDev) console.error(`[OpenRouter] Proxy returned ${response.status}:`, error);
        throw new OpenRouterError(response.status, error);
      }
      return response.json() as Promise<OpenRouterResponse>;
    }

    // ── Direct OpenRouter path (used when no backend is available) ────────
    const requestBody = {
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1024,
      response_format: options.responseFormat,
    };

    if (isDev) {
      console.log(`[OpenRouter] ══════════════════════════════════════════`);
      console.log(`[OpenRouter] REQUEST to ${model}`);
      console.log(`[OpenRouter] ──────────────────────────────────────────`);
      console.log(`[OpenRouter] Full request body:`);
      console.log(JSON.stringify(requestBody, null, 2));
      console.log(`[OpenRouter] ──────────────────────────────────────────`);
    }

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
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (isDev) {
      console.log(`[OpenRouter] RESPONSE status: ${response.status}`);
      console.log(`[OpenRouter] Response headers:`);
      response.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (isDev) {
        console.error(`[OpenRouter] ${response.status} Error body:`);
        console.error(JSON.stringify(error, null, 2));
      }
      throw new OpenRouterError(response.status, error);
    }

    const json = await response.json() as OpenRouterResponse;
    if (isDev) {
      console.log(`[OpenRouter] ──────────────────────────────────────────`);
      console.log(`[OpenRouter] Full response JSON:`);
      console.log(JSON.stringify(json, null, 2));
      console.log(`[OpenRouter] ──────────────────────────────────────────`);
      console.log(`[OpenRouter] Usage: prompt=${json.usage?.prompt_tokens}, completion=${json.usage?.completion_tokens}, total=${json.usage?.total_tokens}`);
      if (json.choices) {
        json.choices.forEach((choice, i) => {
          console.log(`[OpenRouter] Choice[${i}]:`);
          console.log(`  finish_reason: ${choice.finish_reason}`);
          console.log(`  native_finish_reason: ${choice.native_finish_reason}`);
          console.log(`  message.content (type=${typeof choice.message?.content}, len=${choice.message?.content?.length ?? 'null'}): ${JSON.stringify(choice.message?.content?.substring(0, 500))}`);
          if (choice.message?.reasoning_content) {
            console.log(`  message.reasoning_content (len=${choice.message.reasoning_content.length}): ${JSON.stringify(choice.message.reasoning_content.substring(0, 500))}`);
          }
          // Log any other unexpected keys on the message object
          const knownKeys = new Set(['content', 'role', 'reasoning_content']);
          const extraKeys = Object.keys(choice.message || {}).filter(k => !knownKeys.has(k));
          if (extraKeys.length > 0) {
            console.log(`  message extra keys:`, extraKeys);
            extraKeys.forEach(k => console.log(`    ${k}:`, JSON.stringify((choice.message as Record<string, unknown>)[k])));
          }
        });
      }
      console.log(`[OpenRouter] ══════════════════════════════════════════`);
    }
    return json;
  }

  /**
   * Attempts the chat completion with ONLY the configured model.
   * Retries up to 2 times on network/server errors, but does NOT fall back to other models.
   * This keeps costs predictable and easy to track.
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
    const isDev = import.meta.env.DEV;
    const model = this.config.model ?? MODEL_CHAIN[0];

    if (isDev) console.log(`[OpenRouter] Using configured model: ${model}`);

    // Abort immediately if the signal is already aborted
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    try {
      if (isDev) console.log(`[OpenRouter] Attempting ${model}…`);
      const res = await withRetry(
        () =>
          this.chatCompletion(model, messages, {
            ...options,
            responseFormat: { type: "json_object" },
          }),
        { maxRetries: 2 },
      );
      let content = res.choices[0]?.message?.content ?? "";

      // Some reasoning/thinking models (e.g. DeepSeek, StepFun) put
      // their output in reasoning_content and leave content empty.
      const reasoning = res.choices[0]?.message?.reasoning_content;
      if (!content && reasoning) {
        if (isDev) console.warn(`[OpenRouter] content is empty but reasoning_content has ${reasoning.length} chars — using reasoning_content as fallback`);
        content = reasoning;
      }

      if (isDev) {
        console.log(`[OpenRouter] ${model} call completed.`);
        console.log(`[OpenRouter] finish_reason: ${res.choices[0]?.finish_reason}`);
        console.log(`[OpenRouter] Final content length: ${content.length}`);
        if (content) {
          console.log(`[OpenRouter] Content preview (first 500 chars): ${content.substring(0, 500)}`);
        }
        if (!content) {
          console.warn(`[OpenRouter] ⚠ WARNING: Empty content returned from ${model}`);
          console.warn(`[OpenRouter] This model may use all tokens for internal reasoning.`);
          console.warn(`[OpenRouter] Consider increasing maxTokens or using a different model.`);
        }
      }
      if (!content) {
        throw new Error(`${model} returned empty response (finish_reason=${res.choices[0]?.finish_reason}, tokens=${res.usage?.completion_tokens})`);
      }
      return { content, model };
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw error; // propagate cancellation immediately
      }
      const msg = error instanceof Error ? error.message : String(error);
      if (isDev) {
        console.error(`[OpenRouter] ${model} failed: ${msg}`);
      }
      throw error;
    }
  }
}
