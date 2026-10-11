/**
 * Поток шагов модуля, приведённый к ЖИВОЙ схеме редактора.
 *
 * ## Зачем приводить
 *
 * Поток шагов (`flow/<форма>-flow.ts`) — производный файл: кодоген печатает его по шагам схемы
 * в момент генерации. Схему же в редакторе правят непрерывно — шаг добавили, убрали, переставили,
 * — а код перегенерируют по требованию. Между этими двумя событиями файл потока описывает
 * вчерашние шаги, а превью рисует сегодняшнюю схему.
 *
 * Визард считает шаги ПО ПОТОКУ: отданный как есть, устаревший поток прячет добавленный шаг
 * (до него не дойти, «Отправить» стоит на предпоследнем) либо оставляет пустой экран на месте
 * удалённого. Поэтому шаги берутся из живой схемы — в её порядке, — а из потока модуля берутся
 * только ПРАВИЛА, по `selector` шага.
 *
 * ## Что остаётся как есть
 *
 * Поток не трогается, когда связать его со схемой нечем: в схеме нет визарда либо ни один шаг
 * потока не совпал с узлом по `selector` (шаги описаны не деревом). Не трогается и совпадающий
 * поток — возвращается та же ссылка.
 *
 * @module plugins/reformer/render/compiling/flow
 */

import type { CreateFormConfig } from '@reformer/core';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { wizardStepsOf } from '../../../core/codegen';
import { isNodeLike } from '../../../core/form-model';
import type { Shape } from '../runtime/build';

type FlowConfig = NonNullable<CreateFormConfig<Shape>['flow']>;
type FlowStep = FlowConfig['steps'][number];

/** `selector` узла шага; `null` — его нет (шаг добавили в редакторе и код ещё не генерировали). */
function selectorOf(node: unknown): string | null {
  const selector = (node as { readonly selector?: unknown }).selector;
  return typeof selector === 'string' && selector !== '' ? selector : null;
}

/**
 * Привести поток шагов модуля к шагам живой схемы.
 *
 * @param flow - Поток из модуля формы (`formFlow`); `undefined` — у модуля его нет.
 * @param schema - Живая схема редактора (собранная: шаги разбитого визарда лежат узлами).
 * @returns Поток с шагами схемы в её порядке и правилами из `flow`; сам `flow`, если приводить
 *   нечего или не к чему.
 */
export function alignFlow(
  flow: FlowConfig | undefined,
  schema: JsonFormSchema
): FlowConfig | undefined {
  if (flow === undefined) return undefined;
  const nodes = isNodeLike(schema.root) ? wizardStepsOf(schema.root) : [];
  if (nodes.length === 0) return flow;

  const selectors = nodes.map(selectorOf);
  const named = selectors.filter((selector): selector is string => selector !== null);
  // Повтор селектора — отказ компиляции схемы; чинить его потоком нечем, сборка скажет сама.
  if (new Set(named).size !== named.length) return flow;

  const byId = new Map<string, FlowStep>(flow.steps.map((step) => [step.id, step]));
  if (!named.some((selector) => byId.has(selector))) return flow;

  const same =
    selectors.length === flow.steps.length &&
    selectors.every((selector, index) => selector === flow.steps[index]?.id);
  if (same) return flow;

  const taken = new Set(named);
  const steps = selectors.map((selector, index): FlowStep => {
    if (selector !== null) return byId.get(selector) ?? { id: selector };
    // Шагу без селектора нужен хоть какой-то идентификатор: поток без него не строится. Визард
    // такой шаг с узлом по имени не свяжет и возьмёт узлы по порядку — а порядок здесь схемный.
    let id = `step:${index + 1}`;
    while (taken.has(id)) id = `${id}'`;
    taken.add(id);
    return { id };
  });
  return { ...flow, steps };
}
