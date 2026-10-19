/**
 * Чистая логика визарда кита — без React: порядок шагов, сверка схемы с потоком и то, как кнопки
 * HexaUI `Wizard` ложатся на поток шагов `FormFlow` ядра.
 *
 * `orderedNodes` и `flowStepsMismatch` — копия логики `FormWizard` из `@reformer/ui-kit`
 * (`src/components/form-wizard/variants/base/form-wizard.tsx`): кит от ui-kit не зависит, а
 * поведение визарда в схеме у двух китов обязано совпадать — шаг схемы связан с шагом потока по
 * `selector` узла.
 *
 * Проверяется в node с настоящим `createFormFlow` (`./wizard-steps.test.ts`).
 *
 * @module reformer/kit-hexa-ui/wizard-steps
 */

import type { FlowTransition, FormFlow } from '@reformer/core';

/**
 * Узел шага, каким его передаёт рендерер (`KitWizardStepNode` контракта): узел скомпилированной
 * схемы. Визард читает `selector` и подпись шага из `props`; сам узел рисует рендерер.
 */
export interface WizardStepNode {
  /** Идентификатор шага — `id` шага в потоке сборки. */
  readonly selector?: string;
  /** Пропсы узла шага (`componentProps` автора): `title`, `description`, `icon`. */
  readonly props?: { readonly [prop: string]: unknown };
  readonly [key: string]: unknown;
}

/** Расхождение шагов схемы с шагами потока — см. {@link flowStepsMismatch}. */
export interface FlowStepsMismatch {
  /** Шаги потока, для которых в схеме нет узла с таким `selector`. */
  withoutNode: string[];
  /** Узлы шагов с `selector`, которого нет в потоке. */
  withoutFlowStep: string[];
}

/**
 * Сверка шагов схемы с шагами потока — в обе стороны. Визард рисует шаги в порядке потока и
 * связывает их с узлами по `selector`: опечатка в селекторе оставила бы шаг потока без разметки.
 *
 * @returns Расхождение либо `null`, если шаги сходятся.
 */
export function flowStepsMismatch(
  flowSteps: readonly string[],
  stepSelectors: ReadonlyArray<string | undefined>
): FlowStepsMismatch | null {
  const withoutNode = flowSteps.filter((step) => !stepSelectors.includes(step));
  const withoutFlowStep = stepSelectors.filter(
    (selector): selector is string => selector !== undefined && !flowSteps.includes(selector)
  );
  return withoutNode.length === 0 && withoutFlowStep.length === 0
    ? null
    : { withoutNode, withoutFlowStep };
}

/** Список имён для сообщения: `"loan", "contacts"`. */
const quoted = (items: readonly string[]): string => items.map((item) => `"${item}"`).join(', ');

/** Текст предупреждения о расхождении — для консоли в разработке. */
export function mismatchMessage({ withoutNode, withoutFlowStep }: FlowStepsMismatch): string {
  return (
    '[kit-hexa-ui] FormWizard: шаги схемы и шаги потока расходятся.' +
    (withoutNode.length > 0
      ? ` Шаги потока без узла: ${quoted(withoutNode)} — визард не свяжет их с разметкой.`
      : '') +
    (withoutFlowStep.length > 0
      ? ` Узлы без шага потока: ${quoted(withoutFlowStep)} — проверьте \`selector\` шага и ` +
        '`flow.steps` сборки.'
      : '')
  );
}

/**
 * Узлы шагов в порядке потока: шаг потока ↔ узел по `selector`. Если хоть одному шагу узла не
 * нашлось (или узлов больше, чем шагов), — порядок узлов как есть: о расхождении предупредит
 * {@link flowStepsMismatch}.
 */
export function orderedNodes<N extends WizardStepNode>(
  nodes: readonly N[],
  flowSteps: readonly string[] | undefined
): readonly N[] {
  if (flowSteps === undefined) return nodes;
  const bySelector = flowSteps.map((step) => nodes.find((node) => node.selector === step));
  return bySelector.every((node): node is N => node !== undefined) &&
    bySelector.length === nodes.length
    ? bySelector
    : nodes;
}

/** Шаги позиционного потока — визард без сборки: `'1'`, `'2'`, … Хотя бы один. */
export function positionalSteps(total: number): string[] {
  return Array.from({ length: Math.max(total, 1) }, (_, index) => String(index + 1));
}

/** Номер шага для HexaUI в пределах отрисованных шагов: поток длиннее схемы не уронит визард. */
export function clampStep(index: number, total: number): number {
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

/**
 * Кнопка «Далее» HexaUI (`StepConfig.onNext`). Переход делает ПОТОК: `flow.next()` проверяет
 * правила шага и сам переводит шаг, а визард показывает `flow.index`. На последнем шаге —
 * отправка (`submit`: проверка всей формы и обработчик).
 *
 * Ответ всегда `false`: HexaUI на `true` сделал бы свой переход поверх перехода потока (двойной
 * шаг), а на последнем шаге позвал бы `onFinish` в обход проверки.
 */
export async function advance(flow: FormFlow, submit: () => Promise<unknown>): Promise<false> {
  if (flow.isLast.peek()) await submit();
  else await flow.next();
  return false;
}

/**
 * Переход HexaUI на шаг по номеру с нуля (`onStepChange`: «Назад», щелчок по шагу) — переход
 * потока `goTo`. Правила доступности шагов — у потока: на непройденный шаг он не пустит.
 *
 * @returns Итог перехода либо `null`, если шага с таким номером нет.
 */
export function goToIndex(flow: FormFlow, index: number): FlowTransition | null {
  const stepId = flow.steps[index];
  return stepId === undefined ? null : flow.goTo(stepId);
}
