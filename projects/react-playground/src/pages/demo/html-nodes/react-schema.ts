/**
 * Схема мини-примера на TS: `component` строкой-тегом + текст прямо в `children`.
 *
 * Показывает, что презентационные блоки (заголовок, инфо-плашка, сводка, разделитель) больше
 * не требуют отдельного React-компонента с регистрацией — они описываются прямо в схеме.
 * Ребёнком может быть литерал, сигнал или вложенный узел в любом порядке: соседние текстовые
 * части склеиваются без разделителя, а сигнал подписывается точечно, поэтому при изменении
 * модели перерисовывается только сам текст.
 */

import { computed } from '@reformer/core/signals';
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input, InputNumber } from '@reformer/ui-kit';
import type { InstallmentRequest } from './model';

/** Платёж без процентов — вычисляемый сигнал, который уедет прямо в `children` узла. */
export const monthlyPayment = (model: FormModel<InstallmentRequest>) =>
  computed(() => {
    const amount = model.$.amount.value ?? 0;
    const months = model.$.months.value || 1;
    return Math.round(amount / months);
  });

export function buildInstallmentSchema(model: FormModel<InstallmentRequest>): FormSchemaNode {
  const monthly = monthlyPayment(model);

  return {
    component: 'div',
    componentProps: { className: 'space-y-6' },
    children: [
      // Заголовок секции — раньше ради этого заводили компонент Section или Typography.
      {
        component: 'h2',
        componentProps: { className: 'text-xl font-bold' },
        children: ['Рассрочка'],
      },

      // Инфо-плашка: смешанный inline-контент — текст и узлы лежат в одном `children`.
      {
        component: 'div',
        componentProps: { className: 'p-4 bg-blue-50 border border-blue-200 rounded-md' },
        children: [
          {
            component: 'p',
            componentProps: { className: 'text-sm text-blue-800' },
            children: [
              'Проценты не начисляются. ',
              { component: 'b', children: ['Досрочное погашение бесплатно.'] },
            ],
          },
        ],
      },

      {
        component: 'div',
        componentProps: { className: 'space-y-4' },
        children: [
          {
            model: model.$.fullName,
            component: Input,
            componentProps: { label: 'ФИО', placeholder: 'Иванов Иван', testId: 'fullName' },
          },
          {
            model: model.$.amount,
            component: InputNumber,
            componentProps: { label: 'Сумма (₽)', step: 1000, testId: 'amount' },
          },
          {
            model: model.$.months,
            component: InputNumber,
            componentProps: { label: 'Срок (мес.)', min: 1, testId: 'months' },
          },
        ],
      },

      { component: 'hr', componentProps: { className: 'border-gray-200' } },

      // Сводка с реактивным текстом: значения подставляются из модели и вычисляемого сигнала.
      {
        component: 'dl',
        componentProps: { className: 'grid grid-cols-2 gap-2 text-sm' },
        children: [
          {
            component: 'dt',
            componentProps: { className: 'text-gray-500' },
            children: ['Заявитель'],
          },
          {
            component: 'dd',
            componentProps: { className: 'font-medium', 'data-testid': 'summary-fullName' },
            children: [model.$.fullName],
          },
          {
            component: 'dt',
            componentProps: { className: 'text-gray-500' },
            children: ['Платёж в месяц'],
          },
          {
            component: 'dd',
            componentProps: { className: 'font-medium', 'data-testid': 'summary-monthly' },
            children: [monthly, ' ₽'],
          },
        ],
      },
    ],
  };
}
