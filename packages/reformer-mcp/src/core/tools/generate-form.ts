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

import {
  readIntent,
  readTargetStack,
  type FormIntent,
  type IntentProblem,
} from '../generate/form-intent.js';
import { buildBundle, renderLayoutChecklist, renderLayoutLine } from '../generate/builders.js';
import { crossCheckBundle } from '../generate/cross-check.js';
import { intentFromAnalysis } from '../generate/from-spec.js';
import { analyzeSpec } from '../spec/analyze.js';
import type { Knowledge } from '../knowledge.js';

export const planFormToolDefinition = {
  name: 'plan_form',
  description:
    'Turn a form spec (markdown file) or a description into a FormIntent: the machine-readable plan — fields, arrays, validation rules, behaviours, layout — that generate_form compiles into a file bundle. Review and edit the intent before generating. Form-module file names are fixed by convention: the result lists them; full rule — find_recipe directory-layout, check yours with validate_form kind="layout".',
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
    'Compile a FormIntent into a form bundle (model.ts, validation.ts, form.behavior.ts, layout, registry) and cross-check the files against each other: every $model path exists in the model, every $component is registered, every rule and behaviour targets a real path, no compute cycles. Returns a manifest — you write the files yourself, under the canonical file names it prints for the target (rule: find_recipe directory-layout).',
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
  /** Что угодно: разбором занимается `readIntent`, а не система типов вызывающего. */
  intent: unknown;
  target?: string;
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}

function resolveTarget(value: unknown): FormIntent['target'] {
  return readTargetStack(value) ?? 'core';
}

/** Строка проблемы: место — что не так — какой вид ожидается. */
function renderProblem(p: IntentProblem): string {
  return `- \`${p.at}\` — ${p.message}. Ожидается: ${p.expected}`;
}

export async function planFormTool(
  args: PlanFormArgs,
  k: Knowledge
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const spec = args.specPath ? k.spec.read(args.specPath) : null;
  if (args.specPath && spec === null) {
    return text(
      `# plan_form — спека не найдена\n\nПуть \`${args.specPath}\` не существует ни как абсолютный, ` +
        `ни относительно \`${k.spec.describe?.() ?? 'рабочего каталога'}\`. Передайте путь от корня репозитория.`
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
  // Одна строка про раскладку — здесь, а не только в описании инструмента: описания читают
  // бегло, результат — внимательно, и именно на этом шаге агент решает, какие файлы заводить.
  // Имена берутся из `FORM_LAYOUT_CANON` общим хелпером, чтобы копия не разошлась с каноном.
  lines.push(renderLayoutLine(intent.target));
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

/**
 * Инструмент никогда не бросает.
 *
 * У MCP непойманное исключение доезжает до консумента как `-32603` с текстом вида «Cannot read
 * properties of undefined (reading 'split')»: ни поля, ни причины, ни следующего шага — для
 * агента это тупик, а именно к раннему вызову `generate_form` его подталкивают описания
 * инструментов. Разбор входа диагностирует сам (`readIntent`), а этот перехват страхует всё
 * остальное: любой дефект сборки выходит объяснённым текстом, а не кодом ошибки протокола.
 */
export async function generateFormTool(
  args: GenerateFormArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  if (args?.intent === undefined || args.intent === null) {
    return text('Нужен аргумент `intent` (объект FormIntent). Получить его можно из `plan_form`.');
  }
  try {
    return buildManifest(args);
  } catch (e) {
    return text(
      [
        '# generate_form — бандл собрать не удалось',
        '',
        `Внутренняя ошибка сборки: \`${(e as Error).message}\`.`,
        '',
        'Это дефект сервера, а не вашего вызова. Обходной путь: возьмите intent у `plan_form` ' +
          '(по `specPath` или `description`) и передайте его как есть — этот путь заведомо ' +
          'согласован с контрактом. Сам вход можно сверить `validate_form kind="bundle"`, ' +
          'а поломку — прислать через `report_issue`.',
      ].join('\n')
    );
  }
}

function buildManifest(args: GenerateFormArgs): {
  content: Array<{ type: 'text'; text: string }>;
} {
  const { intent, problems } = readIntent(args.intent);
  if (args.target) {
    const override = readTargetStack(args.target);
    if (override) intent.target = override;
    else {
      intent.warnings.push(
        `Аргумент \`target: "${args.target}"\` не распознан — бандл собран для ` +
          `\`${intent.target}\` (допустимы core | renderer-react | renderer-json).`
      );
    }
  }

  // Читать было нечего: печатать пустой каркас поверх нераспознанного входа — значит выдать
  // за результат то, чего консумент не просил. Вместо этого — что именно не прочиталось.
  if (problems.length > 0 && intent.fields.length === 0 && intent.arrays.length === 0) {
    return text(
      [
        '# generate_form — intent прочитать не удалось',
        '',
        'Ни одного поля разобрать не получилось, поэтому собирать нечего.',
        '',
        ...problems.map(renderProblem),
        '',
        'Короткий путь: `plan_form` со `specPath` или `description` отдаёт готовый FormIntent — ' +
          'его можно передать сюда как есть.',
      ].join('\n')
    );
  }

  const { files, warnings, layoutJson } = buildBundle(intent);

  // Проверяем layout как ДАННЫЕ, а не файл с расширением `.json`. Для renderer-json схема
  // теперь отдаётся каноничным `renderer.schema.ts`, и поиск по расширению молча выключил бы
  // кросс-проверку: манифест печатал бы «✅ пройдена», не проверив ничего.
  const report = crossCheckBundle(intent, JSON.parse(layoutJson));

  const lines: string[] = [];
  lines.push(`# generate_form: ${intent.formName} (${intent.target})`);
  lines.push('');
  lines.push(
    report.ok
      ? `✅ Кросс-проверка пройдена: ${files.length} файл(ов).`
      : `❌ Кросс-проверка не пройдена: ${report.errors.length} ошиб(ок). Файлы ниже — с этими ошибками.`
  );
  // Заголовок читают всегда, разделы — не всегда: молчание о выброшенных записях читалось бы
  // как «прочитано целиком», а бандл при этом собран не из всего, что прислали.
  if (problems.length > 0) {
    lines.push(`⚠️ Из intent выброшено записей: ${problems.length} — разбор ниже.`);
  }

  // Проблемы разбора идут ПЕРЕД кросс-проверкой: выброшенная запись объясняет часть её ошибок
  // (правило на поле, которое не прочиталось), и читать их надо в этом порядке.
  if (problems.length > 0) {
    lines.push('');
    lines.push('## Intent — что прочитать не удалось');
    lines.push('');
    lines.push(
      `Записей выброшено: ${problems.length}; остальное собрано ниже. Готовый intent без ручной ` +
        'сборки отдаёт `plan_form`.'
    );
    lines.push('');
    for (const p of problems) lines.push(renderProblem(p));
  }

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
  lines.push(
    renderLayoutChecklist(
      intent.target,
      files.map((f) => f.path)
    )
  );

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
