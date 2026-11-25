// @vitest-environment happy-dom
/**
 * Контрактный набор рендерера на Vue: те же сценарии проходят рендереры React и Angular.
 *
 * Здесь только то, что у стека своё, — кит компонентов-зондов и монтирование. Что именно
 * проверяется, описано сценариями пакета `renderer-contract`.
 */
import { createApp, defineComponent, h, nextTick, type Component, type PropType } from 'vue';
import type { CompiledNode, FormControl } from '@reformer/core';
import { createI18n } from '@reformer/core/i18n';
import { describeRendererContract, type ContractKit, type Mounted } from 'renderer-contract';
import {
  FormRenderer,
  RenderNode,
  provideI18n,
  useFormBundleContext,
  useFormControl,
  useSignalValue,
} from '../src';
import type { ArrayItemSlot, RenderNodeFn } from '../src';

// ---------------------------------------------------------------------------
// Кит: компоненты-зонды пишут полученные пропсы в атрибуты
// ---------------------------------------------------------------------------

/** Проп любого типа: зонд показывает то, что получил, и типы не проверяет. */
const anyProp = { type: null as unknown as PropType<unknown>, default: undefined };
/** Булев проп без приведения отсутствующего значения к `false`: виден сам факт получения. */
const flagProp = { type: Boolean, default: undefined };
/** Колбэк пропом, а не событием: зонду нужно знать, передан ли он. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callbackProp = { type: Function as PropType<(...args: any[]) => void>, default: undefined };

/** Пропсы контрола, которые зонд выводит атрибутами. */
const probeProps = {
  disabled: { type: Boolean, default: false },
  caption: anyProp,
  placeholder: anyProp,
  options: { type: Array as PropType<unknown[]>, default: undefined },
  label: anyProp,
  description: anyProp,
  required: flagProp,
};

/** Атрибуты `<input>` из пропсов зонда: атрибут есть, только когда проп получен. */
const probeAttrs = (props: {
  disabled: boolean;
  caption: unknown;
  placeholder: unknown;
  options: unknown[] | undefined;
  label: unknown;
  description: unknown;
  required: boolean | undefined;
}): Record<string, unknown> => ({
  disabled: props.disabled,
  placeholder: props.placeholder,
  'data-caption': props.caption,
  'data-options': props.options === undefined ? undefined : props.options.length,
  'data-label': props.label,
  'data-description': props.description,
  'data-required': props.required === undefined ? undefined : String(props.required),
});

/** Текстовый контрол диалекта `v-model`. Потерю фокуса ловит слушатель из атрибутов. */
const createInput = (name: string): Component =>
  defineComponent({
    name,
    inheritAttrs: false,
    props: { ...probeProps, modelValue: anyProp },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h('input', {
          ...attrs,
          ...probeAttrs(props),
          value: String(props.modelValue ?? ''),
          onInput: (event: Event) =>
            emit('update:modelValue', (event.target as HTMLInputElement).value),
        });
    },
  });

const Input = createInput('ProbeInput');
const InlineInput = Object.assign(createInput('ProbeInlineInput'), {
  reformerLayout: 'inline-label',
});

/** Контрол с нодой поля: значение — `value` / `onChange`, как у адаптера без своего диалекта. */
const ControlInput = Object.assign(
  defineComponent({
    name: 'ProbeControlInput',
    inheritAttrs: false,
    props: {
      ...probeProps,
      value: anyProp,
      onChange: callbackProp,
      control: { type: Object as PropType<FormControl<unknown>>, default: undefined },
    },
    setup(props, { attrs }) {
      return () =>
        h('input', {
          ...attrs,
          ...probeAttrs(props),
          value: String(props.value ?? ''),
          'data-path': props.control?.path.value,
          onInput: (event: Event) => props.onChange?.((event.target as HTMLInputElement).value),
        });
    },
  }),
  { reformerAdapter: { passControl: true } }
);

const Toggle = Object.assign(
  defineComponent({
    name: 'ProbeToggle',
    inheritAttrs: false,
    props: { checked: flagProp, disabled: { type: Boolean, default: false }, caption: anyProp },
    emits: ['toggle'],
    setup(props, { attrs, emit }) {
      return () =>
        h('button', {
          ...attrs,
          type: 'button',
          'data-checked': String(props.checked === true),
          'data-caption': props.caption,
          disabled: props.disabled,
          onClick: () => emit('toggle', props.checked !== true),
        });
    },
  }),
  { reformerAdapter: { valueProp: 'checked', changeProp: 'onToggle' } }
);

/** Кнопка зонда. */
const button = (action: string, onClick: () => void) =>
  h('button', { type: 'button', 'data-action': action, onClick });

/** Контейнер. Класс узла приходит атрибутом и ложится на корневой элемент сам. */
const Section = defineComponent({
  name: 'ProbeSection',
  props: {
    title: anyProp,
    tone: anyProp,
    items: { type: Array as PropType<unknown[]>, default: undefined },
    selector: { type: String, default: undefined },
    onSubmit: callbackProp,
  },
  setup(props, { slots }) {
    return () =>
      h(
        'section',
        {
          'data-title': props.title,
          'data-tone': props.tone,
          'data-items': props.items === undefined ? undefined : props.items.join('+'),
          'data-selector': props.selector,
        },
        [
          props.onSubmit ? button('submit', () => props.onSubmit?.('payload')) : null,
          slots.default?.(),
        ]
      );
  },
});

const List = defineComponent({
  name: 'ProbeList',
  props: {
    items: { type: Array as PropType<readonly ArrayItemSlot[]>, default: () => [] },
    onAdd: callbackProp,
    onRemove: callbackProp,
    onMove: callbackProp,
    title: anyProp,
    addLabel: anyProp,
  },
  setup(props) {
    return () =>
      h('div', { 'data-list': '', 'data-title': props.title, 'data-add-label': props.addLabel }, [
        h(
          'ul',
          null,
          props.items.map((item) =>
            h('li', { key: item.key, 'data-index': item.index }, [
              item.children,
              button('remove', () => props.onRemove?.(item.index)),
              button('up', () => props.onMove?.(item.index, item.index - 1)),
              button('down', () => props.onMove?.(item.index, item.index + 1)),
            ])
          )
        ),
        button('add', () => props.onAdd?.()),
      ]);
  },
});

const Steps = Object.assign(
  defineComponent({
    name: 'ProbeSteps',
    props: {
      children: { type: Array as PropType<readonly CompiledNode[]>, default: () => [] },
      renderNode: { type: Function as PropType<RenderNodeFn>, required: true },
    },
    setup(props) {
      return () =>
        h(
          'ol',
          { 'data-count': props.children.length },
          props.children.map((child, index) =>
            h(
              'li',
              {
                key: index,
                'data-step': child.selector,
                'data-kind': child.kind,
                'data-title': (child.props as { title?: unknown } | undefined)?.title,
              },
              [props.renderNode(child)]
            )
          )
        );
    },
  }),
  { __selfManagedChildren: true }
);

/** Пропсы обёртки поля: объявлены обе, иначе Vue отдал бы их атрибутами корневому элементу. */
const wrapperProps = {
  control: { type: Object as PropType<FormControl<unknown>>, required: true as const },
  testId: { type: String, default: undefined },
};

const FieldWrapper = defineComponent({
  name: 'ProbeFieldWrapper',
  props: wrapperProps,
  setup(props, { slots }) {
    const field = useFormControl(props.control);
    return () =>
      h(
        'div',
        {
          'data-wrap': 'field',
          'data-testid': `field-${props.testId}`,
          'data-issues': field.issues.value.length,
        },
        slots.default?.()
      );
  },
});

const PlainWrapper = defineComponent({
  name: 'ProbePlainWrapper',
  props: wrapperProps,
  setup(_props, { slots }) {
    return () => h('div', { 'data-wrap': 'plain' }, slots.default?.());
  },
});

/** Ведёт детей сам и рисует их с обёрткой `PlainWrapper` вместо обёртки из настроек. */
const PlainScope = Object.assign(
  defineComponent({
    name: 'ProbePlainScope',
    props: {
      children: { type: Array as PropType<readonly CompiledNode[]>, default: () => [] },
      // Рендерер передаёт и его: необъявленный проп ушёл бы атрибутом на корень.
      renderNode: { type: Function as PropType<RenderNodeFn>, default: undefined },
    },
    setup(props) {
      return () =>
        h(
          'div',
          { 'data-scope': 'plain' },
          props.children.map((child) =>
            h(RenderNode, { key: child.id, node: child, fieldWrapper: PlainWrapper })
          )
        );
    },
  }),
  { __selfManagedChildren: true }
);

const BundleProbe = defineComponent({
  name: 'ProbeBundle',
  setup() {
    const bundle = useFormBundleContext<{ kind: string }>();
    const kind = bundle ? useSignalValue(() => bundle.form.kind.value.value) : undefined;
    return () =>
      h('b', { 'data-testid': 'bundle-probe' }, kind ? `форма:${kind.value}` : 'нет сборки');
  },
});

const kit: ContractKit = {
  Input,
  InlineInput,
  Toggle,
  ControlInput,
  Section,
  List,
  Steps,
  FieldWrapper,
  PlainWrapper,
  PlainScope,
  BundleProbe,
};

// ---------------------------------------------------------------------------
// Монтирование
// ---------------------------------------------------------------------------

/** Дать Vue дорисовать: перерисовка по сигналу уходит в очередь микрозадач. */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describeRendererContract({
  name: 'renderer-vue',
  kit,

  mount(bundle, options = {}): Mounted {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const settings = options.fieldWrapper
      ? { fieldWrapper: options.fieldWrapper as Component }
      : undefined;
    const locale = options.locale;
    const Host = defineComponent({
      name: 'ContractHost',
      setup() {
        if (locale) provideI18n(createI18n(locale));
        return () => h(FormRenderer, { form: bundle, settings });
      },
    });

    // Ошибку рендера Vue отдаёт обработчику приложения, а не бросает из `mount`.
    let failure: unknown;
    const app = createApp(Host);
    app.config.errorHandler = (error) => {
      failure ??= error;
    };
    app.mount(root);

    if (failure !== undefined) {
      app.unmount();
      root.remove();
      throw failure;
    }

    return {
      root,
      settle,
      unmount() {
        app.unmount();
        root.remove();
      },
    };
  },
});
