# @reformer/ui-kit

Готовый набор из **72 компонентов** на базе [shadcn/ui](https://ui.shadcn.com/)
(стиль **new-york**, палитра **neutral**, Tailwind CSS v4), интегрированный с формами
`@reformer/core` через тонкий HOC-слой.

Там, где [`@reformer/cdk`](https://www.npmjs.com/package/@reformer/cdk) даёт headless-примитивы,
`@reformer/ui-kit` даёт стилизованные, доступные (a11y) контролы и их **form-версии**, которые
привязываются прямо к ReFormer-ноде (`FieldNode`) через один универсальный `<FormField>`.

## Что нового в v7

- **Полный набор shadcn/ui** — 72 компонента (все примитивы shadcn + ReFormer-специфичные:
  `Box`, `Section`, `FormField`, `FormArraySection`, `FormWizard`, `AsyncBoundary`,
  `InputMask`, `InputPassword`, `ExampleCard`).
- **Каталог-на-компонент + «Варианты»** — каждый компонент лежит под `variants/`; `base` — чистый
  shadcn-примитив, функциональные варианты (`async`, `number`, …) — пресеты под юзкейс.
- **Чистый shadcn + HOC** — примитивы не знают про формы; form-интеграцию добавляет
  `withFormControl`, порождая `*Field`-версии.
- **Self-contained тема** — пакет поставляет oklch-токены и анимации через `@reformer/ui-kit/styles`.
- **Тяжёлые компоненты — только через subpath** (`@reformer/ui-kit/chart`, `/table`, …), вне
  главного barrel, чтобы recharts/@tanstack и т.п. не попадали в бандл по умолчанию.

## Миграция с v6

v7 — мажорный релиз без обратной совместимости: v6-компоненты удалены, API реструктурирован под
shadcn (`data-slot`, unified `radix-ui`, cva). Что менять в коде:

| v6                                                                     | v7                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `component: Input` в схеме формы                                       | `component: InputField` — form-версии теперь `*Field`                            |
| `<Input value={v} onChange={setV} />`                                  | `<InputField … />`; чистый `Input` следует API shadcn (native `onChange(event)`) |
| `Select` / `Checkbox` / `RadioGroup` / `Textarea` как поля             | `SelectField` / `CheckboxField` / `RadioGroupField` / `TextareaField`            |
| Токены темы копировались в проект                                      | голый `@import '@reformer/ui-kit/styles';`                                       |
| `import { … } from '@reformer/ui-kit'` для chart/table/calendar и т.п. | только через subpath: `@reformer/ui-kit/chart`, `/table`, `/calendar`, …         |
| `src/components/ui/*`                                                  | `src/components/<cmp>/variants/base/*`                                           |

Тяжёлые компоненты требуют своих optional peer-зависимостей (recharts, `@tanstack/react-table`,
react-day-picker, date-fns, cmdk, vaul, embla-carousel-react, sonner, input-otp,
react-resizable-panels, `@shadcn/react`) — ставьте их только если используете
соответствующий subpath.

## Установка

```bash
npm install @reformer/ui-kit @reformer/core
```

Peer-зависимости: `@reformer/core`, `@reformer/cdk`, `@reformer/renderer-react`, `react`, `react-dom`.
Пакет рендерится с **Tailwind CSS v4** — Tailwind должен быть настроен в приложении (см. «Тема» ниже).

## Концепт вариантов

«Вариант» — это **функциональная разновидность** компонента под конкретный юзкейс, а не стилевая ось
(размер/цвет/раскладка лейбла — обычные props/классы внутри реализации).

```
src/components/<cmp>/
  variants/
    base/                       # ОБЯЗАТЕЛЕН: чистый shadcn-примитив (data-slot, radix-ui, cn)
      <cmp>-base.tsx
      <cmp>-base.field.tsx      #   form-версия (только для form-control компонентов)
      <cmp>-base.props.ts       #   props-схема (источник controls[] и DSL-валидации)
    <variant>/                  # функциональный пресет (async / number / …) — по потребности
  index.ts                      # barrel: примитивы + их field + алиас <Cmp>Field + props-схемы
```

Пример: у `Select` вариант `base` — ручная сборка дропдауна из shadcn-частей, а `async` — готовое
поле с `options` / `resource` / `clearable`. Оба — разные компоненты с разными props.

## Импорты

```tsx
// Из корневого barrel (60 «лёгких» компонентов)
import { Input, Select, Checkbox, Button, Box, FormField } from '@reformer/ui-kit';

// Через subpath отдельного компонента (tree-shaking)
import { Input } from '@reformer/ui-kit/input';
import { Select, SelectField } from '@reformer/ui-kit/select';

// Тяжёлые компоненты — ТОЛЬКО через subpath (вне barrel)
import { ChartContainer, ChartTooltip, type ChartConfig } from '@reformer/ui-kit/chart';
import { DataGrid, type TableSettings } from '@reformer/ui-kit/table';

// Props-схемы (React-free) для MCP / renderer-json
import { defaultPropSchemas, mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
```

### Компоненты только через subpath (тяжёлые зависимости)

`calendar` · `carousel` · `chart` · `combobox` · `command` · `date-picker` · `drawer` ·
`input-otp` · `message-scroller` · `resizable` · `sonner` · `table`

Они держат optional-peer зависимости (recharts, `@tanstack/react-table`, react-day-picker, date-fns,
cmdk, embla, vaul, input-otp, react-resizable-panels, sonner, `@shadcn/react`) и **не входят
в главный barrel** — импортируйте их точечно: `@reformer/ui-kit/chart`, `@reformer/ui-kit/table`
и т.п. `sidebar` тоже живёт только в subpath, но тяжёлых зависимостей не тянет — он крупный,
а не внешний.

## Form-интеграция: `*Field` + `withFormControl`

Примитивы (`Input`, `Select`, `Checkbox`, …) — чистый shadcn: они не знают про формы и работают со
своими нативными событиями (`Input` — `onChange(e)`, `Checkbox` — `onCheckedChange`, `Slider` —
`onValueChange`). Форме нужен **единый value-based контракт** (`value` + `onChange(value)`), поэтому
рядом с каждым form-control лежит его **field-версия**, порождённая внутренним HOC:

```ts
// внутри пакета (src/fields) — иллюстрация механизма, не публичный импорт:
export const SelectAsyncField = withFormControl(SelectAsync, valueChangeAdapter);
export const InputBaseField = withFormControl(Input, nativeInputAdapter);
```

`withFormControl(Primitive, adapter)` приводит событие примитива к `onChange(value)`, прокидывает
`value`/`disabled`/`aria-*` и отбрасывает не-DOM ключи (`control`, `testId`). Адаптер выбирается под
event-shape примитива (`nativeInputAdapter`, `checkedAdapter`, `valueChangeAdapter`, `sliderAdapter`,
`dateAdapter`, `pressedAdapter`).

**Соглашение об именах**: field-версия варианта — `<Cmp><Variant>Field`, плюс алиас `<Cmp>Field` на
дефолтный для форм вариант. Публичная поверхность форм — именно `*Field`-компоненты (сам HOC
внутренний):

| Компонент     | Field-версия (public)                | Дефолтный алиас                    |
| ------------- | ------------------------------------ | ---------------------------------- |
| Input         | `InputBaseField`, `InputNumberField` | `InputField` (диспетчер по `type`) |
| InputPassword | `InputPasswordBaseField`             | `InputPasswordField`               |
| InputMask     | `InputMaskBaseField`                 | `InputMaskField`                   |
| InputOTP      | `InputOTPBaseField`                  | `InputOTPField`                    |
| Textarea      | `TextareaBaseField`                  | `TextareaField`                    |
| Select        | `SelectAsyncField`                   | `SelectField`                      |
| NativeSelect  | `NativeSelectBaseField`              | `NativeSelectField`                |
| Checkbox      | `CheckboxBaseField`                  | `CheckboxField`                    |
| Switch        | `SwitchBaseField`                    | `SwitchField`                      |
| Toggle        | `ToggleBaseField`                    | `ToggleField`                      |
| ToggleGroup   | `ToggleGroupBaseField`               | `ToggleGroupField`                 |
| RadioGroup    | `RadioGroupBaseField`                | `RadioGroupField`                  |
| Slider        | `SliderBaseField`                    | `SliderField`                      |
| Calendar      | `CalendarBaseField`                  | `CalendarField`                    |
| DatePicker    | `DatePickerBaseField`                | `DatePickerField`                  |
| Combobox      | `ComboboxBaseField`                  | `ComboboxField`                    |

В M1-схеме поля `component` указывает на **field-версию** (не на голый примитив): `<FormField>` подаёт
контролу резолвленные `value` / `onChange(value)`, которые понимает только `*Field`.

## Тема (self-contained)

Пакет поставляет тему через subpath-экспорт `@reformer/ui-kit/styles` — oklch-токены shadcn
(new-york / neutral), dark-вариант и анимации (`tw-animate-css`). Подключается **голым импортом** в
вашем Tailwind-входе:

```css
/* app.css / globals.css — ваш Tailwind v4 entry */
@import 'tailwindcss';
@import '@reformer/ui-kit/styles';

/* Tailwind должен «видеть» классы пакета — укажите @source на его исходники/сборку: */
@source '../node_modules/@reformer/ui-kit/dist';
```

> Импортировать строго голым `@import '@reformer/ui-kit/styles';` — обёртка `layer(theme)` ломает
> `@custom-variant`. Сам вход Tailwind (`@import 'tailwindcss'`) и `@source` держит consumer: тема
> отдаёт токены и анимации, но не тянет Tailwind за собой.

## Примеры

### 1. Базовый компонент (чистый примитив)

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@reformer/ui-kit';

function LoanTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Выберите тип кредита" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="consumer">Потребительский</SelectItem>
        <SelectItem value="mortgage">Ипотека</SelectItem>
        <SelectItem value="auto">Авто</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

### 2. Form-поле (`SelectField` внутри `FormField`)

Архитектура M1: сначала модель (`createModel`) — источник истины значений, затем форма
(`createForm({ model, schema })`), где поле привязано к сигналу модели и несёт `component`
(**field-версию**) + `componentProps`. Layout **не несёт валидаторов** — правила живут в отдельной
`ValidationSchema` и прогоняются внешним раннером `validateModel(model, schema)` из
[`@reformer/core/validation`](https://www.npmjs.com/package/@reformer/core) (см. пример ниже).
В JSX — один `<FormField control={form.x} />`.

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Button, FormField, SelectField, InputField } from '@reformer/ui-kit';

type LoanForm = { loanType: string; amount: number };

function LoanFormExample() {
  const { model, form, validation } = useMemo(() => {
    const model = createModel<LoanForm>({ loanType: '', amount: 0 });
    // Layout-схема формы: component + componentProps, БЕЗ валидаторов.
    const schema = {
      loanType: {
        value: model.$.loanType,
        component: SelectField, // ← field-версия: понимает value / onChange(value)
        componentProps: {
          label: 'Тип кредита',
          placeholder: 'Выберите вариант',
          options: [
            { value: 'consumer', label: 'Потребительский' },
            { value: 'mortgage', label: 'Ипотека' },
          ],
        },
      },
      amount: {
        value: model.$.amount,
        component: InputField,
        componentProps: { label: 'Сумма', type: 'number', min: 0 },
      },
    };
    // Валидация — отдельный ambient-контракт (@reformer/core/validation): голые операторы
    // validate/validateAsync/cross над сигналами модели. Правила required()/… — из /validators.
    const validation = defineValidationSchema<LoanForm>(({ model }) => {
      validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
      validate(model.$.amount, [required({ message: 'Укажите сумму' })]);
    });
    const form = createForm<LoanForm>({ model, schema });
    return { model, form, validation };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    // form.submit()/validate() больше НЕ прогоняют schema-валидацию — только внешний validateModel.
    // Раннер разносит ошибки по нодам формы (UI подсветит поля) и возвращает Promise<boolean>.
    const ok = await validateModel(model, validation);
    if (!ok) return;
    console.log('Данные:', model.get());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* FormField рендерит Label → Control → Error и подключает value/onChange/onBlur ноды */}
      <FormField control={form.loanType} testId="loanType" />
      <FormField control={form.amount} testId="amount" />
      <Button type="submit">Отправить</Button>
    </form>
  );
}
```

`componentProps` — контракт враппера (`label`, `required`, `testId`) плюс props варианта
(`options`, `placeholder`, `clearable`, …). `value` / `onChange` / `onBlur` / `disabled` резолвит
`<FormField>` (seam) — в `componentProps` их не пишут.

### 3. Динамические массивы и мастер

```tsx
// Стилизованная секция массива (типизированный itemComponent)
import { FormArraySection } from '@reformer/ui-kit/form-array';
// Многошаговый мастер
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
```

Полные примеры `FormArraySection` и `FormWizard` — в корневом
[README проекта](../../README.md#массивы-и-многошаговые-формы).

## License

MIT
