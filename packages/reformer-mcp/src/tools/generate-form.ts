/**
 * Tools `plan_form` и `generate_form` — от требований к проверенному бандлу.
 *
 * `plan_form` отдаёт `FormIntent` как JSON: промежуточный контракт, который человек может
 * прочитать и поправить до того, как из него сгенерируется код. `generate_form` превращает
 * intent в файлы и **проверяет их между собой** — именно кросс-проверка, а не генерация,
 * составляет ценность: типичная поломка мультифайловой формы живёт между файлами и проходит
 * мимо и ajv, и `tsc`.
 *
 * Почему возвращается МАНИФЕСТ, а не запись на диск. Сервер живёт в своём процессе со своим
 * CWD и не знает корня репозитория клиента; `outputDir`, пришедший из модели, может уехать в
 * path traversal. Возврат содержимого отдаёт запись клиенту — через его Write и его
 * permission-гейт. Это же делает инструмент чистым и юнит-тестируемым.
 */

import { normalizeIntent, type FormIntent } from '../generate/form-intent.js';
import { buildBundle } from '../generate/builders.js';
import { crossCheckBundle } from '../generate/cross-check.js';
import { intentFromAnalysis } from '../generate/from-spec.js';
import { analyzeSpec, readSpec } from '../utils/spec-analyzer.js';

export const planFormToolDefinition = {
  name: 'plan_form',
  description:
    'Turn a form spec (markdown file) or a description into a FormIntent: the machine-readable plan — fields, arrays, validation rules, behaviours, layout — that generate_form compiles into a file bundle. Review and edit the intent before generating.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      specPath: {
        type: 'string',
        description: 'Path to a markdown spec, absolute or repo-relative.',
      },
      description: {
        type: 'string',
        description: 'Free-form description, when there is no spec file.',
      },
      target: {
        type: 'string',
        description: 'core | renderer-react | renderer-json (default core).',
      },
    },
    required: [],
  },
};

export const generateFormToolDefinition = {
  name: 'generate_form',
  description:
    'Compile a FormIntent into a form bundle (model.ts, validation.ts, form.behavior.ts, layout, registry) and cross-check the files against each other: every $model path exists in the model, every $component is registered, every rule and behaviour targets a real path, no compute cycles. Returns a manifest — you write the files yourself.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      intent: {
        type: 'object',
        description:
          'FormIntent, typically from plan_form. Partial input is normalised with warnings.',
      },
      target: { type: 'string', description: 'Overrides intent.target.' },
    },
    required: ['intent'],
  },
};

export interface PlanFormArgs {
  specPath?: string;
  description?: string;
  target?: string;
}

export interface GenerateFormArgs {
  intent: Partial<FormIntent>;
  target?: string;
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}

function resolveTarget(value: unknown): FormIntent['target'] {
  return value === 'renderer-react' || value === 'renderer-json' ? value : 'core';
}

export async function planFormTool(
  args: PlanFormArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const spec = args.specPath ? readSpec(args.specPath) : null;
  if (args.specPath && spec === null) {
    return text(
      `# plan_form — спека не найдена\n\nПуть \`${args.specPath}\` не существует ни как абсолютный, ` +
        `ни относительно \`${process.cwd()}\`. Передайте путь от корня репозитория.`
    );
  }
  const source = spec ?? String(args.description ?? '').trim();
  if (!source) {
    return text(
      'Нужен либо `specPath` (markdown-спека), либо `description`. Без источника план строить не из чего.'
    );
  }

  const analysis = analyzeSpec(source);
  const intent = intentFromAnalysis(analysis, resolveTarget(args.target));

  const lines: string[] = [];
  lines.push(`# plan_form: ${intent.formName}`);
  lines.push('');
  lines.push(
    `Разобрано: полей ${intent.fields.length}` +
      (analysis.steps > 0 ? `, шагов ${analysis.steps}` : '') +
      (analysis.conditionalFields.length > 0
        ? `, условных полей ${analysis.conditionalFields.length}`
        : '') +
      (analysis.computedFields.length > 0
        ? `, вычисляемых ${analysis.computedFields.length}`
        : '') +
      (intent.validation.length > 0 ? `, правил валидации ${intent.validation.length}` : '')
  );
  lines.push('');
  // Разбор спеки регулярками — заведомо приблизительный, и об этом надо сказать прямо:
  // intent предназначен для правки человеком, а не для слепой передачи в generate_form.
  // Точность разная по слоям, поэтому названа по слоям, а не одной фразой «всё приблизительно».
  lines.push(
    '> Разбор частичный. Поля, типы и правила валидации взяты из колонок таблицы; там, где ' +
      'колонок нет, тип угадан по имени. Формулы вычисляемых полей и правила видимости ' +
      'НЕ извлекаются — допишите их в intent перед `generate_form`.'
  );
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(intent, null, 2));
  lines.push('```');
  if (intent.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    for (const w of intent.warnings) lines.push(`- ${w}`);
  }
  return text(lines.join('\n'));
}

export async function generateFormTool(
  args: GenerateFormArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  if (!args?.intent || typeof args.intent !== 'object') {
    return text('Нужен аргумент `intent` (объект FormIntent). Получить его можно из `plan_form`.');
  }

  const intent = normalizeIntent({
    ...args.intent,
    target: args.target ? resolveTarget(args.target) : args.intent.target,
  });
  const { files, warnings } = buildBundle(intent);

  const layoutFile = files.find((f) => f.path.endsWith('.json'));
  const report = layoutFile
    ? crossCheckBundle(intent, JSON.parse(layoutFile.content))
    : { ok: true, errors: [], warnings: [] };

  const lines: string[] = [];
  lines.push(`# generate_form: ${intent.formName} (${intent.target})`);
  lines.push('');
  lines.push(
    report.ok
      ? `✅ Кросс-проверка пройдена: ${files.length} файл(ов).`
      : `❌ Кросс-проверка не пройдена: ${report.errors.length} ошиб(ок). Файлы ниже — с этими ошибками.`
  );

  if (report.errors.length > 0) {
    lines.push('');
    lines.push('## Errors');
    for (const e of report.errors) lines.push(`- **${e.code}** ${e.message}`);
  }
  const allWarnings = [
    ...intent.warnings,
    ...warnings,
    ...report.warnings.map((w) => `${w.code}: ${w.message}`),
  ];
  if (allWarnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    for (const w of allWarnings) lines.push(`- ${w}`);
  }

  lines.push('');
  lines.push('## Files');
  lines.push(
    '_Сервер на диск не пишет: создайте их сами, чтобы запись прошла через ваш permission-гейт._'
  );
  for (const file of files) {
    lines.push('');
    lines.push(`### \`${file.path}\``);
    lines.push('```' + (file.path.endsWith('.json') ? 'json' : 'typescript'));
    lines.push(file.content.trimEnd());
    lines.push('```');
  }

  return text(lines.join('\n'));
}
