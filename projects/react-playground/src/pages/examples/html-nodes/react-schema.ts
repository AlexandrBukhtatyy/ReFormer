/**
 * Типизованная RenderSchema мини-примера: `component` строкой-тегом + `text`.
 *
 * Показывает, что презентационные блоки (заголовок, инфо-плашка, сводка, разделитель) больше
 * не требуют отдельного React-компонента с регистрацией — они описываются прямо в схеме.
 * `text` принимает и литералы, и сигналы: части массива склеиваются без разделителя, а сигнал
 * подписывается точечно, поэтому при изменении модели перерисовывается только сам текст.
 */

import { computed } from '@reformer/core/signals';
import type { FormModel } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { InputField } from '@reformer/ui-kit';
import type { InstallmentRequest } from './model';

/** Платёж без процентов — вычисляемый сигнал, который уедет прямо в `text` узла. */
export const monthlyPayment = (model: FormModel<InstallmentRequest>) =>
  computed(() => {
    const amount = model.$.amount.value ?? 0;
    const months = model.$.months.value || 1;
    return Math.round(amount / months);
  });

export function buildInstallmentSchema(
  model: FormModel<InstallmentRequest>
): RenderNode<InstallmentRequest> {
  const monthly = monthlyPayment(model);

  return {
    component: 'div',
    componentProps: { className: 'space-y-6' },
    children: [
      // Заголовок секции — раньше ради этого заводили компонент Section или Typography.
      { component: 'h2', componentProps: { className: 'text-xl font-bold' }, text: 'Рассрочка' },

      // Инфо-плашка: смешанный inline-контент — `text` рендерится перед `children`.
      {
        component: 'div',
        componentProps: { className: 'p-4 bg-blue-50 border border-blue-200 rounded-md' },
        children: [
          {
            component: 'p',
            componentProps: { className: 'text-sm text-blue-800' },
            text: 'Проценты не начисляются. ',
            children: [{ component: 'b', text: 'Досрочное погашение бесплатно.' }],
          },
        ],
      },

      {
        component: 'div',
        componentProps: { className: 'space-y-4' },
        children: [
          {
            value: model.$.fullName,
            component: InputField,
            componentProps: { label: 'ФИО', placeholder: 'Иванов Иван', testId: 'fullName' },
          },
          {
            value: model.$.amount,
            component: InputField,
            componentProps: { label: 'Сумма (₽)', type: 'number', step: 1000, testId: 'amount' },
          },
          {
            value: model.$.months,
            component: InputField,
            componentProps: { label: 'Срок (мес.)', type: 'number', min: 1, testId: 'months' },
          },
        ],
      },

      { component: 'hr', componentProps: { className: 'border-gray-200' } },

      // Сводка с реактивным текстом: значения подставляются из модели и вычисляемого сигнала.
      {
        component: 'dl',
        componentProps: { className: 'grid grid-cols-2 gap-2 text-sm' },
        children: [
          { component: 'dt', componentProps: { className: 'text-gray-500' }, text: 'Заявитель' },
          {
            component: 'dd',
            componentProps: { className: 'font-medium', 'data-testid': 'summary-fullName' },
            text: model.$.fullName,
          },
          {
            component: 'dt',
            componentProps: { className: 'text-gray-500' },
            text: 'Платёж в месяц',
          },
          {
            component: 'dd',
            componentProps: { className: 'font-medium', 'data-testid': 'summary-monthly' },
            text: [monthly, ' ₽'],
          },
        ],
      },
    ],
  };
}
