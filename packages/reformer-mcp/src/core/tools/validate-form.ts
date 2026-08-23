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
import type { Knowledge } from '../knowledge.js';
import { renderDiagnostics, type Diagnostic } from '../validate/codes.js';
import { findCycle, type Dependency } from '../utils/graph.js';
import { crossCheckBundle } from '../generate/cross-check.js';
import { normalizeIntent, type FormIntent } from '../generate/form-intent.js';
import { validateJsonSchemaTool } from './validate-json-schema.js';

export const validateFormToolDefinition = {
  name: 'validate_form',
  description:
    'Check a ReFormer form before running it. kind="code": generated TS — unknown or wrongly imported @reformer symbols, operators called outside their schema, deprecated API. kind="json-schema": the layout DSL. kind="behaviors": compute cycles. kind="bundle": a whole FormIntent + layout, cross-checked against each other. Returns RF0xx diagnostics with line, what to do and the next call to make.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      kind: {
        type: 'string',
        description: 'code | json-schema | behaviors | bundle',
      },
      code: { type: 'string', description: 'kind=code: the TypeScript to check.' },
      schema: {
        description: 'kind=json-schema | bundle: the layout schema (object or JSON string).',
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
      intent: { type: 'object', description: 'kind=bundle: the FormIntent behind the schema.' },
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
  intent?: Partial<FormIntent>;
  componentNames?: string[];
  dataSourceNames?: string[];
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

export async function validateFormTool(
  args: ValidateFormArgs,
  k: Knowledge
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const kind = String(args.kind ?? '').trim();

  switch (kind) {
    case 'code': {
      if (typeof args.code !== 'string' || !args.code.trim()) {
        return text(
          'Для `kind: "code"` нужен непустой аргумент `code` — текст проверяемого модуля.'
        );
      }
      const { diagnostics, limitations } = await validateCode(k, args.code);
      return text(report('code', diagnostics, limitations));
    }

    case 'behaviors': {
      const deps = Array.isArray(args.dependencies) ? args.dependencies : [];
      if (deps.length === 0) {
        return text(
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
        return text('Каждая зависимость — строковый `target` и массив строк `reads`.');
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
        return text('Для `kind: "json-schema"` нужен аргумент `schema`.');
      }
      // Структурную проверку делает ajv внутри @reformer/renderer-json — переиспользуем её
      // как есть, а не переписываем: источник истины о формате DSL находится там.
      return validateJsonSchemaTool({
        schema: args.schema,
        componentNames: args.componentNames,
        dataSourceNames: args.dataSourceNames,
      });
    }

    case 'bundle': {
      if (!args.intent || args.schema === undefined) {
        return text(
          'Для `kind: "bundle"` нужны и `intent`, и `schema` — проверка сверяет их между собой.'
        );
      }
      let schema = args.schema;
      if (typeof schema === 'string') {
        try {
          schema = JSON.parse(schema);
        } catch (e) {
          return text(`Аргумент \`schema\` — строка, но не валидный JSON: ${(e as Error).message}`);
        }
      }
      const intent = normalizeIntent(args.intent);
      const cross = crossCheckBundle(intent, schema);
      const diagnostics: Diagnostic[] = [
        ...cross.errors.map((e) => toDiagnostic(e.code, 'error', e.message)),
        ...cross.warnings.map((w) => toDiagnostic(w.code, 'warning', w.message)),
      ];
      return text(
        report('bundle', diagnostics, [
          'Сверяются intent и layout между собой; сам TypeScript не проверяется — для него `kind: "code"`.',
        ])
      );
    }

    default:
      return text(
        'Аргумент `kind` обязателен: `code` | `json-schema` | `behaviors` | `bundle`. ' +
          'Что именно проверять — зависит от того, что у вас на руках: текст модуля, layout-схема, ' +
          'объявленные зависимости или целый бандл.'
      );
  }
}

/** Коды кросс-проверки C1..C9 → коды диагностик RF0xx. */
function toDiagnostic(code: string, severity: 'error' | 'warning', message: string): Diagnostic {
  const map: Record<string, Diagnostic['code']> = {
    C1: 'RF001',
    C2: 'RF008',
    C3: 'RF009',
    C4: 'RF004',
    C5: 'RF005',
    C6: 'RF007',
    C7: 'RF006',
    C8: 'RF007',
    C9: 'RF001',
  };
  return { code: map[code] ?? 'RF001', severity, message };
}
