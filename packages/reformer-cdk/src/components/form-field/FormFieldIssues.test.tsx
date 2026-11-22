/**
 * FormField над настоящей нодой поля: что видит пользователь при ошибке и при предупреждении.
 *
 * Тесты рядом (`FormFieldError`, `FormFieldControl`) подают слотам готовый контекст. Здесь контекст
 * собирает `FormField.Root` из ноды `createForm`: проверяется вся цепочка «замечание на ноде →
 * снимок `useFormControl` → контекст → разметка» — и в составном компоненте, и в хуке `useFormField`.
 *
 * Предупреждение (`severity: 'warning'`) поле невалидным не делает. Раньше показ текста решал
 * `shouldShowError`, и предупреждение без ошибки рядом не показывалось [ReFormer-dp34].
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createForm, type FormControl, type ValidationIssue } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { ValidationMessagesProvider } from '../../validation/error-resolver';
import { FormField } from './FormField';
import { useFormField } from './useFormField';

const MESSAGES = defineIssueMessages({
  required: 'Укажите пароль',
  'password.weak': 'Пароль слабый',
});

const REQUIRED: ValidationIssue = { code: 'required' };
const WEAK: ValidationIssue = { code: 'password.weak', severity: 'warning' };

/** Поле пароля с замечаниями `issues`; `touched` — уходили ли из него. */
function passwordField(issues: ValidationIssue[], touched = true): FormControl<string> {
  const { form } = createForm<{ password: string }>({ initial: { password: '' } });
  if (touched) form.password.markAsTouched();
  form.password.setIssues(issues);
  return form.password;
}

/** Разметка поля: свой `<input>` в слоте контрола и слот замечаний. */
function renderField(control: FormControl<string>, multi = false): string {
  return renderToStaticMarkup(
    <ValidationMessagesProvider messages={MESSAGES}>
      <FormField control={control} id="password">
        <FormField.Control>
          <input type="password" readOnly />
        </FormField.Control>
        <FormField.Error multi={multi} />
      </FormField>
    </ValidationMessagesProvider>
  );
}

/** Поле, собранное руками из `useFormField`: так хук используют без составного компонента. */
function HookField({ control }: { control: FormControl<string> }) {
  const { labelProps, controlProps, errorProps, state } = useFormField(control, 'password');
  return (
    <div data-valid={state.isValid} data-show-error={state.shouldShowError}>
      <label {...labelProps}>Пароль</label>
      <input
        id={controlProps.id}
        type="password"
        value={controlProps.value}
        readOnly
        aria-invalid={controlProps['aria-invalid']}
        aria-errormessage={controlProps['aria-errormessage']}
      />
      {state.shouldShowIssues && <p {...errorProps}>{state.error}</p>}
    </div>
  );
}

function renderHookField(control: FormControl<string>): string {
  return renderToStaticMarkup(
    <ValidationMessagesProvider messages={MESSAGES}>
      <HookField control={control} />
    </ValidationMessagesProvider>
  );
}

describe('FormField над нодой — ошибка', () => {
  it('тронутое поле: текст ошибки на экране, контрол помечен aria-invalid', () => {
    const html = renderField(passwordField([REQUIRED]));

    expect(html).toContain('<p id="error-password" role="alert">Укажите пароль</p>');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-errormessage="error-password"');
    expect(html).toContain('aria-describedby="error-password"');
  });

  it('нетронутое поле ошибку не показывает', () => {
    const html = renderField(passwordField([REQUIRED], false));

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid');
  });
});

describe('FormField над нодой — предупреждение [ReFormer-dp34]', () => {
  it('предупреждение у валидного поля на экране, а состояния ошибки нет', () => {
    const html = renderField(passwordField([WEAK]));

    // Было: слот замечаний пуст — показ решал shouldShowError, истинный только у невалидного поля.
    expect(html).toContain(
      '<p id="error-password" role="alert" data-severity="warning">Пароль слабый</p>'
    );
    expect(html).toContain('aria-describedby="error-password"');
    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('aria-errormessage');
  });

  it('нетронутое поле предупреждение не показывает', () => {
    expect(renderField(passwordField([WEAK], false))).not.toContain('role="alert"');
  });

  it('предупреждение раньше ошибки: одиночный показ — текст ошибки [ReFormer-10s7]', () => {
    const html = renderField(passwordField([WEAK, REQUIRED]));

    // Было: под полем в состоянии ошибки стоял текст предупреждения.
    expect(html).toContain('<p id="error-password" role="alert">Укажите пароль</p>');
    expect(html).not.toContain('Пароль слабый');
    expect(html).toContain('aria-invalid="true"');
  });

  it('предупреждение и ошибка вместе: multi показывает оба, поле — в состоянии ошибки', () => {
    const html = renderField(passwordField([REQUIRED, WEAK]), true);

    expect(html).toContain('<p id="error-password" role="alert">Укажите пароль</p>');
    expect(html).toContain('<p role="alert" data-severity="warning">Пароль слабый</p>');
    expect(html).toContain('aria-invalid="true"');
  });
});

describe('useFormField над нодой', () => {
  it('предупреждение: текст на экране, поле валидно, aria-invalid не ставится [ReFormer-dp34]', () => {
    const html = renderHookField(passwordField([WEAK]));

    expect(html).toContain('<p id="error-password" role="alert">Пароль слабый</p>');
    expect(html).toContain('data-valid="true" data-show-error="false"');
    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('aria-errormessage');
  });

  it('ошибка: текст на экране, контрол помечен aria-invalid и ссылается на текст', () => {
    const html = renderHookField(passwordField([REQUIRED]));

    expect(html).toContain('<p id="error-password" role="alert">Укажите пароль</p>');
    expect(html).toContain('data-valid="false" data-show-error="true"');
    expect(html).toContain('aria-invalid="true" aria-errormessage="error-password"');
  });

  it('предупреждение раньше ошибки: state.error — текст ошибки [ReFormer-10s7]', () => {
    const html = renderHookField(passwordField([WEAK, REQUIRED]));

    expect(html).toContain('<p id="error-password" role="alert">Укажите пароль</p>');
    expect(html).not.toContain('Пароль слабый');
  });

  it('нетронутое поле: текста нет', () => {
    const html = renderHookField(passwordField([WEAK], false));

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('Пароль слабый');
  });
});
