/**
 * Гейт записи: единственная точка, через которую write-инструменты возвращают новую схему.
 *
 * Зачем гейт на КАЖДОЙ правке, а не только перед применением: структурированная ошибка сразу после
 * неудачного вызова — это то, по чему модель чинится сама, не дожидаясь конца хода. Гейт перед
 * применением тоже остаётся (этап 3), но он барьер, а не обратная связь.
 *
 * Отвергаются только НОВЫЕ ошибки. Если пользовательская форма уже была невалидной (открыл чужую,
 * недописанную, со своими компонентами), проверка «результат обязан быть валиден» заблокировала бы
 * агенту любую работу — включая ту, которая эту форму чинит. Поэтому сравнение идёт с ошибками
 * базовой схемы: правка не обязана лечить, но обязана не ухудшать.
 *
 * @module reformer-builder/agent/core/gate
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { MutationResult } from '../../model';
import { validateSchema } from '../../io/validate';
import { nodeRef } from './node-ref';
import { fail, type ChangeOpKind, type ToolContext, type ToolOutcome } from './types';

/** Сколько ошибок показывать модели: чинит она их по одной. */
const MAX_REPORTED = 5;

/**
 * Ошибки базовой схемы. Кэш по ссылке на объект: база неизменна в пределах хода, а `validateSchema`
 * каждый раз компилирует ajv заново — на ход из десятков правок это заметная разница.
 */
const baselineCache = new WeakMap<JsonFormSchema, ReadonlySet<string>>();

function baselineErrors(base: JsonFormSchema): ReadonlySet<string> {
  let known = baselineCache.get(base);
  if (!known) {
    known = new Set(validateSchema(base, { strict: true, baseline: base }).errors);
    baselineCache.set(base, known);
  }
  return known;
}

/** Как описать операцию в списке изменений. */
export interface OpDescription {
  kind: ChangeOpKind;
  /** Человекочитаемая строка: «Email (Input)», «Email → обязательное». */
  summary: string;
}

/**
 * Провести результат мутации через гейт.
 *
 * @param ctx - Контекст вызова (нужна база для сравнения ошибок).
 * @param result - Результат функции из `model/mutate`.
 * @param describe - Описание операции; получает адрес затронутого узла ПОСЛЕ правки.
 * @returns Успех со схемой и операцией либо `SCHEMA_INVALID` с новыми ошибками.
 */
export function commitMutation(
  ctx: ToolContext,
  result: MutationResult,
  describe: (ref: string) => OpDescription
): ToolOutcome {
  const known = baselineErrors(ctx.base);
  const introduced = validateSchema(result.schema, {
    strict: true,
    baseline: ctx.base,
  }).errors.filter((e) => !known.has(e));

  if (introduced.length) {
    const shown = introduced.slice(0, MAX_REPORTED).join('; ');
    const rest = introduced.length - Math.min(introduced.length, MAX_REPORTED);
    return fail(
      'SCHEMA_INVALID',
      `Правка сделала бы форму невалидной и не применена: ${shown}${rest > 0 ? ` (и ещё ${rest})` : ''}.`
    );
  }

  const ref = nodeRef(result.newPath);
  const { kind, summary } = describe(ref);
  return {
    ok: true,
    text: `Готово: ${summary}. Адрес узла: ${ref}.`,
    schema: result.schema,
    op: { kind, ref, summary },
  };
}
