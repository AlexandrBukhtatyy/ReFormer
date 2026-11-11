/**
 * Tool `plan_form` — черновик `form.intent.json` по спеке (профиль node).
 *
 * Черновик пишется на диск, в `<dir>/form.intent.json`, а ответ — короткая сводка: что разобрано и
 * что дописать руками. Раньше intent возвращался текстом, и большой JSON проходил через модель
 * дважды: она читала его из ответа и печатала в файл заново (аудит 2026-11, A1/A3). Существующий
 * файл не перезаписывается: черновик — начало работы, а не её замена.
 *
 * Разбора свободного описания больше нет: регулярками из текста извлекалась пустая форма
 * («Unknown form», ноль полей), и инструмент отвечал ✓ на ничто. По описанию intent пишет сам агент
 * по грамматике `form_build {"grammar":"base"}`.
 *
 * В профиле browser инструмента нет: прежний `plan_form` воркера отдавал intent текстом для
 * удалённого в 7.0 `generate_form`, а форму в конструкторе собирает его ассистент.
 *
 * @module reformer-mcp/core/tools/plan-form
 */

import { catalogsOf } from '../generate/catalogs.js';
import { readIntent, readTargetStack, type FormIntent } from '../generate/form-intent.js';
import { formatIntentJson } from '../generate/intent-format.js';
import { intentFromAnalysis } from '../generate/from-spec.js';
import type { Knowledge } from '../knowledge.js';
import { analyzeSpec, type SpecAnalysis } from '../spec/analyze.js';
import { invalidCall, type ToolTextResult } from './tool-result.js';
import { INTENT_FILE } from './form-build.js';

export const planFormToolDefinition = {
  name: 'plan_form',
  description:
    'Draft <dir>/form.intent.json from a markdown form spec: fields with types and components, validation from the spec tables, wizard steps, arrays. The draft is written to disk (an existing file is never overwritten); the answer is a short summary and what to finish by hand. Then edit the intent and call form_build.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      specPath: {
        type: 'string',
        description: 'Markdown spec, absolute or relative to the working directory.',
      },
      dir: {
        type: 'string',
        description: 'Form folder for the draft, as in form_build (default "form").',
      },
      target: {
        type: 'string',
        description: 'Stack from the task: core | renderer-react | renderer-json (default core).',
      },
    },
    required: ['specPath'],
  },
};

export interface PlanFormArgs {
  specPath?: unknown;
  dir?: unknown;
  target?: unknown;
  /** Аргумент 6.x: принимается только для понятного отказа. */
  description?: unknown;
}

/** Сколько пунктов «дописать руками» печатать в ответе. */
const WARNINGS_SHOWN = 12;

function text(message: string): ToolTextResult {
  return { content: [{ type: 'text', text: message }] };
}

/** Сводка разбора одной строкой: что и сколько нашлось. */
function summary(intent: FormIntent, analysis: SpecAnalysis): string {
  const parts = [`${intent.fields.length} fields`];
  if (analysis.steps > 0) parts.push(`${analysis.steps} steps`);
  if (intent.arrays.length > 0) parts.push(`${intent.arrays.length} arrays`);
  if (intent.validation.length > 0) parts.push(`${intent.validation.length} validation rows`);
  if (analysis.conditionalFields.length > 0) {
    parts.push(`${analysis.conditionalFields.length} conditional fields`);
  }
  if (analysis.computedFields.length > 0) {
    parts.push(`${analysis.computedFields.length} computed fields`);
  }
  return parts.join(', ');
}

/**
 * Черновик без служебного: `warnings` — заметки разбора, они уходят в ответ, а не в файл. В файле
 * они остались бы навсегда и печатались бы предупреждениями каждой сборки.
 */
function draftOf(intent: FormIntent): Record<string, unknown> {
  const { warnings: _warnings, ...rest } = intent;
  return rest as unknown as Record<string, unknown>;
}

/** `plan_form` профиля node: черновик на диск, сводка в ответ. */
export async function planFormTool(args: PlanFormArgs, k: Knowledge): Promise<ToolTextResult> {
  if (args?.description !== undefined && args.specPath === undefined) {
    return invalidCall(
      '✗ plan_form: "description" is not supported since @reformer/mcp 7.0 — free text gave an ' +
        'empty draft. Write form.intent.json yourself: get the grammar with form_build ' +
        '{"grammar":"base"}, then call form_build {"dir":"<form folder>"}.'
    );
  }
  const specPath = typeof args?.specPath === 'string' ? args.specPath.trim() : '';
  if (!specPath) {
    return invalidCall(
      '✗ plan_form: "specPath" is required — a markdown spec of the form. Without a spec, write ' +
        'form.intent.json by the grammar from form_build {"grammar":"base"}.'
    );
  }
  if (args.dir !== undefined && (typeof args.dir !== 'string' || !args.dir.trim())) {
    return invalidCall('✗ plan_form: "dir" is a non-empty path of the form folder.');
  }

  const spec = k.spec.read(specPath);
  if (spec === null) {
    return invalidCall(
      `✗ plan_form: spec not found — \`${specPath}\` exists neither as an absolute path nor ` +
        `relative to ${k.spec.describe?.() ?? 'the working directory'}.`
    );
  }

  const opened = k.forms.open(typeof args.dir === 'string' ? args.dir : null);
  if (!opened.ok) return invalidCall(`✗ plan_form: form folder — ${opened.reason}`);
  const { directory } = opened;
  const file = `${directory.label}/${INTENT_FILE}`;
  if (directory.read(INTENT_FILE) !== null) {
    return invalidCall(
      `✗ plan_form: ${file} already exists and is never overwritten. Edit it and call ` +
        `form_build {"dir":"${directory.label}"}, or delete it to draft again.`
    );
  }

  const analysis = analyzeSpec(spec);
  const { uiKit } = await catalogsOf(k);
  const intent = intentFromAnalysis(analysis, readTargetStack(args.target) ?? 'core', uiKit);
  const draft = draftOf(intent);
  // Свой черновик сервер обязан уметь прочитать: проблема здесь — дефект разбора спеки, и о ней
  // сказано в ответе, а не обнаружено первой сборкой.
  const { problems } = readIntent(draft, { uiKit });
  directory.write(INTENT_FILE, formatIntentJson(draft));

  const lines = [
    `✓ plan_form: drafted ${file} from ${specPath} — ${summary(intent, analysis)}.`,
    '',
    'The draft is partial: field types without a type column are guessed by name; formulas of ' +
      'computed fields and visibility rules are not extracted — add them by the spec.',
  ];
  if (intent.warnings.length > 0) {
    lines.push('', `Finish by hand (${intent.warnings.length}):`);
    for (const warning of intent.warnings.slice(0, WARNINGS_SHOWN)) lines.push(`- ${warning}`);
    if (intent.warnings.length > WARNINGS_SHOWN) {
      lines.push(`- … ${intent.warnings.length - WARNINGS_SHOWN} more of the same kind.`);
    }
  }
  if (problems.length > 0) {
    lines.push('', `The draft does not read cleanly (${problems.length}) — fix these records:`);
    for (const p of problems.slice(0, WARNINGS_SHOWN)) lines.push(`- \`${p.at}\` — ${p.message}`);
  }
  lines.push(
    '',
    `Next: edit ${file} (grammar: form_build {"grammar":"base"}), then form_build ` +
      `{"dir":"${directory.label}"}.`
  );
  return text(lines.join('\n'));
}
