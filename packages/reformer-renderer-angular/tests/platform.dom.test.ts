/**
 * Слой платформы: владение сборкой, сборка из дерева рендерера, состояние поля и потока шагов
 * сигналами Angular, текст показанного замечания.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { createForm } from '@reformer/core';
import type { FormBundle, FormControl, FormFlow, FormModel } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { signal as coreSignal } from '@reformer/core/signals';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FormRenderer,
  fieldError,
  formControlSignals,
  formFlowSignals,
  injectFormBundle,
  ownFormBundle,
  provideIssueMessages,
} from '../src/public-api';
import { get, mount, unmountAll } from './mount';

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

interface Shape {
  name: string;
  email: string;
}

const initial = (): Shape => ({ name: 'Анна', email: '' });

/** Текстовый контрол диалекта `[(value)]`; хост — сам `<input>`. */
@Component({
  selector: 'input[platformInput]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[value]': 'text()', '(input)': 'emit($event)' },
})
class PlainInput {
  readonly value = input<unknown>();
  readonly valueChange = output<string>();
  protected readonly text = computed(() => String(this.value() ?? ''));

  protected emit(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}

const schema = (model: FormModel<Shape>) => ({
  children: [{ model: model.$.name, component: PlainInput }],
});

/** Атрибуты `data-*` элемента обычным объектом: пустая строка — тоже значение. */
function dataOf(root: ParentNode, selector: string): Record<string, string> {
  const data: Record<string, string> = {};
  for (const attribute of Array.from(get(root, selector).attributes)) {
    if (attribute.name.startsWith('data-')) data[attribute.name.slice(5)] = attribute.value;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Владение сборкой
// ---------------------------------------------------------------------------

/** Фабрика сборки компонента-владельца: её задаёт тест. */
let factory: () => FormBundle<Shape>;

@Component({
  selector: 'test-owner',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<reformer-form [form]="bundle" />`,
})
class Owner {
  readonly bundle = ownFormBundle(() => factory());
}

describe('ownFormBundle', () => {
  it('собирает форму один раз, запускает живую проверку после отрисовки и снимает сборку с компонентом', async () => {
    const stop = vi.fn();
    const start = vi.fn();
    const dispose = vi.fn();
    let calls = 0;
    factory = () => {
      calls += 1;
      const created = createForm<Shape>({
        initial: initial(),
        schema,
        validation: defineValidation<Shape>(({ model }) => {
          validate(model.$.name, [required({ code: 'name.required' })]);
        }),
      });
      const controller = created.validation!.controller;
      const realStart = controller.start.bind(controller);
      controller.start = () => {
        start();
        const realStop = realStart();
        return () => {
          stop();
          realStop();
        };
      };
      const realDispose = created.dispose.bind(created);
      created.dispose = () => {
        dispose();
        realDispose();
      };
      return created;
    };

    const { root, unmount } = await mount(Owner);
    expect(calls).toBe(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
    expect(get<HTMLInputElement>(root, 'input').value).toBe('Анна');

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Сборка из дерева рендерера
// ---------------------------------------------------------------------------

/** Сборки, которые увидели зонды. */
const seenBundles: unknown[] = [];

@Component({
  selector: 'b[bundleProbe]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BundleProbe {
  constructor() {
    seenBundles.push(injectFormBundle());
  }
}

describe('injectFormBundle', () => {
  afterEach(() => {
    seenBundles.length = 0;
  });

  it('внутри рендерера отдаёт ту же сборку, что получил рендерер', async () => {
    const bundle = createForm<Shape>({
      initial: initial(),
      schema: () => ({ component: BundleProbe }),
    });
    await mount(FormRenderer, [], { form: bundle });

    expect(seenBundles).toHaveLength(1);
    expect(seenBundles[0]).toBe(bundle);
    bundle.dispose();
  });

  it('вне рендерера сборки нет', async () => {
    await mount(BundleProbe);

    expect(seenBundles).toEqual([null]);
  });
});

// ---------------------------------------------------------------------------
// Состояние поля
// ---------------------------------------------------------------------------

/** Число отрисовок зонда — чтобы видеть, на что компонент подписан. */
let renders = 0;

@Component({
  selector: 'test-control-probe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <output
      [attr.data-value]="field.value()"
      [attr.data-disabled]="field.disabled()"
      [attr.data-touched]="field.touched()"
      [attr.data-path]="field.path()"
      [attr.data-issues]="field.issues().length"
      >{{ rendered() }}</output
    >
  `,
})
class ControlProbe {
  readonly control = input.required<FormControl<string>>();
  protected readonly field = formControlSignals(this.control);

  protected rendered(): string {
    renders += 1;
    return '';
  }
}

describe('formControlSignals', () => {
  it('сигналы следуют за нодой поля', async () => {
    const bundle = createForm<Shape>({ initial: initial() });
    const { root, settle } = await mount(ControlProbe, [], { control: bundle.form.name });

    expect(dataOf(root, 'output')).toMatchObject({
      value: 'Анна',
      disabled: 'false',
      touched: 'false',
      path: 'name',
      issues: '0',
    });

    bundle.form.name.setValue('Вера');
    bundle.form.name.markAsTouched();
    bundle.form.name.setIssues([{ code: 'name.taken' }]);
    await settle();

    expect(dataOf(root, 'output')).toMatchObject({
      value: 'Вера',
      disabled: 'false',
      touched: 'true',
      issues: '1',
    });

    bundle.form.name.disable();
    await settle();
    expect(dataOf(root, 'output').disabled).toBe('true');
    bundle.dispose();
  });

  it('сигналы следуют за сменой ноды во входе, прежняя нода компонент больше не перерисовывает', async () => {
    const bundle = createForm<Shape>({ initial: initial() });
    const { root, ref, settle } = await mount(ControlProbe, [], { control: bundle.form.name });

    ref.setInput('control', bundle.form.email);
    await settle();
    expect(dataOf(root, 'output')).toMatchObject({ value: '', path: 'email' });

    renders = 0;
    bundle.form.name.setValue('Вера');
    await settle();
    expect(renders).toBe(0);

    bundle.form.email.setValue('vera@example.com');
    await settle();
    expect(dataOf(root, 'output').value).toBe('vera@example.com');
    bundle.dispose();
  });

  it('компонент не перерисовывается на сигнал, который не читал', async () => {
    const bundle = createForm<Shape>({ initial: initial() });
    const { settle } = await mount(ControlProbe, [], { control: bundle.form.name });
    renders = 0;

    // Реактивные пропсы ноды зонд не читает.
    bundle.form.name.updateComponentProps({ placeholder: 'Имя' });
    await settle();

    expect(renders).toBe(0);
    bundle.dispose();
  });
});

// ---------------------------------------------------------------------------
// Текст замечания
// ---------------------------------------------------------------------------

/** Обёртка поля: текст ошибки — только когда он есть. */
@Component({
  selector: 'div[errorWrapper]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
    @if (error(); as text) {
      <p data-role="error">{{ text }}</p>
    }
  `,
})
class ErrorWrapper {
  readonly control = input.required<FormControl<unknown>>();
  protected readonly error = fieldError(this.control);
}

describe('fieldError', () => {
  const settings = { fieldWrapper: ErrorWrapper };
  const errorText = (root: ParentNode): string | undefined =>
    root.querySelector('[data-role="error"]')?.textContent ?? undefined;

  it('текст замечания тронутого поля — из словаря формы; без замечания элемента ошибки нет', async () => {
    const bundle = createForm<Shape>({ initial: initial(), schema });
    const { root, settle } = await mount(FormRenderer, [], {
      form: bundle,
      settings,
      messages: defineIssueMessages({ 'name.taken': 'Занято' }),
    });
    expect(errorText(root)).toBeUndefined();

    // Замечание нетронутого поля не показывается.
    bundle.form.name.setIssues([{ code: 'name.taken' }]);
    await settle();
    expect(errorText(root)).toBeUndefined();

    bundle.form.name.markAsTouched();
    await settle();
    expect(errorText(root)).toBe('Занято');

    bundle.form.name.clearIssues();
    await settle();
    expect(errorText(root)).toBeUndefined();
    bundle.dispose();
  });

  it('словарь формы накрывает словарь предка, остальные коды берутся у предка', async () => {
    const bundle = createForm<Shape>({ initial: initial(), schema });
    const { root, settle } = await mount(
      FormRenderer,
      [
        provideIssueMessages(
          defineIssueMessages({ 'name.taken': 'Занято у предка', 'name.short': 'Коротко' })
        ),
      ],
      { form: bundle, settings, messages: defineIssueMessages({ 'name.taken': 'Занято' }) }
    );
    bundle.form.name.markAsTouched();

    bundle.form.name.setIssues([{ code: 'name.taken' }]);
    await settle();
    expect(errorText(root)).toBe('Занято');

    bundle.form.name.setIssues([{ code: 'name.short' }]);
    await settle();
    expect(errorText(root)).toBe('Коротко');
    bundle.dispose();
  });
});

// ---------------------------------------------------------------------------
// Поток шагов
// ---------------------------------------------------------------------------

@Component({
  selector: 'test-flow-probe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p
      [attr.data-current]="steps.current()"
      [attr.data-index]="steps.index()"
      [attr.data-first]="steps.isFirst()"
      [attr.data-last]="steps.isLast()"
    >
      {{ rendered() }}
    </p>
  `,
})
class FlowProbe {
  readonly flow = input.required<FormFlow>();
  protected readonly steps = formFlowSignals(this.flow);

  protected rendered(): string {
    renders += 1;
    return '';
  }
}

/** Сборка с потоком из двух шагов: первый не отпускает без имени. */
function createSteps(): { bundle: FormBundle<Shape>; flow: FormFlow } {
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
}

/**
 * Поток из сигналов, которые сообщают о подписчиках: по нему видно, на какие сигналы компонент
 * подписан сейчас.
 */
function watchedFlow(): { flow: FormFlow; watched(): string[] } {
  const live = new Set<string>();
  const tracked = <T>(name: string, value: T) =>
    coreSignal(value, {
      watched: () => void live.add(name),
      unwatched: () => void live.delete(name),
    });
  const flow = {
    steps: ['person', 'contacts'],
    activeSteps: tracked('activeSteps', ['person', 'contacts']),
    current: tracked('current', 'person'),
    index: tracked('index', 0),
    completed: tracked('completed', new Set<string>()),
    isFirst: tracked('isFirst', true),
    isLast: tracked('isLast', false),
    validating: tracked('validating', false),
  } as unknown as FormFlow;
  return { flow, watched: () => [...live].sort() };
}

describe('formFlowSignals', () => {
  it('сигналы следуют за переходами потока', async () => {
    const { bundle, flow } = createSteps();
    const { root, settle } = await mount(FlowProbe, [], { flow });

    expect(dataOf(root, 'p')).toMatchObject({ current: 'person', index: '0', first: 'true' });

    // Шаг с замечанием не отпускает: правило имени не выполнено.
    await flow.next();
    await settle();
    expect(dataOf(root, 'p').current).toBe('person');

    bundle.form.name.setValue('Анна');
    await flow.next();
    await settle();
    expect(dataOf(root, 'p')).toMatchObject({ current: 'contacts', index: '1', last: 'true' });

    flow.previous();
    await settle();
    expect(dataOf(root, 'p')).toMatchObject({ current: 'person', first: 'true', last: 'false' });
    bundle.dispose();
  });

  it('компонент не перерисовывается на сигнал, который не читал', async () => {
    const { bundle, flow } = createSteps();
    const { settle } = await mount(FlowProbe, [], { flow });
    renders = 0;

    // `validating` и `completed` зонд не читает: неудачный переход меняет только их.
    await flow.next();
    await settle();

    expect(renders).toBe(0);
    bundle.dispose();
  });

  it('компонент подписан только на прочитанные сигналы, после снятия подписок не остаётся', async () => {
    const { flow, watched } = watchedFlow();
    const { unmount } = await mount(FlowProbe, [], { flow });

    expect(watched()).toEqual(['current', 'index', 'isFirst', 'isLast']);

    unmount();
    expect(watched()).toEqual([]);
  });
});
