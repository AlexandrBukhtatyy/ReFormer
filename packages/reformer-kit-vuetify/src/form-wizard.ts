/**
 * `FormWizard` и `Step` ui-kit на Vuetify: шапка — `VStepper`, кнопки — `VBtn`, шаги и переходы —
 * поток сборки `createForm({ flow })`.
 *
 * Визард ведёт детей сам: рендерер отдаёт ему узлы шагов (`children`) и `renderNode`. Шаг потока —
 * узел с тем же `selector`. «Далее» — `flow.next()`: правила текущего шага, при замечаниях шаг не
 * меняется; «Назад» — `flow.previous()`. На последнем шаге «Отправить» проверяет всю форму через
 * `bundle.submission` и зовёт `onSubmit` — его ставит поведение формы
 * (`onComponentEvent(schema.node('wizard'), 'onSubmit', …)`).
 *
 * Роли — как у визарда ui-kit: `step-indicator`, `step-indicator-{номер}`, `btn-previous` (нет на
 * первом шаге), `btn-next`, `btn-submit`.
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

export const FormWizard = Object.assign(
  defineComponent({
    name: 'KitFormWizard',
    props: {
      children: { type: Array as PropType<readonly CompiledNode[]>, default: () => [] },
      renderNode: { type: Function as PropType<RenderNodeFn>, required: true },
      submitLabel: { type: String, default: 'Отправить' },
      onSubmit: {
        type: Function as PropType<(values: unknown) => void | Promise<void>>,
        default: undefined,
      },
      className: { type: String, default: undefined },
    },
    setup(props) {
      const bundle = useFormBundleContext();
      const flow = bundle?.flow;
      if (!bundle || !flow) {
        throw new Error('FormWizard: у сборки нет потока шагов — createForm({ flow })');
      }
      const { current, index, completed, isFirst, isLast } = useFormFlow(flow);
      const submit = (): void => {
        void bundle.submission.submit(async (values) => {
          await props.onSubmit?.(values);
        });
      };

      return () => {
        const steps = props.children;
        const currentNode = steps.find((node) => node.selector === current.value);
        const number = index.value + 1;

        return h('div', { class: ['kit-wizard', 'kit-stack', props.className] }, [
          h(
            VStepper as Component,
            {
              modelValue: number,
              flat: true,
              'data-slot': 'step-indicator',
              'data-testid': 'step-indicator',
            },
            {
              default: () =>
                h(VStepperHeader as Component, null, {
                  default: () =>
                    steps.map((node, position) => [
                      position > 0
                        ? h(VDivider as Component, { key: `divider-${position}` })
                        : null,
                      // Переходы — только кнопками: пункт шапки не нажимается.
                      h(VStepperItem as Component, {
                        key: node.selector ?? position,
                        value: position + 1,
                        title: titleOf(node),
                        complete: node.selector !== undefined && completed.value.has(node.selector),
                        'data-testid': `step-indicator-${position + 1}`,
                        // Состояние пункта — те же атрибуты, что у шапки визарда ui-kit.
                        'data-step-number': position + 1,
                        'data-step-current': String(position === index.value),
                        'data-step-completed': String(
                          node.selector !== undefined && completed.value.has(node.selector)
                        ),
                      }),
                    ]),
                }),
            }
          ),
          currentNode ? props.renderNode(currentNode, current.value) : null,
          h('div', { class: 'kit-actions' }, [
            isFirst.value
              ? null
              : h(
                  VBtn as Component,
                  {
                    type: 'button',
                    variant: 'outlined',
                    'data-testid': 'btn-previous',
                    onClick: () => flow.previous(),
                  },
                  { default: () => 'Назад' }
                ),
            // Ключи разные: кнопки — разные элементы, клик по «Далее» не попадает в «Отправить».
            isLast.value
              ? h(
                  VBtn as Component,
                  {
                    key: 'submit',
                    type: 'button',
                    color: 'primary',
                    'data-testid': 'btn-submit',
                    onClick: submit,
                  },
                  { default: () => props.submitLabel }
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
  // Объявлены, чтобы не лечь атрибутами (`title` — всплывающей подсказкой) на корень шага.
  props: {
    title: { type: String, default: undefined },
    icon: { type: String, default: undefined },
  },
  setup(_, { slots }) {
    return () => h('div', { class: ['kit-step', 'kit-stack'] }, slots.default?.());
  },
});
