/**
 * `FormWizard` в схеме формы: шаги — узлы-дети от рендерера, форма и валидация — из контекста
 * сборки `createForm`.
 *
 * DOM-окружения в пакете нет, поэтому отрисовка проверяется статической разметкой (первый шаг), а
 * связь «шаг ↔ правила» — на чистых функциях, которыми визард собирает колбэки валидации.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createForm, FormBundleContext } from '@reformer/core';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { FormWizard, type FormWizardStepNode } from './index';
import { stepRulesMismatch, wizardConfigFromValidation } from './variants/base/form-wizard';

interface Shape {
  amount: string;
  phone: string;
}

const loanRules = defineValidationSchema<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});
const contactsRules = defineValidationSchema<Shape>(({ model }) => {
  validate(model.$.phone, [required()]);
});

const stepNodes: FormWizardStepNode[] = [
  { selector: 'loan', componentProps: { title: 'Кредит', icon: '💰' } },
  { selector: 'contacts', componentProps: { title: 'Контакты' } },
];

const createBundle = () =>
  createForm<Shape>({
    initial: { amount: '', phone: '' },
    validation: { steps: { loan: loanRules, contacts: contactsRules } },
  });

/** Отрисовка узла, как её делает рендерер: по узлу шага — его тело. */
const renderNode = (node: FormWizardStepNode): ReactNode => (
  <i data-step-body={node.selector}>{node.componentProps?.title}</i>
);

describe('FormWizard в схеме формы', () => {
  it('строит шаги из узлов-детей: заголовки — в индикаторе, тело шага рисует renderNode', () => {
    const html = renderToStaticMarkup(
      <FormBundleContext.Provider value={createBundle()}>
        <FormWizard<Shape> renderNode={renderNode}>{stepNodes}</FormWizard>
      </FormBundleContext.Provider>
    );

    expect(html).toContain('Кредит');
    expect(html).toContain('Контакты');
    expect(html).toContain('💰');
    // Видимо тело текущего (первого) шага.
    expect(html).toContain('data-step-body="loan"');
    expect(html).not.toContain('data-step-body="contacts"');
    expect(html).toContain('data-testid="btn-next"');
  });

  it('форму берёт из контекста сборки — пропсы `form` и `config` не нужны', () => {
    expect(() =>
      renderToStaticMarkup(
        <FormBundleContext.Provider value={createBundle()}>
          <FormWizard<Shape> renderNode={renderNode}>{stepNodes}</FormWizard>
        </FormBundleContext.Provider>
      )
    ).not.toThrow();
  });

  it('вне сборки и без `form` — понятная ошибка', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      renderToStaticMarkup(<FormWizard<Shape> renderNode={renderNode}>{stepNodes}</FormWizard>)
    ).toThrow(/нет формы.*FormRenderer/s);

    vi.restoreAllMocks();
  });

  it('узлы-дети без renderNode — адресная ошибка, а не «Objects are not valid»', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      renderToStaticMarkup(
        <FormBundleContext.Provider value={createBundle()}>
          <FormWizard<Shape>>{stepNodes}</FormWizard>
        </FormBundleContext.Provider>
      )
    ).toThrow(/renderStepBody/);

    vi.restoreAllMocks();
  });

  it('явные `steps` главнее узлов-детей', () => {
    const html = renderToStaticMarkup(
      <FormBundleContext.Provider value={createBundle()}>
        <FormWizard<Shape>
          renderNode={renderNode}
          steps={[{ number: 1, title: 'Явный шаг', body: <b data-testid="explicit" /> }]}
        >
          {stepNodes}
        </FormWizard>
      </FormBundleContext.Provider>
    );

    expect(html).toContain('Явный шаг');
    expect(html).toContain('data-testid="explicit"');
    expect(html).not.toContain('data-step-body');
  });
});

describe('Шаг ↔ правила', () => {
  it('шаг проверяется правилами своего `selector`, а не порядкового номера', async () => {
    const bundle = createBundle();
    // Порядок шагов в схеме обратный порядку ключей в validation.steps.
    const config = wizardConfigFromValidation(bundle.validation, ['contacts', 'loan']);

    bundle.model.phone = '+7';
    expect(await config.validateStep?.(1)).toBe(true); // шаг «contacts» — телефон заполнен
    expect(await config.validateStep?.(2)).toBe(false); // шаг «loan» — сумма пуста
  });

  it('шаг без `selector` проверяется по номеру — как раньше', async () => {
    const bundle = createBundle();
    const config = wizardConfigFromValidation(bundle.validation, [undefined, undefined]);

    bundle.model.amount = '100';
    expect(await config.validateStep?.(1)).toBe(true); // первый ключ — loan
    expect(await config.validateStep?.(2)).toBe(false); // второй ключ — contacts
  });

  it('`validateAll` — полный набор правил сборки', async () => {
    const bundle = createBundle();
    const config = wizardConfigFromValidation(bundle.validation, ['loan', 'contacts']);

    expect(await config.validateAll?.()).toBe(false);
    bundle.model.amount = '100';
    bundle.model.phone = '+7';
    expect(await config.validateAll?.()).toBe(true);
  });

  it('без валидации в сборке колбэков нет — переходы не блокируются', () => {
    expect(wizardConfigFromValidation(undefined, ['loan'])).toEqual({});
  });
});

describe('Сверка шагов схемы с ключами validation.steps', () => {
  it('совпадают — предупреждения нет', () => {
    expect(stepRulesMismatch(['loan', 'contacts'], ['loan', 'contacts'])).toBeNull();
    // Порядок не важен: связь — по селектору.
    expect(stepRulesMismatch(['loan', 'contacts'], ['contacts', 'loan'])).toBeNull();
  });

  it('опечатка в селекторе шага видна с обеих сторон', () => {
    expect(stepRulesMismatch(['loan', 'contacts'], ['loan', 'contatcs'])).toEqual({
      withoutStep: ['contacts'],
      withoutRules: ['contatcs'],
    });
  });

  it('шаг без правил, не объявленный в validation.steps, — расхождение', () => {
    expect(stepRulesMismatch(['loan'], ['loan', 'confirm'])).toEqual({
      withoutStep: [],
      withoutRules: ['confirm'],
    });
  });

  it('шаг без селектора занимает ключ на своей позиции', () => {
    expect(stepRulesMismatch(['loan', 'contacts'], [undefined, undefined])).toBeNull();
    expect(stepRulesMismatch(['loan', 'contacts'], ['loan', undefined])).toBeNull();
  });

  it('правила не разбиты по шагам — сверять нечего', () => {
    expect(stepRulesMismatch([], ['loan', 'contacts'])).toBeNull();
  });
});
