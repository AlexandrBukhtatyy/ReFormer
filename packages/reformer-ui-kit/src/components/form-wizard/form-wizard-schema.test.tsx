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
import { createForm } from '@reformer/core';
import { FormBundleContext } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { FormWizard, type FormWizardStepNode } from './index';
import { flowStepsMismatch } from './variants/base/form-wizard';

interface Shape {
  amount: string;
  phone: string;
}

const loanRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});
const contactsRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.phone, [required()]);
});

const stepNodes: FormWizardStepNode[] = [
  { selector: 'loan', props: { title: 'Кредит', icon: '💰' } },
  { selector: 'contacts', props: { title: 'Контакты' } },
];

const createBundle = () =>
  createForm<Shape>({
    initial: { amount: '', phone: '' },
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'contacts', rules: contactsRules },
      ],
    },
  });

/** Отрисовка узла, как её делает рендерер: по узлу шага — его тело. */
const renderNode = (node: FormWizardStepNode): ReactNode => (
  <i data-step-body={node.selector}>{node.props?.title}</i>
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

  it('форму и поток берёт из контекста сборки — пропсы `form` и `flow` не нужны', () => {
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

describe('Шаг схемы ↔ шаг потока', () => {
  it('шаги рисуются в порядке потока: узел связан с шагом по `selector`', () => {
    // Порядок узлов в схеме обратный порядку шагов в потоке.
    const html = renderToStaticMarkup(
      <FormBundleContext.Provider value={createBundle()}>
        <FormWizard<Shape> renderNode={renderNode}>{[...stepNodes].reverse()}</FormWizard>
      </FormBundleContext.Provider>
    );

    // Текущий — первый шаг потока, `loan`, хотя его узел в схеме второй.
    expect(html).toContain('data-step-body="loan"');
    expect(html.indexOf('Кредит')).toBeLessThan(html.indexOf('Контакты'));
  });

  it('«Далее» проверяет правила шага потока', async () => {
    const bundle = createBundle();

    expect(await bundle.flow!.next()).toMatchObject({ status: 'stayed', reason: 'invalid' });
    bundle.model.amount = '100';
    expect(await bundle.flow!.next()).toEqual({ status: 'moved', from: 'loan', to: 'contacts' });
  });
});

describe('Сверка шагов схемы с шагами потока', () => {
  it('совпадают — предупреждения нет; порядок не важен', () => {
    expect(flowStepsMismatch(['loan', 'contacts'], ['loan', 'contacts'])).toBeNull();
    expect(flowStepsMismatch(['loan', 'contacts'], ['contacts', 'loan'])).toBeNull();
  });

  it('опечатка в селекторе шага видна с обеих сторон', () => {
    expect(flowStepsMismatch(['loan', 'contacts'], ['loan', 'contatcs'])).toEqual({
      withoutNode: ['contacts'],
      withoutFlowStep: ['contatcs'],
    });
  });

  it('узлы без селектора к шагам потока не привязаны', () => {
    expect(flowStepsMismatch(['loan', 'contacts'], [undefined, undefined])).toEqual({
      withoutNode: ['loan', 'contacts'],
      withoutFlowStep: [],
    });
  });
});
