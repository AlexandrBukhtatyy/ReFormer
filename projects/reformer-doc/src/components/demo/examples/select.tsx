import { Select } from '@reformer/ui-kit';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import type { ComponentDocConfig } from '../types';

const LOAN = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Авто' },
];

const GROUPED = [
  { value: 'msk', label: 'Москва', group: 'Россия' },
  { value: 'spb', label: 'Санкт-Петербург', group: 'Россия' },
  { value: 'minsk', label: 'Минск', group: 'Беларусь' },
];

export const selectDocConfig: ComponentDocConfig = {
  name: 'Select',
  importFrom: '@reformer/ui-kit',
  description: 'Выпадающий список на Radix. Inline-опции или асинхронный источник (resource).',
  variants: [
    {
      id: 'basic',
      title: 'Inline-опции',
      description: 'Массив options прямо в componentProps.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
      }),
      code: `{
  value: model.$.loanType,
  component: Select,
  componentProps: {
    label: 'Тип кредита',
    placeholder: 'Выберите тип',
    options: [
      { value: 'consumer', label: 'Потребительский' },
      { value: 'mortgage', label: 'Ипотека' },
    ],
  },
}`,
    },
    {
      id: 'clearable',
      title: 'С очисткой',
      description: 'clearable добавляет крестик сброса в null.',
      render: makeFieldVariant({
        initial: 'mortgage',
        component: Select,
        componentProps: { label: 'Тип кредита', options: LOAN, clearable: true },
      }),
      code: `componentProps: { label: 'Тип кредита', options: LOAN, clearable: true }`,
    },
    {
      id: 'grouped',
      title: 'Группы',
      description: 'Опции с одинаковым group объединяются под заголовком.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Город', placeholder: 'Выберите город', options: GROUPED },
      }),
      code: `options: [
  { value: 'msk', label: 'Москва', group: 'Россия' },
  { value: 'minsk', label: 'Минск', group: 'Беларусь' },
]`,
    },
    {
      id: 'disabled',
      title: 'Заблокирован',
      description: 'Через control.disable().',
      render: makeFieldVariant({
        initial: 'auto',
        component: Select,
        componentProps: { label: 'Тип кредита', options: LOAN },
        disabled: true,
      }),
      code: `const form = createForm({ model, schema });
form.loanType.disable();`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Обязательный выбор',
      description: 'Валидатор required прямо в ноде схемы.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
        validators: [required({ message: 'Выберите тип кредита' })],
      }),
      code: `{
  value: model.$.loanType,
  component: Select,
  componentProps: { label: 'Тип кредита', options: LOAN },
  validators: [required({ message: 'Выберите тип кредита' })],
}`,
    },
    {
      id: 'async',
      title: 'Асинхронный источник (resource)',
      description:
        'Стратегии static / preload (клиентский поиск) / partial (серверные поиск и пагинация).',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Город', placeholder: 'Выберите город', options: GROUPED },
      }),
      code: `import { type ResourceConfig } from '@reformer/ui-kit';

const countries: ResourceConfig<string> = {
  type: 'preload', // грузим всё, поиск фильтрует на клиенте
  load: async () => {
    const items = await fetch('/api/countries').then((r) => r.json());
    return { items: items.map((c) => ({ id: c.id, label: c.name, value: c.code })), totalCount: items.length };
  },
};

// в componentProps: { label: 'Страна', resource: countries }`,
    },
  ],
  api: {
    component: Select,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ message: 'Выберите тип' })],
    valuePresets: [
      { label: 'Потребительский', value: 'consumer' },
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Очистить (null)', value: null },
    ],
    controls: [
      {
        prop: 'value',
        type: 'string | null',
        group: 'Control',
        kind: 'readonly',
        description: 'Выбранное значение из option.value. null — ничего не выбрано.',
      },
      {
        prop: 'onChange',
        type: '(value: string | null) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Выбор варианта; при очистке приходит null.',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при закрытии дропдауна.',
      },
      {
        prop: 'options',
        type: 'Array<{ value; label; group? }>',
        group: 'Options',
        kind: 'readonly',
        description: 'Inline-опции. Одинаковый group объединяется в секцию.',
      },
      {
        prop: 'resource',
        type: 'ResourceConfig',
        group: 'Options',
        kind: 'readonly',
        description: 'Асинхронный источник опций (static / preload / partial).',
      },
      {
        prop: 'placeholder',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: 'Выберите вариант',
        description: 'Подсказка в триггере.',
      },
      {
        prop: 'clearable',
        type: 'boolean',
        group: 'Behavior',
        kind: 'boolean',
        default: false,
        description: 'Показывать крестик очистки в null.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует выбор.',
      },
    ],
    code: (v) =>
      `{
  value: model.$.loanType,
  component: Select,
  componentProps: {
    label: 'Тип кредита',
    options: LOAN,
    placeholder: '${v.placeholder}',${v.clearable ? '\n    clearable: true,' : ''}
  },
  validators: [required()],
}${v.disabled ? '\n// поле отключено: form.loanType.disable()' : ''}`,
  },
};
