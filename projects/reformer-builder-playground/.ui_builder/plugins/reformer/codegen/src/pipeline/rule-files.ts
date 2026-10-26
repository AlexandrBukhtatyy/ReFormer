/**
 * Файлы правил в прогоне генерации: страж обратного чтения и заглушки осиротевшим файлам шагов.
 *
 * Правила живут в коде модуля, поэтому файл правил, который генерация пишет, обязан читаться
 * обратно в те правила, из которых его напечатали. Иначе следующий прогон прочёл бы из него
 * меньше, чем в нём лежит, и тихо потерял бы правила. Расходятся печать и чтение в двух случаях:
 * цель из проекта (`.ui_builder/codegen`) печатает правила своей записью, которой читатель не
 * знает, либо печать встроенной цели изменилась без читателя. Тогда файлы правил прогона не
 * пишутся, а генерация называет причину.
 *
 * Файл правил шага называется заголовком шага. Переименуй шаг — прежний файл останется лежать, а
 * читатель (он обходит весь `validation/`) снова найдёт в нём правила, которые уже лежат в новом
 * файле. Поэтому нетронутый сирота получает заглушку без правил; правленный руками только
 * называется в заметках (`../stack/disk`).
 *
 * @module plugins/reformer/codegen/pipeline/rule-files
 */

import type { CodegenFile, CodegenProblem } from '@reformer/builder-plugin-api';
import {
  normalizeRules,
  patchConstants,
  patchMessages,
  readRulesFromCode,
  ruleFileTombstone,
  VALIDATION_DIR,
  MESSAGES_NAME,
  type RulesFromCode,
} from '../../../core/codegen';
import { statementsOf } from '../../../core/codegen/rules-code/syntax';
import { DEFAULT_CROSS_CODE } from '../../../core/codegen/rules-code/validation';
import { readRules, type FormRules } from '../../../core/form-model/rules';

/** Файл поведения модуля. */
const BEHAVIOR_FILE = 'behavior/index.ts';

/** Файл правил, который перепечатывает генерация: валидация (кроме словаря) и поведение. */
export function isRuleTargetPath(path: string): boolean {
  if (path === BEHAVIOR_FILE) return true;
  const [dir, name, ...rest] = path.split('/');
  return (
    rest.length === 0 &&
    dir === VALIDATION_DIR &&
    name !== undefined &&
    name.endsWith('.ts') &&
    name !== `${MESSAGES_NAME}.ts`
  );
}

/** Правила без текстов и значений источников: их сверяет страж, остальное — не код правил. */
function comparable(rules: FormRules): string[] {
  const { validation, behavior, render } = normalizeRules(rules);
  return [
    ...validation.map((rule) => {
      const { message: _message, ...rest } = rule;
      return JSON.stringify(['validation', rest]);
    }),
    ...behavior.map((link) => JSON.stringify(['behavior', link])),
    ...render.map((rule) => JSON.stringify(['render', rule])),
  ].sort();
}

/**
 * Не пускать в запись файлы правил, которые не читаются обратно в правила прогона.
 *
 * @returns Файлы для записи и отказы — по одному на каждый задержанный файл правил.
 */
export function guardRuleFiles(
  files: readonly CodegenFile[],
  rules: FormRules
): { readonly files: CodegenFile[]; readonly problems: CodegenProblem[] } {
  const ruleFiles = files.filter((file) => isRuleTargetPath(file.path));
  const behavior = ruleFiles.find((file) => file.path === BEHAVIOR_FILE);
  const read = readRulesFromCode({
    validation: ruleFiles
      .filter((file) => file.path !== BEHAVIOR_FILE)
      .map((file) => ({ path: file.path, text: file.content })),
    ...(behavior === undefined
      ? {}
      : { behavior: { path: behavior.path, text: behavior.content } }),
    constants: [],
  });
  const foreign = read.files.some((file) => file.foreign.length > 0);
  const same = JSON.stringify(comparable(read.rules)) === JSON.stringify(comparable(rules));
  if (!foreign && same) return { files: [...files], problems: [] };

  const message = foreign
    ? 'файл правил напечатан записью, которой билдер не читает: правила в нём потерялись бы при следующей генерации'
    : 'файлы правил читаются не в те правила, из которых напечатаны: правила потерялись бы при следующей генерации';
  return {
    files: files.filter((file) => !isRuleTargetPath(file.path)),
    problems: ruleFiles.map((file) => ({
      targetId: file.targetId,
      path: file.path,
      reason: 'threw' as const,
      message,
    })),
  };
}

/**
 * Заглушки нетронутым осиротевшим файлам правил шагов: в `validation/` лежит файл, которого
 * прогон не печатает, с маркером генерации и с правилами.
 */
export function orphanTombstones(
  code: RulesFromCode,
  files: readonly CodegenFile[]
): CodegenFile[] {
  const printed = new Set(files.map((file) => file.path));
  return code.files
    .filter(
      (file) =>
        file.origin === 'generated' &&
        file.path !== BEHAVIOR_FILE &&
        isRuleTargetPath(file.path) &&
        !printed.has(file.path) &&
        file.rules.validation.length > 0
    )
    .map((file) => ({
      path: file.path,
      content: ruleFileTombstone(file.path),
      cls: 'user' as const,
      regenerable: true,
      // Цель файлов шагов: заказ «только файлы правил» пишет и заглушку.
      targetId: 'codegen.step-validation',
      origin: 'builtin' as const,
    }));
}

// ── Переопределение правил заказчиком ───────────────────────────────────────────────────────

/**
 * Правила, которые заказчик генерации подал вместо правил кода (`CodegenPrintRequest.input`):
 * `{ rules }` — словарь правил формы. Так ассистент пишет правила хода в код модуля.
 *
 * @returns Правила либо `null`, если входа нет или он не того вида.
 */
export function rulesOverrideOf(input: unknown): FormRules | null {
  if (input === null || typeof input !== 'object' || !('rules' in input)) return null;
  return readRules((input as { rules: unknown }).rules);
}

/** Код замечания правила — тот, под которым словарь формы держит его текст. */
function messageCodeOf(rule: FormRules['validation'][number]): string | undefined {
  return rule.code ?? (rule.cross !== undefined ? DEFAULT_CROSS_CODE : undefined);
}

/** Тексты правил: код → текст. */
function ruleMessages(rules: FormRules): Map<string, string> {
  const messages = new Map<string, string>();
  for (const rule of normalizeRules(rules).validation) {
    const code = messageCodeOf(rule);
    if (code !== undefined && rule.message !== undefined) messages.set(code, rule.message);
  }
  return messages;
}

/** Объявления и импорты свежего файла констант — из них правка берёт новые значения. */
function freshConstants(text: string): {
  readonly declarations: ReadonlyMap<string, string>;
  readonly imports: readonly string[];
} {
  const declarations = new Map<string, string>();
  const imports: string[] = [];
  for (const statement of statementsOf(text, 0, text) ?? []) {
    if (statement.text.startsWith('import ')) imports.push(`${statement.text};`);
    const name = /^export\s+const\s+([A-Za-z_$][\w$]*)\b/.exec(statement.text)?.[1];
    if (name !== undefined) declarations.set(name, `${statement.text};`);
  }
  return { declarations, imports };
}

/**
 * Точечные правки авторских файлов под переопределённые правила: новые тексты замечаний — в
 * словарь формы, новые значения источников — в константы. Перепечатывать эти файлы нельзя — они
 * человека; правка трогает только то, что изменили правила.
 */
export function withRuleMerges(
  files: readonly CodegenFile[],
  base: RulesFromCode,
  next: FormRules
): CodegenFile[] {
  const before = ruleMessages(base.rules);
  const after = ruleMessages(next);
  const entries: Record<string, string | null> = {};
  for (const [code, message] of after) if (before.get(code) !== message) entries[code] = message;
  for (const code of before.keys()) if (!after.has(code)) entries[code] = null;

  const was = base.rules.dataSources ?? {};
  const now = next.dataSources ?? {};
  const changed = Object.keys(now).filter(
    (name) => JSON.stringify(now[name]) !== JSON.stringify(was[name])
  );

  return files.map((file) => {
    if (file.path === `${VALIDATION_DIR}/${MESSAGES_NAME}.ts`) {
      if (Object.keys(entries).length === 0) return file;
      return {
        ...file,
        merge: (current: string) => {
          const patched = patchMessages(current, entries);
          return patched.ok ? patched.text : null;
        },
      };
    }
    if (file.path.startsWith('constants/') && file.path.endsWith('.ts') && changed.length > 0) {
      const fresh = freshConstants(file.content);
      const declarations: Record<string, string | null> = {};
      for (const name of changed) declarations[name] = fresh.declarations.get(name) ?? null;
      return {
        ...file,
        merge: (current: string) => {
          const patched = patchConstants(current, declarations, fresh.imports);
          return patched.ok ? patched.text : null;
        },
      };
    }
    return file;
  });
}
