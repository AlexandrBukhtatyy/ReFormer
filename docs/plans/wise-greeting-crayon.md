# Автокомплит со свободным вводом: ядро в cdk, режим `suggestions` у Input

## Context

Нужен режим поля «пиши что хочешь или выбери из подсказок»: value = введённый текст, список лишь
помогает его набрать. Сейчас такого нет:

- `@reformer/cdk` не содержит ни одного list/combobox-примитива.
- В ui-kit есть `Combobox.creatable`, но это другой UX: триггер-кнопка, выбор из списка, «Создать «…»»
  как пункт меню; напечатанный и не подтверждённый текст теряется при закрытии. Его **не трогаем**.
- Асинхронная загрузка опций (`ResourceConfig`, `resourceReducer`, `useResourceOptions`) живёт в
  ui-kit внутри `select/variants/async/` — чистая логика без UI, но недоступна другим пакетам.

Решения (согласованы):
1. В ui-kit режим включается **опциональным пропом `suggestions` у `Input`** — нового
   registry-компонента нет, контракт Input (`value: string|null`, `onChange`) не меняется.
2. value коммитится **на каждый ввод** (как у обычного Input); выбор подсказки просто подставляет текст.
3. Источник — **статика или async `ResourceConfig`**; логику ресурсов переносим в cdk и
   переиспользуем в Select/SelectMulti.
4. `Combobox`/`ComboboxMulti` `creatable` остаются как есть.

## Принципы контракта

- Одно новое понятие для пользователя — `suggestions`. Нет `freeSolo`/`creatable`-флага: наличие
  подсказок и есть режим, свобода ввода — свойство Input по определению.
- `suggestions: string[] | { value: string; label?: string }[] | ResourceConfig`. Дискриминация
  `Array.isArray`. Массив достижим из JSON через `$dataSource(NAME)`; `ResourceConfig` — тоже через
  `$dataSource` (значения registry непрозрачны), описывается в `x-runtimeProps`-заметке.
- Выбор подсказки пишет в value `option.value`; `label` — только текст в списке (по умолчанию = value).
- Пустой ввод → `null` (та же семантика, что `nativeInputAdapter`).

## Часть 1. cdk: источник опций (перенос из ui-kit)

Новый subpath **`@reformer/cdk/option-source`** — `packages/reformer-cdk/src/components/option-source/`:

- `option-source.ts` ← перенос 1:1 `packages/reformer-ui-kit/src/components/select/variants/async/select-resource.ts`
  (`ResourceConfig`, `ResourceItem`, `ResourceLoadParams`, `NormalizedOption`, `resolveStrategyFlags`,
  `normalizeItems`, `mergeOptions`, `filterClient`, `resourceReducer`, `initialResourceState`,
  `hasMore`, `isNearBottom`) + тест `select-resource.test.ts` → `option-source.test.ts`.
- `useResourceOptions.ts` ← перенос `select/variants/async/use-resource-options.ts` (зависит только от React).
- `index.ts`, запись в `package.json` `exports`, сборочный entry в `vite.config` (по образцу `./file-upload`),
  re-export из `src/index.ts`.
- В ui-kit `select-resource.ts` и `use-resource-options.ts` становятся тонкими re-export'ами из
  `@reformer/cdk/option-source` — публичные типы ui-kit (`ResourceConfig` и др.) не меняются,
  `SelectAsync`/`SelectMulti` правок не требуют. ui-kit уже peer-зависит от `@reformer/cdk`.

## Часть 2. cdk: headless-автокомплит

Subpath **`@reformer/cdk/autocomplete`** — `packages/reformer-cdk/src/components/autocomplete/`,
по конвенции пакета (pure core + hook + context + compound, как `file-upload`):

- `autocomplete-core.ts` — чистый reducer навигации: state `{ open, activeIndex }`, actions
  `input | focus | arrowDown | arrowUp | enter | escape | select | blur | itemsChanged`;
  `normalizeSuggestions(string[] | {value,label?}[]) → NormalizedOption[]`; фильтрация — `filterClient`
  из option-source. Тест `autocomplete-core.test.ts`.
- `useAutocomplete(options)`:
  - вход: `value: string`, `onChange(text)`, `onBlur?`, `suggestions`, `openOnFocus?` (false),
    `minChars?` (0), `filter?` (кастомный матчинг; по умолчанию contains, case-insensitive), `id?`;
  - статика → клиентская фильтрация по текущему value; `ResourceConfig` → `useResourceOptions`,
    `setSearchInput(value)` (debounce и стратегии уже внутри);
  - выход prop-getters: `getInputProps()` (role=combobox, `aria-autocomplete="list"`,
    `aria-expanded`, `aria-controls`, `aria-activedescendant`, onChange/onKeyDown/onFocus/onBlur),
    `getListboxProps()`, `getOptionProps(option, index)` (role=option, `aria-selected`,
    onMouseDown `preventDefault` — фокус остаётся в input, onClick → select), плюс
    `{ open, setOpen, items, activeIndex, loading, hasMore, loadMore, error }`.
  - Клавиатура: ↓/↑ — навигация (открывает список), Enter при активном пункте — `onChange(option.value)`
    + закрыть (preventDefault только когда список открыт и есть активный пункт, иначе Enter сабмитит форму),
    Esc — закрыть, blur — закрыть + `onBlur`. Никакого «коммита» при blur не нужно: value уже актуален.
  - Позиционирование списка — не забота cdk.
- Compound-обёртки над хуком: `Autocomplete.Root`, `.Input`, `.Listbox`, `.Option`, `.Empty`,
  `.Loading` + `AutocompleteContext` — для тех, кто собирает свой UI без ui-kit.
- Документация: `packages/reformer-cdk/docs/llms/08-autocomplete.md` (+ option-source), `npm run generate:llms`.

## Часть 3. ui-kit: вариант `suggest` у Input

`packages/reformer-ui-kit/src/components/input/variants/suggest/`:

- `input-suggest.tsx` — `InputSuggest`: shadcn `Input` + `useAutocomplete`; список в Radix `Popover`
  через `PopoverAnchor` вокруг input, `PopoverContent` с `onOpenAutoFocus={e => e.preventDefault()}`,
  ширина = ширина anchor; пункты стилизуются как `CommandItem` (классы, без cmdk). Состояния
  loading / пусто (список не показываем, если нечего предложить) / `hasMore` → `loadMore` по
  `isNearBottom`. forwardRef на `<input>` → baseline `FieldHandle`.
- `input-suggest.field.tsx` — `withFormControl(InputSuggest, suggestAdapter)`,
  `suggestAdapter = { valueProp:'value', changeProp:'onChange', fromEmit: v => (v as string) || null, toValue: v => v ?? '' }`
  (кладём в `src/fields/adapters.ts`).
- `input/input-field.tsx` — диспетчер: `type==='number'` → InputNumberField (подсказки игнорируются),
  иначе `props.suggestions != null` → `InputSuggestField`, иначе `InputBaseField`.
- `input/variants/base/input-base.props.ts` — в `properties` добавить `suggestions`
  (array of string | {value,label}; `x-doc` group `Behavior`), в `x-runtimeProps` — форма с
  `ResourceConfig`. Пересобрать `component-catalog.json` (`scripts/generate-catalog.ts`),
  `input.props.test.ts` должен остаться зелёным.
- Экспорт `InputSuggest`, `InputSuggestField` из `input/index.ts`.

Не делаем сейчас (завести beads-задачи): подсказки у `InputMask`/`Textarea`; перевод `Combobox` на
cdk-ядро/`resource`; маппинг `suggestionsSource` в MCP `plan_form/generate_form`
(`packages/reformer-mcp/src/core/generate/builders.ts` ~402 по аналогии с `optionsSource`).

## Часть 4. Документация и демо

- `packages/reformer-ui-kit/docs/llms/02-text-fields.md` — раздел «Подсказки (suggestions)»:
  отличие от `Combobox.creatable` (свободный текст vs выбор из списка), статика / `$dataSource` / resource.
- `projects/reformer-doc/docs/ui-kit/input.mdx` + демо-конфиг; `projects/reformer-doc/docs/cdk/` — страница autocomplete.
- Демо-страница в `projects/react-playground/src/pages/demo/` (город со статикой + компания с
  `partial`-ресурсом) и e2e `projects/react-playground-e2e/tests/pages/input-suggest/`.

## Verification

1. `cd packages/reformer-cdk && npm test` — `option-source.test.ts`, `autocomplete-core.test.ts`,
   тест хука (печать → onChange на каждый символ; ↓+Enter → value опции; Esc/blur закрывают без
   изменения value; resource `partial` вызывает `load({search})` после debounce).
2. `cd packages/reformer-ui-kit && npm test` — select-тесты зелёные после переноса (регрессия re-export),
   `input.props.test.ts`, новый `input-suggest.test.tsx`; `npx tsc --noEmit` в обоих пакетах (из каталога пакета).
3. Сборка cdk и ui-kit (`npm run build`) — проверить появление `dist/option-source.*`, `dist/autocomplete.*`.
4. Playwright e2e на демо: ввод произвольного текста сохраняется в модели; выбор подсказки мышью и
   клавиатурой; Enter без активного пункта не перехватывается; скриншоты в
   `projects/react-playground-e2e/screenshots/input-suggest/`.
5. Существующие e2e `multi-select` и Select-демо — без регрессий.
