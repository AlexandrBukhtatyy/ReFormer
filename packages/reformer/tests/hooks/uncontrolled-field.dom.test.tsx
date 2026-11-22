// @vitest-environment happy-dom
/**
 * Неуправляемая привязка нативного контрола (`FieldAdapter.uncontrolled`): ввод не перерисовывает
 * компонент поля, запись в поле извне доходит до DOM-элемента, собственный ввод не перетирается.
 * Компонент поля здесь — как у потребителя: `useFormControl` и seam, где `value` читается при
 * обращении.
 */
import { Profiler, createRef, useLayoutEffect, type ChangeEvent, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createForm } from '../../src/form/form-bundle';
import type { FormControl } from '../../src/form/types/index';
import { useFormControl } from '../../src/platforms/react/hooks/useFormControl';
import { watchValueOf } from '../../src/platforms/react/hooks/useSignalSubscription';
import {
  bindFieldProps,
  type FieldAdapter,
  type FieldSeam,
} from '../../src/platforms/react/field-binding/field-adapter';
import { act, StrictWrapper } from '../test-utils/react';
import { createdEffects, liveEffects } from '../test-utils/effect-tracker';
import { collectUntilReleased } from '../test-utils/gc';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

afterEach(cleanup);

type Target = { target: HTMLInputElement };

const textAdapter: FieldAdapter = {
  uncontrolled: true,
  fromEmit: (event) => (event as ChangeEvent<HTMLInputElement>).target.value,
  toValue: (value) => value ?? '',
};

/** Число в текстовом поле: `''` — `null`. */
const numberAdapter: FieldAdapter = {
  uncontrolled: true,
  fromEmit: (event) => {
    const text = (event as Target).target.value;
    return text === '' ? null : Number(text);
  },
  toValue: (value) => (value == null ? '' : String(value)),
};

const checkedAdapter: FieldAdapter = {
  uncontrolled: true,
  valueProp: 'checked',
  fromEmit: (event) => (event as Target).target.checked,
  toValue: (value) => Boolean(value),
};

/** Seam, где `value` читается из подписанного снимка при обращении. */
function useSeam(control: FormControl<unknown>): {
  seam: FieldSeam;
  state: ReturnType<typeof useFormControl>;
} {
  const state = useFormControl(control);
  const seam: FieldSeam = {
    control,
    get value() {
      return state.value;
    },
    onChange: (value) => control.setValue(value),
    onBlur: () => control.markAsTouched(),
  };
  return { seam, state };
}

/** Поле: контрол и первое замечание. */
function Field({
  control,
  adapter,
  type = 'text',
}: {
  control: FormControl<unknown>;
  adapter: FieldAdapter;
  type?: string;
}) {
  const { seam, state } = useSeam(control);
  return (
    <>
      <input type={type} data-testid="control" {...bindFieldProps(adapter, seam)} />
      {state.issues.length > 0 ? <span role="alert">{state.issues[0].code}</span> : null}
    </>
  );
}

function renderCounting(node: ReactNode) {
  const renders = { count: 0 };
  const view = render(
    <Profiler id="field" onRender={() => renders.count++}>
      {node}
    </Profiler>
  );
  const control = view.getByTestId('control') as HTMLInputElement;
  return { renders, view, control };
}

const createProfile = () =>
  createForm<{ name: string; age: number | null; agree: boolean; city: string }>({
    initial: { name: 'Анна', age: null, agree: false, city: 'msk' },
  });

describe('неуправляемая привязка — текст', () => {
  it('начальное значение — в DOM; ввод пишет в поле и не перерисовывает компонент', () => {
    const { form } = createProfile();
    const { renders, control } = renderCounting(
      <Field control={form.name as FormControl<unknown>} adapter={textAdapter} />
    );
    expect(control.value).toBe('Анна');
    const before = renders.count;

    fireEvent.change(control, { target: { value: 'Анна Ивановна' } });
    fireEvent.change(control, { target: { value: 'Анна Ивановна!' } });

    expect(form.name.value.value).toBe('Анна Ивановна!');
    expect(form.name.dirty.value).toBe(true);
    expect(control.value).toBe('Анна Ивановна!');
    expect(renders.count).toBe(before);
  });

  it('setValue и reset доходят до DOM без рендера; замечание поле перерисовывает', () => {
    const { form } = createProfile();
    const { renders, view, control } = renderCounting(
      <Field control={form.name as FormControl<unknown>} adapter={textAdapter} />
    );
    const before = renders.count;

    act(() => form.name.setValue('Пётр'));
    expect(control.value).toBe('Пётр');
    act(() => form.name.reset());
    expect(control.value).toBe('Анна');
    expect(renders.count).toBe(before);

    act(() => form.name.setIssues([{ code: 'taken' }]));
    expect(renders.count).toBe(before + 1);
    expect(view.getByRole('alert').textContent).toBe('taken');
  });

  it('blur помечает поле тронутым', () => {
    const { form } = createProfile();
    const { control } = renderCounting(
      <Field control={form.name as FormControl<unknown>} adapter={textAdapter} />
    );
    fireEvent.blur(control);
    expect(form.name.touched.value).toBe(true);
  });
});

describe('неуправляемая привязка — разбор значения', () => {
  it('ввод, который разбирается в то же значение, не перетирается', () => {
    const { form } = createProfile();
    const { control } = renderCounting(
      <Field control={form.age as FormControl<unknown>} adapter={numberAdapter} />
    );
    expect(control.value).toBe('');

    fireEvent.change(control, { target: { value: '1.50' } });
    expect(form.age.value.value).toBe(1.5);
    expect(control.value).toBe('1.50');

    act(() => form.age.setValue(2));
    expect(control.value).toBe('2');
    act(() => form.age.setValue(null));
    expect(control.value).toBe('');
  });
});

describe('неуправляемая привязка — чекбокс, список, радиогруппа', () => {
  it('чекбокс: checked в DOM, клик пишет в поле, запись извне — в DOM', () => {
    const { form } = createProfile();
    const { renders, control } = renderCounting(
      <Field
        control={form.agree as FormControl<unknown>}
        adapter={checkedAdapter}
        type="checkbox"
      />
    );
    const before = renders.count;
    expect(control.checked).toBe(false);

    fireEvent.click(control);
    expect(form.agree.value.value).toBe(true);
    act(() => form.agree.setValue(false));
    expect(control.checked).toBe(false);
    expect(renders.count).toBe(before);
  });

  it('список: выбор пишет в поле, запись извне выбирает вариант', () => {
    const { form } = createProfile();
    function City() {
      const { seam } = useSeam(form.city as FormControl<unknown>);
      return (
        <select data-testid="control" {...bindFieldProps(textAdapter, seam)}>
          <option value="msk">Москва</option>
          <option value="spb">Петербург</option>
        </select>
      );
    }
    const { control } = renderCounting(<City />);
    const select = control as unknown as HTMLSelectElement;
    expect(select.value).toBe('msk');

    fireEvent.change(select, { target: { value: 'spb' } });
    expect(form.city.value.value).toBe('spb');
    act(() => form.city.setValue('msk'));
    expect(select.value).toBe('msk');
  });

  it('список: опции, пришедшие после монтирования, возвращают выбор значения поля', async () => {
    const { form } = createProfile();
    function City({ cities }: { cities: string[] }) {
      const { seam } = useSeam(form.city as FormControl<unknown>);
      return (
        <select data-testid="control" {...bindFieldProps(textAdapter, seam)}>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      );
    }
    const view = render(<City cities={[]} />);
    const select = view.getByTestId('control') as HTMLSelectElement;

    view.rerender(<City cities={['spb', 'msk']} />);
    // Наблюдатель опций — микрозадача после вставки.
    await Promise.resolve();

    expect(select.value).toBe('msk');
    expect(form.city.value.value).toBe('msk');
  });

  it('радиогруппа: одна ссылка на все кнопки, отмечена кнопка значения поля', () => {
    const { form } = createProfile();
    function Cities() {
      const { seam } = useSeam(form.city as FormControl<unknown>);
      const { defaultValue, ...bound } = bindFieldProps(textAdapter, seam);
      return (
        <div data-testid="control">
          {['msk', 'spb'].map((city) => (
            <input
              key={city}
              type="radio"
              name="city"
              value={city}
              aria-label={city}
              defaultChecked={defaultValue === city}
              {...bound}
            />
          ))}
        </div>
      );
    }
    const { view } = renderCounting(<Cities />);
    const radio = (city: string) => view.getByLabelText(city) as HTMLInputElement;
    expect([radio('msk').checked, radio('spb').checked]).toEqual([true, false]);

    fireEvent.click(radio('spb'));
    expect(form.city.value.value).toBe('spb');
    act(() => form.city.setValue('msk'));
    expect([radio('msk').checked, radio('spb').checked]).toEqual([true, false]);
  });
});

describe('неуправляемая привязка — чужой ref', () => {
  it('ref из прочих props получает элемент и отпускает его при размонтировании', () => {
    const { form } = createProfile();
    const outer = createRef<HTMLInputElement>();
    function Named() {
      const { seam } = useSeam(form.name as FormControl<unknown>);
      return <input data-testid="control" {...bindFieldProps(textAdapter, seam, { ref: outer })} />;
    }
    const { view, control } = renderCounting(<Named />);
    expect(outer.current).toBe(control);
    view.unmount();
    expect(outer.current).toBeNull();
  });
});

describe('неуправляемая привязка — жизненный цикл', () => {
  it('ссылка стабильна между рендерами; размонтирование снимает синхронизацию', () => {
    const { form } = createProfile();
    const baseline = liveEffects();
    const { view, control } = renderCounting(
      <StrictWrapper>
        <Field control={form.name as FormControl<unknown>} adapter={textAdapter} />
      </StrictWrapper>
    );
    const attached = liveEffects();
    const created = createdEffects();

    act(() => form.name.setIssues([{ code: 'taken' }]));
    act(() => form.name.setIssues([]));
    expect(createdEffects()).toBe(created);

    view.unmount();
    expect(liveEffects()).toBeLessThan(attached);
    expect(liveEffects()).toBe(baseline);
    act(() => form.name.setValue('Пётр'));
    expect(control.value).toBe('Анна');
  });

  /** Список, привязанный к полю города. */
  function cityField(form: ReturnType<typeof createProfile>['form']) {
    return function City() {
      const { seam } = useSeam(form.city as FormControl<unknown>);
      return (
        <select data-testid="control" {...bindFieldProps(textAdapter, seam)}>
          <option value="msk">Москва</option>
          <option value="spb">Петербург</option>
        </select>
      );
    };
  }

  it('наблюдатель опций — свой у каждого списка и отключается при размонтировании [ReFormer-2o1j.23]', () => {
    const { form } = createProfile();
    const City = cityField(form);
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    try {
      const first = render(<City />);
      const second = render(<City />);
      const observers = observe.mock.calls.flatMap(([target], i) =>
        (target as Element).tagName === 'SELECT' ? [observe.mock.contexts[i]] : []
      );
      expect(new Set(observers).size).toBe(2);

      first.unmount();
      second.unmount();
      expect(observers.every((observer) => disconnect.mock.contexts.includes(observer))).toBe(true);
    } finally {
      observe.mockRestore();
      disconnect.mockRestore();
    }
  });

  it('размонтированные списки уходят сборщику мусора — наблюдатель опций их не держит [ReFormer-2o1j.23]', async () => {
    const { form } = createProfile();
    const City = cityField(form);
    // Смонтировать и размонтировать; наружу — только слабая ссылка на список.
    const mountOnce = (): WeakRef<HTMLSelectElement> => {
      const view = render(<City />);
      const select = new WeakRef(view.getByTestId('control') as HTMLSelectElement);
      view.unmount();
      return select;
    };
    const selects = [mountOnce(), mountOnce(), mountOnce()];

    await collectUntilReleased(selects);

    expect(selects.map((select) => select.deref() === undefined)).toEqual([true, true, true]);
    // Поле живо: списки отпустила привязка, а не сборщик вместе с формой.
    expect(form.city.value.value).toBe('msk');
  });
});

describe('неуправляемая привязка — подписка хука (seam.watch)', () => {
  /** Поле, чей seam несёт подписку снимка на значение. */
  function WatchedField({ control }: { control: FormControl<unknown> }) {
    const { seam, state } = useSeam(control);
    return (
      <input
        data-testid="control"
        {...bindFieldProps(textAdapter, { ...seam, watch: watchValueOf(state) })}
      />
    );
  }

  it('своего effect на поле нет; запись извне доходит до DOM', () => {
    const { form } = createProfile();
    const baseline = liveEffects();
    const plain = render(
      <Field control={form.name as FormControl<unknown>} adapter={textAdapter} />
    );
    const withEffect = liveEffects() - baseline;
    plain.unmount();

    const { view, control } = renderCounting(
      <WatchedField control={form.name as FormControl<unknown>} />
    );
    expect(liveEffects() - baseline).toBe(withEffect - 1);

    fireEvent.change(control, { target: { value: 'Анна Ивановна' } });
    expect(form.name.value.value).toBe('Анна Ивановна');
    act(() => form.name.setValue('Пётр'));
    expect(control.value).toBe('Пётр');
    act(() => form.name.reset());
    expect(control.value).toBe('Анна');

    view.unmount();
    expect(liveEffects()).toBe(baseline);
    act(() => form.name.setValue('Олег'));
    expect(control.value).toBe('Анна');
  });

  it('запись между фиксацией и подпиской хука доходит до DOM', () => {
    const { form } = createProfile();
    // Эффект раскладки родителя — после подключения ref, до пассивной подписки хука поля.
    function Host() {
      useLayoutEffect(() => form.name.setValue('Пётр'), []);
      return <WatchedField control={form.name as FormControl<unknown>} />;
    }
    const { control } = renderCounting(<Host />);
    expect(control.value).toBe('Пётр');
  });
});
