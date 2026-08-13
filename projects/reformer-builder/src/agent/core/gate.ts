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
import { buildOutline, renderOutline } from './outline';
import {
  fail,
  TOOL_TEXT_BUDGET,
  type ChangeOpKind,
  type ToolContext,
  type ToolOutcome,
} from './types';

/** Сколько ошибок показывать модели: чинит она их по одной. */
const MAX_REPORTED = 5;

/**
 * Ошибки базовой схемы. Кэш по ссылке на объект: база неизменна в пределах хода, а `validateSchema`
 * каждый раз компилирует ajv заново — на ход из десятков правок это заметная разница.
 */
const baselineCache = new WeakMap<JsonFormSchema, ReadonlyMap<string, number>>();

/**
 * Ошибка без индексов пути: `root.children[0].componentProps …` → `root.children[#].componentProps …`.
 *
 * Сравнивать ошибки дословно нельзя: вставка узла ПЕРЕД уже битым соседом сдвигает его индекс, та
 * же самая ошибка выглядит новой, и правка отвергается — с сообщением про ЧУЖОЙ узел, которого
 * модель не трогала. Политика «не обязана лечить, но обязана не ухудшать» из шапки модуля на
 * сдвиге индексов не работала.
 */
function normalizeError(message: string): string {
  return message.replace(/\[\d+\]/g, '[#]');
}

/**
 * Ошибки базы как мультимножество нормализованных сообщений.
 *
 * Именно счётчики, а не множество: с одними лишь ключами форма, где уже есть одна такая ошибка,
 * молча принимала бы вторую такую же — «не ухудшать» превратилось бы в «не ухудшать заметно».
 */
function countErrors(errors: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of errors) {
    const key = normalizeError(e);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function baselineErrors(base: JsonFormSchema): ReadonlyMap<string, number> {
  let known = baselineCache.get(base);
  if (!known) {
    known = countErrors(validateSchema(base, { strict: true, baseline: base }).errors);
    baselineCache.set(base, known);
  }
  return known;
}

/** Ошибки, которых в базе не было (или стало больше), в исходных формулировках. */
function introducedErrors(base: ReadonlyMap<string, number>, errors: readonly string[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const e of errors) {
    const key = normalizeError(e);
    const used = (seen.get(key) ?? 0) + 1;
    seen.set(key, used);
    if (used > (base.get(key) ?? 0)) out.push(e);
  }
  return out;
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
  const introduced = introducedErrors(
    known,
    validateSchema(result.schema, { strict: true, baseline: ctx.base }).errors
  );

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
  const head = `Готово: ${summary}. Адрес узла: ${ref}.`;
  const inside = subtreeOf(
    result.schema,
    ref,
    TOOL_TEXT_BUDGET - head.length - SUBTREE_LEAD.length
  );
  return {
    ok: true,
    text: inside ? `${head}${SUBTREE_LEAD}${inside}` : head,
    schema: result.schema,
    op: { kind, ref, summary },
  };
}

/** Предисловие к составу поддерева — отделяет его от адреса самого узла. */
const SUBTREE_LEAD = '\nВнутри уже есть:\n';

/**
 * Состав поддерева под `ref`, если узел пришёл не один, — иначе `undefined`.
 *
 * Compound-компоненты вставляются собранными: `Tabs` разворачивается в список, две вкладки и две
 * панели, `Wizard` приносит первый шаг. Раньше об этом сообщался ровно один адрес — корень, и
 * модель, не зная про готовые части, создавала их заново: в живых прогонах ход целиком уходил на
 * борьбу с собственным вторым `TabsList`. Тот же ответ нужен `duplicate_node` (копия поддерева) и
 * `group_nodes` (адреса всех детей уезжают на уровень вниз).
 *
 * Бюджет передаётся снаружи уже за вычетом заголовка: обрезка по символам порвала бы JSON Pointer
 * пополам, и модель получила бы адрес, которого нет.
 */
function subtreeOf(schema: JsonFormSchema, ref: string, budget: number): string | undefined {
  if (budget <= 0) return undefined;
  const inside = buildOutline(schema).filter((e) => e.ref.startsWith(`${ref}/`));
  if (!inside.length) return undefined;
  const base = inside[0].depth;
  return renderOutline(
    inside.map((e) => ({ ...e, depth: e.depth - base })),
    budget
  );
}
