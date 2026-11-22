// @vitest-environment happy-dom
/**
 * Поле с неуправляемым адаптером (`FieldAdapter.uncontrolled` из `@reformer/core/react`): ввод не
 * перерисовывает ни составной `FormField`, ни поле на `useFormField`; запись в поле извне доходит до
 * DOM; ручка поля (`ref` у `FormField.Control`) получает элемент. Корень `FormField` читает
 * состояние при обращении — смена `pending` поле без индикатора не перерисовывает.
 */
import {
  Profiler,
  createRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createFormFromModel, createModel, type FormControl } from '@reformer/core';
import {
  bindFieldProps,
  getFieldAdapter,
  type FieldAdapter,
  type FieldHandle,
} from '@reformer/core/react';
import { defineIssueMessages } from '@reformer/core/i18n';
import { ValidationMessagesProvider } from '../../validation/error-resolver';
import { FormField } from './FormField';
import { useFormField } from './useFormField';
import { useFormFieldContext } from './FormFieldContext';

const MESSAGES = defineIssueMessages({ taken: 'Логин занят' });

afterEach(cleanup);

/** Рендеры самого контрола: вызов функции, а не запись в переменную модуля (правила хуков). */
const inputRendered = vi.fn();

/** Нативный input: `ref` — обычный проп (React 19), диалект — DOM-событие. */
function NativeInput(
  props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }
) {
  inputRendered();
  return <input data-testid="control" {...props} />;
}
const nativeAdapter: FieldAdapter = {
  uncontrolled: true,
  fromEmit: (event) => (event as ChangeEvent<HTMLInputElement>).target.value,
  toValue: (value) => value ?? '',
};
Object.assign(NativeInput, { reformerAdapter: nativeAdapter });

function buildLogin(): FormControl<string> {
  const model = createModel<{ login: string }>({ login: 'anna' });
  const form = createFormFromModel<{ login: string }>({
    model,
    schema: {
      children: [
        { model: model.$.login, component: NativeInput, componentProps: { label: 'Логин' } },
      ],
    },
  });
  return (form as unknown as { login: FormControl<string> }).login;
}

function renderCounting(node: ReactNode) {
  const renders = { count: 0 };
  const view = render(
    <ValidationMessagesProvider messages={MESSAGES}>
      <Profiler id="field" onRender={() => renders.count++}>
        {node}
      </Profiler>
    </ValidationMessagesProvider>
  );
  return { renders, view, input: view.getByTestId('control') as HTMLInputElement };
}

/** Составное поле: подпись, контрол, замечание. */
const Composite = ({
  control,
  handle,
}: {
  control: FormControl<string>;
  handle?: Ref<FieldHandle>;
}) => (
  <FormField.Root control={control}>
    <FormField.Label />
    <FormField.Control ref={handle} />
    <FormField.Error />
  </FormField.Root>
);

describe('FormField с неуправляемым адаптером', () => {
  it('ввод пишет в поле и не перерисовывает поле; запись извне — в DOM', () => {
    const login = buildLogin();
    const { renders, input } = renderCounting(<Composite control={login} />);
    expect(input.value).toBe('anna');
    const before = { field: renders.count, input: inputRendered.mock.calls.length };

    fireEvent.change(input, { target: { value: 'anna2' } });
    act(() => login.setValue('boris'));

    expect(login.value.value).toBe('boris');
    expect(input.value).toBe('boris');
    expect(renders.count).toBe(before.field);
    expect(inputRendered.mock.calls.length).toBe(before.input);
  });

  it('замечание и доступность перерисовывают; pending — нет', () => {
    const login = buildLogin();
    const { renders, view, input } = renderCounting(<Composite control={login} />);
    const before = renders.count;

    act(() => {
      const raw = login as unknown as { setPending(pending: boolean): void };
      raw.setPending(true);
      raw.setPending(false);
    });
    expect(renders.count).toBe(before);

    act(() => {
      login.markAsTouched();
      login.setIssues([{ code: 'taken' }]);
    });
    expect(view.getByRole('alert').textContent).toBe('Логин занят');
    act(() => login.disable());
    expect(input.disabled).toBe(true);
    expect(renders.count).toBe(before + 2);
  });

  it('ручка поля получает элемент контрола', () => {
    const login = buildLogin();
    const handle = createRef<FieldHandle>();
    const { input } = renderCounting(<Composite control={login} handle={handle} />);
    expect(handle.current?.getElement()).toBe(input);
  });

  it('asChild: дочерний нативный контрол привязан неуправляемо', () => {
    const login = buildLogin();
    const { renders, input } = renderCounting(
      <FormField.Root control={login}>
        <FormField.Control asChild>
          <NativeInput />
        </FormField.Control>
      </FormField.Root>
    );
    const before = renders.count;
    expect(input.value).toBe('anna');

    fireEvent.change(input, { target: { value: 'anna2' } });
    expect(login.value.value).toBe('anna2');
    act(() => login.reset());
    expect(input.value).toBe('anna');
    expect(renders.count).toBe(before);
  });
});

describe('useFormField — seam', () => {
  it('поле на хуке с seam: ввод не перерисовывает, ошибка — перерисовывает', () => {
    const login = buildLogin();
    function Field({ control }: { control: FormControl<string> }) {
      const { seam, state } = useFormField(control);
      const adapter = getFieldAdapter(NativeInput);
      return (
        <>
          <NativeInput {...(bindFieldProps(adapter, seam, {}, NativeInput) as object)} />
          {state.error ? <span role="alert">{state.error}</span> : null}
        </>
      );
    }
    const { renders, view, input } = renderCounting(<Field control={login} />);
    const before = renders.count;

    fireEvent.change(input, { target: { value: 'anna2' } });
    expect(login.value.value).toBe('anna2');
    expect(renders.count).toBe(before);

    act(() => {
      login.markAsTouched();
      login.setIssues([{ code: 'taken' }]);
    });
    expect(view.getByRole('alert').textContent).toBe('Логин занят');
    expect(renders.count).toBe(before + 1);
  });
});

describe('seam с подпиской снимка', () => {
  it('seam хука и контекста несёт watch: у неуправляемой привязки нет своего effect', () => {
    const login = buildLogin();
    const seen = vi.fn();
    function Hook() {
      seen('hook', useFormField(login).seam.watch);
      return null;
    }
    function Context() {
      seen('context', useFormFieldContext().seam?.watch);
      return null;
    }
    render(
      <>
        <Hook />
        <FormField.Root control={login}>
          <Context />
        </FormField.Root>
      </>
    );
    expect(seen.mock.calls.map(([where, watch]) => [where, typeof watch])).toEqual([
      ['hook', 'function'],
      ['context', 'function'],
    ]);
  });
});
