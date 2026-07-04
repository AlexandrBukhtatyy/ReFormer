import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ProjectStack } from './project-detector.js';
import { isSamplingSupported, requestSampling } from './sampling.js';

export type ReformerTarget = 'core' | 'renderer-react' | 'renderer-json';
/** @deprecated используйте ReformerTarget */
export type Target = ReformerTarget;

export const REFORMER_TARGETS = ['core', 'renderer-react', 'renderer-json'] as const;

export function isReformerTarget(x: unknown): x is ReformerTarget {
  return typeof x === 'string' && (REFORMER_TARGETS as readonly string[]).includes(x);
}

const VALID_TARGETS: ReadonlyArray<ReformerTarget> = REFORMER_TARGETS;

/**
 * Best-effort fallback when no client LLM is available — pick a target purely
 * from the detected dependency stack.
 */
function fallbackTarget(stack: ProjectStack): Target {
  if (stack.hasRendererJson) return 'renderer-json';
  if (stack.hasRendererReact) return 'renderer-react';
  return 'core';
}

/**
 * Infer the desired target stack ("core" / "renderer-react" / "renderer-json")
 * via client sampling, biased by what dependencies are already installed.
 *
 * Falls back to a deterministic heuristic when the client doesn't support
 * sampling, the call fails, or the response is unparseable.
 *
 * Used by `create-form` and `plan-form` only when `args.target` was not
 * supplied explicitly — so callers that pin the target pay nothing.
 */
export async function inferTarget(
  server: Server,
  ctx: { description: string; stack: ProjectStack }
): Promise<Target> {
  const fallback = fallbackTarget(ctx.stack);
  if (!isSamplingSupported(server)) return fallback;

  const installed =
    [
      ctx.stack.hasRendererReact ? '@reformer/renderer-react' : null,
      ctx.stack.hasRendererJson ? '@reformer/renderer-json' : null,
      ctx.stack.hasUiKit ? '@reformer/ui-kit' : null,
      ctx.stack.hasCdk ? '@reformer/cdk' : null,
    ]
      .filter(Boolean)
      .join(', ') || '(none)';

  const result = await requestSampling(server, {
    systemPrompt:
      'You classify which @reformer/* target stack to use for a new form. ' +
      'Reply with EXACTLY one of: core | renderer-react | renderer-json. No prose.',
    userPrompt:
      `Form description:\n${ctx.description}\n\n` +
      `Installed @reformer/* packages: ${installed}.\n\n` +
      'Rules:\n' +
      '- Prefer "renderer-json" if @reformer/renderer-json is installed.\n' +
      '- Prefer "renderer-react" if @reformer/renderer-react is installed (and json is not).\n' +
      '- Prefer "core" otherwise OR for trivial forms with <5 fields.\n\n' +
      'Reply with one token: core, renderer-react, or renderer-json.',
    maxTokens: 16,
    intelligencePriority: 0.4,
  });

  if (!result.ok) return fallback;
  const token = result.text.trim().toLowerCase().split(/\s+/)[0];
  return (VALID_TARGETS as ReadonlyArray<string>).includes(token) ? (token as Target) : fallback;
}

export interface DiscoveredStack {
  /** Detected UI library, e.g. "@reformer/ui-kit", "@mui/material", "antd". */
  uiKit: string | null;
  /** Detected styling system, e.g. "tailwind", "styled-components", "css-modules". */
  styling: string | null;
}

/**
 * When `detectProjectStack` failed to find an @reformer ui-kit or Tailwind,
 * ask the client LLM to look at the full dependency list and suggest
 * a likely UI library + styling system.
 *
 * Returns `null` if sampling is unsupported, fails, or the response is empty.
 */
export async function discoverUnknownStack(
  server: Server,
  stack: ProjectStack
): Promise<DiscoveredStack | null> {
  if (!isSamplingSupported(server)) return null;
  if (!stack.projectRoot) return null;

  const depList = Object.keys(stack.allDependencies).join(', ');
  if (!depList) return null;

  const result = await requestSampling(server, {
    systemPrompt:
      'You analyse package.json dependencies and identify the UI library and ' +
      'styling system in use. Reply ONLY in JSON: ' +
      '{"uiKit":"<package-name>|null","styling":"<system>|null"}. No prose.',
    userPrompt:
      `Dependencies: ${depList}\n\n` +
      'Pick uiKit from one of: @reformer/ui-kit, @mui/material, antd, @chakra-ui/react, @radix-ui/themes, shadcn-ui (if components.json hint visible), or null.\n' +
      'Pick styling from one of: tailwind, styled-components, emotion, css-modules, sass, vanilla-css, or null.\n\n' +
      'Reply JSON only.',
    maxTokens: 64,
    intelligencePriority: 0.3,
  });

  if (!result.ok) return null;
  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<DiscoveredStack>;
    return {
      uiKit: typeof parsed.uiKit === 'string' && parsed.uiKit.length > 0 ? parsed.uiKit : null,
      styling:
        typeof parsed.styling === 'string' && parsed.styling.length > 0 ? parsed.styling : null,
    };
  } catch {
    return null;
  }
}

export interface DeepSpecAnalysis {
  /** "step1.foo → step2.bar → step3.baz" chains the regex parser missed. */
  crossStepCascades: string[];
  /** Single flag that hides multiple fields at once. */
  conditionalGroups: Array<{ flag: string; affects: string[] }>;
  /** Whole step is hidden until a condition. */
  hiddenSteps: Array<{ step: string; condition: string }>;
}

/**
 * Use sampling to extract complex spec patterns the regex parser in
 * `analyzeSpec` cannot reliably catch. Returns `null` when sampling is
 * unsupported or the response cannot be parsed.
 *
 * The result is merged into the `plan-form` template as an optional
 * "## LLM-extracted complex patterns" section — the prompt remains usable
 * (just without that section) when sampling is unavailable.
 */
export async function deepAnalyzeSpec(
  server: Server,
  specContent: string
): Promise<DeepSpecAnalysis | null> {
  if (!isSamplingSupported(server)) return null;

  // Truncate spec to keep tokens reasonable; the deep patterns are usually
  // surfaced in tables/notes, not deep code blocks.
  const trimmed =
    specContent.length > 12_000
      ? specContent.slice(0, 12_000) + '\n\n[... truncated ...]'
      : specContent;

  const result = await requestSampling(server, {
    systemPrompt:
      'You extract structural patterns from a form specification. Reply ONLY ' +
      'in JSON matching this schema: ' +
      '{"crossStepCascades":string[],"conditionalGroups":[{"flag":string,"affects":string[]}],"hiddenSteps":[{"step":string,"condition":string}]}. ' +
      'No prose.',
    userPrompt:
      'Find these patterns in the spec below:\n' +
      '1. Cross-step computed cascades (step1.foo → step2.bar → step3.baz). List as arrows in `crossStepCascades`.\n' +
      '2. Conditional groups: a single boolean flag that hides several fields at once.\n' +
      '3. Hidden steps: an entire step section that is shown only when some condition holds.\n\n' +
      'Spec:\n```markdown\n' +
      trimmed +
      '\n```\n\n' +
      'Reply JSON only.',
    maxTokens: 768,
    intelligencePriority: 0.7,
  });

  if (!result.ok) return null;
  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<DeepSpecAnalysis>;
    return {
      crossStepCascades: Array.isArray(parsed.crossStepCascades)
        ? parsed.crossStepCascades.filter((s) => typeof s === 'string')
        : [],
      conditionalGroups: Array.isArray(parsed.conditionalGroups)
        ? parsed.conditionalGroups.filter(
            (g): g is { flag: string; affects: string[] } =>
              !!g && typeof g.flag === 'string' && Array.isArray(g.affects)
          )
        : [],
      hiddenSteps: Array.isArray(parsed.hiddenSteps)
        ? parsed.hiddenSteps.filter(
            (h): h is { step: string; condition: string } =>
              !!h && typeof h.step === 'string' && typeof h.condition === 'string'
          )
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Render `DeepSpecAnalysis` into a markdown block suitable for embedding into
 * the plan-form output. Returns an empty string when the analysis is null or
 * empty across all categories.
 */
export function renderDeepAnalysisBlock(analysis: DeepSpecAnalysis | null): string {
  if (!analysis) return '';
  const isEmpty =
    analysis.crossStepCascades.length === 0 &&
    analysis.conditionalGroups.length === 0 &&
    analysis.hiddenSteps.length === 0;
  if (isEmpty) return '';

  const lines: string[] = ['## LLM-extracted complex patterns', ''];
  if (analysis.crossStepCascades.length > 0) {
    lines.push('### Cross-step cascades');
    for (const c of analysis.crossStepCascades) lines.push(`- ${c}`);
    lines.push('');
  }
  if (analysis.conditionalGroups.length > 0) {
    lines.push('### Conditional groups (one flag, multiple fields)');
    for (const g of analysis.conditionalGroups) {
      lines.push(`- **${g.flag}** → ${g.affects.join(', ')}`);
    }
    lines.push('');
  }
  if (analysis.hiddenSteps.length > 0) {
    lines.push('### Hidden steps');
    for (const h of analysis.hiddenSteps) {
      lines.push(`- **${h.step}** if \`${h.condition}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}
