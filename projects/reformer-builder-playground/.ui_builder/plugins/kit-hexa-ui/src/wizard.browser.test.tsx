/**
 * Визард кита целиком — в `FormRenderer` со сборкой `createForm({ flow })`, как его рисует билдер и
 * как его печатает кодоген: узел `FormWizard` с узлами-шагами `Step` из `@reformer/cdk/form-wizard`.
 *
 * Проверяется протокол `3.0` вживую: шаги приходят данными и рисуются `renderNode`, «Далее»
 * проверяет правила шага и не пускает дальше с ошибкой, переход делает поток (ровно на один шаг),
 * «Назад» возвращает, а отправка зовёт `onSubmit` только после проверки всей формы.
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createForm, type FormSchemaNode } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Step } from '@reformer/cdk/form-wizard';
import { FormRenderer } from '@reformer/renderer-react';
import { renderReact } from '../../.shared/render';
import { Input } from './fields';
import { FormField } from './form-field';
import { KitProvider } from './provider';
import { FormWizard } from './wizard';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Shape {
  amount: string | null;
  phone: string | null;
}

const loanRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});
const contactsRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.phone, [required()]);
});

/** Форма-визард из двух шагов; `withFlow: false` — без потока сборки (позиционный). */
function mountWizard(onSubmit: (values: Shape) => void, { withFlow = true } = {}) {
  const bundle = createForm<Shape>({
    initial: { amount: null, phone: null },
    schema: (model) =>
      ({
        selector: 'wizard',
        component: FormWizard,
        componentProps: {
          onSubmit,
          nextLabel: 'Далее',
          backLabel: 'Назад',
          submitLabel: 'Отправить',
        },
        children: [
          {
            selector: 'loan',
            component: Step,
            componentProps: { title: 'Кредит' },
            children: [
              {
                model: model.$.amount,
                component: Input,
                componentProps: { label: 'Сумма', testId: 'amount' },
              },
            ],
          },
          {
            selector: 'contacts',
            component: Step,
            componentProps: { title: 'Контакты' },
            children: [
              {
                model: model.$.phone,
                component: Input,
                componentProps: { label: 'Телефон', testId: 'phone' },
              },
            ],
          },
        ],
      }) as FormSchemaNode,
    ...(withFlow
      ? {
          flow: {
            steps: [
              { id: 'loan', rules: loanRules },
              { id: 'contacts', rules: contactsRules },
            ],
          },
        }
      : {}),
  });
  const { container } = renderReact(
    <KitProvider>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField as any }} />
    </KitProvider>
  );
  return { bundle, container };
}

/** Поле ввода шага по `testId`; `null` — шаг не показан. */
const input = (container: HTMLElement, key: string): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>(`[data-testid="field-${key}"] input`);

/** Кнопка визарда HexaUI по её `testId`. */
const button = (container: HTMLElement, testId: string): HTMLElement =>
  container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;

describe('визард кита в FormRenderer + createForm({ flow })', () => {
  it('шаги — из узлов схемы: заголовки в индикаторе, тело текущего шага рисует рендерер', async () => {
    const { container } = mountWizard(vi.fn());

    await vi.waitFor(() => expect(input(container, 'amount')).not.toBeNull());
    expect(container.textContent).toContain('Кредит');
    expect(container.textContent).toContain('Контакты');
    expect(input(container, 'phone')).toBeNull();
    expect(button(container, 'wizardNextAction').textContent).toBe('Далее');
  });

  it('пустое обязательное поле не пускает дальше; заполненное — ровно на один шаг; «Назад» возвращает', async () => {
    const { bundle, container } = mountWizard(vi.fn());
    await vi.waitFor(() => expect(input(container, 'amount')).not.toBeNull());

    await userEvent.click(button(container, 'wizardNextAction'));
    // Проверка шага прошла и отказала: шаг тот же, у поля — замечание правила `required()`
    // (текст — словарь ядра; локаль приложения тест не задаёт).
    await vi.waitFor(() =>
      expect(container.querySelector('[data-testid="field-amount"]')?.textContent).toMatch(
        /required|Обязательное/
      )
    );
    expect(bundle.flow?.current.value).toBe('loan');
    expect(input(container, 'phone')).toBeNull();

    await userEvent.type(input(container, 'amount')!, '100000');
    await userEvent.click(button(container, 'wizardNextAction'));
    await vi.waitFor(() => expect(input(container, 'phone')).not.toBeNull());
    // Ровно один шаг: поток на втором, а не за его пределами (HexaUI свой переход не сделал).
    expect(bundle.flow?.current.value).toBe('contacts');
    expect(button(container, 'wizardNextAction').textContent).toBe('Отправить');

    await userEvent.click(button(container, 'wizardBackAction'));
    await vi.waitFor(() => expect(input(container, 'amount')?.value).toBe('100000'));
    expect(bundle.flow?.current.value).toBe('loan');
  });

  it('отправка на последнем шаге зовёт onSubmit со значениями — только когда форма верна', async () => {
    const onSubmit = vi.fn();
    const { bundle, container } = mountWizard(onSubmit);
    await vi.waitFor(() => expect(input(container, 'amount')).not.toBeNull());
    await userEvent.type(input(container, 'amount')!, '100000');
    await userEvent.click(button(container, 'wizardNextAction'));
    await vi.waitFor(() => expect(input(container, 'phone')).not.toBeNull());

    await userEvent.click(button(container, 'wizardNextAction'));
    await vi.waitFor(() => expect(bundle.flow?.current.value).toBe('contacts'));
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(input(container, 'phone')!, '+79000000000');
    await userEvent.click(button(container, 'wizardNextAction'));
    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ amount: '100000', phone: '+79000000000' })
    );
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('без потока сборки визард идёт позиционно — без проверки шагов', async () => {
    const { container } = mountWizard(vi.fn(), { withFlow: false });
    await vi.waitFor(() => expect(input(container, 'amount')).not.toBeNull());

    await userEvent.click(button(container, 'wizardNextAction'));
    await vi.waitFor(() => expect(input(container, 'phone')).not.toBeNull());
  });
});
