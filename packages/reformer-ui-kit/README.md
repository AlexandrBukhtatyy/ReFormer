# @reformer/ui-kit

Готовый набор из **75 компонентов** на базе [shadcn/ui](https://ui.shadcn.com/)
(стиль **new-york**, палитра **neutral**, Tailwind CSS v4), интегрированный с формами
`@reformer/core` через статику `reformerAdapter` — без обёрток над компонентами.

Там, где [`@reformer/cdk`](https://www.npmjs.com/package/@reformer/cdk) даёт headless-примитивы,
`@reformer/ui-kit` даёт стилизованные, доступные (a11y) контролы, которые кладутся в схему формы
как есть и привязываются к ReFormer-ноде (`FieldNode`) через один универсальный `<FormField>`
или рендерер.

## Что нового в v7

- **Полный набор shadcn/ui** — 75 компонентов (все примитивы shadcn + ReFormer-специфичные:
  `Box`, `Section`, `FormField`, `FormArraySection`, `FormWizard`, `AsyncBoundary`,
  `InputMask`, `InputPassword`, `Tree`, `ExampleCard`).
- **Дерево** — `Tree`: плотный навигатор по иерархии (файлы, категории, оргструктура) с ленивым
  чтением уровней и виртуальным скроллом. Само дерево не поле формы, но на нём стоят варианты
  комбобокса `ComboboxTree` и `ComboboxTreeMulti` — выбор файла и набора файлов.
- **Каталог-на-компонент + «Варианты»** — каждый компонент лежит под `variants/`; `base` — чистый
  shadcn-примитив, функциональные варианты (`async`, `number`, …) — пресеты под юзкейс.
- **Компонент = поле** — отдельных «field-версий» нет: form-контрол объявляет свой диалект
  статикой (`defineFieldControl`), а связывает его с формой обёртка поля (`FormField.Control` /
  рендерер).
- **Self-contained тема** — пакет поставляет oklch-токены и анимации через `@reformer/ui-kit/styles`.
- **Тяжёлые компоненты — только через subpath** (`@reformer/ui-kit/chart`, `/table`, …), вне
  главного barrel, чтобы recharts/@tanstack и т.п. не попадали в бандл по умолчанию.

## Миграция с v6

v7 — мажорный релиз без обратной совместимости: v6-компоненты удалены, API реструктурирован под
shadcn (`data-slot`, unified `radix-ui`, cva). Что менять в коде:

| v6                                                                     | v7                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `component: Input` + `type: 'number'` в схеме формы                    | `component: InputNumber` (`Input` отдаёт строку)                            |
| `<Input value={v} onChange={setV} />`                                  | `<Input … />`; чистый `Input` следует API shadcn (native `onChange(event)`) |
| `Select` / `Checkbox` / `RadioGroup` / `Textarea` как поля             | `SelectAsync` / `CheckboxWithLabel` / `RadioGroupOptions` / `Textarea`      |
| Токены темы копировались в проект                                      | голый `@import '@reformer/ui-kit/styles';`                                  |
| `import { … } from '@reformer/ui-kit'` для chart/table/calendar и т.п. | только через subpath: `@reformer/ui-kit/chart`, `/table`, `/calendar`, …    |
| `src/components/ui/*`                                                  | `src/components/<cmp>/variants/base/*`                                      |

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
      <cmp>-base.tsx            #   + defineFieldControl(…) у form-control компонентов
      <cmp>-base.props.ts       #   props-схема (источник controls[] и DSL-валидации)
    <variant>/                  # функциональный пресет (async / number / …) — по потребности
  index.ts                      # barrel: примитивы, варианты, props-схемы
```

Пример: у `Select` вариант `base` — ручная сборка дропдауна из shadcn-частей, а `async` — готовое
поле с `options` / `resource` / `clearable`. Оба — разные компоненты с разными props.

## Импорты

```tsx
// Из корневого barrel (62 «лёгких» компонента)
import { Input, Select, Checkbox, Button, Box, FormField } from '@reformer/ui-kit';

// Через subpath отдельного компонента (tree-shaking)
import { Input } from '@reformer/ui-kit/input';
import { Select, SelectAsync } from '@reformer/ui-kit/select';

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

## Form-интеграция: компонент + `reformerAdapter`

Примитивы (`Input`, `Select`, `Checkbox`, …) — чистый shadcn со своими нативными событиями
(`Input` — `onChange(e)`, `Checkbox` — `onCheckedChange`, `Slider` — `onValueChange`). Форма говорит
на **едином value-based контракте** (`value` + `onChange(value)` + `onBlur`). Мост между ними —
не обёртка над компонентом, а **статика** `reformerAdapter`, которую компонент объявляет через
`defineFieldControl` (`@reformer/ui-kit/fields`):

```ts
// внутри пакета — иллюстрация механизма:
export const Input = defineFieldControl(InputPrimitive, { adapter: nativeInputAdapter });
export const CheckboxWithLabel = defineFieldControl(CheckboxWithLabelBase, {
  adapter: checkedAdapter,
  layout: 'inline-label', // FormField не рисует верхнюю подпись
});
```

`defineFieldControl` возвращает **тот же** компонент — он только вешает статики. Связывает поле
обёртка: `FormField.Control` из `@reformer/cdk` (его использует `<FormField>` кита) или рендерер
`@reformer/renderer-react`. Она читает `reformerAdapter`, кладёт значение в нужный проп
(`value`/`checked`/…), переводит эмит контрола в `onChange(value)`, пробрасывает
`disabled`/`aria-*` и строит императивный `FieldHandle`. Нет статики — контрол получает seam как
есть (value-based контролы: `InputNumber`, `InputMask`, `SelectAsync`, `Combobox`, …). Пресеты
адаптеров: `nativeInputAdapter`, `textValueAdapter`, `checkedAdapter`, `pressedAdapter`,
`valueChangeAdapter`, `multiValueAdapter`, `sliderAdapter`, `dateAdapter`, `datePickerAdapter`.

В `component` поля кладётся сам компонент. Для составных примитивов (Radix-`Select`,
`RadioGroup` + `RadioGroupItem`, …) в форму берётся готовый вариант, который рисует пункты из
`options`:

| Компонент         | В форму (`component`)                                                         | Registry-имя (JSON DSL)                                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Input             | `Input`, `InputNumber`, `InputSuggest`                                        | `Input`, `InputNumber`, `InputSuggest`                                    |
| InputPassword     | `InputPassword`                                                               | `InputPassword`                                                           |
| InputMask         | `InputMask`                                                                   | `InputMask`                                                               |
| InputOTP          | `InputOTPDefault`                                                             | `InputOTP`                                                                |
| Textarea          | `Textarea`                                                                    | `Textarea`                                                                |
| Select            | `SelectAsync`                                                                 | `Select`                                                                  |
| SelectMulti       | `SelectMulti`                                                                 | `SelectMulti`                                                             |
| NativeSelect      | `NativeSelectWithOptions`                                                     | `NativeSelect`                                                            |
| NativeSelectMulti | `NativeSelectMulti`                                                           | `NativeSelectMulti`                                                       |
| Checkbox          | `CheckboxWithLabel`                                                           | `Checkbox`                                                                |
| Switch            | `SwitchWithLabel`                                                             | `Switch`                                                                  |
| Toggle            | `Toggle`                                                                      | `Toggle`                                                                  |
| ToggleGroup       | `ToggleGroupOptions`                                                          | `ToggleGroup`                                                             |
| ToggleGroupMulti  | `ToggleGroupMulti`                                                            | `ToggleGroupMulti`                                                        |
| RadioGroup        | `RadioGroupOptions`                                                           | `RadioGroup`                                                              |
| Slider            | `Slider`                                                                      | `Slider`                                                                  |
| Calendar          | `CalendarSingle`                                                              | `Calendar`                                                                |
| DatePicker        | `DatePicker`                                                                  | `DatePicker`                                                              |
| Combobox          | `Combobox`, `ComboboxMulti`                                                   | `Combobox`, `ComboboxMulti`                                               |
| ComboboxTree      | `ComboboxTree`, `ComboboxTreeMulti`                                           | `ComboboxTree`, `ComboboxTreeMulti`                                       |
| FileUpload        | `FileUploadBase`, `FileUploadDropzone`, `FileUploadInput`, `FileUploadAvatar` | `FileUpload`, `FileUploadDropzone`, `FileUploadInput`, `FileUploadAvatar` |

У `Input` нет `type: 'number'` и `suggestions` (числа — `InputNumber`, подсказки — `InputSuggest`),
у `FileUpload*` нет пропа `variant` — каждый вариант отдельный компонент.

`Tree` в этой таблице нет намеренно: у него нет ни `value`, ни `onChange`, ни статики
`reformerAdapter`. Это компонент отображения — раскрытие, выделение и отмеченный набор он держит
сам, а наружу отдаёт события. Когда от иерархии нужно именно значение поля, в форму ставят
`ComboboxTree` / `ComboboxTreeMulti`, построенные поверх того же `Tree`.

**Свой контрол** подключается тем же способом:

```tsx
import { defineFieldControl, checkedAdapter } from '@reformer/ui-kit/fields';

export const MyCheckbox = defineFieldControl(ThirdPartyCheckbox, { adapter: checkedAdapter });
// схема: { value: model.$.agree, component: MyCheckbox }
```

> **Чужие компоненты без статики.** С `@reformer/renderer-react` (и через наследование
> `@reformer/renderer-json`) сырой контрол другой библиотеки, на который статику не повесить,
> подключается через `settings.resolveFieldAdapter`: он возвращает `FieldAdapter` по компоненту и
> приоритетнее статики — рендерер сам переложит seam на диалект контрола (`checked` +
> `onChange(event)`, `value` + `onChange(value, option)` и т.п.).

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

### 2. Form-поле (`SelectAsync` внутри `FormField`)

Архитектура M1: сначала модель (`createModel`) — источник истины значений, затем форма
(`createForm({ model, schema })`), где поле привязано к сигналу модели и несёт `component`
(сам компонент кита) + `componentProps`. Layout **не несёт валидаторов** — правила живут в отдельной
`ValidationSchema` и прогоняются внешним раннером `validateModel(model, schema)` из
[`@reformer/core/validation`](https://www.npmjs.com/package/@reformer/core) (см. пример ниже).
В JSX — один `<FormField control={form.x} />`.

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Button, FormField, SelectAsync, InputNumber } from '@reformer/ui-kit';

type LoanForm = { loanType: string; amount: number | null };

function LoanFormExample() {
  const { model, form, validation } = useMemo(() => {
    const model = createModel<LoanForm>({ loanType: '', amount: null });
    // Layout-схема формы: component + componentProps, БЕЗ валидаторов.
    const schema = {
      loanType: {
        value: model.$.loanType,
        component: SelectAsync, // ← сам компонент: связывает его FormField
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
        component: InputNumber,
        componentProps: { label: 'Сумма', min: 0 },
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
