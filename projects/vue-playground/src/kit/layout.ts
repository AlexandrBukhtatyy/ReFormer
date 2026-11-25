/**
 * Страница, форма и кнопки кита на Vuetify: своя разметка с кнопками библиотеки и testid
 * DOM-контракта (`btn-submit`, `btn-reset`, `submit-result`).
 *
 * Заголовок страницы один — `<h1>`: сценарии снимают фокус с поля кликом по заголовку.
 */
import { defineComponent, h, inject, provide, shallowRef, type Component } from 'vue';
import { useFormBundleContext } from '@reformer/renderer-vue';
import { VBtn } from 'vuetify/components/VBtn';
import { FORM_ACTIONS, FORM_RESET } from './form-actions';

export const Page = defineComponent({
  name: 'KitPage',
  props: { title: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h('main', { class: 'cross-page' }, [h('h1', props.title), slots.default?.()]);
  },
});

/**
 * `<form>` с отправкой через сборку: `submission.submit(handler)` проверяет форму и зовёт
 * обработчик страницы. «Очистить» — `form.reset()`: значения, ноды и тихая фаза живой проверки;
 * подтверждение прежней отправки при этом скрывается.
 */
export const Form = defineComponent({
  name: 'KitForm',
  setup(_, { slots }) {
    const bundle = useFormBundleContext();
    const actions = inject(FORM_ACTIONS, null);
    if (!actions) throw new Error('FORM_ACTIONS не задан');
    const result = shallowRef<string | null>(null);

    const onSubmit = async (event: Event): Promise<void> => {
      event.preventDefault();
      if (!bundle) return;
      const outcome = await bundle.submission.submit(actions.submit);
      if (outcome.status === 'submitted') result.value = outcome.result;
    };

    provide(FORM_RESET, () => {
      bundle?.form.reset();
      result.value = null;
    });

    return () =>
      h('form', { novalidate: true, class: 'cross-form', onSubmit }, [
        slots.default?.(),
        result.value
          ? h('p', { role: 'status', 'data-testid': 'submit-result' }, result.value)
          : null,
      ]);
  },
});

export const Actions = defineComponent({
  name: 'KitActions',
  setup(_, { slots }) {
    return () => h('div', { class: 'cross-actions' }, slots.default?.());
  },
});

export const SubmitButton = defineComponent({
  name: 'KitSubmitButton',
  setup(_, { slots }) {
    return () =>
      h(
        VBtn as Component,
        { type: 'submit', color: 'primary', 'data-testid': 'btn-submit' },
        { default: () => slots.default?.() ?? 'Отправить' }
      );
  },
});

export const ResetButton = defineComponent({
  name: 'KitResetButton',
  setup(_, { slots }) {
    const reset = inject(FORM_RESET, null);
    return () =>
      h(
        VBtn as Component,
        {
          type: 'button',
          variant: 'outlined',
          'data-testid': 'btn-reset',
          onClick: () => reset?.(),
        },
        { default: () => slots.default?.() ?? 'Очистить' }
      );
  },
});
