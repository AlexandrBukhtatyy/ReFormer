# Choice fields

Поля выбора: `Checkbox`, `RadioGroup`, `Select` (+ 8 sub-компонентов из Radix).
Контракт `value`/`onChange`/`onBlur` тот же, что у текстовых полей, но `value`
бывает разных типов:

| Component | `value` type | `onChange` payload |
| --- | --- | --- |
| `Checkbox` | `boolean` | `boolean` |
| `RadioGroup` | `string \| null` | `string` (ровно один из `options`) |
| `Select` | `string \| null` | `string \| null` (`null` при `clearable`) |

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

| Prop | Тип | Default | Описание |
| --- | --- | --- | --- |
| `value` | `boolean` | `false` | Чекнут или нет. `undefined` → `false`. |
| `onChange` | `(value: boolean) => void` | — | Вызывается с `event.target.checked`. |
| `label` | `string` | — | Подпись справа от чекбокса. Если опущен — рендерится только сам чекбокс. |
| `disabled` | `boolean` | `false` | Блокирует переключение. |

### Common Patterns

Согласие с условиями:

```tsx
import { Checkbox } from '@reformer/ui-kit';

<Checkbox value={agree} onChange={setAgree} label="Согласен с условиями" />
```

Чекбокс без подписи (label рендерится снаружи или не нужен):

```tsx
<div className="flex items-center gap-2">
  <Checkbox value={hasMortgage} onChange={setHasMortgage} />
  <span>У меня уже есть ипотека</span>
</div>
```

В составе формы (`FormField` сам определяет, что это checkbox, и не дублирует
label сверху):

```tsx
import { createForm, type FormSchema } from '@reformer/core';
import { Checkbox, FormField } from '@reformer/ui-kit';

const form = createForm<FormSchema<{ accept: boolean }>>({
  accept: { component: Checkbox, value: false, componentProps: { label: 'Принять' } },
});

<FormField control={form.accept} testId="accept" />
```

### Anti-patterns

- Передавать `value: 'yes' | 'no'` (строку) — `Checkbox` ожидает `boolean`. Для
  строкового выбора используйте `RadioGroup` (два варианта) или `Select`.
- Делать `<Checkbox checked={x} onChange={…}>` (как с нативным `<input
  type="checkbox">`) — пропа `checked` нет, нужно `value`.

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

| Prop | Тип | Default | Описание |
| --- | --- | --- | --- |
| `options` | `RadioOption[]` | — | Список вариантов. `value` обязан быть строкой. |
| `value` | `string \| null` | `null` | Выбранный вариант. Должен совпадать с одним из `options[i].value`. |
| `onChange` | `(value: string) => void` | — | Вызывается при выборе. Передаётся `event.target.value`. |
| `disabled` | `boolean` | `false` | Блокирует все варианты. |

По умолчанию варианты раскладываются вертикально (`flex flex-col gap-2`).

### Common Patterns

Вертикальная раскладка (default):

```tsx
import { RadioGroup } from '@reformer/ui-kit';

const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Авто' },
];

<RadioGroup value={loanType} onChange={setLoanType} options={LOAN_TYPES} />
```

Горизонтальная раскладка (через `className`):

```tsx
<RadioGroup
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
const form = createForm<FormSchema<{ loanType: string }>>({
  loanType: {
    component: RadioGroup,
    value: 'consumer',
    componentProps: { options: LOAN_TYPES },
  },
});

<FormField control={form.loanType} testId="loan-type" />
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
- **Resource**: `resource={{ type, load }}` — асинхронная загрузка (см. ниже).

### API

```typescript
interface ResourceConfig<T> {
  type: 'static' | 'preload' | 'partial';
  load: (params?: ResourceLoadParams) => Promise<{
    items: Array<{ id: string | number; label: string; value: T; group?: string }>;
    totalCount: number;
  }>;
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
  clearable?: boolean;       // показать кнопку очистки (X)
  'data-testid'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}
```

| Prop | Тип | Default | Описание |
| --- | --- | --- | --- |
| `options` | `Array<{value,label,group?}>` | — | Inline-варианты. `value` приводится к строке. `group` опционально — варианты с одинаковым `group` объединяются в `SelectGroup` с `SelectLabel`. |
| `resource` | `ResourceConfig<T>` | — | Асинхронный источник. На маунт вызывается `resource.load({})`. На время загрузки `Select` показывает `Loading...` и блокируется. |
| `value` | `string \| null` | `null` | Выбранное значение (всегда строка из `option.value`). |
| `onChange` | `(value: string \| null) => void` | — | Срабатывает при выборе. При нажатии на крестик (`clearable`) приходит `null`. |
| `placeholder` | `string` | `'Select an option...'` | Подсказка в триггере. |
| `clearable` | `boolean` | `false` | Показать кнопку очистки справа от значения (только когда `value` непустой). |
| `disabled` | `boolean` | `false` | Блокирует выбор. |

### Sub-components

Все рендерятся `Select` автоматически, но при необходимости их можно
импортировать и собрать кастомный layout:

| Component | Purpose |
| --- | --- |
| `SelectGroup` | Обёртка над `Radix.Select.Group`. Группирует `SelectItem`. |
| `SelectValue` | Отображает выбранное значение в триггере. |
| `SelectTrigger` | Кнопка-открывалка. Принимает `size: 'sm' \| 'default'`. |
| `SelectContent` | Дропдаун-портал со списком. Включает `SelectScrollUpButton` / `SelectScrollDownButton`. |
| `SelectLabel` | Заголовок группы (рендерится в `SelectGroup`). |
| `SelectItem` | Одна опция. С `CheckIcon`-индикатором, если выбрана. |
| `SelectScrollUpButton` | Стрелка скролла вверх. |
| `SelectScrollDownButton` | Стрелка скролла вниз. |

### Common Patterns

Inline `options`:

```tsx
import { Select } from '@reformer/ui-kit';

<Select
  value={loanType}
  onChange={setLoanType}
  placeholder="Тип кредита"
  options={[
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]}
/>
```

Async `resource` (пример: список банков):

```tsx
import { Select, type ResourceConfig } from '@reformer/ui-kit/select';

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

<Select value={bankId} onChange={setBankId} resource={banksResource} />
```

Grouped options:

```tsx
<Select
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
<Select
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
const form = createForm<FormSchema<{ city: string }>>({
  city: {
    component: Select,
    componentProps: {
      placeholder: 'Город',
      options: [
        { value: 'msk', label: 'Москва' },
        { value: 'spb', label: 'Санкт-Петербург' },
      ],
    },
  },
});

<FormField control={form.city} testId="city" />
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

## See also

- [02-text-fields.md](02-text-fields.md) — `Input`, `InputMask`, `InputPassword`, `Textarea`.
- [05-form-field-integration.md](05-form-field-integration.md) — `FormField` распознаёт `Checkbox` и не дублирует label.
- [06-troubleshooting.md](06-troubleshooting.md) — «Select не показывает options», «options vs resource», «onBlur не срабатывает на Select/RadioGroup».
- Эталон: [credit-application-schema.ts](../../../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-schema.ts) — большой пример с `Select` и `Checkbox` в реальной форме.
