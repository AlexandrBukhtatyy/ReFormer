// @vitest-environment happy-dom
/**
 * Поток шагов в компоненте Vue: ссылки следуют за сигналами потока, подписки снимаются вместе с
 * компонентом.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { createForm, type FormBundle, type FormFlow } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { useFormFlow } from '../src';
import { mount, unmountAll } from './mount';

afterEach(unmountAll);

interface Shape {
  name: string;
  email: string;
}

/** Сборка с потоком из двух шагов: первый не отпускает без имени. */
const createSteps = (): { bundle: FormBundle<Shape>; flow: FormFlow } => {
  const bundle = createForm<Shape>({
    initial: { name: '', email: '' },
    flow: {
      steps: [
        {
          id: 'person',
          rules: defineValidation<Shape>(({ model }) => {
            validate(model.$.name, [required()]);
          }),
        },
        { id: 'contacts', rules: defineValidation<Shape>(() => {}) },
      ],
    },
  });
  if (!bundle.flow) throw new Error('у сборки нет потока шагов');
  return { bundle, flow: bundle.flow };
};

/** Число рендеров зонда — чтобы видеть, на что компонент подписан. */
let renders = 0;

const Probe = defineComponent({
  name: 'Probe',
  props: { flow: { type: Object as () => FormFlow, required: true } },
  setup(props) {
    const { current, index, isFirst, isLast } = useFormFlow(props.flow);
    return () => {
      renders++;
      return h('p', {
        'data-current': current.value,
        'data-index': index.value,
        'data-first': isFirst.value,
        'data-last': isLast.value,
      });
    };
  },
});

describe('useFormFlow', () => {
  it('ссылки следуют за переходами потока', async () => {
    const { bundle, flow } = createSteps();
    const { root, settle } = mount(Probe, { flow });
    const probe = (): HTMLElement => root.querySelector('p')!;

    expect(probe().dataset).toMatchObject({ current: 'person', index: '0', first: 'true' });

    // Шаг с замечанием не отпускает: правило имени не выполнено.
    await flow.next();
    await settle();
    expect(probe().dataset.current).toBe('person');

    bundle.form.name.setValue('Анна');
    await flow.next();
    await settle();
    expect(probe().dataset).toMatchObject({ current: 'contacts', index: '1', last: 'true' });

    flow.previous();
    await settle();
    expect(probe().dataset).toMatchObject({ current: 'person', first: 'true', last: 'false' });
  });

  it('компонент не перерисовывается на сигнал, который не читал', async () => {
    const { flow } = createSteps();
    const { settle } = mount(Probe, { flow });
    renders = 0;

    // `validating` и `completed` зонд не читает: неудачный переход меняет только их.
    await flow.next();
    await settle();

    expect(renders).toBe(0);
  });

  it('после снятия компонента подписок на поток не остаётся', async () => {
    const { bundle, flow } = createSteps();
    const handle = mount(Probe, { flow });
    handle.unmount();
    renders = 0;

    bundle.form.name.setValue('Анна');
    await flow.next();
    await handle.settle();

    expect(flow.current.value).toBe('contacts');
    expect(renders).toBe(0);
  });
});
