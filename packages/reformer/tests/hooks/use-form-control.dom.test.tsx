// @vitest-environment happy-dom
/**
 * `useFormControl` в DOM: снапшот поля и массива под-форм, точечные ререндеры и смена контрола.
 *
 * Мок-тесты рядом (`useFormControl-parity`, `useFormControl-rules-of-hooks`) проверяют состав
 * снапшота и число хуков без React. Здесь — настоящий React: каждый сигнал состояния ноды будит
 * компонент ровно один раз, новый массив с теми же замечаниями ререндера не даёт (поэлементное
 * сравнение), соседние ноды компонент не трогают. Переключение `undefined → поле → массив` не
 * ломает порядок хуков, подписка переезжает на новую ноду, StrictMode оставляет одну подписку,
 * размонтирование снимает effect.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrayOf } from '../../src/model';
import type { FormModel } from '../../src/model/types';
import { createForm } from '../../src/form/form-bundle';
import type { FormArray, FormControl, ValidationIssue } from '../../src/form/types/index';
import { useFormControl } from '../../src/platforms/react/hooks/useFormControl';
import type { ArrayControlState, FieldControlState } from '../../src/platforms/react/hooks/types';
import { act, cleanup, renderHookCounting } from '../test-utils/react';
import { liveEffects } from '../test-utils/effect-tracker';
import { FieldArrayStub, InputStub } from '../test-utils/stubs';

/**
 * Счётчик созданных effect'ов: `liveEffects` пересоздание подписки на каждом рендере не видит
 * (минус один, плюс один) — его ловит только число созданий.
 */
const created = vi.hoisted(() => ({ effects: 0 }));

vi.mock('@preact/signals-core', async (importOriginal) => {
  const signals = (await import('../test-utils/effect-tracker')).trackEffects(
    await importOriginal()
  );
  const effect: typeof signals.effect = (fn, options) => {
    created.effects++;
    return signals.effect(fn, options);
  };
  return { ...signals, effect };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface Phone {
  number: string;
}

interface Contacts {
  email: string;
  name: string;
  phones: Phone[];
}

const phoneRow = (row: FormModel<Phone>) => ({
  children: [{ model: row.$.number, component: InputStub }],
});

const createContacts = (initial: Partial<Contacts> = {}) =>
  createForm<Contacts>({
    initial: {
      email: '',
      name: '',
      ...initial,
      phones: arrayOf(() => ({ number: '' }), initial.phones ?? [{ number: '111' }]),
    },
    schema: (model) => ({
      children: [
        { model: model.$.email, component: InputStub, componentProps: { label: 'Почта' } },
        { model: model.$.name, component: InputStub },
        { model: model.$.phones, component: FieldArrayStub, item: phoneRow },
      ],
    }),
  });

type ContactsForm = ReturnType<typeof createContacts>['form'];

const renderField = (control: FormControl<string>, strict = false) =>
  renderHookCounting((props: { control: FormControl<string> }) => useFormControl(props.control), {
    initialProps: { control },
    strict,
  });

type AnyControl = FormControl<string> | FormArray<Phone> | undefined;
type AnyState = FieldControlState<string> | ArrayControlState<Phone>;

/**
 * Хук над контролом любого вида. Перегрузки `useFormControl` не принимают объединение — приведение
 * только для вызова: внутри хук сам различает поле, массив и `undefined`.
 */
const renderAny = (control: AnyControl) =>
  renderHookCounting(
    (props: { control: AnyControl }): AnyState =>
      useFormControl(props.control as FormArray<Phone> | undefined),
    { initialProps: { control } }
  );

describe('useFormControl — поле', () => {
  it('снапшот поля: значение, состояние и пропсы компонента', () => {
    const { form } = createContacts({ email: 'a@b.c' });
    const hook = renderField(form.email);

    expect(hook.result.current).toEqual({
      value: 'a@b.c',
      pending: false,
      disabled: false,
      issues: [],
      valid: true,
      invalid: false,
      touched: false,
      dirty: false,
      shouldShowError: false,
      shouldShowIssues: false,
      componentProps: { label: 'Почта' },
    });
  });

  it.each<
    [
      name: string,
      prepare: (form: ContactsForm) => void,
      change: (form: ContactsForm) => void,
      read: (state: FieldControlState<string>) => unknown,
      expected: unknown,
    ]
  >([
    ['touched', () => {}, (form) => form.email.markAsTouched(), (s) => s.touched, true],
    [
      'замечания',
      () => {},
      (form) => form.email.setIssues([{ code: 'required' }]),
      (s) => [s.issues.map((issue) => issue.code), s.invalid],
      [['required'], true],
    ],
    [
      'ошибка у тронутого поля',
      (form) => form.email.markAsTouched(),
      (form) => form.email.setIssues([{ code: 'required' }]),
      (s) => [s.shouldShowError, s.shouldShowIssues],
      [true, true],
    ],
    [
      'предупреждение у тронутого поля',
      (form) => form.email.markAsTouched(),
      (form) => form.email.setIssues([{ code: 'email.rare', severity: 'warning' }]),
      (s) => [s.shouldShowError, s.shouldShowIssues, s.valid],
      [false, true, true],
    ],
    ['отключение', () => {}, (form) => form.email.disable(), (s) => s.disabled, true],
    [
      'включение',
      (form) => form.email.disable(),
      (form) => form.email.enable(),
      (s) => s.disabled,
      false,
    ],
    [
      'пропсы компонента',
      () => {},
      (form) => form.email.updateComponentProps({ hint: 'h' }),
      (s) => s.componentProps,
      { label: 'Почта', hint: 'h' },
    ],
  ])('%s — один ререндер с новым снапшотом', (_name, prepare, change, read, expected) => {
    const { form } = createContacts();
    prepare(form);
    const hook = renderField(form.email);
    const before = hook.renders();

    act(() => change(form));

    expect(hook.renders()).toBe(before + 1);
    expect(read(hook.result.current)).toEqual(expected);
  });

  it('setValue — значение и dirty одним ререндером', () => {
    const { form } = createContacts();
    const hook = renderField(form.email);
    const before = hook.renders();

    act(() => form.email.setValue('x@y.z'));

    expect(hook.renders()).toBe(before + 1);
    expect(hook.result.current).toMatchObject({ value: 'x@y.z', dirty: true });
  });

  it('новый массив с теми же замечаниями не перерисовывает — сравнение поэлементное', () => {
    const { form } = createContacts();
    const issue: ValidationIssue = { code: 'required' };
    const hook = renderField(form.email);
    act(() => form.email.setIssues([issue]));
    const snapshot = hook.result.current;
    const before = hook.renders();

    act(() => form.email.setIssues([issue]));

    expect(hook.renders()).toBe(before);
    expect(hook.result.current).toBe(snapshot);
  });

  it('снятие замечаний у поля без замечаний не перерисовывает', () => {
    const { form } = createContacts();
    const hook = renderField(form.email);
    const before = hook.renders();

    act(() => form.email.clearIssues());

    expect(hook.renders()).toBe(before);
  });

  it('то же число замечаний с другим содержимым перерисовывает', () => {
    const { form } = createContacts();
    const hook = renderField(form.email);
    act(() => form.email.setIssues([{ code: 'required' }]));
    const before = hook.renders();

    act(() => form.email.setIssues([{ code: 'email' }]));

    expect(hook.renders()).toBe(before + 1);
    expect(hook.result.current.issues).toEqual([{ code: 'email' }]);
  });

  it('правка пропсов теми же значениями не перерисовывает, другим значением — да [ReFormer-0f7y]', () => {
    // `updateComponentProps` всегда создаёт новый объект пропсов — снапшот сравнивает поверхностно.
    const options = ['a', 'b'];
    const { form } = createContacts();
    const hook = renderField(form.email);
    act(() => form.email.updateComponentProps({ options }));
    const before = hook.renders();

    act(() => form.email.updateComponentProps({ options }));
    expect(hook.renders()).toBe(before);

    act(() => form.email.updateComponentProps({ options: ['a', 'b'] }));
    expect(hook.renders()).toBe(before + 1);
    expect(hook.result.current.componentProps.options).toEqual(['a', 'b']);
  });

  it('соседнее поле и массив не перерисовывают', () => {
    const { form } = createContacts();
    const hook = renderField(form.email);
    const before = hook.renders();

    act(() => form.name.setValue('Анна'));
    act(() => form.phones.push());

    expect(hook.renders()).toBe(before);
  });
});

describe('useFormControl — массив под-форм', () => {
  it('снапшот массива: значения строк, длина и собственные замечания', () => {
    const { form } = createContacts({ phones: [{ number: '1' }, { number: '2' }] });
    const hook = renderAny(form.phones);

    expect(hook.result.current).toEqual({
      value: [{ number: '1' }, { number: '2' }],
      length: 2,
      pending: false,
      issues: [],
      ownIssues: [],
      valid: true,
      invalid: false,
      touched: false,
      dirty: false,
      disabled: false,
    });
  });

  it('push и removeAt перерисовывают и меняют длину', () => {
    const { form } = createContacts();
    const hook = renderAny(form.phones);

    act(() => form.phones.push({ number: '222' }));
    expect(hook.result.current).toMatchObject({ length: 2 });

    act(() => form.phones.removeAt(0));
    expect(hook.result.current).toMatchObject({ length: 1, value: [{ number: '222' }] });
  });

  it('правка поля строки меняет значение массива — ререндер', () => {
    const bundle = createContacts();
    const hook = renderAny(bundle.form.phones);
    const before = hook.renders();

    act(() => {
      bundle.model.phones.at(0).number = '999';
    });

    expect(hook.renders()).toBe(before + 1);
    expect(hook.result.current.value).toEqual([{ number: '999' }]);
  });

  it('замечание на ручке массива — в ownIssues и issues', () => {
    const { form } = createContacts();
    const hook = renderAny(form.phones);

    act(() => form.phones.setIssues([{ code: 'minLength', params: { minLength: 2 } }]));

    const state = hook.result.current as ArrayControlState<Phone>;
    expect(state.ownIssues.map((issue) => issue.code)).toEqual(['minLength']);
    expect(state.issues.map((issue) => issue.code)).toEqual(['minLength']);
    expect(state.valid).toBe(false);
  });

  it('отключение массива видно в снапшоте', () => {
    const { form } = createContacts();
    const hook = renderAny(form.phones);

    act(() => form.phones.disable());

    expect(hook.result.current.disabled).toBe(true);
  });
});

describe('useFormControl — undefined и смена контрола', () => {
  it('undefined — пустой снапшот массива', () => {
    const hook = renderAny(undefined);

    expect(hook.result.current).toEqual({
      value: [],
      length: 0,
      pending: false,
      issues: [],
      ownIssues: [],
      valid: true,
      invalid: false,
      touched: false,
      dirty: false,
      disabled: false,
    });
  });

  it('undefined → поле → массив → undefined: порядок хуков цел, React не падает', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { form } = createContacts({ email: 'e', phones: [{ number: '1' }] });
    const hook = renderAny(undefined);

    hook.rerender({ control: form.email });
    hook.rerender({ control: form.phones });
    hook.rerender({ control: undefined });

    // Ни «Rendered more hooks», ни предупреждения о смене порядка хуков.
    expect(error).not.toHaveBeenCalled();
  });

  // Ветки поля, массива и `undefined` стоят на одних позициях хуков, а построитель снапшота в
  // каждой мемоизирован `useCallback(…, [])`: после смены вида React отдаёт построитель прежней
  // ветки. Поле, появившееся вместо `undefined`, видно как пустой массив; поле вместо массива —
  // снапшотом массива и наоборот.
  it('undefined → поле: снапшот поля, а не пустой снапшот массива [ReFormer-cyyb]', () => {
    const { form } = createContacts({ email: 'e' });
    const hook = renderAny(undefined);

    hook.rerender({ control: form.email });

    expect(hook.result.current.value).toBe('e');
  });

  // Обход дефекта для приложений: другой вид ноды — другой экземпляр компонента (свой `key`).
  it('смена вида ноды с перемонтированием отдаёт снапшот нового вида', () => {
    const { form } = createContacts({ email: 'e', phones: [{ number: '1' }] });

    const field = renderAny(form.email);
    expect(field.result.current).toMatchObject({ value: 'e', shouldShowError: false });
    field.unmount();

    const array = renderAny(form.phones);
    expect(array.result.current).toMatchObject({ length: 1, ownIssues: [] });
  });

  it('другое поле — подписка переезжает, старое поле компонент не будит', () => {
    const first = createContacts({ email: 'first' });
    const second = createContacts({ email: 'second' });
    const hook = renderAny(first.form.email);
    const subscribed = liveEffects();
    const createdBefore = created.effects;

    hook.rerender({ control: second.form.email });
    expect(hook.result.current.value).toBe('second');
    expect(created.effects).toBe(createdBefore + 1);
    expect(liveEffects()).toBe(subscribed);

    const before = hook.renders();
    act(() => first.form.email.markAsTouched());
    expect(hook.renders()).toBe(before);

    act(() => second.form.email.markAsTouched());
    expect(hook.renders()).toBe(before + 1);
    expect(hook.result.current.touched).toBe(true);
  });

  it('ререндер родителя без смены контрола не пересоздаёт подписку', () => {
    const { form } = createContacts();
    const hook = renderAny(form.email);
    const subscribed = liveEffects();
    const createdBefore = created.effects;
    const snapshot = hook.result.current;

    for (let i = 0; i < 5; i++) hook.rerender({ control: form.email });

    expect(created.effects).toBe(createdBefore);
    expect(liveEffects()).toBe(subscribed);
    expect(hook.result.current).toBe(snapshot);
  });
});

describe('useFormControl — StrictMode', () => {
  it('двойной эффект оставляет одну подписку', () => {
    const { form } = createContacts();
    const base = liveEffects();
    const hook = renderField(form.email, true);
    expect(liveEffects()).toBe(base + 1);

    act(() => form.email.setValue('strict'));
    expect(hook.result.current).toMatchObject({ value: 'strict', dirty: true });

    hook.unmount();
    expect(liveEffects()).toBe(base);
  });
});

describe('useFormControl — размонтирование', () => {
  it('поле: effect снят, записи не перерисовывают', () => {
    const { form } = createContacts();
    const base = liveEffects();
    const hook = renderField(form.email);
    expect(liveEffects()).toBe(base + 1);

    hook.unmount();
    const after = hook.renders();
    act(() => {
      form.email.setValue('после');
      form.email.markAsTouched();
    });

    expect(hook.renders()).toBe(after);
    expect(liveEffects()).toBe(base);
  });

  it('массив и undefined: effect снят', () => {
    const { form } = createContacts();
    const base = liveEffects();
    const array = renderAny(form.phones);
    const empty = renderAny(undefined);
    expect(liveEffects()).toBe(base + 2);

    array.unmount();
    empty.unmount();
    act(() => form.phones.push());

    expect(liveEffects()).toBe(base);
  });
});
