import { useState } from 'react';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { Autocomplete, useAutocomplete, useAutocompleteContext } from '@reformer/cdk/autocomplete';
import type { NormalizedOption, ResourceConfig } from '@reformer/cdk/option-source';
import { FormField, InputSuggest } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/** Подсказки — константа модуля: новый массив на каждый рендер пересчитывал бы нормализацию. */
const CITIES = ['Москва', 'Мурманск', 'Казань', 'Калининград', 'Новосибирск', 'Нижний Новгород'];

/** Подсказки-объекты: в списке виден label, в поле уходит value. */
const STREETS = [
  { value: 'Тверская улица', label: 'Тверская улица — Москва' },
  { value: 'Невский проспект', label: 'Невский проспект — Санкт-Петербург' },
  { value: 'улица Баумана', label: 'улица Баумана — Казань' },
];

const ALL_CITIES = [
  'Абакан',
  'Архангельск',
  'Астрахань',
  'Барнаул',
  'Белгород',
  'Владивосток',
  'Владимир',
  'Волгоград',
  'Вологда',
  'Воронеж',
  'Екатеринбург',
  'Иркутск',
  'Калуга',
  'Кемерово',
  'Киров',
  'Краснодар',
  'Красноярск',
  'Курск',
  'Липецк',
  'Магадан',
  'Омск',
  'Орёл',
  'Пенза',
  'Пермь',
  'Псков',
  'Ростов-на-Дону',
  'Рязань',
  'Самара',
  'Саратов',
  'Смоленск',
  'Сочи',
  'Тверь',
  'Томск',
  'Тула',
  'Тюмень',
  'Ульяновск',
  'Уфа',
  'Хабаровск',
  'Чебоксары',
  'Челябинск',
  'Ярославль',
];

/**
 * Источник подсказок с серверным поиском: `partial` зовёт `load({ search, page })` с debounce.
 * Сервер имитирует задержка 400 мс. Константа модуля — ссылка на источник должна быть стабильной.
 */
const citySource: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 5,
  load: ({ search = '', page = 1, pageSize = 5 } = {}) =>
    new Promise((resolve) => {
      setTimeout(() => {
        const q = search.trim().toLowerCase();
        const found = ALL_CITIES.filter((c) => c.toLowerCase().includes(q));
        const items = found
          .slice((page - 1) * pageSize, page * pageSize)
          .map((c) => ({ id: c, label: c, value: c }));
        resolve({ items, totalCount: found.length });
      }, 400);
    }),
};

const FIELD: React.CSSProperties = { position: 'relative', maxWidth: 360, width: '100%' };
const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--ifm-color-emphasis-400)',
  fontSize: 14,
};
const LISTBOX: React.CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  left: 0,
  right: 0,
  marginTop: 4,
  maxHeight: 220,
  overflowY: 'auto',
  padding: 4,
  borderRadius: 6,
  border: '1px solid var(--ifm-color-emphasis-300)',
  background: 'var(--ifm-background-surface-color)',
  boxShadow: 'var(--ifm-global-shadow-md)',
};
const OPTION: React.CSSProperties = { padding: '4px 8px', borderRadius: 4, cursor: 'pointer' };
const MUTED: React.CSSProperties = { color: 'var(--ifm-color-emphasis-600)', fontSize: 13 };

/** Подсвеченный пункт: у элемента ещё и data-active — для стилей через CSS. */
const optionStyle = (active: boolean): React.CSSProperties => ({
  ...OPTION,
  background: active ? 'var(--ifm-color-emphasis-200)' : undefined,
});

function StaticDemo() {
  const [city, setCity] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Autocomplete.Root value={city} onChange={setCity} suggestions={CITIES}>
        <div style={FIELD}>
          <Autocomplete.Input placeholder="Город" aria-label="Город" style={INPUT} />
          <Autocomplete.Listbox style={LISTBOX}>
            {(items) =>
              items.map((item, i) => <AutocompleteRow key={item.id} item={item} index={i} />)
            }
          </Autocomplete.Listbox>
        </div>
      </Autocomplete.Root>
      <p style={MUTED}>Значение поля: «{city}»</p>
    </div>
  );
}

/** Пункт списка: подсвеченный (стрелками или мышью) — по activeIndex из контекста. */
function AutocompleteRow({ item, index }: { item: NormalizedOption; index: number }) {
  const { activeIndex } = useAutocompleteContext();
  return (
    <Autocomplete.Option item={item} index={index} style={optionStyle(index === activeIndex)} />
  );
}

function ObjectsDemo() {
  const [street, setStreet] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Autocomplete.Root value={street} onChange={setStreet} suggestions={STREETS} openOnFocus>
        <div style={FIELD}>
          <Autocomplete.Input placeholder="Улица" aria-label="Улица" style={INPUT} />
          <Autocomplete.Listbox style={LISTBOX}>
            {(items) =>
              items.map((item, i) => <AutocompleteRow key={item.id} item={item} index={i} />)
            }
          </Autocomplete.Listbox>
        </div>
      </Autocomplete.Root>
      <p style={MUTED}>Значение поля: «{street}»</p>
    </div>
  );
}

function AsyncDemo() {
  const [city, setCity] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Autocomplete.Root value={city} onChange={setCity} suggestions={citySource} minChars={1}>
        <div style={FIELD}>
          <Autocomplete.Input
            placeholder="Начните вводить город"
            aria-label="Город"
            style={INPUT}
          />
          <Autocomplete.Listbox style={LISTBOX}>
            {(items) => (
              <>
                {items.map((item, i) => (
                  <AutocompleteRow key={item.id} item={item} index={i} />
                ))}
                <Autocomplete.Loading>
                  <div style={{ ...OPTION, ...MUTED }}>Загрузка…</div>
                </Autocomplete.Loading>
              </>
            )}
          </Autocomplete.Listbox>
        </div>
      </Autocomplete.Root>
      <p style={MUTED}>Значение поля: «{city}»</p>
    </div>
  );
}

function HookDemo() {
  const [city, setCity] = useState('');
  const ac = useAutocomplete({ value: city, onChange: setCity, suggestions: CITIES });
  return (
    <div style={FIELD}>
      <input {...ac.getInputProps({ placeholder: 'Город', 'aria-label': 'Город' })} style={INPUT} />
      {ac.open && (
        <ul {...ac.getListboxProps()} style={{ ...LISTBOX, listStyle: 'none', margin: '4px 0 0' }}>
          {ac.items.map((item, i) => (
            <li
              key={item.id}
              {...ac.getOptionProps(item, i)}
              style={optionStyle(i === ac.activeIndex)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AddressForm = { city: string };

/** Готовый вид: InputSuggest из ui-kit — узел схемы с suggestions. */
const addressSchema = (model: FormModel<AddressForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.city,
      component: InputSuggest,
      componentProps: { label: 'Город', placeholder: 'Начните вводить', suggestions: CITIES },
    },
  ],
});

function UiKitDemo() {
  const { form } = useFormBundle(() =>
    createForm<AddressForm>({ initial: { city: '' }, schema: addressSchema })
  );
  return (
    <div style={{ maxWidth: 360, width: '100%' }}>
      <FormField control={form.city} />
    </div>
  );
}

export const cdkAutocompleteDocConfig: ComponentDocConfig = {
  name: 'Autocomplete',
  importFrom: '@reformer/cdk/autocomplete',
  description:
    'Headless-поле со свободным вводом и подсказками. Значение — всегда введённый текст; выбор подсказки подставляет её value в поле.',
  variants: [
    {
      id: 'static',
      title: 'Подсказки из списка строк',
      description:
        'Подсказки фильтруются по введённому тексту. ↓/↑ — по пунктам, Enter — выбрать, Esc — закрыть. Подсказку можно не выбирать: в поле остаётся то, что набрано.',
      render: StaticDemo,
      code: `const CITIES = ['Москва', 'Мурманск', 'Казань', 'Калининград', 'Новосибирск'];

<Autocomplete.Root value={city} onChange={setCity} suggestions={CITIES}>
  <div className="relative">
    <Autocomplete.Input placeholder="Город" aria-label="Город" />
    <Autocomplete.Listbox className="dropdown">
      {/* подсвеченный пункт помечен data-active */}
      {(items) =>
        items.map((item, i) => <Autocomplete.Option key={item.id} item={item} index={i} />)
      }
    </Autocomplete.Listbox>
  </div>
</Autocomplete.Root>`,
    },
    {
      id: 'objects',
      title: 'Подсказки с подписью',
      description:
        'Объекты { value, label }: в списке виден label, в поле уходит value. openOnFocus раскрывает список при фокусе.',
      render: ObjectsDemo,
      code: `const STREETS = [
  { value: 'Тверская улица', label: 'Тверская улица — Москва' },
  { value: 'Невский проспект', label: 'Невский проспект — Санкт-Петербург' },
];

<Autocomplete.Root value={street} onChange={setStreet} suggestions={STREETS} openOnFocus>
  <Autocomplete.Input placeholder="Улица" aria-label="Улица" />
  <Autocomplete.Listbox>
    {(items) => items.map((item, i) => <Autocomplete.Option key={item.id} item={item} index={i} />)}
  </Autocomplete.Listbox>
</Autocomplete.Root>`,
    },
  ],
  examples: [
    {
      id: 'async',
      title: 'Серверный поиск',
      description:
        'Источник ResourceConfig со стратегией partial: запрос load({ search, page }) уходит с задержкой 300 мс после ввода. Autocomplete.Loading виден, пока идёт загрузка.',
      render: AsyncDemo,
      code: `import type { ResourceConfig } from '@reformer/cdk/option-source';

// Константа модуля: ссылка на источник должна быть стабильной.
const citySource: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 5,
  load: ({ search = '', page = 1, pageSize = 5 } = {}) => api.findCities(search, page, pageSize),
  // → { items: [{ id, label, value }], totalCount }
};

<Autocomplete.Root value={city} onChange={setCity} suggestions={citySource} minChars={1}>
  <Autocomplete.Input placeholder="Начните вводить город" aria-label="Город" />
  <Autocomplete.Listbox>
    {(items) => (
      <>
        {items.map((item, i) => <Autocomplete.Option key={item.id} item={item} index={i} />)}
        <Autocomplete.Loading>Загрузка…</Autocomplete.Loading>
      </>
    )}
  </Autocomplete.Listbox>
</Autocomplete.Root>`,
    },
    {
      id: 'hook',
      title: 'Хук useAutocomplete',
      description:
        'Prop-getters навешивают роли, aria-атрибуты и клавиатуру на вашу разметку. Свои обработчики передавайте аргументом getInputProps — они вызываются первыми.',
      render: HookDemo,
      code: `import { useAutocomplete } from '@reformer/cdk/autocomplete';

const ac = useAutocomplete({ value: city, onChange: setCity, suggestions: CITIES });

<div className="relative">
  <input {...ac.getInputProps({ placeholder: 'Город', 'aria-label': 'Город' })} />
  {ac.open && (
    <ul {...ac.getListboxProps()}>
      {ac.items.map((item, i) => (
        <li key={item.id} {...ac.getOptionProps(item, i)}>
          {item.label}
        </li>
      ))}
    </ul>
  )}
</div>`,
    },
    {
      id: 'ui-kit',
      title: 'Готовый вид: InputSuggest из ui-kit',
      description:
        'В форме обычно хватает InputSuggest: он собран на Autocomplete и ставится в узел схемы с пропом suggestions.',
      render: UiKitDemo,
      code: `import { FormField, InputSuggest } from '@reformer/ui-kit';

// узел схемы
{
  model: model.$.city,
  component: InputSuggest,
  componentProps: { label: 'Город', placeholder: 'Начните вводить', suggestions: CITIES },
}

<FormField control={form.city} />`,
    },
  ],
  props: [
    {
      name: 'Autocomplete.Root',
      type: 'value: string; onChange: (value: string) => void; onBlur?; suggestions?; minChars?; openOnFocus?; filter?; disabled?; id?',
      default: 'minChars: 0, openOnFocus: false',
      description:
        'Провайдер; принимает те же опции, что useAutocomplete. suggestions — string[], { value, label? }[] или ResourceConfig. filter(option, query) заменяет встроенный поиск подстроки.',
    },
    {
      name: 'Autocomplete.Input',
      type: 'asChild?; атрибуты <input>',
      description:
        'Поле с role="combobox", aria-autocomplete="list", aria-expanded, aria-controls, aria-activedescendant и autoComplete="off".',
    },
    {
      name: 'Autocomplete.Listbox',
      type: 'children: ReactNode | (items) => ReactNode; forceMount?',
      description:
        'Список с role="listbox", рендерится, пока раскрыт (forceMount — всегда, скрытый hidden). mousedown по списку не уводит фокус из поля.',
    },
    {
      name: 'Autocomplete.Option',
      type: 'item; index; asChild?; children?',
      description:
        'Пункт с role="option", aria-selected и data-active у подсвеченного; клик выбирает подсказку. Без children выводит label.',
    },
    {
      name: 'Autocomplete.Loading',
      type: 'children',
      description: 'Виден, пока источник грузит подсказки или следующую страницу.',
    },
    {
      name: 'useAutocomplete(options)',
      type: '→ { open, items, activeIndex, loading, loadingMore, error, hasMore, loadMore, setOpen, select, ids, getInputProps, getListboxProps, getOptionProps }',
      description: 'Вся логика без compound-компонентов. Позиционирование списка — ваше.',
    },
    {
      name: 'autocompleteReducer / normalizeSuggestions / matchSuggestions / isSuggestionResource',
      type: 'чистые функции',
      description: 'Ядро без React — для своих обёрток и тестов без DOM.',
    },
  ],
};
