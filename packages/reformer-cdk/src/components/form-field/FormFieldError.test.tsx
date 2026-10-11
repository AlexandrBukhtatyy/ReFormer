/**
 * Unit-тесты FormField.Error — режимы multi / render / asChild.
 *
 * Регрессия (defect #54):
 *  - `<FormField.Error asChild multi/>` не отрисовывал НИЧЕГО: в multi-ветке дочерний
 *    элемент Slot — сырая строка резолвера, а Slot возвращает null для не-элемента.
 *  - forwardRef ref прикреплялся только в ветке одиночной ошибки, теряясь в multi/render.
 *    (ref нельзя наблюдать через renderToStaticMarkup без DOM, поэтому здесь проверяем
 *    отрисовку; привязка ref к первому элементу закреплена в коде.)
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FormControl, ValidationIssue } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { ValidationMessagesProvider } from '../../validation/error-resolver';
import { FormFieldContext } from './FormFieldContext';
import { FormFieldError } from './FormFieldError';
import type { FormFieldContextValue } from './types';

const ERRORS: ValidationIssue[] = [{ code: 'required' }, { code: 'minLength' }];

/** Тексты замечаний — словарь формы: у самих замечаний текста нет. */
const MESSAGES = defineIssueMessages({ required: 'Required', minLength: 'Too short' });

function ctxWithErrors(issues: ValidationIssue[]): FormFieldContextValue {
  return {
    value: '',
    issues,
    pending: false,
    disabled: false,
    valid: false,
    invalid: true,
    touched: true,
    shouldShowError: true,
    shouldShowIssues: true,
    error: issues[0] ? MESSAGES[issues[0].code as 'required'] : undefined,
    label: undefined,
    required: true,
    componentProps: {},
    control: {} as unknown as FormControl<unknown>,
    ids: {
      controlId: 'control-x',
      labelId: 'label-x',
      descriptionId: 'desc-x',
      errorId: 'error-x',
      hintId: 'hint-x',
    },
    hasDescription: false,
    hasHint: false,
  };
}

function render(node: React.ReactNode, issues: ValidationIssue[] = ERRORS): string {
  return renderToStaticMarkup(
    <ValidationMessagesProvider messages={MESSAGES}>
      <FormFieldContext.Provider value={ctxWithErrors(issues)}>{node}</FormFieldContext.Provider>
    </ValidationMessagesProvider>
  );
}

describe('FormField.Error — asChild + multi (#54)', () => {
  it('раньше рендерил пусто; теперь отрисовывает все сообщения об ошибках', () => {
    const html = render(<FormFieldError asChild multi />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Required');
    expect(html).toContain('Too short');
    // role="alert" сохранён на каждой ошибке
    expect(html).toContain('role="alert"');
  });
});

describe('FormField.Error — multi (non-asChild)', () => {
  it('отрисовывает каждую ошибку, первая несёт id=errorId', () => {
    const html = render(<FormFieldError multi />);
    expect(html).toContain('Required');
    expect(html).toContain('Too short');
    expect(html).toContain('id="error-x"');
    // ровно один элемент получает errorId (первый)
    expect(html.match(/id="error-x"/g)?.length).toBe(1);
  });
});

describe('FormField.Error — render prop', () => {
  it('отрисовывает каждую ошибку кастомным рендером', () => {
    const html = render(<FormFieldError render={(err) => <em>{err.code}</em>} />);
    expect(html).toContain('<em>required</em>');
    expect(html).toContain('<em>minLength</em>');
    expect(html).toContain('id="error-x"');
  });
});

describe('FormField.Error — single (регрессии нет)', () => {
  it('отрисовывает первую ошибку в <p role="alert" id=errorId>', () => {
    const html = render(<FormFieldError />);
    expect(html).toContain('<p');
    expect(html).toContain('role="alert"');
    expect(html).toContain('id="error-x"');
    expect(html).toContain('Required');
    expect(html).not.toContain('Too short');
  });

  it('возвращает null, когда shouldShowIssues=false', () => {
    const html = renderToStaticMarkup(
      <FormFieldContext.Provider
        value={{ ...ctxWithErrors(ERRORS), shouldShowError: false, shouldShowIssues: false }}
      >
        <FormFieldError multi />
      </FormFieldContext.Provider>
    );
    expect(html).toBe('');
  });

  it('у ошибки атрибута data-severity нет — разметка прежняя', () => {
    expect(render(<FormFieldError multi />)).not.toContain('data-severity');
  });
});

describe('FormField.Error — предупреждение [ReFormer-dp34]', () => {
  const WARNING: ValidationIssue = { code: 'weak', severity: 'warning' };
  const WARNING_MESSAGES = defineIssueMessages({ ...MESSAGES, weak: 'Weak password' });

  /** Поле с замечаниями `issues`; `invalid` — есть ли среди них блокирующее. */
  function renderIssues(node: React.ReactNode, issues: ValidationIssue[]): string {
    const invalid = issues.some((issue) => issue.severity !== 'warning');
    return renderToStaticMarkup(
      <ValidationMessagesProvider messages={WARNING_MESSAGES}>
        <FormFieldContext.Provider
          value={{
            ...ctxWithErrors(issues),
            valid: !invalid,
            invalid,
            shouldShowError: invalid,
            shouldShowIssues: true,
          }}
        >
          {node}
        </FormFieldContext.Provider>
      </ValidationMessagesProvider>
    );
  }

  it('предупреждение у валидного поля показывается и помечено data-severity', () => {
    // Было: показ решал shouldShowError — у поля с одним предупреждением он false, и текста не было.
    const html = renderIssues(<FormFieldError />, [WARNING]);

    expect(html).toBe('<p id="error-x" role="alert" data-severity="warning">Weak password</p>');
  });

  it('multi: помечено только предупреждение, ошибка рядом — как раньше', () => {
    const html = renderIssues(<FormFieldError multi />, [{ code: 'required' }, WARNING]);

    expect(html).toBe(
      '<p id="error-x" role="alert">Required</p>' +
        '<p role="alert" data-severity="warning">Weak password</p>'
    );
  });

  it('предупреждение раньше ошибки: одиночный показ берёт ошибку [ReFormer-10s7]', () => {
    // Порядок замечаний — порядок правил. Было: показывался issues[0] — текст предупреждения у
    // поля в состоянии ошибки, а текста самой ошибки на экране не было.
    const html = renderIssues(<FormFieldError />, [WARNING, { code: 'required' }]);

    expect(html).toBe('<p id="error-x" role="alert">Required</p>');
  });

  it('одни предупреждения: одиночный показ берёт первое', () => {
    const html = renderIssues(<FormFieldError />, [WARNING, { code: 'rare', severity: 'warning' }]);

    expect(html).toBe('<p id="error-x" role="alert" data-severity="warning">Weak password</p>');
  });

  it('multi: порядок правил сохраняется, а id для aria-errormessage — на ошибке [ReFormer-10s7]', () => {
    const html = renderIssues(<FormFieldError multi />, [WARNING, { code: 'required' }]);

    expect(html).toBe(
      '<p role="alert" data-severity="warning">Weak password</p>' +
        '<p id="error-x" role="alert">Required</p>'
    );
  });

  it('render: id для aria-errormessage — тоже на ошибке', () => {
    const html = renderIssues(<FormFieldError render={(issue) => <em>{issue.code}</em>} />, [
      WARNING,
      { code: 'required' },
    ]);

    expect(html).toBe(
      '<p role="alert" data-severity="warning"><em>weak</em></p>' +
        '<p id="error-x" role="alert"><em>required</em></p>'
    );
  });

  it('render: предупреждение помечено и в своём рендере', () => {
    const html = renderIssues(<FormFieldError render={(issue) => <em>{issue.code}</em>} />, [
      WARNING,
    ]);

    expect(html).toBe('<p id="error-x" role="alert" data-severity="warning"><em>weak</em></p>');
  });
});
