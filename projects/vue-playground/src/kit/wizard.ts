/**
 * Визард кита на Vuetify: шапка — `VStepper`, кнопки — `VBtn`, шаги и переходы — поток сборки
 * `createForm({ flow })`.
 *
 * От `VStepper` берётся только шапка: окно шагов и кнопки библиотеки листают шаги сами, без
 * проверки текущего. У DOM-контракта свои правила кнопок — `btn-prev` есть и на первом шаге
 * (выключена: кнопки не сдвигаются между шагами), заголовок текущего шага — `step-current` с
 * номером в `data-step`.
 */
import { defineComponent, h, type Component, type PropType } from 'vue';
import type { CompiledNode } from '@reformer/core';
import { useFormBundleContext, useFormFlow, type RenderNodeFn } from '@reformer/renderer-vue';
import { VBtn } from 'vuetify/components/VBtn';
import { VDivider } from 'vuetify/components/VDivider';
import { VStepper, VStepperHeader, VStepperItem } from 'vuetify/components/VStepper';

const titleOf = (node: CompiledNode | undefined): string => {
  const title = (node?.props as { title?: unknown } | undefined)?.title;
  return typeof title === 'string' ? title : '';
};

/**
 * Визард: рендерер отдаёт ему узлы шагов данными и `renderNode`, поток шагов он берёт из сборки в
 * контексте. «Далее» — `flow.next()`: правила текущего шага, при замечаниях шаг не меняется;
 * «Назад» — `flow.previous()`. Рисуется только текущий шаг.
 */
export const Wizard = Object.assign(
  defineComponent({
    name: 'KitWizard',
    props: {
      children: { type: Array as PropType<readonly CompiledNode[]>, default: () => [] },
      renderNode: { type: Function as PropType<RenderNodeFn>, required: true },
    },
    setup(props) {
      const flow = useFormBundleContext()?.flow;
      if (!flow) throw new Error('Wizard: у сборки нет потока шагов — createForm({ flow })');
      const { current, index, completed, isFirst, isLast } = useFormFlow(flow);

      return () => {
        const steps = props.children;
        const currentNode = steps.find((node) => node.selector === current.value);
        const number = index.value + 1;

        return h('div', { class: 'cross-wizard' }, [
          h(
            VStepper as Component,
            { modelValue: number, flat: true, 'aria-label': 'Шаги заявки' },
            {
              default: () =>
                h(VStepperHeader as Component, null, {
                  default: () =>
                    steps.map((node, position) => [
                      position > 0
                        ? h(VDivider as Component, { key: `divider-${position}` })
                        : null,
                      // Шагов шесть, заголовки длинные: в шапке — номера, заголовок текущего шага —
                      // под ней. Переходы — только кнопками: пункт шапки не нажимается.
                      h(VStepperItem as Component, {
                        key: node.selector ?? position,
                        value: position + 1,
                        complete: node.selector !== undefined && completed.value.has(node.selector),
                        'aria-label': `Шаг ${position + 1}: ${titleOf(node)}`,
                      }),
                    ]),
                }),
            }
          ),
          h(
            'h2',
            { class: 'cross-wizard__title', 'data-testid': 'step-current', 'data-step': number },
            `Шаг ${number} из ${steps.length}. ${titleOf(currentNode)}`
          ),
          currentNode ? props.renderNode(currentNode, current.value) : null,
          h('div', { class: 'cross-actions' }, [
            h(
              VBtn as Component,
              {
                type: 'button',
                variant: 'outlined',
                disabled: isFirst.value,
                'data-testid': 'btn-prev',
                onClick: () => flow.previous(),
              },
              { default: () => 'Назад' }
            ),
            // Ключи разные: тот же элемент, ставший `type="submit"` посреди клика по «Далее»,
            // отправил бы форму.
            isLast.value
              ? h(
                  VBtn as Component,
                  { key: 'submit', type: 'submit', color: 'primary', 'data-testid': 'btn-submit' },
                  { default: () => 'Отправить' }
                )
              : h(
                  VBtn as Component,
                  {
                    key: 'next',
                    type: 'button',
                    color: 'primary',
                    'data-testid': 'btn-next',
                    onClick: () => void flow.next(),
                  },
                  { default: () => 'Далее' }
                ),
          ]),
        ]);
      };
    },
  }),
  { __selfManagedChildren: true }
);

/** Шаг визарда: рисует своих детей; `title` узла читает визард. */
export const Step = defineComponent({
  name: 'KitStep',
  // Объявлен, чтобы не лечь атрибутом `title` (всплывающей подсказкой) на корень шага.
  props: { title: { type: String, default: undefined } },
  setup(_, { slots }) {
    return () => h('div', { class: 'cross-step' }, slots.default?.());
  },
});
