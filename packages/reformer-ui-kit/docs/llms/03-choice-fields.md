# Choice fields

Поля выбора: `Checkbox`, `RadioGroup`, `Select` (+ 8 sub-компонентов из Radix).
Контракт `value`/`onChange`/`onBlur` тот же, что у текстовых полей, но `value`
бывает разных типов:

| Component    | `value` type     | `onChange` payload                        |
| ------------ | ---------------- | ----------------------------------------- |
| `Checkbox`   | `boolean`        | `boolean`                                 |
| `RadioGroup` | `string \| null` | `string` (ровно один из `options`)        |
| `Select`     | `string \| null` | `string \| null` (`null` при `clearable`) |

## Checkbox

### API

```typescript
interface CheckboxProps {
  className?: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
  label?: string;
  disabled?: boolean;
  'data-testid'?: string;
}
```

| Prop       | Тип                        | Default | Описание                                                                 |
| ---------- | -------------------------- | ------- | ------------------------------------------------------------------------ |
| `value`    | `boolean`                  | `false` | Чекнут или нет. `undefined` → `false`.                                   |
| `onChange` | `(value: boolean) => void` | —       | Вызывается с `event.target.checked`.                                     |
| `label`    | `string`                   | —       | Подпись справа от чекбокса. Если опущен — рендерится только сам чекбокс. |
| `disabled` | `boolean`                  | `false` | Блокирует переключение.                                                  |

### Common Patterns

Согласие с условиями:

```tsx
import { CheckboxField } from '@reformer/ui-kit';

<CheckboxField value={agree} onChange={setAgree} label="Согласен с условиями" />;
```

Чекбокс без подписи (label рендерится снаружи или не нужен):

```tsx
<div className="flex items-center gap-2">
  <CheckboxField value={hasMortgage} onChange={setHasMortgage} />
  <span>У меня уже есть ипотека</span>
</div>
```

В составе формы (`FormField` сам определяет, что это checkbox, и не дублирует
label сверху):

```tsx
import { createModel, createForm } from '@reformer/core';
import { CheckboxField, FormField } from '@reformer/ui-kit';

const model = createModel<{ accept: boolean }>({ accept: false });
const schema = {
  children: [
    { value: model.$.accept, component: CheckboxField, componentProps: { label: 'Принять' } },
  ],
};
const form = createForm<{ accept: boolean }>({ model, schema });

<FormField control={form.accept} testId="accept" />;
```

### Anti-patterns

- Передавать `value: 'yes' | 'no'` (строку) — `CheckboxField` ожидает `boolean`. Для
  строкового выбора используйте `RadioGroupField` (два варианта) или `SelectField`.
- Делать `<CheckboxField checked={x} onChange={…}>` (как с нативным `<input
type="checkbox">`) — у field-версии пропа `checked` нет, нужно `value`.
- **Ставить в форму примитив `Checkbox` вместо `CheckboxField`.** У примитива всё
  наоборот: он Radix-контрол с `checked`, и `value={true}` он проигнорирует —
  чекбокс останется `aria-checked="false"`, а `label`/`value` утекут в DOM-атрибуты.
  То же для `RadioGroup`/`RadioGroupField` (примитив отрисуется пустым) и
  `Select`/`SelectField`.

## RadioGroup

### API

```typescript
interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  className?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: RadioOption[];
  disabled?: boolean;
  'data-testid'?: string;
}
```

| Prop       | Тип                       | Default | Описание                                                           |
| ---------- | ------------------------- | ------- | ------------------------------------------------------------------ |
| `options`  | `RadioOption[]`           | —       | Список вариантов. `value` обязан быть строкой.                     |
| `value`    | `string \| null`          | `null`  | Выбранный вариант. Должен совпадать с одним из `options[i].value`. |
| `onChange` | `(value: string) => void` | —       | Вызывается при выборе. Передаётся `event.target.value`.            |
| `disabled` | `boolean`                 | `false` | Блокирует все варианты.                                            |

По умолчанию варианты раскладываются вертикально (`flex flex-col gap-2`).

### Common Patterns

Вертикальная раскладка (default):

```tsx
import { RadioGroupField } from '@reformer/ui-kit';

const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Авто' },
];

<RadioGroupField value={loanType} onChange={setLoanType} options={LOAN_TYPES} />;
```

Горизонтальная раскладка (через `className`):

```tsx
<RadioGroupField
  value={size}
  onChange={setSize}
  options={[
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
  ]}
  className="!flex-row gap-6"
/>
```

В составе формы:

```tsx
import { createModel, createForm } from '@reformer/core';

const model = createModel<{ loanType: string }>({ loanType: 'consumer' });
const schema = {
  children: [
    {
      value: model.$.loanType,
      component: RadioGroupField,
      componentProps: { options: LOAN_TYPES },
    },
  ],
};
const form = createForm<{ loanType: string }>({ model, schema });

<FormField control={form.loanType} testId="loan-type" />;
```

### Anti-patterns

- Передавать `options` с числовыми `value` — компонент ставит их в DOM-атрибут
  `value`, который всегда строка, и `onChange` вернёт строку. Это рассинхронит
  типы. Если нужны числа — конвертируй на уровне behavior `transformValue`.
- Динамически менять список `options` без пересоздания компонента — текущее
  `value` может оказаться вне набора, и ничего не выбрано визуально.
- Ожидать, что `onBlur` сработает после клика на radio — он срабатывает на
  `blur` нативного input, как обычно. Для пометки `touched` после взаимодействия
  обычно достаточно `onChange`.

## Select

`Select` построен поверх `@radix-ui/react-select`. Имеет два режима источника
данных:

- **Inline**: `options={[…]}` — массив `{ value, label, group? }`.
- **Resource**: `resource={{ type, load }}` — асинхронная загрузка со стратегией `type`:
  - `static` — один `load({})` при маунте, без поиска (снимок);
  - `preload` — грузит всё сразу, поиск фильтрует опции **на клиенте**;
  - `partial` — **серверные** поиск (`load({ search })` с debounce ~300 мс) и
    пагинация (`load({ page })` по мере прокрутки списка до `totalCount`).

  Для `preload`/`partial` в дропдауне появляется поле поиска.

### API

```typescript
interface ResourceConfig<T> {
  /** Стратегия загрузки. Если не задана — трактуется как `static`. */
  type: 'static' | 'preload' | 'partial';
  load: (params?: {
    search?: string; // серверная фильтрация (partial)
    page?: number; // 1-based, пагинация (partial)
    pageSize?: number;
  }) => Promise<{
    items: Array<{ id: string | number; label: string; value: T; group?: string }>;
    totalCount: number; // общее число опций — для пагинации (partial)
  }>;
  pageSize?: number; // размер страницы для partial (по умолчанию 20)
}

interface SelectProps<T> {
  className?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  resource?: ResourceConfig<T>;
  options?: Array<{ value: string | number; label: string; group?: string }>;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean; // показать кнопку очистки (X)
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}
```

| Prop          | Тип                               | Default                 | Описание                                                                                                                                        |
| ------------- | --------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`     | `Array<{value,label,group?}>`     | —                       | Inline-варианты. `value` приводится к строке. `group` опционально — варианты с одинаковым `group` объединяются в `SelectGroup` с `SelectLabel`. |
| `resource`    | `ResourceConfig<T>`               | —                       | Асинхронный источник со стратегией `type` (`static`/`preload`/`partial`). Во время первичной загрузки `Select` показывает `Loading...` и блокируется; при пагинации (`partial`) внизу списка — `Loading more...`.                |
| `value`       | `string \| null`                  | `null`                  | Выбранное значение (всегда строка из `option.value`).                                                                                           |
| `onChange`    | `(value: string \| null) => void` | —                       | Срабатывает при выборе. При нажатии на крестик (`clearable`) приходит `null`.                                                                   |
| `placeholder` | `string`                          | `'Select an option...'` | Подсказка в триггере.                                                                                                                           |
| `clearable`   | `boolean`                         | `false`                 | Показать кнопку очистки справа от значения (только когда `value` непустой).                                                                     |
| `disabled`    | `boolean`                         | `false`                 | Блокирует выбор.                                                                                                                                |

### Sub-components

Все рендерятся `Select` автоматически, но при необходимости их можно
импортировать и собрать кастомный layout:

| Component                | Purpose                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `SelectGroup`            | Обёртка над `Radix.Select.Group`. Группирует `SelectItem`.                              |
| `SelectValue`            | Отображает выбранное значение в триггере.                                               |
| `SelectTrigger`          | Кнопка-открывалка. Принимает `size: 'sm' \| 'default'`.                                 |
| `SelectContent`          | Дропдаун-портал со списком. Включает `SelectScrollUpButton` / `SelectScrollDownButton`. |
| `SelectLabel`            | Заголовок группы (рендерится в `SelectGroup`).                                          |
| `SelectItem`             | Одна опция. С `CheckIcon`-индикатором, если выбрана.                                    |
| `SelectScrollUpButton`   | Стрелка скролла вверх.                                                                  |
| `SelectScrollDownButton` | Стрелка скролла вниз.                                                                   |

### Common Patterns

Inline `options`:

```tsx
import { SelectField } from '@reformer/ui-kit';

<SelectField
  value={loanType}
  onChange={setLoanType}
  placeholder="Тип кредита"
  options={[
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]}
/>;
```

Async `resource`, стратегия `preload` (грузим всё, поиск на клиенте):

```tsx
import { SelectField, type ResourceConfig } from '@reformer/ui-kit';

const banksResource: ResourceConfig<string> = {
  type: 'preload',
  load: async () => {
    const res = await fetch('/api/banks');
    const banks: Array<{ id: number; name: string }> = await res.json();
    return {
      items: banks.map((b) => ({ id: b.id, value: String(b.id), label: b.name })),
      totalCount: banks.length,
    };
  },
};

<SelectField value={bankId} onChange={setBankId} resource={banksResource} />;
```

Стратегия `partial` (серверные поиск + пагинация больших списков):

```tsx
const usersResource: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 20,
  load: async ({ search = '', page = 1, pageSize = 20 } = {}) => {
    const res = await fetch(`/api/users?q=${search}&page=${page}&size=${pageSize}`);
    const { rows, total }: { rows: Array<{ id: number; name: string }>; total: number } =
      await res.json();
    return {
      items: rows.map((u) => ({ id: u.id, value: String(u.id), label: u.name })),
      totalCount: total, // Select догружает страницы, пока items.length < totalCount
    };
  },
};

<SelectField value={userId} onChange={setUserId} resource={usersResource} clearable />;
```

Grouped options:

```tsx
<SelectField
  value={city}
  onChange={setCity}
  options={[
    { value: 'msk', label: 'Москва', group: 'Россия' },
    { value: 'spb', label: 'Санкт-Петербург', group: 'Россия' },
    { value: 'minsk', label: 'Минск', group: 'Беларусь' },
    { value: 'kiev', label: 'Киев', group: 'Украина' },
  ]}
/>
```

`clearable` (с очисткой):

```tsx
<SelectField
  value={status}
  onChange={setStatus}
  clearable
  placeholder="Любой"
  options={[
    { value: 'open', label: 'Открыт' },
    { value: 'closed', label: 'Закрыт' },
  ]}
/>
```

В составе формы:

```tsx
import { createModel, createForm } from '@reformer/core';

const model = createModel<{ city: string }>({ city: '' });
const schema = {
  children: [
    {
      value: model.$.city,
      component: SelectField,
      componentProps: {
        placeholder: 'Город',
        options: [
          { value: 'msk', label: 'Москва' },
          { value: 'spb', label: 'Санкт-Петербург' },
        ],
      },
    },
  ],
};
const form = createForm<{ city: string }>({ model, schema });

<FormField control={form.city} testId="city" />;
```

### Anti-patterns

- Передавать одновременно `options` и `resource` — `options` приоритетнее,
  `resource.load` всё равно вызовется на маунт (лишний запрос). Выбирай один
  источник.
- Опускать `value` (`undefined`) — Radix покажет placeholder, но сам компонент
  всегда мапит `undefined` в пустую строку. Лучше явно `null`.
- Использовать `value: number` напрямую — `Select` приводит к строке внутри
  (`String(value)`); `onChange` вернёт строку. В schema формы тип поля должен
  быть `string` или `string | null`.
- Регистрировать `Select` без `placeholder` и ждать понятного UX —
  пользователь увидит дефолт `'Select an option...'`. Для русскоязычных форм
  это, как правило, нежелательно.

## Multi-select

Пять контролов множественного выбора. Все пять — **отдельные записи реестра**, а не режим
одиночных: тип значения другой, а `x-runtimeProps.value` у записи ровно один (тот же приём, что у
`FileUpload` / `FileUploadAvatar`).

| Field-компонент          | На чём построен                        | Когда брать                                                       |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| `ToggleGroupMulti`       | Radix ToggleGroup `type="multiple"`     | 2–7 вариантов, все видны сразу                                    |
| `ComboboxMulti`          | Popover + Command (cmdk) + Badge        | длинный список с поиском; есть `creatable`                        |
| `SelectMulti`            | Popover + свой listbox                  | длинный список, в т.ч. асинхронный (`resource`); **без cmdk**     |
| `NativeSelectMulti`      | нативный `<select multiple>`            | no-JS / legacy / киоски. **Не для тач-устройств**                 |
| `ComboboxTreeMulti`      | Popover + `Tree` кита; **без cmdk**     | значения лежат в иерархии: файлы, разделы каталога                |

### Единый контракт значения

```typescript
value: string[] | null;
onChange: (value: string[] | null) => void;
```

**Пустой выбор — всегда `null`, никогда `[]`.** Это не стиль, а требование модели: `createModel`
превращает массив в `ArrayNode`, `createForm` такой путь пропускает, и поля не оказывается вовсе.
Симптомы разные и все обманчивые — `FormField` падает с `TypeError`, а renderer тихо рисует
контейнер с подписью и опциями, но без `value`/`onChange`.

```typescript
// ✅ начальное значение поля мультивыбора
const model = createModel({ tags: null as string[] | null });

// ❌ поле исчезнет: [] → ArrayNode, а не лист-сигнал
const model = createModel({ tags: [] });
```

### Использование в схеме

```typescript
import { ToggleGroupMultiField } from '@reformer/ui-kit';
import { ComboboxMultiField } from '@reformer/ui-kit/combobox'; // combobox — только subpath
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, maxLength } from '@reformer/core/validators';

const schema = {
  tags: {
    // Для поля типа T[] `model.$.tags` — НЕ сигнал (ModelArraySignals), нужен signalAt.
    value: model.signalAt('tags')!,
    component: ToggleGroupMultiField,
    componentProps: {
      label: 'Теги',
      options: [
        { value: 'ru', label: 'Россия' },
        { value: 'by', label: 'Беларусь' },
      ],
      maxItems: 3,
    },
  },
};

// Правила — отдельной схемой над моделью: у layout-узла поля `validators` нет.
const validation = defineValidationSchema<Form>(({ model }) => {
  validate(model.signalAt('tags')!, [required(), maxLength(3)]);
});
```

### Common Patterns

- **Обязательность** — только `required()`. `minLength(1)` НЕ сработает: он делает ранний
  `return null` на `null`, а пустой выбор приходит именно как `null`.
- **Ограничение количества** — `maxLength(n)` / `minLength(n)` (оба читают `value.length` и
  работают на массиве без правок ядра). Проп `maxItems` у контрола — это **подсказка интерфейса**
  (гасит невыбранные пункты), а не правило формы; авторитетное ограничение задаёт валидатор.
- **Префилл выбранного** — только ПОСЛЕ сборки формы, в `setup`, и через сигнал:
  `model.signalAt('tags')!.value = ['ru']`. В `seed` (до `createForm`) массив снова превратит поле
  в `ArrayNode`. После префилла нужен `model.captureInitial()` — иначе форма считает себя
  изменённой сразу после загрузки, а `form.tags.reset()` сотрёт префилл в `null`.
- **Лейблы выбранного вне текущей страницы** (`SelectMulti` + `resource`) — проп
  `selectedOptions: Array<{ value, label }>`. Внутри контрола есть ещё и кэш лейблов, который
  пополняется всем, что когда-либо появлялось в опциях, поэтому чипы не «слепнут» после смены
  поискового запроса или перезагрузки источника.
- **Ошибка вспыхивает посреди выбора** — ожидаемо: `FieldNode.setValue` взводит `dirty`
  безусловно, без сравнения, а `shouldShowError = invalid && (touched || dirty)`. Оставляйте
  `updateOn: 'blur'` (значение по умолчанию) и не стройте логику на `dirty`.

### Anti-patterns

- Начальное значение `[]` вместо `null` — поле молча исчезает (см. выше).
- Мутация массива на месте: `arr.push(x); onChange(arr)` — preact-сигнал бэйлится по `!==`, UI не
  обновится, но поле уже станет `dirty`, и валидация прогонится по старому значению. `onChange`
  обязан отдавать **новый** массив.
- `minFiles` / `maxFiles` на массиве строк — тихий no-op: они фильтруют значение до file-like и
  получают пустой массив. Для количества — `minLength` / `maxLength`.
- `compute` / `copyFrom` / `transformValue` над мультивыбором — peek-guard сравнивает по ссылке,
  поэтому новый массив на каждом прогоне даёт запись на каждом прогоне; пара взаимных `compute`
  сходит в расходящийся цикл или в `Cycle detected`. Сравнивайте содержимое руками и выходите до
  записи.
- `componentProps.disabled` для выключения отдельных опций — мёртв (враппер ставит `disabled`
  после спреда `componentProps`). Выключить можно только контрол целиком (`control.disable()`).
- `NativeSelectMulti` на тач-устройствах — множественный выбор в нативном листбоксе там
  практически недоступен и не имеет аффорданса «можно несколько». Берите `ToggleGroupMulti` или
  `SelectMulti`.
- `placeholder` у `NativeSelectMulti` — его нет намеренно: в multiple-листбоксе `<option value="">`
  становится выбираемым мусорным пунктом.

## Combobox: варианты дерева

Два варианта комбобокса показывают в поповере не плоский список, а иерархию — тот самый `Tree`
кита (см. [04-layout-and-buttons.md](04-layout-and-buttons.md)). Берут их там, где значение
адресуется путём, а не выбирается из перечня: файл в репозитории, раздел каталога, узел
оргструктуры.

| Field-компонент          | `value` в модели                  | Что выбирается            |
| ------------------------ | --------------------------------- | ------------------------- |
| `ComboboxTreeField`      | `string \| null` — адрес узла     | один узел, обычно файл    |
| `ComboboxTreeMultiField` | `string[] \| null` — адреса узлов | набор узлов, обычно файлы |

Оба живут вне главного barrel:

```typescript
import { ComboboxTreeField, ComboboxTreeMultiField } from '@reformer/ui-kit/combobox';
import type { TreeNode } from '@reformer/ui-kit';
```

Subpath `./combobox` тянет опциональный peer `cmdk` — не ради дерева (в нём cmdk нет намеренно),
а ради базового варианта, который отдаёт тот же barrel.

### Key Concepts

- **Значение — `node.id`, а не подпись.** Подпись в триггере берётся из объявленного дерева, а
  если узел пришёл из лениво прочитанного уровня — показывается сам адрес. Для файлов это и
  нужно: путь однозначен, имя файла — нет.
- **`selectable` по умолчанию `'leaf'`** — в отличие от самого `Tree`, где умолчание `'all'`.
  Щелчок по каталогу раскрывает его, а не выбирает; выбрать можно только лист. `'all'` ставят
  там, где значением бывает и ветка (раздел каталога).
- **Пустой выбор мульти — `null`, никогда `[]`** (тот же контракт и та же причина, что у
  остальных мультивыборов, см. «Единый контракт значения» выше). Компонент при этом видит
  массив: `multiValueAdapter` разворачивает `null` в `[]` на входе и сворачивает пустой выбор
  обратно в `null` на выходе.
- **Обязательность — только `required()`.** `minLength(1)` на пустом выборе делает ранний
  `return null` и пропускает его.
- **Одиночный закрывает поповер по выбору**, мульти — **нет**: набор файлов собирают одним
  заходом, и поиск между выборами тоже не сбрасывается. `onBlur` у обоих эмитится на закрытии
  поповера, а не на каждом выборе.
- **Членство в мульти переключается щелчком по строке**, отметка — галочка справа. Чекбокса
  слева нет намеренно: там уже треугольник раскрытия и значок типа узла, третий значок сделал бы
  уровень нечитаемым.
- **Поиск свой, не cmdk**: фильтрует само дерево, достраивая путь до совпадения. Видит только
  **прочитанные** уровни; непрочитанная ветка при этом остаётся в выдаче — её содержимое ещё не
  за что судить, и человек может открыть её руками.
- **`maxItems` — подсказка интерфейса**, а не правило формы: по достижении потолка невыбранные
  строки гаснут. Авторитетное ограничение задаёт `maxLength(n)`.
- **Путь до выбранного раскрывается сам** — но только по объявленному `nodes`. У ленивого
  источника предков не знает никто, пока уровень не прочитан; нужные ветки перечисляют в
  `defaultExpandedIds`.

Остальные пропы обоих вариантов: `placeholder` (`'Выберите файл...'` / `'Выберите файлы...'`),
`searchPlaceholder` (`'Поиск...'`), `emptyText` (`'Ничего не найдено'`), `clearable` (`false`),
`maxRows` (12 строк до прокрутки), у мульти ещё `summaryThreshold` (3 — дальше чипы схлопываются
в «Выбрано: N»).

### Common Patterns

Выбор одного файла из объявленного дерева:

```tsx
import { createModel, createForm } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import { ComboboxTreeField } from '@reformer/ui-kit/combobox';
import type { TreeNode } from '@reformer/ui-kit';

// id — полный путь: два index.ts в разных каталогах обязаны различаться.
const FILES: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'src/index.ts', label: 'index.ts' },
      { id: 'src/app.tsx', label: 'app.tsx' },
    ],
  },
  { id: 'package.json', label: 'package.json' },
];

const model = createModel<{ entry: string | null }>({ entry: null });
const schema = {
  entry: {
    value: model.$.entry,
    component: ComboboxTreeField,
    componentProps: {
      label: 'Точка входа',
      nodes: FILES,
      defaultExpandedIds: ['src'],
      clearable: true,
      testId: 'entry',
    },
  },
};
const form = createForm<{ entry: string | null }>({ model, schema });

<FormField control={form.entry} testId="entry" />;
```

Набор файлов из ленивого источника — значение поля `string[] | null`, поэтому сигнал берётся
через `signalAt`, а правила живут в отдельной validation-схеме:

```typescript
import { ComboboxTreeMultiField } from '@reformer/ui-kit/combobox';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, maxLength } from '@reformer/core/validators';

type Form = { attachments: string[] | null };

const model = createModel<Form>({ attachments: null }); // не [] — иначе поля не будет
const schema = {
  attachments: {
    value: model.signalAt('attachments')!,
    component: ComboboxTreeMultiField,
    componentProps: {
      label: 'Файлы заявки',
      // Уровень читается при первом раскрытии ветки; null — верхний уровень.
      loadChildren: (node) => fs.list(node?.id ?? '/'),
      maxItems: 5,
      testId: 'attachments',
    },
  },
};

const validation = defineValidationSchema<Form>(({ model }) => {
  validate(model.signalAt('attachments')!, [required(), maxLength(5)]);
});
```

### Anti-patterns

- Начальное значение мульти `[]` вместо `null` — поле молча исчезает; симптомы разобраны в
  [06-troubleshooting.md](06-troubleshooting.md), пункт 12.
- `minLength(1)` вместо `required()` для обязательности — пустой выбор приходит как `null`, и
  правило выходит раньше проверки.
- Одинаковые `node.id` у разных узлов (имя файла вместо полного пути) — раскрытие, выделение и
  отметка адресуются одним и тем же ключом, поэтому две строки начинают вести себя как одна.
- Ждать, что поиск найдёт файл в непрочитанном каталоге. Фильтр не ходит за уровнями: ради
  подсветки одной строки пришлось бы обойти весь источник. Нужен сквозной поиск — ищите на
  сервере и подавайте `nodes` уже отфильтрованными.
- Полагаться на `maxItems` как на валидацию — это только гашение строк в интерфейсе, форма о нём
  ничего не знает.
- Импортировать `ComboboxTree*` из `'@reformer/ui-kit'` — их там нет, `combobox` живёт только в
  своём subpath.
- Ставить в схему примитив `ComboboxTree` / `ComboboxTreeMulti` вместо `*Field`-версии —
  value-seam остаётся неподключённым, поле рисуется и не реагирует на выбор.

## See also

- [04-layout-and-buttons.md](04-layout-and-buttons.md) — сам `Tree`: узлы, ленивое чтение уровней, виртуализация.
- [10-imperative-handles.md](10-imperative-handles.md) — императивные handle мультивыборов (open/close/clear).
- [02-text-fields.md](02-text-fields.md) — `Input`, `InputMask`, `InputPassword`, `Textarea`.
- [05-form-field-integration.md](05-form-field-integration.md) — `FormField` распознаёт `Checkbox` и не дублирует label.
- [06-troubleshooting.md](06-troubleshooting.md) — «Select не показывает options», «options vs resource», «onBlur не срабатывает на Select/RadioGroup».
