/**
 * Tool `form_build`: собрать модуль формы на диск из `form.intent.json`.
 *
 * Зачем он при живом `generate_form`. Тот возвращает файлы текстом, и агент печатает их заново:
 * форма кредита стоит два вывода вместо одного, поэтому на больших формах агенты его обходили и
 * писали код вручную, читая справку. Здесь агент правит только intent своими Write и Edit, а сервер
 * компилирует, проверяет и пишет сам, отвечая одной диагностикой. Замер и критерии —
 * `docs/plans/mcp-misty-graham.md`.
 *
 * Запись — «всё или ничего»: при любой ошибке диск не меняется. Запись на диск отдана порту
 * `FormWorkspace`, поэтому в браузерном профиле инструмента нет.
 *
 * @module reformer-mcp/core/tools/form-build
 */

import { buildAssemblyTsx, buildBundle, isLostMessageWarning } from '../generate/builders.js';
import { crossCheckBundle, inspectLayoutRefs } from '../generate/cross-check.js';
import { readIntent } from '../generate/form-intent.js';
import { originOf, withMarker } from '../generate/generated-marker.js';
import { INTENT_GRAMMAR } from '../generate/intent-grammar.js';
import { checkComponentProps, loadUiKitPropSchemas } from '../generate/ui-kit-props.js';
import type { Knowledge } from '../knowledge.js';
import { validateCode } from '../validate/code.js';
import type { FormDirectory, FormFile, TypeDiagnostic } from '../workspace/form-workspace.js';
import { invalidCall, type ToolTextResult } from './tool-result.js';

export const INTENT_FILE = 'form.intent.json';

/** Необязательные файлы сборки: исчезли из бандла — их нетронутая копия удаляется с диска. */
const OPTIONAL_DERIVED = ['form.flow.ts', 'form.messages.ts', 'registry.ts'];

/** Сколько ошибок печатать: дальше агент всё равно правит и собирает заново. */
const MAX_ERRORS = 12;
const MAX_WARNINGS = 10;

export const formBuildToolDefinition = {
  name: 'form_build',
  description:
    'Build a form module on disk from <dir>/form.intent.json: compiles it, cross-checks it, type-checks the result and WRITES all module files itself, returning only diagnostics. You author and edit only form.intent.json with your own Write/Edit. Nothing is written while errors remain. Call it before the intent file exists to get the intent grammar. Keep the requested stack in "target": on core you also write the JSX markup in index.tsx.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dir: {
        type: 'string',
        description: 'Form folder inside the project (default "form").',
      },
    },
    required: [],
  },
};

export interface FormBuildArgs {
  dir?: unknown;
}

function failure(heading: string, items: readonly string[]): ToolTextResult {
  return invalidCall(
    [
      `✗ form_build: ${heading}. Файлы не записаны.`,
      ...items.slice(0, MAX_ERRORS).map((item) => `- ${item}`),
      ...(items.length > MAX_ERRORS ? [`… и ещё ${items.length - MAX_ERRORS}.`] : []),
    ].join('\n')
  );
}

function renderTypeError(diagnostic: TypeDiagnostic): string {
  const place =
    diagnostic.line === null ? diagnostic.file : `${diagnostic.file}:${diagnostic.line}`;
  return `${place} ${diagnostic.message}\n  в строке: ${diagnostic.source}`;
}

/** Что и как лежит на диске после сборки: решение принимается до записи. */
interface BuildPlan {
  /** Модуль целиком, как его увидит компилятор: с файлами, правленными руками. */
  module: FormFile[];
  writes: FormFile[];
  removes: string[];
  unchanged: number;
  /** Файлы с правками: сборка их не трогает и об этом говорит. */
  detached: string[];
}

/**
 * Решить судьбу каждого файла.
 *
 * Производные файлы, включая `index.tsx`, собираются при каждом вызове: иначе точка входа, созданная
 * до появления правил, навсегда осталась бы без провайдера текстов. Файл, правленный руками,
 * отсоединяется. `types.ts` и `api.ts` принадлежат потребителю с первого дня.
 */
function planBuild(directory: FormDirectory, derived: FormFile[], owned: FormFile[]): BuildPlan {
  const plan: BuildPlan = { module: [], writes: [], removes: [], unchanged: 0, detached: [] };
  for (const file of derived) {
    const next = withMarker(file.content);
    const existing = directory.read(file.path);
    if (existing === null) {
      plan.writes.push({ path: file.path, content: next });
      plan.module.push({ path: file.path, content: next });
    } else if (originOf(existing) !== 'generated') {
      plan.detached.push(file.path);
      plan.module.push({ path: file.path, content: existing });
    } else if (existing === next) {
      plan.unchanged += 1;
      plan.module.push({ path: file.path, content: next });
    } else {
      plan.writes.push({ path: file.path, content: next });
      plan.module.push({ path: file.path, content: next });
    }
  }
  for (const file of owned) {
    const existing = directory.read(file.path);
    if (existing === null) plan.writes.push(file);
    plan.module.push({ path: file.path, content: existing ?? file.content });
  }
  const produced = new Set(derived.map((file) => file.path));
  for (const name of OPTIONAL_DERIVED) {
    const existing = produced.has(name) ? null : directory.read(name);
    if (existing !== null && originOf(existing) === 'generated') plan.removes.push(name);
  }
  return plan;
}

/** Запасная проверка без компилятора: импорты несуществующих символов. */
async function checkImports(k: Knowledge, files: readonly FormFile[]): Promise<string[]> {
  const errors: string[] = [];
  for (const file of files) {
    if (!/\.tsx?$/.test(file.path)) continue;
    const { diagnostics } = await validateCode(k, file.content);
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity !== 'error') continue;
      const place = diagnostic.line ? `${file.path}:${diagnostic.line}` : file.path;
      errors.push(`${place} ${diagnostic.code} ${diagnostic.message}`);
    }
  }
  return errors;
}

export async function formBuildTool(args: FormBuildArgs, k: Knowledge): Promise<ToolTextResult> {
  const dir = args?.dir === undefined ? 'form' : args.dir;
  if (typeof dir !== 'string' || !dir.trim()) {
    return invalidCall('✗ form_build: `dir` — непустой путь каталога формы внутри проекта.');
  }
  const opened = k.forms.open(dir);
  if (!opened.ok) return failure(`каталог «${dir}»`, [opened.reason]);
  const { directory } = opened;

  const source = directory.read(INTENT_FILE);
  if (source === null) {
    return { content: [{ type: 'text', text: INTENT_GRAMMAR }] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    return failure(`${INTENT_FILE} не разбирается`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }

  const { intent, problems } = readIntent(raw);
  if (problems.length > 0) {
    return failure(
      'intent прочитан не целиком',
      problems.map((p) => `\`${p.at}\` — ${p.message}. Ожидается: ${p.expected}`)
    );
  }

  const { files, warnings, layoutJson } = buildBundle(intent);
  const report = crossCheckBundle(intent, JSON.parse(layoutJson));
  if (!report.ok) {
    return failure(
      'кросс-проверка',
      report.errors.map((error) => `${error.code} ${error.message}`)
    );
  }

  // Поле вне раскладки: модель его знает, а пользователь не увидит. Для `generate_form` это
  // предупреждение C9, здесь — ошибка, как и всё, что молча теряет часть формы.
  const { placed } = inspectLayoutRefs(intent);
  const unplaced = [...intent.fields, ...intent.arrays]
    .map((entity) => entity.modelPath ?? entity.name)
    .filter((name) => !placed.has(name));
  if (unplaced.length > 0) {
    // Раскладку из сокращения `steps` строит чтение intent: там поле ставится в `steps[i].fields`,
    // а `layoutRoot` агент мог и не писать.
    const hint = intent.wizard ? ['В сокращении `steps` имя поля — в `steps[i].fields`.'] : [];
    return failure('не стоят в layoutRoot', [unplaced.join(', '), ...hint]);
  }

  const lostMessages = warnings.filter(isLostMessageWarning);
  if (lostMessages.length > 0) {
    return failure(
      `тексты ошибок потеряны: ${lostMessages.length}. На каждый код — своя строка validation со своим message`,
      lostMessages
    );
  }

  // На core разметку пишет агент в JSX, поэтому `index.tsx` там его файл, а не вывод сборки. Отказывать
  // такой форме нельзя: прогоны показали, что агент либо меняет заданный стек, либо уходит писать
  // модуль вручную и теряет канон.
  const assembly: FormFile = { path: 'index.tsx', content: buildAssemblyTsx(intent) };
  const handMarkup = intent.target === 'core';
  const derived: FormFile[] = [
    ...files,
    ...(handMarkup ? [] : [assembly]),
    ...(files.some((file) => file.path === 'data-sources.ts')
      ? []
      : [{ path: 'data-sources.ts', content: '// Справочники формы.\nexport {};\n' }]),
  ];
  const owned: FormFile[] = [
    ...(handMarkup ? [assembly] : []),
    { path: 'types.ts', content: '// Локальные типы модуля.\nexport {};\n' },
    { path: 'api.ts', content: '// Загрузка и отправка данных.\nexport {};\n' },
  ];
  const plan = planBuild(directory, derived, owned);

  const types = await directory.typecheck(plan.module);
  if (types.status === 'checked' && types.diagnostics.length > 0) {
    return failure(
      `ошибки типов: ${types.diagnostics.length}. Правь ${INTENT_FILE}, а не сгенерированные файлы`,
      types.diagnostics.map(renderTypeError)
    );
  }
  if (types.status === 'unavailable') {
    const importErrors = await checkImports(k, plan.module);
    if (importErrors.length > 0) return failure('неверные импорты', importErrors);
  }

  for (const file of plan.writes) directory.write(file.path, file.content);
  for (const name of plan.removes) directory.remove(name);

  const kit = await loadUiKitPropSchemas();
  const notes = [
    ...intent.warnings,
    ...(kit ? checkComponentProps(intent, kit) : []),
    ...warnings,
    ...report.warnings.map((warning) => `${warning.code}: ${warning.message}`),
  ];
  const lines = [
    `✓ form_build: записано ${plan.writes.length}, без изменений ${plan.unchanged}. ` +
      `Полей ${intent.fields.length}, массивов ${intent.arrays.length}, ` +
      `правил ${intent.validation.length}, поведений ${intent.behavior.length}.`,
    types.status === 'checked'
      ? 'Типы проверены, ошибок нет.'
      : `⚠️ Типы НЕ проверены: ${types.reason}. Проверены только импорты.`,
    `Каталог ${directory.label}: ${directory.list().join(', ')}.`,
    // Полноту сборка не проверяет: без этой строки агенты заканчивали на ✓, не дописав правила из
    // таблицы зависимостей спеки (ReFormer-w0bo.3).
    'Сборка не знает задания: сверь intent с ним, особенно межполевые правила и таблицы зависимостей.',
  ];
  if (
    handMarkup &&
    plan.module.some((file) => file.path === 'index.tsx' && file.content.includes('return null;'))
  ) {
    lines.push(
      '⚠️ Разметки ещё нет: index.tsx рисует `null`. На core напиши её там сам (Edit) и собери снова: ' +
        'сборка этот файл не перезаписывает и проверит его типы.'
    );
  }
  if (plan.detached.length > 0) {
    lines.push(
      `Правлены вручную и оставлены как есть: ${plan.detached.join(', ')}. Сборка их больше не ` +
        'обновляет; чтобы вернуть файл под сборку, удали его.'
    );
  }
  if (notes.length > 0) {
    lines.push(`Предупреждений: ${notes.length}.`);
    for (const note of notes.slice(0, MAX_WARNINGS)) lines.push(`- ${note}`);
  }
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
