# Autocomplete

Headless-автокомплит со **свободным вводом**: значение поля — всегда введённый текст, подсказки
лишь помогают его набрать. Выбор подсказки подставляет её `value` в текст. Этим он отличается от
выбора из списка (Select / Combobox), где значение обязано быть одной из опций.

Разметки и стилей не рендерит. Готовый визуальный слой — компонент `InputSuggest` (проп
`suggestions`) из `@reformer/ui-kit`.

```typescript
import { Autocomplete, useAutocomplete } from '@reformer/cdk/autocomplete';
```

## Источник подсказок — `suggestions`

| Форма                                   | Поведение                                                               |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `string[]`                              | Подсказка = текст.                                                      |
| `{ value: string; label?: string }[]`   | В поле уходит `value`, в списке виден `label` (по умолчанию = `value`). |
| `ResourceConfig` (`static` / `preload`) | Один `load({})`, фильтрация на клиенте по введённому тексту.            |
| `ResourceConfig` (`partial`)            | Серверный поиск `load({ search, page })` с debounce, догрузка страниц.  |

`ResourceConfig` — тот же контракт, что у Select из ui-kit; живёт в `@reformer/cdk/option-source`
вместе с `useResourceOptions`.

## useAutocomplete

```typescript
interface UseAutocompleteOptions {
  value: string; // текст поля — он же значение
  onChange: (value: string) => void; // на каждый ввод и при выборе подсказки
  onBlur?: () => void;
  suggestions?: AutocompleteSuggestions | null;
  minChars?: number; // @default 0
  openOnFocus?: boolean; // @default false
  filter?: (option: NormalizedOption, query: string) => boolean;
  disabled?: boolean;
  id?: string; // префикс id (иначе useId)
}
```

Возвращает `{ open, items, activeIndex, loading, loadingMore, error, hasMore, loadMore, setOpen,
select, ids, getInputProps, getListboxProps, getOptionProps }`.

- `getInputProps(props?)` — `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, `autoComplete="off"` и обработчики. Свои обработчики
  передавайте аргументом — они вызываются первыми; `preventDefault()` в `onKeyDown` отключает
  встроенную клавиатуру.
- `getListboxProps(props?)` — `role="listbox"`; `mousedown` не уводит фокус из поля.
- `getOptionProps(item, index, props?)` — `role="option"`, `aria-selected`, `data-active` у
  подсвеченного пункта; клик выбирает подсказку.

Клавиатура: ↓/↑ — навигация по кругу (раскрывает список), Enter — выбрать подсвеченную (без
подсветки Enter не перехватывается и отправляет форму), Esc — закрыть.

Список не раскрывается, когда предлагать нечего: нет совпадений, текст короче `minChars` или
единственная подсказка совпадает с текстом. Позиционирование списка — забота вызывающего.

```tsx
function CityInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ac = useAutocomplete({ value, onChange, suggestions: ['Москва', 'Мурманск', 'Казань'] });
  return (
    <div className="relative">
      <input {...ac.getInputProps()} />
      {ac.open && (
        <ul {...ac.getListboxProps({ className: 'absolute' })}>
          {ac.items.map((item, i) => (
            <li key={item.id} {...ac.getOptionProps(item, i)}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Compound API

| Слот                   | Назначение                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| `Autocomplete.Root`    | Провайдер, принимает опции `useAutocomplete`                           |
| `Autocomplete.Input`   | Поле (`asChild` — свой элемент)                                        |
| `Autocomplete.Listbox` | Список; рендерится, пока раскрыт; children — render-функция от `items` |
| `Autocomplete.Option`  | Пункт (`item`, `index`); без children выводит `label`                  |
| `Autocomplete.Loading` | Виден, пока ресурс грузит подсказки                                    |

```tsx
<Autocomplete.Root value={city} onChange={setCity} suggestions={CITIES}>
  <Autocomplete.Input placeholder="Город" />
  <Autocomplete.Listbox className="dropdown">
    {(items) => items.map((item, i) => <Autocomplete.Option key={item.id} item={item} index={i} />)}
  </Autocomplete.Listbox>
</Autocomplete.Root>
```

## Pure core

`autocompleteReducer`, `normalizeSuggestions`, `matchSuggestions`, `isSuggestionResource` —
React-free, пригодны для своих обёрток и тестов без DOM.

## Anti-patterns

- Использовать для выбора кода/id (`{ value: 'spb', label: 'Санкт-Петербург' }` покажет в поле
  `spb`). Значение здесь — текст для пользователя; для кодов — Select/Combobox.
- Передавать новый массив `suggestions` на каждый рендер — нормализация пересчитывается по ссылке;
  выносите статический список в константу или `useMemo`.
