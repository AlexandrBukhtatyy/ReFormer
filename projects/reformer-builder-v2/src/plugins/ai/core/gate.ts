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
 * @module plugins/ai/core/gate
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { MutationResult } from '@/lib/form-model/mutate';
import type { FormRules } from '@/lib/form-model/rules';
import { validateSchema } from './validate';
import { nodeRef } from './node-ref';
import { buildOutline, renderOutline } from './outline';
import { joinWithinBudget } from './render-budget';
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
 * Сколько замечаний дописывать к успешной правке. Замечание — не отказ, а подсказка вдогонку, и
 * длинный список превратил бы ответ инструмента в отчёт валидатора.
 */
const MAX_WARNINGS = 2;

/** Что схема представляла собой до правки: ошибки и замечания как мультимножества. */
interface Baseline {
  errors: ReadonlyMap<string, number>;
  warnings: ReadonlyMap<string, number>;
}

/**
 * Состояние базовой схемы. Кэш по ссылке на объект: база неизменна в пределах хода, а
 * `validateSchema` каждый раз компилирует ajv заново — на ход из десятков правок это заметная
 * разница.
 *
 * Ключей ДВА, и второй существенен. Замечания зависят не только от схемы, но и от правил: правило,
 * добавленное в середине хода, делает поле «занятым», и база, посчитанная до него, объявила бы
 * такое замечание новым. Правила иммутабельны (инструменты возвращают новый объект), поэтому
 * ссылка на них — точный ключ.
 */
const baselineCache = new WeakMap<JsonFormSchema, WeakMap<FormRules, Baseline>>();

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

function baselineOf(ctx: ToolContext): Baseline {
  let byRules = baselineCache.get(ctx.base);
  if (!byRules) baselineCache.set(ctx.base, (byRules = new WeakMap()));
  let known = byRules.get(ctx.rules);
  if (!known) {
    const result = validateSchema(ctx.base, {
      catalog: ctx.catalog,
      baseline: ctx.base,
      rules: ctx.rules,
      validateForm: ctx.validateForm,
    });
    known = { errors: countErrors(result.errors), warnings: countErrors(result.warnings) };
    byRules.set(ctx.rules, known);
  }
  return known;
}

/** То, чего в базе не было (или стало больше), в исходных формулировках. */
function introduced(base: ReadonlyMap<string, number>, errors: readonly string[]): string[] {
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

/**
 * Как описать операцию — двумя языками сразу.
 *
 * Один и тот же факт читают двое: человек в списке изменений и модель в ответе инструмента.
 * Интерфейс билдера русский, а модели устойчивее следуют англоязычным инструкциям и на них же
 * дешевле по токенам — поэтому строки разведены, а не переведены разом.
 */
export interface OpDescription {
  kind: ChangeOpKind;
  /** Для интерфейса, по-русски: «Email (Input)», «Email → обязательное». */
  summary: string;
  /** Для модели, по-английски: «Email (Input)», «Email → required = true». Без адреса — его добавит гейт. */
  report: string;
}

/**
 * Провести результат мутации через гейт.
 *
 * @param ctx - Контекст вызова (нужна база для сравнения ошибок).
 * @param result - Результат функции из `@/lib/form-model/mutate`.
 * @param describe - Описание операции; получает адрес затронутого узла ПОСЛЕ правки.
 * @returns Успех со схемой и операцией либо `SCHEMA_INVALID` с новыми ошибками.
 */
export function commitMutation(
  ctx: ToolContext,
  result: MutationResult,
  describe: (ref: string) => OpDescription
): ToolOutcome {
  const ref = nodeRef(result.newPath);
  return commitBatch(ctx, result.schema, [{ ref, ...describe(ref) }]);
}

/** Одна правка пакета: что изменилось и по какому адресу. */
export interface BatchEntry extends OpDescription {
  ref: string;
}

/**
 * Провести через гейт результат ПАКЕТА правок.
 *
 * Гейт запускается один раз на весь пакет, а не на каждую правку: `validateSchema` компилирует ajv
 * заново при каждом вызове, и на пакете из двенадцати полей это двенадцать полных проверок схемы
 * вместо одной. Смысл проверки от этого не меняется — промежуточные состояния пакета модели всё
 * равно не видны, а невалидным считается результат.
 *
 * Отвергается пакет ЦЕЛИКОМ. Применить его частично значило бы оставить черновик в состоянии, о
 * котором модель не знает точно, — и следующий её вызов адресовал бы узлы по неверным индексам.
 *
 * @param ctx - Контекст вызова (нужна база для сравнения ошибок).
 * @param schema - Схема после всех правок пакета.
 * @param entries - Описания правок в порядке применения; их адреса уже посчитаны.
 */
export function commitBatch(
  ctx: ToolContext,
  schema: JsonFormSchema,
  entries: readonly BatchEntry[]
): ToolOutcome {
  const known = baselineOf(ctx);
  const checked = validateSchema(schema, {
    catalog: ctx.catalog,
    baseline: ctx.base,
    rules: ctx.rules,
    validateForm: ctx.validateForm,
  });
  const errors = introduced(known.errors, checked.errors);

  if (errors.length) {
    const shown = errors.slice(0, MAX_REPORTED).join('; ');
    const rest = errors.length - Math.min(errors.length, MAX_REPORTED);
    return fail(
      'SCHEMA_INVALID',
      `Edit rejected — it would make the form invalid: ${shown}${rest > 0 ? ` (and ${rest} more)` : ''}.`
    );
  }

  const warned = warningLine(introduced(known.warnings, checked.warnings));
  const head = headline(entries);
  // Состав поддерева печатается только у одиночной правки: у пакета из дюжины compound'ов он не
  // влезет ни в какой бюджет, а узнать состав модель может заранее — из describe_component.
  const inside =
    entries.length === 1
      ? subtreeOf(
          schema,
          entries[0].ref,
          TOOL_TEXT_BUDGET - head.length - warned.length - SUBTREE_LEAD.length
        )
      : undefined;

  return {
    ok: true,
    text: `${head}${warned}${inside ? `${SUBTREE_LEAD}${inside}` : ''}`,
    schema,
    ops: entries.map((e) => ({ kind: e.kind, ref: e.ref, summary: e.summary })),
  };
}

/** Заголовок ответа: что сделано и по каким адресам. */
function headline(entries: readonly BatchEntry[]): string {
  if (entries.length === 1) {
    return `Done: ${entries[0].report}. Node address: ${entries[0].ref}.`;
  }
  const lines = entries.map((e) => `${e.report} → ${e.ref}`);
  return joinWithinBudget(
    [`Done, ${entries.length} nodes:`],
    lines,
    TOOL_TEXT_BUDGET,
    (shown, total) => `… and ${total - shown} more`
  );
}

/**
 * Замечания, которые правка ПРИНЕСЛА, — строкой вдогонку к успеху.
 *
 * Замечания структурного линтера (вкладка без панели, шаг не-контейнером) на валидность не влияют,
 * поэтому гейт их не отвергает. Но раньше он их и не показывал: единственным каналом был отдельный
 * `validate_form`, то есть целый обход «модель → инструмент → модель» в конце каждого хода — ровно
 * тот шаг, который здесь и экономится. Сказанное сразу после правки и адреснее: модель ещё помнит,
 * что делала.
 *
 * Сравнение с базой — та же политика «не обязана лечить, но обязана не ухудшать», что у ошибок:
 * чужая форма с давним замечанием не должна упрекать агента на каждой правке.
 */
function warningLine(fresh: readonly string[]): string {
  if (!fresh.length) return '';
  const shown = fresh.slice(0, MAX_WARNINGS).join('; ');
  const rest = fresh.length - Math.min(fresh.length, MAX_WARNINGS);
  return `\nHeads up: ${shown}${rest > 0 ? ` (and ${rest} more)` : ''}.`;
}

/** Предисловие к составу поддерева — отделяет его от адреса самого узла. */
const SUBTREE_LEAD = '\nIt already contains:\n';

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
