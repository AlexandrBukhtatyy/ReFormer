// @vitest-environment happy-dom
/**
 * Дымовая проверка рендерера: контейнер, HTML-узел, текст, поле с обёрткой и без неё, `testId`,
 * видимость и владение сборкой.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, type PropType } from 'vue';
import { createForm, type FormControl, type FormModel } from '@reformer/core';
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';
import { defineIssueMessages } from '@reformer/core/i18n';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { FormRenderer, useFieldError, useFormBundle } from '../src';
import type { RenderNodeFn } from '../src';
import { byTestId, mount, unmountAll } from './mount';

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

interface Shape {
  name: string;
  email: string;
  agree: boolean;
}

const initial = (): Shape => ({ name: 'Анна', email: '', agree: false });

/** Текстовое поле диалекта `v-model`: значение пропом `modelValue`, запись — событием. */
const TextInput = defineComponent({
  name: 'TextInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    caption: { type: String, default: undefined },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        value: props.modelValue,
        disabled: props.disabled,
        'data-caption': props.caption,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
        onBlur: () => emit('blur'),
      });
  },
});

/** Секция: компонент-контейнер со слотом по умолчанию. */
const Section = defineComponent({
  name: 'Section',
  props: { title: { type: String, default: undefined } },
  setup(props, { slots }) {
    return () => h('section', { 'data-title': props.title }, slots.default?.());
  },
});

/** Обёртка поля: корень `field-`, текст ошибки — только когда он есть. */
const FieldWrapper = defineComponent({
  name: 'FieldWrapper',
  props: {
    control: { type: Object as PropType<FormControl<unknown>>, required: true },
    testId: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const error = useFieldError(props.control);
    return () =>
      h('div', { 'data-testid': `field-${props.testId}` }, [
        slots.default?.(),
        error.value ? h('p', { 'data-testid': `error-${props.testId}` }, error.value) : null,
      ]);
  },
});

const schema = (model: FormModel<Shape>) => ({
  selector: 'root',
  component: Section,
  componentProps: { title: 'Регистрация' },
  children: [
    {
      component: 'h1',
      componentProps: { className: 'title' },
      children: ['Привет, ', model.$.name],
    },
    { component: 'hr' },
    { model: model.$.name, component: TextInput, componentProps: { caption: 'Имя' } },
    {
      selector: 'contacts',
      component: 'div',
      componentProps: { id: 'contacts' },
      children: [
        {
          model: model.$.email,
          component: TextInput,
          componentProps: { testId: 'mail', className: 'wide' },
        },
      ],
    },
  ],
});

const input = (root: ParentNode, id: string): HTMLInputElement => {
  const element = byTestId<HTMLInputElement>(root, id);
  if (!element) throw new Error(`нет элемента ${id}`);
  return element;
};

describe('FormRenderer', () => {
  it('рисует контейнер, HTML-узел с текстом и поля с `testId`', () => {
    const bundle = createForm<Shape>({ initial: initial(), schema });
    const { root } = mount(FormRenderer, { form: bundle });

    const section = root.querySelector('section');
    expect(section?.getAttribute('data-title')).toBe('Регистрация');
    // `selector` адресует узел схемы: компоненту, который его не объявил, он не уходит.
    expect(section?.hasAttribute('selector')).toBe(false);

    const heading = root.querySelector('h1');
    expect(heading?.textContent).toBe('Привет, Анна');
    expect(heading?.className).toBe('title');
    expect(root.querySelector('hr')).not.toBeNull();
    expect(root.querySelector('#contacts')?.hasAttribute('selector')).toBe(false);

    // Путь поля → `input-{путь}`; явный `testId` главнее.
    expect(input(root, 'input-name').value).toBe('Анна');
    expect(input(root, 'input-name').getAttribute('data-caption')).toBe('Имя');
    expect(byTestId(root, 'input-email')).toBeNull();
    // Без обёртки поля контрол стоит в `div` с классом из `className`.
    const mail = input(root, 'input-mail');
    expect(mail.parentElement?.tagName).toBe('DIV');
    expect(mail.parentElement?.className).toBe('wide');
  });

  it('связывает значение в обе стороны и следит за `disabled`', async () => {
    const bundle = createForm<Shape>({ initial: initial(), schema });
    const { root, settle } = mount(FormRenderer, { form: bundle });
    const name = input(root, 'input-name');

    name.value = 'Борис';
    name.dispatchEvent(new Event('input'));
    expect(bundle.form.name.value.value).toBe('Борис');
    await settle();
    // Текст заголовка подписан на тот же сигнал.
    expect(root.querySelector('h1')?.textContent).toBe('Привет, Борис');

    bundle.form.name.setValue('Вера');
    await settle();
    expect(input(root, 'input-name').value).toBe('Вера');

    expect(name.disabled).toBe(false);
    bundle.form.name.disable();
    await settle();
    expect(input(root, 'input-name').disabled).toBe(true);
  });

  it('обёртка поля из настроек получает ноду и `testId`, ошибки нет в разметке без ошибки', async () => {
    const bundle = createForm<Shape>({ initial: initial(), schema });
    const { root, settle } = mount(FormRenderer, {
      form: bundle,
      settings: { fieldWrapper: FieldWrapper },
      messages: defineIssueMessages({ 'name.taken': 'Занято' }),
    });

    const field = byTestId(root, 'field-name');
    expect(field?.contains(input(root, 'input-name'))).toBe(true);
    expect(byTestId(root, 'field-mail')).not.toBeNull();
    expect(byTestId(root, 'error-name')).toBeNull();

    bundle.form.name.setIssues([{ code: 'name.taken' }]);
    bundle.form.name.markAsTouched();
    await settle();
    expect(byTestId(root, 'error-name')?.textContent).toBe('Занято');

    bundle.form.name.clearIssues();
    await settle();
    expect(byTestId(root, 'error-name')).toBeNull();
  });

  it('`hideWhen` поведения скрывает и возвращает узел', async () => {
    const bundle = createForm<Shape>({
      initial: initial(),
      schema,
      behavior: defineFormBehavior<Shape>(({ model, schema: nodes }) => {
        hideWhen(nodes.node('contacts'), () => model.name === 'скрыть');
      }),
    });
    const { root, settle } = mount(FormRenderer, { form: bundle });
    expect(root.querySelector('#contacts')).not.toBeNull();

    bundle.form.name.setValue('скрыть');
    await settle();
    expect(root.querySelector('#contacts')).toBeNull();

    bundle.form.name.setValue('показать');
    await settle();
    expect(root.querySelector('#contacts')).not.toBeNull();
  });

  it('компонент, который ведёт детей сам, получает узлы и способ их отрисовать', () => {
    const Tabs = defineComponent({
      name: 'Tabs',
      props: {
        children: { type: Array as PropType<readonly { id: string }[]>, default: () => [] },
        renderNode: { type: Function as PropType<RenderNodeFn>, required: true },
      },
      setup(props) {
        return () =>
          h(
            'ol',
            props.children.map((child) =>
              h('li', { key: child.id }, [props.renderNode(child as never)])
            )
          );
      },
    });
    (Tabs as { __selfManagedChildren?: boolean }).__selfManagedChildren = true;

    const bundle = createForm<Shape>({
      initial: initial(),
      schema: (model) => ({
        component: Tabs,
        children: [
          { model: model.$.name, component: TextInput },
          { model: model.$.email, component: TextInput },
        ],
      }),
    });
    const { root } = mount(FormRenderer, { form: bundle });
    const items = root.querySelectorAll('ol > li');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('[data-testid="input-name"]')).not.toBeNull();
    expect(items[1].querySelector('[data-testid="input-email"]')).not.toBeNull();
  });

  it('без схемы у сборки рисовать нечего — ошибка с подсказкой', () => {
    const bundle = createForm<Shape>({ initial: initial() });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => mount(FormRenderer, { form: bundle })).toThrow(/нет дерева/);
    warn.mockRestore();
  });
});

describe('useFormBundle', () => {
  it('запускает живую проверку на монтировании и снимает сборку вместе с компонентом', () => {
    const stop = vi.fn();
    let start: ReturnType<typeof vi.fn> | undefined;
    let dispose: ReturnType<typeof vi.fn> | undefined;
    let factoryCalls = 0;

    const Host = defineComponent({
      setup() {
        const bundle = useFormBundle(() => {
          factoryCalls += 1;
          const created = createForm<Shape>({
            initial: initial(),
            schema,
            validation: defineValidation<Shape>(({ model }) => {
              validate(model.$.name, [required({ code: 'name.required' })]);
            }),
          });
          const controller = created.validation!.controller;
          const realStart = controller.start.bind(controller);
          start = vi.fn(() => {
            const realStop = realStart();
            return () => {
              stop();
              realStop();
            };
          });
          controller.start = start as never;
          const realDispose = created.dispose.bind(created);
          dispose = vi.fn(() => realDispose());
          created.dispose = dispose as never;
          return created;
        });
        return () => h(FormRenderer, { form: bundle });
      },
    });

    const { root, unmount } = mount(Host);
    expect(factoryCalls).toBe(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
    expect(byTestId(root, 'input-name')).not.toBeNull();

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
