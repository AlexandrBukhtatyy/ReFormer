import { useState } from 'react';
import { Root as SelectRoot } from '@radix-ui/react-select';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  type ResourceConfig,
} from '@reformer/ui-kit';
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

/* ─── Живые resource-источники для Examples ─────────────────────────────── */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const COUNTRIES = [
  { id: 'ru', label: 'Россия', value: 'ru' },
  { id: 'by', label: 'Беларусь', value: 'by' },
  { id: 'kz', label: 'Казахстан', value: 'kz' },
  { id: 'am', label: 'Армения', value: 'am' },
  { id: 'ge', label: 'Грузия', value: 'ge' },
  { id: 'rs', label: 'Сербия', value: 'rs' },
];

// static: один снимок при маунте, без поиска и пагинации.
const staticResource: ResourceConfig<string> = {
  type: 'static',
  load: async () => {
    await delay(400);
    return { items: COUNTRIES, totalCount: COUNTRIES.length };
  },
};

// preload: грузим всё сразу, поиск фильтрует загруженные опции на клиенте.
const preloadResource: ResourceConfig<string> = {
  type: 'preload',
  load: async () => {
    await delay(400);
    return { items: COUNTRIES, totalCount: COUNTRIES.length };
  },
};

// partial: серверные поиск (load({ search })) и пагинация (load({ page })).
const CITY_POOL = Array.from({ length: 64 }, (_, i) => ({
  id: i + 1,
  label: `Город ${i + 1}`,
  value: String(i + 1),
}));

const partialResource: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 20,
  load: async ({ search = '', page = 1, pageSize = 20 } = {}) => {
    await delay(500);
    const filtered = CITY_POOL.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), totalCount: filtered.length };
  },
};

// Источник, который всегда падает — витрина состояния «ошибка + Retry».
const failingResource: ResourceConfig<string> = {
  type: 'static',
  load: async () => {
    await delay(400);
    throw new Error('Network error');
  },
};

/* ─── Ручная композиция дропдауна из под-компонентов ────────────────────── */

function ManualCompositionExample() {
  const [value, setValue] = useState<string>('');
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <SelectRoot value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Выберите город" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Россия</SelectLabel>
            <SelectItem value="msk">Москва</SelectItem>
            <SelectItem value="spb">Санкт-Петербург</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Беларусь</SelectLabel>
            <SelectItem value="minsk">Минск</SelectItem>
            <SelectItem value="premium" disabled>
              Гомель (недоступно)
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </SelectRoot>
    </div>
  );
}

export const selectDocConfig: ComponentDocConfig = {
  name: 'Select',
  importFrom: '@reformer/ui-kit',
  description: 'Выпадающий список на Radix. Inline-опции или асинхронный источник (resource).',
  variants: [
    {
      id: 'empty',
      title: 'Пусто (placeholder)',
      description: 'Ничего не выбрано — триггер показывает подсказку-placeholder.',
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
      id: 'filled',
      title: 'С выбранным значением',
      description: 'Заполненное состояние — триггер показывает подпись выбранной опции.',
      render: makeFieldVariant({
        initial: 'mortgage',
        component: Select,
        componentProps: { label: 'Тип кредита', options: LOAN },
      }),
      code: `{
  value: model.$.loanType, // 'mortgage'
  component: Select,
  componentProps: { label: 'Тип кредита', options: LOAN },
}`,
    },
    {
      id: 'grouped',
      title: 'Группы опций',
      description: 'Опции с одинаковым group объединяются в секции под заголовком SelectLabel.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Город', placeholder: 'Выберите город', options: GROUPED },
      }),
      code: `options: [
  { value: 'msk', label: 'Москва', group: 'Россия' },
  { value: 'spb', label: 'Санкт-Петербург', group: 'Россия' },
  { value: 'minsk', label: 'Минск', group: 'Беларусь' },
]`,
    },
    {
      id: 'disabled-empty',
      title: 'Заблокирован (пусто)',
      description: 'Недоступен для взаимодействия, показан placeholder, приглушённый вид.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
        disabled: true,
      }),
      code: `const form = createForm({ model, schema });
form.loanType.disable(); // value = null`,
    },
    {
      id: 'disabled-filled',
      title: 'Заблокирован с значением',
      description: 'Заблокирован, но выбранное значение остаётся видимым в триггере.',
      render: makeFieldVariant({
        initial: 'auto',
        component: Select,
        componentProps: { label: 'Тип кредита', options: LOAN },
        disabled: true,
      }),
      code: `const form = createForm({ model, schema }); // value = 'auto'
form.loanType.disable();`,
    },
    {
      id: 'invalid',
      title: 'Ошибка (invalid)',
      description: 'Состояние ошибки валидации: рамка/ring destructive и текст ошибки под полем.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
        validators: [required({ message: 'Выберите тип кредита' })],
        touched: true,
      }),
      code: `// invalid-состояние = провал валидатора на touched-поле
{
  value: model.$.loanType, // null
  component: Select,
  componentProps: { label: 'Тип кредита', options: LOAN },
  validators: [required({ message: 'Выберите тип кредита' })],
}`,
    },
    {
      id: 'required',
      title: 'Обязательный (required)',
      description: 'Поле помечено как обязательное — у метки появляется required-маркер «*».',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: {
          label: 'Тип кредита',
          placeholder: 'Выберите тип',
          options: LOAN,
          required: true,
        },
      }),
      code: `componentProps: {
  label: 'Тип кредита',
  options: LOAN,
  required: true, // рисует «*» у метки и aria-required
}`,
    },
    {
      id: 'empty-options',
      title: 'Пустой список',
      description: 'Крайнее состояние: опций нет — дропдаун показывает «No options available».',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: { label: 'Город', placeholder: 'Выберите город', options: [] },
      }),
      code: `componentProps: { label: 'Город', options: [] }
// пустой массив → «No options available»`,
    },
  ],
  examples: [
    {
      id: 'clearable',
      title: 'Очистка выбора (clearable)',
      description:
        'clearable=true добавляет крестик справа от значения; клик сбрасывает выбор в null через onChange(null).',
      render: makeFieldVariant({
        initial: 'mortgage',
        component: Select,
        componentProps: { label: 'Тип кредита', options: LOAN, clearable: true },
      }),
      code: `{
  value: model.$.loanType,
  component: Select,
  componentProps: { label: 'Тип кредита', options: LOAN, clearable: true },
}`,
    },
    {
      id: 'resource-static',
      title: 'Resource: static (снимок)',
      description:
        'type="static" — один load({}) при маунте, без поля поиска и пагинации. Опции берутся из внешнего источника.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: {
          label: 'Страна',
          placeholder: 'Выберите страну',
          resource: staticResource,
        },
      }),
      code: `import { type ResourceConfig } from '@reformer/ui-kit';

const countries: ResourceConfig<string> = {
  type: 'static', // один load({}) при маунте; без поиска и пагинации
  load: async () => {
    const items = await fetch('/api/countries').then((r) => r.json());
    return {
      items: items.map((c) => ({ id: c.code, label: c.name, value: c.code })),
      totalCount: items.length,
    };
  },
};

// схема:
{
  value: model.$.country,
  component: Select,
  componentProps: { label: 'Страна', resource: countries },
}`,
    },
    {
      id: 'resource-preload',
      title: 'Resource: preload + клиентский поиск',
      description:
        'type="preload" грузит все опции сразу; в дропдауне появляется поле Search, фильтрующее загруженные опции на клиенте.',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: {
          label: 'Страна',
          placeholder: 'Выберите страну',
          resource: preloadResource,
        },
      }),
      code: `const countries: ResourceConfig<string> = {
  type: 'preload', // грузим всё, поиск фильтрует на клиенте
  load: async () => {
    const items = await fetch('/api/countries').then((r) => r.json());
    return {
      items: items.map((c) => ({ id: c.code, label: c.name, value: c.code })),
      totalCount: items.length,
    };
  },
};

// componentProps: { label: 'Страна', resource: countries }`,
    },
    {
      id: 'resource-partial',
      title: 'Resource: partial (серверные поиск и пагинация)',
      description:
        'type="partial" — debounce-поиск уходит на сервер (load({ search })), а следующие страницы догружаются по мере скролла (infinite-scroll до totalCount).',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: {
          label: 'Город',
          placeholder: 'Выберите город',
          resource: partialResource,
        },
      }),
      code: `const cities: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 20,
  load: async ({ search = '', page = 1, pageSize = 20 }) => {
    const res = await fetch(\`/api/cities?q=\${search}&page=\${page}&size=\${pageSize}\`);
    const { rows, total } = await res.json();
    return {
      items: rows.map((c) => ({ id: c.id, label: c.name, value: c.id })),
      totalCount: total,
    };
  },
};

// componentProps: { label: 'Город', resource: cities }`,
    },
    {
      id: 'resource-error',
      title: 'Ошибка загрузки + Retry',
      description:
        'Когда load() у resource падает и опций нет, дропдаун показывает «Failed to load options» и кнопку Retry (повтор первичной загрузки).',
      render: makeFieldVariant({
        initial: null,
        component: Select,
        componentProps: {
          label: 'Страна',
          placeholder: 'Выберите страну',
          resource: failingResource,
        },
      }),
      code: `const countries: ResourceConfig<string> = {
  type: 'static',
  load: async () => {
    // если промис реджектится и опций ещё нет —
    // в дропдауне появляется «Failed to load options» + Retry
    throw new Error('Network error');
  },
};

// componentProps: { label: 'Страна', resource: countries }`,
    },
    {
      id: 'validation',
      title: 'Обязательный выбор (валидатор)',
      description:
        'validators: [required()] прямо в ноде схемы — интеграция валидации ReFormer, ошибка при пустом значении.',
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
      id: 'manual-composition',
      title: 'Ручная композиция дропдауна',
      description:
        'Сборка из SelectTrigger / SelectValue / SelectContent / SelectGroup / SelectLabel / SelectItem вместо options — кастомная разметка секций и disabled-пункты.',
      render: ManualCompositionExample,
      code: `import { Root as SelectRoot } from '@radix-ui/react-select';
import {
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@reformer/ui-kit';

function CitySelect({ value, onChange }) {
  return (
    <SelectRoot value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Выберите город" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Россия</SelectLabel>
          <SelectItem value="msk">Москва</SelectItem>
          <SelectItem value="spb">Санкт-Петербург</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Беларусь</SelectLabel>
          <SelectItem value="minsk">Минск</SelectItem>
          <SelectItem value="premium" disabled>
            Гомель (недоступно)
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </SelectRoot>
  );
}`,
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
        prop: 'required',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Рисует required-маркер «*» у метки и aria-required.',
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
    placeholder: '${v.placeholder}',${v.required ? '\n    required: true,' : ''}${v.clearable ? '\n    clearable: true,' : ''}
  },
  validators: [required()],
}${v.disabled ? '\n// поле отключено: form.loanType.disable()' : ''}`,
  },
};
