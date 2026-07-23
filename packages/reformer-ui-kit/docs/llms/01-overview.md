# Overview

`@reformer/ui-kit` — это набор готовых стилизованных React-компонентов для форм на
[`@reformer/core`](../../../reformer/) и [`@reformer/cdk`](../../../reformer-cdk/).
Под капотом — Tailwind CSS и Radix UI; интерфейс компонентов спроектирован под
контракт `value` / `onChange` / `onBlur` `FieldNode<T>`, поэтому подключение к
форме сводится к `<FormField control={form.email} />` или к регистрации
компонента в `RenderSchema` рендерера.

В отличие от headless-уровня `@reformer/cdk` (компоненты `FormArray`,
`FormWizard`, `FormField` без стилей), `ui-kit` уже имеет:

- стили (Tailwind utility-классы + темизация через CSS-переменные),
- разумные defaults для accessibility (`aria-invalid`, `aria-label`),
- готовый `FormField`-обёртку с label/error/pending,
- `Button` с вариантами (`default`/`outline`/`ghost`/`link`/`destructive`/`secondary`),
- утилиты для playground (`ExampleCard`, `AsyncBoundary`).

Если стили не подходят — можно использовать только headless `@reformer/cdk` и
писать собственный UI; этот пакет — разумная отправная точка.

## Installation

```bash
npm install @reformer/ui-kit @reformer/cdk @reformer/core
```

Peer-зависимости (должны быть в проекте):

```json
{
  "@reformer/cdk": ">=1.0.0",
  "@reformer/core": ">=1.1.0",
  "@reformer/renderer-react": ">=1.0.0",
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0"
}
```

`radix-ui`, `lucide-react`, `clsx`, `tailwind-merge` и `class-variance-authority` —
обычные зависимости пакета, ставить их отдельно не нужно.

### Опциональные peer-зависимости

Двенадцать компонентов построены на внешних библиотеках. Чтобы приложению, которому
нужен один `Input`, не прилетали recharts и react-table, эти библиотеки объявлены
**опциональными** peer-зависимостями: npm их не поставит и не поругается, но без них
соответствующий subpath не зарезолвится (`ERR_MODULE_NOT_FOUND`). Ставьте ту, чей
компонент используете:

| subpath                        | поставить                       |
| ------------------------------ | ------------------------------- |
| `./table` (DataGrid-вариант)   | `@tanstack/react-table` (>=8)   |
| `./command`, `./combobox`      | `cmdk` (>=1)                    |
| `./chart`                      | `recharts` (>=3)                |
| `./calendar`                   | `react-day-picker` (>=10)       |
| `./date-picker`                | `date-fns` (>=4)                |
| `./carousel`                   | `embla-carousel-react` (>=8)    |
| `./drawer`                     | `vaul` (>=1)                    |
| `./input-otp`                  | `input-otp` (>=1.4)             |
| `./resizable`                  | `react-resizable-panels` (>=4)  |
| `./sonner`                     | `sonner` (>=2)                  |
| `./message-scroller`           | `@shadcn/react` (^0.2.1)        |

Корневой barrel (`import { … } from '@reformer/ui-kit'`) эти компоненты не
реэкспортирует, поэтому без единой опциональной зависимости пакет полностью
работоспособен — они нужны только при deep-import конкретного компонента.

Tailwind должен быть подключён в проекте: `@reformer/ui-kit` использует
utility-классы (`h-9`, `rounded-md`, `border-input`, `text-destructive`, ...).
Для тем (variables `--primary`, `--destructive`, `--ring`, ...) используйте
конфигурацию shadcn/ui или собственную аналогичную.

## Import Patterns

```typescript
// Все компоненты из корня (рекомендованный способ для приложений)
import {
  Input,
  InputMask,
  InputPassword,
  Textarea,
  Checkbox,
  RadioGroup,
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Button,
  FormField,
  AsyncBoundary,
  ExampleCard,
  Box,
  Section,
  Collapsible,
  cn,
} from '@reformer/ui-kit';
```

Для tree-shaking и оптимизации бандла доступен импорт из подмодулей:

```typescript
// Tree-shaking (для библиотек / тонких бандлов)
import { Input } from '@reformer/ui-kit/input';
import { Select } from '@reformer/ui-kit/select';
import { FormField } from '@reformer/ui-kit/form-field';
import { Button } from '@reformer/ui-kit/button';
```

Реэкспорт внутри одного модуля (`@reformer/ui-kit/select` отдаёт `Select` и все
8 sub-компонентов) также работает.

## Quick Start

Минимальная форма из двух полей с валидацией и сабмитом (архитектура M1:
`createModel` → layout-схема → `createForm({ model, schema })`; валидация — отдельная
`defineValidationSchema`, запускаемая `validateModel`). `FormField` самостоятельно
подцепляет `value`/`error`/`pending` через `@reformer/cdk`:

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';

type RegistrationForm = {
  email: string;
  password: string;
};

// Валидация — отдельный слой (@reformer/core/validation), НЕ в layout-схеме.
const registrationValidation = defineValidationSchema<RegistrationForm>(({ model }) => {
  validate(model.$.email, [required({ message: 'Email обязателен' }), email()]);
  validate(model.$.password, [required({ message: 'Пароль обязателен' }), minLength(8)]);
});

function RegistrationPage() {
  const { model, form } = useMemo(() => {
    // 1) Модель — источник истины значений.
    const model = createModel<RegistrationForm>({ email: '', password: '' });
    // 2) Layout-схема: лист = { value: сигнал модели, component, componentProps? } — без validators.
    const schema = {
      children: [
        {
          value: model.$.email,
          component: Input,
          componentProps: { label: 'Email', type: 'email', testId: 'email' },
        },
        {
          value: model.$.password,
          component: InputPassword,
          componentProps: { label: 'Пароль', testId: 'password' },
        },
      ],
    };
    // 3) createForm привязывает ноды к сигналам модели → FormProxy.
    const form = createForm<RegistrationForm>({ model, schema });
    return { model, form };
  }, []);

  const onSubmit = async () => {
    form.markAsTouched();
    // 4) Валидация модели внешним раннером (ошибки сам роутит в ноды).
    //    form.submit()/validate() schema-валидацию НЕ гоняют.
    const ok = await validateModel(model, registrationValidation);
    if (!ok) return;
    console.log('values', model.get());
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4 max-w-md"
    >
      <FormField control={form.email} />
      <FormField control={form.password} />
      <Button type="submit">Зарегистрироваться</Button>
    </form>
  );
}
```

## Components

| Name                            | Purpose                                                    | Where documented                                              |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `Input`                         | Текстовое поле (`text`/`email`/`number`/`tel`/`url`).      | [02-text-fields.md](02-text-fields.md)                        |
| `InputMask`                     | Поле ввода со строковой маской (телефон, дата, ИНН).       | [02-text-fields.md](02-text-fields.md)                        |
| `InputPassword`                 | Поле пароля с переключателем видимости.                    | [02-text-fields.md](02-text-fields.md)                        |
| `Textarea`                      | Многострочное поле.                                        | [02-text-fields.md](02-text-fields.md)                        |
| `Checkbox`                      | Чекбокс с label рядом с контролом.                         | [03-choice-fields.md](03-choice-fields.md)                    |
| `RadioGroup`                    | Группа радио-кнопок из массива `options`.                  | [03-choice-fields.md](03-choice-fields.md)                    |
| `Select` (+ 8 sub-компонентов)  | Выпадающий список с inline `options` или async `resource`. | [03-choice-fields.md](03-choice-fields.md)                    |
| `Button`                        | Кнопка с вариантами (`variant`, `size`, `asChild`).        | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `AsyncBoundary` (+ `*Loading`, `*Error`, `*Empty`) | Состояния загрузки `idle`/`loading`/`ready`/`error` со встроенными блоками. | [04-layout-and-buttons.md](04-layout-and-buttons.md) |
| `ExampleCard`                   | Карточка-обёртка для демо в playground.                    | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `cn`                            | Утилита для конкатенации Tailwind-классов.                 | [04-layout-and-buttons.md](04-layout-and-buttons.md)          |
| `FormField`                     | Wrapper «label + control + error + pending» поверх CDK.    | [05-form-field-integration.md](05-form-field-integration.md)  |
| `Box`, `Section`, `Collapsible` | Контейнеры для `RenderSchema` (см. рендерер).              | [renderer-react](../../../reformer-renderer-react/docs/llms/) |

Полный troubleshooting (number-input возвращает строку, Select не показывает
options, mask пропускает символы, forwardRef + Slot конфликты, и т.п.) —
[06-troubleshooting.md](06-troubleshooting.md).

## See also

- [02-text-fields.md](02-text-fields.md) — `Input`, `InputMask`, `InputPassword`, `Textarea`.
- [03-choice-fields.md](03-choice-fields.md) — `Checkbox`, `RadioGroup`, `Select`.
- [04-layout-and-buttons.md](04-layout-and-buttons.md) — `Button`, `AsyncBoundary`, `ExampleCard`, `cn`.
- [05-form-field-integration.md](05-form-field-integration.md) — `FormField` standalone и как `fieldWrapper`.
- [06-troubleshooting.md](06-troubleshooting.md) — типичные проблемы и решения.
