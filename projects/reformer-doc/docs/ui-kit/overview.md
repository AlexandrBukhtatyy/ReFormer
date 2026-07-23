---
sidebar_position: 1
---

# Обзор

`@reformer/ui-kit` — готовый набор стилизованных компонентов на базе
[shadcn/ui](https://ui.shadcn.com/) (стиль **new-york**, палитра **neutral**, Tailwind CSS v4),
интегрированный с формами `@reformer/core`.

Там, где [`@reformer/cdk`](../cdk/overview) даёт headless-примитивы без стилей, ui-kit даёт
стилизованные, доступные (a11y) контролы и их **form-версии** (`*Field`), которые привязываются
прямо к ноде формы через один универсальный `<FormField control={form.x} />`.

## Установка

```bash
npm install @reformer/ui-kit @reformer/core
```

Peer-зависимости: `@reformer/core`, `@reformer/cdk`, `@reformer/renderer-react`, `react`,
`react-dom` — npm 7+ установит их автоматически.

Тяжёлые компоненты (`chart`, `table`, `calendar`, `combobox`, `command`, `date-picker`, `drawer`,
`carousel`, `input-otp`, `message-scroller`, `resizable`, `sonner`) держат **optional**
peer-зависимости (recharts, `@tanstack/react-table`, react-day-picker, date-fns, cmdk, vaul,
embla-carousel-react, input-otp, react-resizable-panels, sonner) — ставьте их только если
используете соответствующий subpath.

### Подключение стилей

Пакет рендерится с **Tailwind CSS v4** — Tailwind должен быть настроен в приложении, иначе
utility-классы компонентов не будут сгенерированы и контролы окажутся без стилей.

Тема — self-contained: subpath-экспорт `@reformer/ui-kit/styles` поставляет oklch-токены shadcn
(new-york / neutral), dark-вариант и анимации (`tw-animate-css`). Подключается в вашем
Tailwind-входе:

```css
/* app.css / globals.css — ваш Tailwind v4 entry */
@import 'tailwindcss';
@import '@reformer/ui-kit/styles';

/* Tailwind должен «видеть» классы пакета — укажите @source на его сборку: */
@source '../node_modules/@reformer/ui-kit/dist';
```

Правила подключения:

- Импортировать тему строго **голым** `@import` — обёртка `layer(theme)` ломает
  `@custom-variant`.
- `@import 'tailwindcss'` и `@source` держит consumer: тема отдаёт токены и анимации, но не тянет
  Tailwind за собой.
- Не объявляйте собственный `@custom-variant dark` — тема уже содержит вариант, покрывающий и
  `.dark`, и `[data-theme='dark']` (последний объявленный молча побеждает).
- Для npm-потребителей `@source` указывает на `dist` (каталог `src` пакета не публикуется, кроме
  `src/styles`).

## Как устроен кит

Кит собран из трёх слоёв:

### 1. Чистые shadcn-примитивы

`Input`, `Select`, `Checkbox`, `Button`, `Dialog`, … — полный набор примитивов shadcn/ui
(`data-slot`, unified `radix-ui`, cva). Они **не знают про формы** и работают со своими нативными
событиями (`Input` — `onChange(event)`, `Checkbox` — `onCheckedChange`, `Slider` —
`onValueChange`).

Каждый компонент лежит в собственном каталоге с концептом **вариантов**: `variants/base` —
обязательный чистый shadcn-примитив, функциональные варианты (`async`, `number`, …) — пресеты под
юзкейс. Например, у `Select` вариант `base` — ручная сборка дропдауна из shadcn-частей, а
`async` — готовое поле с `options` / `resource` / `clearable`.

### 2. Headless-основа: `@reformer/cdk`

Составные form-компоненты кита — это **визуальный слой поверх headless-компонентов
[`@reformer/cdk`](../cdk/overview)**. Логика (состояние, render-props, контекст) живёт в cdk,
ui-kit добавляет к ней разметку и стили:

| Компонент ui-kit                    | Headless-основа                | Роль                                            |
| ----------------------------------- | ------------------------------ | ----------------------------------------------- |
| [`FormField`](../cdk/form-field)    | `@reformer/cdk/form-field`     | Обёртка «Label → Control → Error (+ pending)»   |
| [`FormArraySection`](./form-array)  | `@reformer/cdk/form-array`     | Стилизованная секция динамического массива форм |
| [`FormWizard`](./form-navigation)   | `@reformer/cdk/form-wizard`    | Многошаговый мастер с индикатором и навигацией  |
| [`AsyncBoundary`](./async-boundary) | `@reformer/cdk/async-boundary` | Состояния `loading` / `error` / `ready`         |

Если готовая разметка не подходит — берите headless-версию из cdk напрямую и стройте свой UI.

### 3. Form-интеграция: `*Field`-версии

Форме нужен единый value-based контракт (`value` + `onChange(value)`), а у примитивов event-shape
разный. Поэтому рядом с каждым form-control лежит его **field-версия**, порождённая внутренним HOC
`withFormControl`: `InputField`, `SelectField`, `CheckboxField`, `RadioGroupField`,
`TextareaField`, `SwitchField`, `SliderField`, `DatePickerField`, …

В схеме формы `component` указывает именно на field-версию — `<FormField>` сам резолвит
`value` / `onChange` / `onBlur` / `disabled` / ошибку ноды:

```tsx
import { createModel, createForm } from '@reformer/core';
import { FormField, InputField } from '@reformer/ui-kit';

const model = createModel<{ email: string }>({ email: '' });
const form = createForm({
  model,
  schema: {
    email: {
      value: model.$.email,
      component: InputField, // ← field-версия, не голый Input
      componentProps: { label: 'Email', type: 'email' },
    },
  },
});

// В JSX — один универсальный FormField:
<FormField control={form.email} />;
```

## Импорты

```tsx
// Из корневого barrel («лёгкие» компоненты)
import { Input, Select, Checkbox, Button, Box, FormField } from '@reformer/ui-kit';

// Через subpath отдельного компонента (tree-shaking)
import { Input, InputField } from '@reformer/ui-kit/input';

// Тяжёлые компоненты — ТОЛЬКО через subpath (вне barrel)
import { ChartContainer } from '@reformer/ui-kit/chart';
import { DataGrid } from '@reformer/ui-kit/table';

// Props-схемы (React-free) для MCP / renderer-json
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
```

## Дальше

- Интерактивная документация каждого компонента — в разделах слева (Variants / Examples / API)
- [`@reformer/cdk`](../cdk/overview) — headless-основа кита
