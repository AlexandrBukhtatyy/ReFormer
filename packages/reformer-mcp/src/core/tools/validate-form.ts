/**
 * Tool `validate_form` — одна дверь во все проверки формы.
 *
 * Раньше их было две и они жили порознь: `validate_json_schema` (структура layout) и
 * `check_behaviors` (циклы). Агенту приходилось знать, какая из них про его случай, и звать
 * их по очереди. Здесь вид проверки — это аргумент, а результат всегда одной формы:
 * список диагностик с кодом `RF0xx`, местом и готовым следующим вызовом.
 *
 * Единый формат — не косметика. Он превращает ответ сервера из текста, который модель
 * перечитывает целиком, в перечень действий: что не так, где и чем это выяснить.
 */

import { validateCode } from '../validate/code.js';
import {
  inferLayoutTarget,
  renderFoldersCanon,
  renderLayoutCanon,
  resolveLayoutTarget,
  validateLayout,
} from '../validate/layout.js';
import type { Knowledge } from '../knowledge.js';
import { renderDiagnostics, type Diagnostic } from '../validate/codes.js';
import { findCycle, type Dependency } from '../utils/graph.js';
import { catalogsOf } from '../generate/catalogs.js';
import { judgeIntent, type JudgeFinding } from '../generate/judge.js';
import { validateJsonSchemaTool } from './validate-json-schema.js';
import { invalidCall } from './tool-result.js';

export const validateFormToolDefinition = {
  name: 'validate_form',
  description:
    'Check a ReFormer form before running it. kind="code": generated TS — unknown or wrongly imported @reformer symbols, operators called outside their schema, deprecated API. kind="json-schema": the layout DSL. kind="behaviors": compute cycles. kind="bundle": a whole FormIntent + layout, cross-checked against each other. kind="layout": form-module FILE NAMES against the canonical per-target set (files[] + target) — catches schema.ts / render-behavior.ts drift, accepts the optional steps/<slug>/ wizard folders, flags former renderer.* names as warnings, and names the expected file; run it before writing them. Returns RF0xx diagnostics with line, what to do and the next call to make.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      kind: {
        type: 'string',
        description: 'code | json-schema | behaviors | bundle | layout',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description:
          'kind=layout: file names or paths of the form module (a common leading directory is stripped).',
      },
      target: {
        type: 'string',
        description:
          'kind=layout: core | renderer-react | renderer-json; inferred from files when omitted.',
      },
      code: { type: 'string', description: 'kind=code: the TypeScript to check.' },
      // Тип объявлен явно: схема без ключевых слов принимает что угодно, и `tools/list --strict`
      // MCP Inspector отмечал её как непереносимую (калибровка, smoke S02).
      schema: {
        anyOf: [{ type: 'object', additionalProperties: true }, { type: 'string' }],
        description:
          'kind=json-schema: the layout schema (object or JSON string). kind=bundle: optional — the ' +
          'schema to check the intent against; without it, the schema the build would make.',
      },
      dependencies: {
        type: 'array',
        description: 'kind=behaviors: one entry per computed field — { target, reads[] }.',
        items: {
          type: 'object',
          properties: {
            target: { type: 'string' },
            reads: { type: 'array', items: { type: 'string' } },
          },
          required: ['target', 'reads'],
        },
      },
      intent: {
        anyOf: [{ type: 'object', additionalProperties: true }, { type: 'string' }],
        description:
          'kind=bundle: the FormIntent (object or JSON string) — judged as form_build judges it.',
      },
      componentNames: {
        type: 'array',
        items: { type: 'string' },
        description: 'Registry component names.',
      },
      dataSourceNames: {
        type: 'array',
        items: { type: 'string' },
        description: 'Registry data-source names.',
      },
    },
    required: ['kind'],
  },
};

export interface ValidateFormArgs {
  kind?: string;
  code?: string;
  schema?: unknown;
  dependencies?: Dependency[];
  intent?: unknown;
  componentNames?: string[];
  dataSourceNames?: string[];
  /** kind=layout: имена или пути файлов модуля формы. */
  files?: string[];
  /** kind=layout: `core` | `renderer-react` | `renderer-json`. */
  target?: string;
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}

/** Заголовок отчёта: сразу видно, проходит проверка или нет и чего именно не хватает. */
function report(kind: string, diagnostics: Diagnostic[], notes: string[] = []): string {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const lines: string[] = [];

  lines.push(
    errors.length === 0
      ? `# validate_form (${kind}) — ✅ ошибок нет${warnings.length ? `, предупреждений ${warnings.length}` : ''}`
      : `# validate_form (${kind}) — ❌ ошибок ${errors.length}${warnings.length ? `, предупреждений ${warnings.length}` : ''}`
  );

  if (errors.length > 0) {
    lines.push('');
    lines.push('## Errors');
    lines.push(renderDiagnostics(errors));
  }
  if (warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    lines.push(renderDiagnostics(warnings));
  }
  if (notes.length > 0) {
    lines.push('');
    // Ограничения печатаем ВСЕГДА, в том числе при «ошибок нет»: иначе чистый отчёт
    // прочитается как «код верен», хотя проверка видит не всё.
    lines.push('## Что эта проверка НЕ видит');
    for (const n of notes) lines.push(`- ${n}`);
  }
  return lines.join('\n');
}

export interface ValidateFormOptions {
  /** Есть ли у сервера `form_build`: в воркере билдера его нет, и советовать его нельзя. */
  formBuild?: boolean;
}

export async function validateFormTool(
  args: ValidateFormArgs,
  k: Knowledge,
  options: ValidateFormOptions = {}
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const kind = String(args.kind ?? '').trim();

  switch (kind) {
    case 'code': {
      if (typeof args.code !== 'string' || !args.code.trim()) {
        return invalidCall(
          'Для `kind: "code"` нужен непустой аргумент `code` — текст проверяемого модуля.'
        );
      }
      const { diagnostics, limitations } = await validateCode(k, args.code);
      return text(report('code', diagnostics, limitations));
    }

    case 'behaviors': {
      const deps = Array.isArray(args.dependencies) ? args.dependencies : [];
      if (deps.length === 0) {
        return invalidCall(
          'Для `kind: "behaviors"` нужен непустой массив `dependencies` — `{ target, reads[] }`.'
        );
      }
      const malformed = deps.some(
        (d) =>
          typeof d?.target !== 'string' ||
          !Array.isArray(d?.reads) ||
          d.reads.some((r) => typeof r !== 'string')
      );
      if (malformed) {
        return invalidCall('Каждая зависимость — строковый `target` и массив строк `reads`.');
      }
      const diagnostics: Diagnostic[] = [];
      for (const d of deps) {
        if (d.reads.includes(d.target)) {
          diagnostics.push({
            code: 'RF006',
            severity: 'warning',
            message: `\`${d.target}\` читает сам себя — это немедленный цикл.`,
            suggestion: 'Поведение должно читать ДРУГИЕ поля и писать своё.',
          });
        }
      }
      const cycle = findCycle(deps);
      if (cycle) {
        diagnostics.push({
          code: 'RF006',
          severity: 'error',
          message: `Цикл: ${cycle.join(' → ')}. Рантайм бросит «Cycle detected».`,
          suggestion: 'Вычисляйте из независимых источников либо разорвите связь через watchField.',
          fix: { tool: 'find_recipe', arguments: { topic: 'cycle' } },
        });
      }
      return text(report('behaviors', diagnostics));
    }

    case 'json-schema': {
      if (args.schema === undefined) {
        return invalidCall('Для `kind: "json-schema"` нужен аргумент `schema`.');
      }
      // Структурную проверку делает ajv внутри @reformer/renderer-json — переиспользуем её
      // как есть, а не переписываем: источник истины о формате DSL находится там.
      return validateJsonSchemaTool(
        {
          schema: args.schema,
          componentNames: args.componentNames,
          dataSourceNames: args.dataSourceNames,
        },
        k,
        options
      );
    }

    case 'bundle': {
      if (args.intent === undefined || args.intent === null) {
        return invalidCall(
          '`kind: "bundle"` needs `intent` — the FormIntent or its JSON. `schema` is optional: ' +
            'without it the intent is judged against the schema the build would make.'
        );
      }
      let schema = args.schema;
      if (typeof schema === 'string') {
        try {
          schema = JSON.parse(schema);
        } catch (e) {
          return invalidCall(`\`schema\` is a string but not JSON: ${(e as Error).message}`);
        }
      }
      // Вердикт — у того же судьи, что у `form_build`: раньше intent здесь шёл мимо `readIntent` и
      // поля-словарь роняли вызов `-32603` (аудит 2026-11, B2). componentNames/dataSourceNames —
      // реальные ключи реестра: контейнеры (Box, Section) intent не объявляет.
      const catalogs = await catalogsOf(k);
      const verdict = judgeIntent(args.intent, catalogs, {
        requireEnvironment: false,
        ...(schema !== undefined ? { schema } : {}),
        ...(Array.isArray(args.componentNames) ? { componentNames: args.componentNames } : {}),
        ...(Array.isArray(args.dataSourceNames) ? { dataSourceNames: args.dataSourceNames } : {}),
      });
      const diagnostics: Diagnostic[] = [
        ...verdict.errors.map((f) => findingDiagnostic(f, 'error')),
        ...verdict.warnings.map((f) => findingDiagnostic(f, 'warning')),
      ];
      const limits = [
        'The intent and the layout are checked against each other; TypeScript is not — for it ' +
          'use `kind: "code"`, and form_build type-checks the module.',
        ...(catalogs.core.found ? [] : ['The @reformer/core index is not found: rules unchecked.']),
        ...(catalogs.uiKit.found
          ? []
          : ['The @reformer/ui-kit catalog is not found: components unchecked.']),
      ];
      return text(report('bundle', diagnostics, limits));
    }

    case 'layout': {
      const files = (Array.isArray(args.files) ? args.files : []).filter(
        (f): f is string => typeof f === 'string' && f.trim().length > 0
      );
      if (files.length === 0) {
        return invalidCall(
          'Для `kind: "layout"` нужен непустой массив `files` — имена или пути файлов модуля формы ' +
            '(`["index.tsx", "types.ts", "model.ts", "form.schema.ts", …]`) и `target` — ' +
            '`core` | `renderer-react` | `renderer-json`.'
        );
      }

      const explicit = resolveLayoutTarget(args.target);
      const guess = explicit ? null : inferLayoutTarget(files);
      const target = explicit ?? guess?.target ?? null;
      if (!target) {
        return invalidCall(
          'Для `kind: "layout"` нужен `target`: `core` | `renderer-react` | `renderer-json`. ' +
            'Канон раскладки у таргетов разный, а по одному этому списку файлов таргет не определяется.'
        );
      }

      const { diagnostics, limitations, layout } = validateLayout(files, target);
      const parts = [report('layout', diagnostics, limitations)];
      if (guess) {
        // Догадку проговариваем вслух: молчаливо выбранный таргет превращает отчёт
        // в претензии по чужому канону, и опровергнуть их будет нечем. После выравнивания имён
        // (`form.schema.*` у всех таргетов) набор без различающих файлов определяется только
        // наугад — об этом говорится отдельно, а не выдаётся за вывод.
        parts.push(
          guess.certain
            ? `> \`target\` не передан — принят \`${target}\` по составу файлов (${guess.basis}). ` +
                'Если это не так, повторите вызов с явным `target`.'
            : `> \`target\` не передан, а ${guess.basis} — принят \`${target}\` НАУГАД. ` +
                'Отчёт может предъявлять претензии по чужому канону: повторите вызов с явным ' +
                '`target` (`core` | `renderer-react` | `renderer-json`).'
        );
      }
      parts.push(layout === 'folders' ? renderFoldersCanon() : renderLayoutCanon(target));
      return text(parts.join('\n\n'));
    }

    default:
      return invalidCall(
        'Аргумент `kind` обязателен: `code` | `json-schema` | `behaviors` | `bundle` | `layout`. ' +
          'Что именно проверять — зависит от того, что у вас на руках: текст модуля, layout-схема, ' +
          'объявленные зависимости, целый бандл или список файлов модуля.'
      );
  }
}

/** Коды находок судьи → коды диагностик RF0xx. Проблемы чтения intent — RF014. */
const FINDING_RF: Readonly<Record<string, Diagnostic['code']>> = {
  C1: 'RF001',
  C2: 'RF008',
  C3: 'RF009',
  C4: 'RF004',
  C5: 'RF005',
  C6: 'RF007',
  C7: 'RF006',
  C8: 'RF007',
  C9: 'RF001',
  C10: 'RF007',
  C11: 'RF007',
  C12: 'RF001',
  C13: 'RF007',
  unplaced: 'RF007',
  'lost-message': 'RF004',
  'unknown-component': 'RF008',
  'component-props': 'RF008',
  environment: 'RF015',
  'not-on-target': 'RF016',
  'not-in-document': 'RF016',
  'module-note': 'RF001',
};

function findingDiagnostic(
  finding: JudgeFinding<string>,
  severity: 'error' | 'warning'
): Diagnostic {
  return {
    code: FINDING_RF[finding.code] ?? 'RF014',
    severity,
    message: `${finding.code}: ${finding.message}`,
    ...(finding.at ? { path: finding.at } : {}),
    ...(finding.hint ? { suggestion: finding.hint } : {}),
  };
}
