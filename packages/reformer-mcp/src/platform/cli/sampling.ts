import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface SamplingRequest {
  /** Optional system-prompt sent to the client LLM. */
  systemPrompt?: string;
  /** User message text. Required. */
  userPrompt: string;
  /** Max tokens in the assistant response. Default 512. */
  maxTokens?: number;
  /** Model preference hint, e.g. "claude-3-5-sonnet". Default "claude-3-5-sonnet". */
  modelHint?: string;
  /** 0..1 — bias toward smarter models. Default 0.7. */
  intelligencePriority?: number;
}

export type SamplingResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'unsupported' | 'error'; error?: unknown };

/**
 * True if the connected client declared `sampling` capability during
 * initialization. When false, do NOT call {@link requestSampling} —
 * fall back to deterministic logic instead.
 */
export function isSamplingSupported(server: Server): boolean {
  const caps = server.getClientCapabilities();
  return caps?.sampling !== undefined;
}

/**
 * Ask the client LLM for a response. Wraps `server.createMessage(...)` with
 * sane defaults and a discriminated-union result so callers can degrade
 * gracefully when the client doesn't support sampling or the call fails.
 *
 * Caller is responsible for checking `isSamplingSupported(server)` first
 * — otherwise this function still returns `{ ok: false, reason: 'unsupported' }`,
 * but the server makes a wasted round-trip.
 *
 * Errors are logged to stderr (`console.error`) — stdout is reserved for MCP.
 */
export async function requestSampling(
  server: Server,
  req: SamplingRequest
): Promise<SamplingResult> {
  if (!isSamplingSupported(server)) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    const result = await server.createMessage({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: req.userPrompt },
        },
      ],
      systemPrompt: req.systemPrompt,
      modelPreferences: {
        hints: [{ name: req.modelHint ?? 'claude-3-5-sonnet' }],
        intelligencePriority: req.intelligencePriority ?? 0.7,
      },
      maxTokens: req.maxTokens ?? 512,
    });

    const content = result.content;
    if (content?.type === 'text' && typeof content.text === 'string') {
      return { ok: true, text: content.text };
    }
    console.error('[sampling] Unexpected response shape:', JSON.stringify(content));
    return { ok: false, reason: 'error', error: new Error('non-text sampling response') };
  } catch (err) {
    console.error('[sampling] failed:', err);
    return { ok: false, reason: 'error', error: err };
  }
}
