// @vitest-environment happy-dom
/**
 * Идентичность ссылок: нода формы и сборка доходят до компонентов теми же объектами, а не
 * прокси Vue. Ядро сопоставляет ноды и ручки модели по ссылке — прокси вместо ноды порвал бы связь
 * поля с формой молча.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, isProxy, reactive, ref, type PropType } from 'vue';
import { createForm, type FormControl, type FormModel } from '@reformer/core';
import { FormRenderer, useFormBundle, useFormBundleContext } from '../src';
import { mount, unmountAll } from './mount';

afterEach(unmountAll);

interface Shape {
  name: string;
}

/** Что увидел компонент-зонд. */
interface Seen {
  control?: unknown;
  /** Нода после `ref()` и `reactive()` — как её держал бы компонент приложения. */
  heldInRef?: unknown;
  heldInReactive?: unknown;
  wrapperControl?: unknown;
  bundle?: unknown;
}

function probes(seen: Seen) {
  /** Контрол, который просит ноду поля статикой `reformerNeedsControl`. */
  const Probe = defineComponent({
    name: 'Probe',
    inheritAttrs: false,
    props: {
      modelValue: { type: String, default: '' },
      disabled: { type: Boolean, default: false },
      control: { type: Object as PropType<FormControl<unknown>>, default: undefined },
    },
    emits: ['update:modelValue', 'blur'],
    setup(props) {
      seen.control = props.control;
      seen.heldInRef = ref(props.control).value;
      seen.heldInReactive = reactive({ control: props.control }).control;
      seen.bundle = useFormBundleContext();
      return () => h('input', { value: props.modelValue });
    },
  });
  (Probe as { reformerNeedsControl?: boolean }).reformerNeedsControl = true;

  const Wrapper = defineComponent({
    name: 'Wrapper',
    props: {
      control: { type: Object as PropType<FormControl<unknown>>, required: true },
      testId: { type: String, default: undefined },
    },
    setup(props, { slots }) {
      seen.wrapperControl = props.control;
      return () => h('div', slots.default?.());
    },
  });

  const schema = (model: FormModel<Shape>) => ({
    children: [{ model: model.$.name, component: Probe }],
  });
  return { Wrapper, schema };
}

describe('идентичность ссылок', () => {
  it('контрол и обёртка получают ноду формы, а не прокси Vue', () => {
    const seen: Seen = {};
    const { Wrapper, schema } = probes(seen);
    const bundle = createForm<Shape>({ initial: { name: 'Анна' }, schema });
    mount(FormRenderer, { form: bundle, settings: { fieldWrapper: Wrapper } });

    const node = bundle.form.name;
    expect(seen.control).toBe(node);
    expect(seen.wrapperControl).toBe(node);
    expect(isProxy(seen.control)).toBe(false);
    // Нода переживает `ref()` и `reactive()` приложения той же ссылкой.
    expect(seen.heldInRef).toBe(node);
    expect(seen.heldInReactive).toBe(node);
  });

  it('контекст сборки отдаёт ту же сборку', () => {
    const seen: Seen = {};
    const { schema } = probes(seen);
    const bundle = createForm<Shape>({ initial: { name: 'Анна' }, schema });
    mount(FormRenderer, { form: bundle });

    expect(seen.bundle).toBe(bundle);
    expect(isProxy(seen.bundle)).toBe(false);
  });

  it('сборка `useFormBundle` в `ref()` остаётся той же ссылкой', () => {
    const seen: Seen = {};
    const { schema } = probes(seen);
    let owned: unknown;
    let held: unknown;
    const Host = defineComponent({
      setup() {
        const bundle = useFormBundle(() =>
          createForm<Shape>({ initial: { name: 'Анна' }, schema })
        );
        owned = bundle;
        held = ref(bundle).value;
        return () => h(FormRenderer, { form: bundle });
      },
    });
    mount(Host);

    expect(held).toBe(owned);
    expect(seen.bundle).toBe(owned);
  });
});
