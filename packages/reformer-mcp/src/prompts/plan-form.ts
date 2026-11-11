import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  detectProjectStack,
  renderStackDetectionBlockAsync,
} from '../platform/cli/project-detector.js';
import {
  countFieldsPerStep,
  countSteps,
  extractApiEndpoints,
  extractArrays,
  extractComputedFields,
  extractConditionalFields,
  extractFormName,
} from '../core/spec/analyze.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';
import {
  deepAnalyzeSpec,
  inferTarget,
  isReformerTarget,
  renderDeepAnalysisBlock,
  type ReformerTarget,
} from '../platform/cli/sampling-helpers.js';
import { TARGET_NOTE } from './create-form.js';

/**
 * Промпт `plan-form` — форма по markdown-спеке.
 *
 * С 7.0 он ведёт к одному пути: `plan_form` пишет черновик intent, агент дописывает его по спеке,
 * `form_build` собирает модуль. Прежний текст был планом ручной разработки — стадии субагентов,
 * сборка модуля руками (аудит 2026-11, A1). Сводка спеки (шаги, условные и вычисляемые поля,
 * массивы, API) осталась: по ней агент сверяет черновик.
 */
export const planFormPromptDefinition = {
  name: 'plan-form',
  description:
    'Build a @reformer form from a markdown spec: a summary of the spec (steps, conditional and computed fields, arrays, API), then plan_form drafts form.intent.json and form_build builds it.',
  arguments: [
    {
      name: 'specPath',
      description:
        'Markdown spec of the form, absolute or relative to the working directory. E.g. docs/specs/credit-application-form.md',
      required: true,
    },
    {
      name: 'target',
      description: 'Stack: "core" | "renderer-react" | "renderer-json". Default "core".',
      required: false,
    },
    {
      name: 'projectPath',
      description:
        'Project folder whose package.json is used to detect the stack (as in create-form). Default: the server working directory.',
      required: false,
    },
  ],
};

interface SpecAnalysis {
  formName: string;
  totalFields: number;
  steps: number;
  fieldsPerStep: Record<string, number>;
  conditionalFields: string[];
  computedFields: string[];
  arrays: string[];
  apiEndpoints: string[];
  hasCanonicalLabels: boolean;
  hasMasks: boolean;
}

function resolveSpecPath(specPath: string): string | null {
  if (existsSync(specPath)) return specPath;
  const cwdRelative = resolve(process.cwd(), specPath);
  if (existsSync(cwdRelative)) return cwdRelative;
  return null;
}

function analyzeSpec(content: string): SpecAnalysis {
  const formName = extractFormName(content);
  const steps = countSteps(content);
  const fieldsPerStep = countFieldsPerStep(content);
  const totalFields = Object.values(fieldsPerStep).reduce((a, b) => a + b, 0);
  const conditionalFields = extractConditionalFields(content);
  const computedFields = extractComputedFields(content);
  const arrays = extractArrays(content);
  const apiEndpoints = extractApiEndpoints(content);
  const hasCanonicalLabels = /## Canonical user-facing strings/i.test(content);
  const hasMasks = /InputMask|маска|mask:\s*['"`]/.test(content);

  return {
    formName,
    totalFields,
    steps,
    fieldsPerStep,
    conditionalFields,
    computedFields,
    arrays,
    apiEndpoints,
    hasCanonicalLabels,
    hasMasks,
  };
}

/** Перечень до `limit` имён и «+N» за ним; пусто — `none found`. */
function listed(names: readonly string[], limit = 12): string {
  if (names.length === 0) return 'none found';
  return (
    names.slice(0, limit).join(', ') + (names.length > limit ? ` (+${names.length - limit})` : '')
  );
}

/** Секции грамматики, которые нужны этой спеке. */
function sectionsFor(spec: SpecAnalysis): string {
  const sections = ['behavior', 'cross'];
  if (spec.steps > 0) sections.unshift('wizard');
  if (spec.arrays.length > 0) sections.unshift('arrays');
  if (spec.apiEndpoints.length > 0) sections.push('async', 'operators', 'nodes');
  return sections.map((name) => `\`${name}\``).join(', ');
}

function buildPlanVars(
  spec: SpecAnalysis,
  stackBlock: string,
  target: ReformerTarget,
  specPathRel: string
): Record<string, unknown> {
  const stepsLine =
    spec.steps > 0
      ? `Wizard of ${spec.steps} steps (${Object.entries(spec.fieldsPerStep)
          .map(([step, count]) => `${step}: ${count}`)
          .join(', ')})`
      : 'Single page';

  return {
    formName: spec.formName,
    totalFields: spec.totalFields,
    stepsLine,
    conditionalLine: listed(spec.conditionalFields),
    computedLine: listed(spec.computedFields),
    arraysLine: listed(spec.arrays),
    apiLine: spec.apiEndpoints.length > 0 ? spec.apiEndpoints.join('; ') : 'none found',
    canonicalLine: spec.hasCanonicalLabels
      ? 'The spec has a table of canonical user-facing strings: use it literally for labels, placeholders and messages.'
      : 'The spec has no table of canonical strings: take texts from the field tables; ask the orchestrator rather than invent.',
    masksLine: spec.hasMasks
      ? 'Masked fields found: `InputMask` with `componentProps.mask`.'
      : 'No input masks mentioned.',
    stackBlock,
    target,
    specPathRel,
    sectionsLine: sectionsFor(spec),
    targetNote: TARGET_NOTE[target],
  };
}

export async function getPlanFormPrompt(
  args: { specPath: string; target?: string; projectPath?: string },
  server?: Server
): Promise<{
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
}> {
  // MCP Server не валидирует args по inputSchema — обязательный `specPath` может прийти
  // отсутствующим/не-строкой. Без guard'а resolveSpecPath() бросает на
  // `resolve(cwd, undefined)`, ошибка уходит в диспетчер и клиент видит пустой ответ
  // (ср. паттерн guard'а в find-recipe.ts). Возвращаем внятное сообщение вместо throw.
  if (typeof args.specPath !== 'string' || !args.specPath.trim()) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `❌ **plan-form: the required argument \`specPath\` is missing**

plan-form builds a form from a markdown spec. Pass \`specPath\` — absolute or relative to \`${process.cwd()}\`, e.g. \`docs/specs/credit-application-form.md\`; optionally \`target\` (\`core\` | \`renderer-react\` | \`renderer-json\`) and \`projectPath\`. Without a spec, use the prompt \`create-form\`.`,
          },
        },
      ],
    };
  }

  const resolvedSpecPath = resolveSpecPath(args.specPath);

  if (!resolvedSpecPath) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `❌ **plan-form: spec not found**

\`specPath: "${args.specPath}"\` exists neither as an absolute path nor relative to \`${process.cwd()}\`. Check the path (in a monorepo — from the repo root, e.g. \`docs/specs/credit-application-form.md\`) or ask the orchestrator for it.`,
          },
        },
      ],
    };
  }

  let specContent: string;
  try {
    specContent = readFileSync(resolvedSpecPath, 'utf-8');
  } catch (err) {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `❌ **plan-form: the spec cannot be read**

\`${resolvedSpecPath}\`: ${err instanceof Error ? err.message : String(err)}`,
          },
        },
      ],
    };
  }

  const spec = analyzeSpec(specContent);
  const stack = detectProjectStack(args.projectPath);

  // Auto-detect target via sampling unless caller pinned it; an unknown value is not passed on.
  const pinned = args.target ? args.target.toLowerCase() : undefined;
  const target: ReformerTarget = isReformerTarget(pinned)
    ? pinned
    : server
      ? await inferTarget(server, { description: spec.formName, stack })
      : 'core';

  // Run stack-block discovery + deep spec analysis in parallel — both are
  // best-effort sampling calls and gracefully no-op when unsupported.
  const [stackBlock, deep] = await Promise.all([
    renderStackDetectionBlockAsync(stack, server),
    server ? deepAnalyzeSpec(server, specContent) : Promise.resolve(null),
  ]);

  const vars = buildPlanVars(spec, stackBlock, target, args.specPath);
  vars.deepAnalysisBlock = renderDeepAnalysisBlock(deep);
  const text = renderPromptTemplate('plan-form', vars);

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}
