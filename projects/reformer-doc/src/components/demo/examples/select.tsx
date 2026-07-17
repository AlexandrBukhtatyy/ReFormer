import { useState } from 'react';
import {
  SelectField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectAsyncPropsSchema,
  type ResourceConfig,
} from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
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

/* ─── Кастомный шаблон элемента (ручная сборка base-compound: аватар + ФИО) ─── */

const PEOPLE = [
  { value: 'ivanov', name: 'Иванов И.И.', role: 'Менеджер', color: '#6366f1' },
  { value: 'petrov', name: 'Петров П.П.', role: 'Аналитик', color: '#10b981' },
  { value: 'sidorov', name: 'Сидоров С.С.', role: 'Разработчик', color: '#f59e0b' },
];

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function CustomItemVariant() {
  const [value, setValue] = useState<string>('');
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите сотрудника" />
        </SelectTrigger>
        <SelectContent>
          {PEOPLE.map((person) => (
            <SelectItem key={person.value} value={person.value}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: person.color,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {initials(person.name)}
                </span>
                <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <span style={{ fontWeight: 500 }}>{person.name}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{person.role}</span>
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ─── Живые resource-источники для Examples ─────────────────────────────── */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const COUNTRIES = [
  { id: 'ru', label: 'Россия', value: 'ru' },
  { id: 'by', label: 'Беларусь', value: 'by' },
  { id: 'kz', label: 'Казахстан', value: 'kz' },
  { id: 'am', label: 'Армения', value: 'am' },
];

const staticResource: ResourceConfig<string> = {
  type: 'static',
  load: async () => {
    await delay(400);
    return { items: COUNTRIES, totalCount: COUNTRIES.length };
  },
};

const preloadResource: ResourceConfig<string> = {
  type: 'preload',
  load: async () => {
    await delay(400);
    return { items: COUNTRIES, totalCount: COUNTRIES.length };
  },
};

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

const failingResource: ResourceConfig<string> = {
  type: 'static',
  load: async () => {
    await delay(400);
    throw new Error('Network error');
  },
};

export const selectDocConfig: ComponentDocConfig = {
  name: 'Select',
  importFrom: '@reformer/ui-kit',
  description:
    'Выпадающий список на Radix. Вариант base — чистый compound (ручная сборка), async — inline-опции или асинхронный источник (resource).',
  variants: [
    {
      id: 'single',
      title: 'Одиночный выбор (options)',
      description:
        'Плоский список inline-опций через проп options. Значение — строка (value: string | null).',
      render: makeFieldVariant({
        initial: null,
        component: SelectField,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
      }),
      code: `{
  value: model.$.loanType,
  component: SelectField,
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
      id: 'grouped',
      title: 'Группировка опций (options + group)',
      description: 'Опции с одинаковым group объединяются под заголовком SelectLabel.',
      render: makeFieldVariant({
        initial: null,
        component: SelectField,
        componentProps: { label: 'Город', placeholder: 'Выберите город', options: GROUPED },
      }),
      code: `componentProps: {
  label: 'Город',
  options: [
    { value: 'msk', label: 'Москва', group: 'Россия' },
    { value: 'minsk', label: 'Минск', group: 'Беларусь' },
  ],
}`,
    },
    {
      id: 'custom-item',
      title: 'Кастомный шаблон элемента (ручная сборка base-compound)',
      description:
        'Форма, недостижимая options-пропом: произвольная разметка item (аватар + ФИО + роль). Собирается из Select / SelectTrigger / SelectContent / SelectItem варианта base.',
      render: CustomItemVariant,
      code: `import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@reformer/ui-kit';

<Select value={value} onValueChange={onChange}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Выберите сотрудника" />
  </SelectTrigger>
  <SelectContent>
    {people.map((p) => (
      <SelectItem key={p.value} value={p.value}>
        <Avatar>{initials(p.name)}</Avatar>
        <span>{p.name}</span>
      </SelectItem>
    ))}
  </SelectContent>
</Select>`,
    },
  ],
  examples: [
    {
      id: 'clearable',
      title: 'Очистка выбора (clearable)',
      description:
        'clearable=true добавляет крестик; клик сбрасывает выбор в null через onChange(null).',
      render: makeFieldVariant({
        initial: 'mortgage',
        component: SelectField,
        componentProps: { label: 'Тип кредита', options: LOAN, clearable: true },
      }),
      code: `componentProps: { label: 'Тип кредита', options: LOAN, clearable: true }`,
    },
    {
      id: 'resource-static',
      title: 'Resource: static (снимок)',
      description: 'type="static" — один load({}) при маунте, без поля поиска и пагинации.',
      render: makeFieldVariant({
        initial: null,
        component: SelectField,
        componentProps: {
          label: 'Страна',
          placeholder: 'Выберите страну',
          resource: staticResource,
        },
      }),
      code: `const countries: ResourceConfig<string> = {
  type: 'static',
  load: async () => ({ items: await fetchCountries(), totalCount: n }),
};
componentProps: { label: 'Страна', resource: countries }`,
    },
    {
      id: 'resource-preload',
      title: 'Resource: preload + клиентский поиск',
      description:
        'type="preload" грузит всё сразу; поле Search фильтрует загруженные опции на клиенте.',
      render: makeFieldVariant({
        initial: null,
        component: SelectField,
        componentProps: {
          label: 'Страна',
          placeholder: 'Выберите страну',
          resource: preloadResource,
        },
      }),
      code: `const countries: ResourceConfig<string> = { type: 'preload', load: async () => ({ items, totalCount }) };`,
    },
    {
      id: 'resource-partial',
      title: 'Resource: partial (серверные поиск и пагинация)',
      description:
        'type="partial" — debounce-поиск на сервер (load({ search })), догрузка страниц по скроллу.',
      render: makeFieldVariant({
        initial: null,
        component: SelectField,
        componentProps: {
          label: 'Город',
          placeholder: 'Выберите город',
          resource: partialResource,
        },
      }),
      code: `const cities: ResourceConfig<string> = {
  type: 'partial', pageSize: 20,
  load: async ({ search, page, pageSize }) => {
    const { rows, total } = await fetchCities(search, page, pageSize);
    return { items: rows, totalCount: total };
  },
};`,
    },
    {
      id: 'resource-error',
      title: 'Ошибка загрузки + Retry',
      description:
        'Когда load() падает и опций нет — дропдаун показывает «Failed to load options» и кнопку Retry.',
      render: makeFieldVariant({
        initial: null,
        component: SelectField,
        componentProps: {
          label: 'Страна',
          placeholder: 'Выберите страну',
          resource: failingResource,
        },
      }),
      code: `const src: ResourceConfig<string> = { type: 'static', load: async () => { throw new Error('Network'); } };`,
    },
    {
      id: 'validation',
      title: 'Обязательный выбор (валидатор)',
      description:
        'validators: [required()] прямо в ноде схемы. touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: SelectField,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
        validators: [required({ message: 'Выберите тип кредита' })],
        touched: true,
      }),
      code: `{
  value: model.$.loanType,
  component: SelectField,
  componentProps: { label: 'Тип кредита', options: LOAN },
  validators: [required({ message: 'Выберите тип кредита' })],
}`,
    },
  ],
  api: {
    component: SelectField,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ message: 'Выберите тип' })],
    valuePresets: [
      { label: 'Потребительский', value: 'consumer' },
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Очистить (null)', value: null },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label/options — задаются baseComponentProps (иначе перетрут initialValues undefined-ами).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(selectAsyncPropsSchema), {
      omit: ['label', 'options'],
    }),
    code: (v) =>
      `{
  value: model.$.loanType,
  component: SelectField,
  componentProps: {
    label: 'Тип кредита',
    options: LOAN,
    placeholder: '${v.placeholder}',${v.required ? '\n    required: true,' : ''}${v.clearable ? '\n    clearable: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
