// @vitest-environment happy-dom
/**
 * `useFormField` читает состояние поля при обращении: компонент, который показывает значение и
 * ошибку, не перерисовывается на смену `pending`, касания без замечаний, `valid`/`invalid`.
 * Подписку по прочитанному даёт снимок `useFormControl` из `@reformer/core/react`.
 */
import { Profiler } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createForm, type FormControl } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { ValidationMessagesProvider } from '../../validation/error-resolver';
import { useFormField } from './useFormField';

const MESSAGES = defineIssueMessages({ required: 'Укажите почту', taken: 'Логин занят' });

afterEach(cleanup);

/** Поле, как в разметке приложения: значение, текст ошибки и доступность. */
function Field({ control }: { control: FormControl<string> }) {
  const { state, controlProps } = useFormField(control);
  return (
    <label>
      <input
        value={state.value}
        disabled={state.isDisabled}
        onChange={(event) => controlProps.onChange(event.target.value)}
      />
      {state.error ? <span role="alert">{state.error}</span> : null}
    </label>
  );
}

function renderField(control: FormControl<string>) {
  const renders = { count: 0 };
  const view = render(
    <ValidationMessagesProvider messages={MESSAGES}>
      <Profiler id="field" onRender={() => renders.count++}>
        <Field control={control} />
      </Profiler>
    </ValidationMessagesProvider>
  );
  return { renders, view };
}

const createLogin = () =>
  createForm<{ login: string; email: string }>({ initial: { login: 'anna', email: '' } });

describe('useFormField — подписка по прочитанному', () => {
  it('pending, касание без замечаний и valid/invalid поле не перерисовывают', () => {
    const { form } = createLogin();
    const { renders } = renderField(form.login);
    const before = renders.count;

    act(() => {
      const raw = form.login as unknown as { setPending(pending: boolean): void };
      raw.setPending(true);
      raw.setPending(false);
      form.login.markAsTouched();
    });

    expect(renders.count).toBe(before);
  });

  it('значение, показанная ошибка и доступность — перерисовывают', () => {
    const { form } = createLogin();
    const { renders, view } = renderField(form.login);
    const before = renders.count;

    act(() => form.login.setValue('anna2'));
    act(() => {
      form.login.markAsTouched();
      form.login.setIssues([{ code: 'taken' }]);
    });
    act(() => form.login.disable());

    expect(renders.count).toBe(before + 3);
    expect(view.container.querySelector('input')!.value).toBe('anna2');
    expect(view.container.querySelector('input')!.disabled).toBe(true);
  });

  it('ошибка поля, которое прежде не показывало ошибок, появляется', () => {
    const { form } = createLogin();
    const { view } = renderField(form.email);

    act(() => {
      form.email.markAsTouched();
      form.email.setIssues([{ code: 'required' }]);
    });

    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Укажите почту');
  });
});
