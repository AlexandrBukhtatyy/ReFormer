/**
 * Гейт записи файлового режима: запись, которая ломает форму, отвергается и НЕ пишется.
 *
 * Это обещание режима для слабых моделей. Структурный режим держит форму целой формой своих
 * инструментов — модель там не может написать `$component` с опечаткой, потому что не пишет
 * его вовсе. Здесь модель пишет текст сама, и целость формы держит только этот барьер: проверка
 * ДО записи, отказ с причиной, по которой модель чинится сама, и рабочая копия, в которую битый
 * текст не попадает никогда.
 *
 * Политика та же, что у структурного гейта, — «не обязана лечить, но обязана не ухудшать»
 * (`../loop/introduced`): чужая форма с давней ошибкой не должна запрещать модели любую правку,
 * включая ту, что её чинит. Сравнение идёт с формой на начало попытки.
 *
 * Что проверяется — по виду файла:
 * - **документ формы и файлы шагов, на которые он ссылается** — форма собирается с подставленной
 *   записью (`./compose`) и проходит ту же строгую проверку, что запись структурного режима:
 *   мета-схема form-DSL, имена компонентов против каталога кита, props против схем каталога;
 * - **файл шага, на который корень ещё не ссылается** — разбор и проверка узла шага; так шаг
 *   создаётся ДО ссылки на него, и сборка формы не падает между двумя записями;
 * - **код (`.ts`, `.tsx`)** — проверка API `@reformer/*` справкой по библиотеке (`../reference`;
 *   встроенная — из MCP): неизвестный символ, импорт не из того пакета, оператор вне своей схемы,
 *   снятое API. Это проверка по строкам, не компилятор, — типов она не видит, и о её пределах
 *   сказано честно;
 * - **прочий JSON** — только разбор; остальное — без проверки.
 *
 * Отдельно от отказов — замечания по РОЛИ файла: правка производного файла выглядит успешной и
 * молча исчезает при следующей генерации кода, и сказать об этом в момент правки дешевле, чем
 * объяснять пропажу потом.
 *
 * @module plugins/reformer/ai/files/gate
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { originOf } from '@reformer/builder-toolkit';
import { isFormStepSchema, migrateNodeFormat } from '../../../core/form-model';
import {
  fileRoleOf,
  FORM_RULES_NAME,
  VALIDATION_DIR,
  type ModuleFileRole,
} from '../../../core/codegen/layout';
import { validateSchema } from '../model/validate';
import { countErrors, introduced } from '../loop/introduced';
import { MAX_REPORTED } from '../loop/gate';
import { fail, type ToolOutcome } from '../model/types';
import type { CodeFinding } from '../reference';
import { composeForm, jsonError } from './compose';
import type { ModuleFile } from './scope';
import type { FileToolContext } from './turn';

/** Решение гейта. */
export type GateVerdict =
  | {
      readonly ok: true;
      /** Замечания вдогонку к успеху — по строке. */
      readonly notes: readonly string[];
      /** Форма после записи — если запись меняла форму. */
      readonly draft?: JsonFormSchema;
    }
  | { readonly ok: false; readonly outcome: ToolOutcome };

/**
 * Проверить запись до того, как она случится.
 *
 * @param ctx - Контекст инструмента: попытка хода, каталог, проверка по мета-схеме.
 * @param file - Записываемый файл.
 * @param next - Текст, который будет записан.
 * @param before - Текст файла сейчас; `null` — файла нет.
 */
export async function gateWrite(
  ctx: FileToolContext,
  file: ModuleFile,
  next: string,
  before: string | null
): Promise<GateVerdict> {
  const { scope } = ctx.files;
  const role = fileRoleOf(file.rel, scope.schemaPath);
  const notes: string[] = [];
  const roleNote = roleWarning(role, before, next);
  if (roleNote) notes.push(roleNote);

  if (role === 'form' || role === 'step') return schemaGate(ctx, file, next, before, role, notes);
  if (role === 'obsolete') {
    // Правила живут в коде модуля, а прежний файл правил билдер больше не читает, кроме одного
    // переноса: правило, записанное сюда, не сработало бы нигде.
    return refuse(
      'REFUSED',
      `${file.rel} is obsolete: form rules live in the module code — ` +
        `${VALIDATION_DIR}/${FORM_RULES_NAME}.ts, ${VALIDATION_DIR}/<step>.ts and behavior/index.ts. ` +
        'Write the rules there.'
    );
  }
  if (/\.tsx?$/.test(file.rel)) return codeGate(ctx, file, next, before, notes);
  if (file.rel.endsWith('.json')) {
    try {
      JSON.parse(next);
    } catch (error) {
      return refuse('SCHEMA_INVALID', `${file.rel}: ${jsonError(next, error)}`);
    }
  }
  return { ok: true, notes };
}

/** Форма или шаг: собрать и проверить. */
async function schemaGate(
  ctx: FileToolContext,
  file: ModuleFile,
  next: string,
  before: string | null,
  role: 'form' | 'step',
  notes: string[]
): Promise<GateVerdict> {
  const { files } = ctx;
  const composed = await composeForm(
    (rel) => (rel === file.rel ? Promise.resolve(next) : files.readPath(rel)),
    files.scope.schemaPath
  );
  if (!composed.ok) {
    // Форма на начало попытки собиралась (иначе ход не начался бы), а каждая принятая запись
    // её собираемость сохраняет — значит, не собирает её именно эта запись.
    return refuse(
      'SCHEMA_INVALID',
      `Edit rejected — the form no longer assembles: ${composed.error}.`
    );
  }

  if (role === 'form' || composed.stepFiles.includes(file.rel)) {
    const errors = newErrors(ctx, composed.schema, ctx.files.base);
    if (errors.length) return refuse('SCHEMA_INVALID', rejection(errors));
    return { ok: true, notes, draft: composed.schema };
  }

  // Шаг, на который корень пока не ссылается: формы он не меняет, проверяется сам по себе.
  const step = parseStep(next);
  if (typeof step === 'string') return refuse('SCHEMA_INVALID', `${file.rel}: ${step}`);
  const previous = before === null ? null : parseStep(before);
  const errors = newErrors(
    ctx,
    asForm(step),
    ctx.files.base,
    previous === null || typeof previous === 'string' ? undefined : asForm(previous)
  );
  if (errors.length) return refuse('SCHEMA_INVALID', rejection(errors));
  return { ok: true, notes };
}

/** Узел файла шага либо причина, по которой это не шаг. */
function parseStep(text: string): JsonNode | string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return jsonError(text, error);
  }
  if (!isFormStepSchema(value))
    return 'not a step file: it needs an object with the node under "node"';
  return migrateNodeFormat(value.node) as JsonNode;
}

/** Узел шага как форма — так его принимает проверка по мета-схеме. */
function asForm(node: JsonNode): JsonFormSchema {
  return { format: 2, root: node } as JsonFormSchema;
}

/**
 * Ошибки, которых не было в базе.
 *
 * @param baseline - Форма, имена компонентов которой считаются законными (строгий режим).
 * @param prior - С чем сравнивать ошибки; по умолчанию — с самой базой.
 */
function newErrors(
  ctx: FileToolContext,
  schema: JsonFormSchema,
  baseline: JsonFormSchema,
  prior: JsonFormSchema | null | undefined = baseline
): string[] {
  const options = { catalog: ctx.catalog, baseline, validateForm: ctx.validateForm };
  let known: ReadonlyMap<string, number> = new Map();
  if (prior) {
    const cached = priorErrors.get(prior);
    known = cached ?? countErrors(validateSchema(prior, options).errors);
    if (!cached) priorErrors.set(prior, known);
  }
  return introduced(known, validateSchema(schema, options).errors);
}

/**
 * Ошибки базы по ссылке на неё. База неизменна в пределах попытки, а проверка схемы каждый раз
 * заново компилирует мета-схему — на ход из десятка записей это заметная разница.
 */
const priorErrors = new WeakMap<JsonFormSchema, ReadonlyMap<string, number>>();

/**
 * Код правил: проверка API `@reformer/*` справкой по библиотеке (`../reference`).
 *
 * Находки отдаёт справка — встроенная на MCP или плагина-поставщика; что из них НОВОЕ, решает
 * гейт. Справка, которой проверить нечем (`null` по одному из текстов), запись не держит: прошлые
 * находки, принятые за пустые, вменили бы правке чужие старые ошибки. Бросок справки поднимается
 * наружу: барьер, который не смог проверить, отказывает, а не пропускает.
 */
async function codeGate(
  ctx: FileToolContext,
  file: ModuleFile,
  next: string,
  before: string | null,
  notes: string[]
): Promise<GateVerdict> {
  const reference = ctx.files.reference?.();
  const request = { path: file.rel, ...(ctx.turn ? { signal: ctx.turn.signal } : {}) };
  // Метод зовётся через справку, а не вынутым из неё: реализация-класс опирается на `this`.
  const check = async (text: string) => (await reference?.checkCode?.(text, request)) ?? null;
  const checked = await check(next);
  // Текст «до» проверяется, только если проверка вообще состоялась: удалённой справке это
  // второй запрос, и делать его ради отказа незачем.
  const checkedBefore =
    checked === null ? null : before === null ? { findings: [] } : await check(before);
  if (checked === null || checkedBefore === null) {
    notes.push('Code check unavailable — the ReFormer knowledge base is not loaded.');
    return { ok: true, notes };
  }
  const after = checked.findings;
  const prior = checkedBefore.findings;

  // Номер строки в ключ не входит: правка выше старой находки сдвигает её строку, и та же
  // находка выглядела бы новой.
  const keyOf = (finding: CodeFinding): string => `${finding.code} ${finding.message}`;
  const describe = (finding: CodeFinding): string =>
    `${finding.line !== undefined ? `line ${finding.line}: ` : ''}${finding.code} ${finding.message}` +
    (finding.suggestion ? ` — ${finding.suggestion}` : '');

  const fresh = (severity: 'error' | 'warning'): string[] => {
    const base = countErrors(prior.filter((d) => d.severity === severity).map(keyOf), (k) => k);
    const now = after.filter((d) => d.severity === severity);
    const keys = introduced(base, now.map(keyOf), (k) => k);
    const picked: string[] = [];
    for (const d of now) {
      const at = keys.indexOf(keyOf(d));
      if (at === -1) continue;
      keys.splice(at, 1);
      picked.push(describe(d));
    }
    return picked;
  };

  const errors = fresh('error');
  if (errors.length) {
    return refuse(
      'CODE_INVALID',
      `Edit rejected — the code uses the ReFormer API wrongly: ${list(errors)}.`
    );
  }
  const warnings = fresh('warning');
  if (warnings.length) notes.push(`Heads up: ${list(warnings)}.`);
  return { ok: true, notes };
}

/** Замечание по роли файла — или ничего. */
function roleWarning(
  role: ModuleFileRole,
  before: string | null,
  next: string
): string | undefined {
  switch (role) {
    case 'derived':
      return (
        'This file is derived: code generation rewrites it, and this edit will be lost on the ' +
        'next generation. Prefer the form document and the rules files.'
      );
    case 'regenerable':
      return before !== null && originOf(before) === 'generated' && originOf(next) !== 'generated'
        ? 'Code generation will now keep your version of this file and stop regenerating it.'
        : undefined;
    case 'legacy':
      return 'This file belongs to the old flat layout: the module no longer uses it.';
    default:
      return undefined;
  }
}

function rejection(errors: readonly string[]): string {
  return `Edit rejected — it would make the form invalid: ${list(errors)}.`;
}

function list(items: readonly string[]): string {
  const shown = items.slice(0, MAX_REPORTED).join('; ');
  const rest = items.length - Math.min(items.length, MAX_REPORTED);
  return `${shown}${rest > 0 ? ` (and ${rest} more)` : ''}`;
}

function refuse(code: 'SCHEMA_INVALID' | 'CODE_INVALID' | 'REFUSED', message: string): GateVerdict {
  return { ok: false, outcome: fail(code, message) };
}
