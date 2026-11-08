import { useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Select,
  SelectAsync,
  SelectContent,
  SelectItem,
  SelectMulti,
  SelectTrigger,
  SelectValue,
  selectAsyncPropsSchema,
  type ResourceConfig,
} from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant, raw } from '../field-snippet';
import type { ComponentDocConfig, VariantDef } from '../types';

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

const CITIES = [
  { value: 'msk', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'kzn', label: 'Казань' },
  { value: 'nsk', label: 'Новосибирск' },
  { value: 'ekb', label: 'Екатеринбург' },
];

/* ─── Раскрытый список для карточек вариантов ──────────────────────────────
   Настоящий список Select открывается поверх страницы, и открытым бывает только один. Чтобы
   в галерее были видны пункты сразу нескольких полей, раскрытое состояние нарисовано на месте
   токенами кита: клик по пункту выбирает его. Это иллюстрация, а не компонент кита. */
interface PreviewOption {
  value: string;
  label: string;
  group?: string;
}

function SelectOpenPreview({
  label,
  options,
  initial,
}: {
  label: string;
  options: PreviewOption[];
  initial: string;
}) {
  const [selected, setSelected] = useState(initial);
  const selectedOption = options.find((o) => o.value === selected);

  const groups: { name?: string; items: PreviewOption[] }[] = [];
  for (const o of options) {
    let bucket = groups.find((g) => g.name === o.group);
    if (!bucket) {
      bucket = { name: o.group, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(o);
  }

  return (
    <div style={{ maxWidth: 380, width: '100%', fontSize: 14 }}>
      <div style={{ fontWeight: 500, marginBottom: 6 }}>{label}</div>

      {/* Поле с выбранным значением. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          height: 36,
          padding: '0 12px',
          borderRadius: 6,
          border: '1px solid var(--input)',
        }}
      >
        <span>{selectedOption?.label ?? ''}</span>
        <ChevronDownIcon size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
      </div>

      {/* Список пунктов, всегда раскрытый. */}
      <div
        style={{
          marginTop: 4,
          padding: 4,
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        }}
      >
        {groups.map((group, gi) => (
          <div key={group.name ?? gi}>
            {group.name && (
              <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>
                {group.name}
              </div>
            )}
            {group.items.map((o) => {
              const active = o.value === selected;
              return (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelected(o.value)}
                  style={{
                    position: 'relative',
                    padding: '6px 32px 6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: active ? 'var(--accent)' : undefined,
                    color: active ? 'var(--accent-foreground)' : undefined,
                  }}
                >
                  {o.label}
                  {active && (
                    <CheckIcon
                      size={16}
                      style={{ position: 'absolute', right: 8, top: '50%', marginTop: -8 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Карточка с раскрытым списком: код — тот узел SelectAsync, который даёт такой список. */
function openPreviewVariant(o: {
  id: string;
  title: string;
  description: string;
  field: string;
  label: string;
  options: PreviewOption[];
  initial: string;
}): VariantDef {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    render: () => <SelectOpenPreview label={o.label} options={o.options} initial={o.initial} />,
    code: fieldSnippet({
      field: o.field,
      component: 'SelectAsync',
      props: { label: o.label, options: o.options },
      initial: o.initial,
    }),
  };
}

/* ─── Своя разметка пункта: ручная сборка из частей Select ─────────────── */

const PEOPLE = [
  { value: 'ivanov', name: 'Иванов И. И.', initials: 'ИИ', role: 'Менеджер' },
  { value: 'petrov', name: 'Петров П. П.', initials: 'ПП', role: 'Аналитик' },
  { value: 'sidorov', name: 'Сидоров С. С.', initials: 'СС', role: 'Разработчик' },
];

function EmployeeSelect() {
  const [value, setValue] = useState('petrov');
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите сотрудника" />
        </SelectTrigger>
        <SelectContent>
          {PEOPLE.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <Avatar size="sm">
                <AvatarFallback>{p.initials}</AvatarFallback>
              </Avatar>
              {p.name}
              <span className="text-muted-foreground">{p.role}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const EMPLOYEE_SELECT_CODE = `import { useState } from 'react';
import {
  Avatar,
  AvatarFallback,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reformer/ui-kit';

const PEOPLE = [
  { value: 'ivanov', name: 'Иванов И. И.', initials: 'ИИ', role: 'Менеджер' },
  { value: 'petrov', name: 'Петров П. П.', initials: 'ПП', role: 'Аналитик' },
  { value: 'sidorov', name: 'Сидоров С. С.', initials: 'СС', role: 'Разработчик' },
];

function EmployeeSelect() {
  const [value, setValue] = useState('petrov');
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Выберите сотрудника" />
      </SelectTrigger>
      <SelectContent>
        {PEOPLE.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            <Avatar size="sm">
              <AvatarFallback>{p.initials}</AvatarFallback>
            </Avatar>
            {p.name}
            <span className="text-muted-foreground">{p.role}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}`;

/* ─── Источники данных для примеров ────────────────────────────────────────
   Сервер имитируется задержкой: в реальном коде load обращается к API. */

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

/** Код источника данных над узлом поля. */
function withSource(def: VariantDef, source: string): VariantDef {
  return { ...def, code: `${source}\n\n${def.code}` };
}

const STATIC_SOURCE = `// источник: один запрос при появлении поля
const countries: ResourceConfig<string> = {
  type: 'static',
  load: async () => {
    const items = await api.countries(); // [{ id, label, value }]
    return { items, totalCount: items.length };
  },
};`;

const PRELOAD_SOURCE = `// источник: загрузить всё сразу, искать среди загруженного
const countries: ResourceConfig<string> = {
  type: 'preload',
  load: async () => {
    const items = await api.countries();
    return { items, totalCount: items.length };
  },
};`;

const PARTIAL_SOURCE = `// источник: поиск и страницы — на сервере
const cities: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 20,
  load: async ({ search = '', page = 1, pageSize = 20 } = {}) => {
    const { rows, total } = await api.cities({ search, page, pageSize });
    return { items: rows, totalCount: total };
  },
};`;

const FAILING_SOURCE = `// источник, у которого падает запрос
const countries: ResourceConfig<string> = {
  type: 'static',
  load: async () => {
    throw new Error('Network error');
  },
};`;

// Пропсы панели API — из props-схемы варианта. label и options задаются baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(selectAsyncPropsSchema), {
  omit: ['label', 'options'],
});

export const selectDocConfig: ComponentDocConfig = {
  name: 'Select',
  importFrom: '@reformer/ui-kit',
  description:
    'Выпадающий список. SelectAsync — одно значение из options или из загружаемого источника, SelectMulti — несколько значений, Select с частями — ручная сборка вне формы.',
  variants: [
    openPreviewVariant({
      id: 'single',
      title: 'Одно значение',
      description:
        'SelectAsync с массивом options. Значение — string | null. Список показан раскрытым для наглядности.',
      field: 'loanType',
      label: 'Тип кредита',
      options: LOAN,
      initial: 'mortgage',
    }),
    openPreviewVariant({
      id: 'grouped',
      title: 'Группы пунктов',
      description:
        'Пункты с одинаковым group собираются под общим заголовком. Список показан раскрытым для наглядности.',
      field: 'city',
      label: 'Город',
      options: GROUPED,
      initial: 'spb',
    }),
    fieldVariant({
      id: 'multi',
      title: 'Несколько значений',
      description:
        'SelectMulti: значение — string[] | null. Выбранное — чипами; когда выбрано больше двух, чипы сворачиваются в «Выбрано: N».',
      field: 'cities',
      component: SelectMulti,
      componentName: 'SelectMulti',
      initial: ['msk', 'kzn'],
      showInitial: true,
      props: { label: 'Города', options: CITIES, clearable: true, summaryThreshold: 2 },
    }),
    {
      id: 'custom-item',
      title: 'Своя разметка пункта',
      description:
        'Вне формы: Select собирается из частей, в пункте — аватар, имя и должность. Пропом options такой пункт не описать.',
      render: EmployeeSelect,
      code: EMPLOYEE_SELECT_CODE,
    },
  ],
  examples: [
    fieldVariant({
      id: 'clearable',
      title: 'Кнопка очистки',
      description: 'clearable добавляет крестик: он сбрасывает значение поля в null.',
      field: 'loanType',
      component: SelectAsync,
      componentName: 'SelectAsync',
      initial: 'mortgage',
      showInitial: true,
      props: { label: 'Тип кредита', options: LOAN, clearable: true },
    }),
    withSource(
      fieldVariant({
        id: 'resource-static',
        title: 'Загрузка один раз',
        description:
          'resource с type: "static" — один запрос при появлении поля, без поиска и подгрузки.',
        field: 'country',
        component: SelectAsync,
        componentName: 'SelectAsync',
        initial: null,
        props: { label: 'Страна', placeholder: 'Выберите страну', resource: staticResource },
        codeProps: { resource: raw('countries') },
      }),
      STATIC_SOURCE
    ),
    withSource(
      fieldVariant({
        id: 'resource-preload',
        title: 'Загрузка всего списка и поиск по нему',
        description:
          'type: "preload" — один запрос за всем списком; поле поиска в списке фильтрует уже загруженные пункты.',
        field: 'country',
        component: SelectAsync,
        componentName: 'SelectAsync',
        initial: null,
        props: { label: 'Страна', placeholder: 'Выберите страну', resource: preloadResource },
        codeProps: { resource: raw('countries') },
      }),
      PRELOAD_SOURCE
    ),
    withSource(
      fieldVariant({
        id: 'resource-partial',
        title: 'Поиск и подгрузка на сервере',
        description:
          'type: "partial" — поиск уходит на сервер (load({ search })) через 300 мс после ввода, следующая страница грузится при прокрутке списка.',
        field: 'city',
        component: SelectAsync,
        componentName: 'SelectAsync',
        initial: null,
        props: { label: 'Город', placeholder: 'Выберите город', resource: partialResource },
        codeProps: { resource: raw('cities') },
      }),
      PARTIAL_SOURCE
    ),
    withSource(
      fieldVariant({
        id: 'resource-error',
        title: 'Ошибка загрузки',
        description:
          'Если load упал и пунктов нет, список показывает сообщение об ошибке и кнопку повтора.',
        field: 'country',
        component: SelectAsync,
        componentName: 'SelectAsync',
        initial: null,
        props: { label: 'Страна', placeholder: 'Выберите страну', resource: failingResource },
        codeProps: { resource: raw('countries') },
      }),
      FAILING_SOURCE
    ),
    fieldVariant({
      id: 'validation',
      title: 'Обязательный выбор',
      description:
        'Правило required — в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'loanType',
      component: SelectAsync,
      componentName: 'SelectAsync',
      initial: null,
      props: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN, required: true },
      validators: [required({ code: 'loanType.required' })],
      rules: "required({ code: 'loanType.required' })",
      messages: { 'loanType.required': 'Выберите тип кредита' },
      touched: true,
    }),
  ],
  api: {
    component: SelectAsync,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Выберите тип' },
    valuePresets: [
      { label: 'Потребительский', value: 'consumer' },
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Очистить (null)', value: null },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'loanType',
        component: 'SelectAsync',
        props: { label: 'Тип кредита', options: raw('LOAN_TYPES') },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
