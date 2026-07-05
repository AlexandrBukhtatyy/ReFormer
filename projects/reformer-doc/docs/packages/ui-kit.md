---
id: ui-kit
title: '@reformer/ui-kit'
sidebar_label: 'ui-kit'
---

# @reformer/ui-kit

> Стилизованные, готовые к использованию контролы форм (Tailwind + Radix), привязывающиеся к FieldNode.

`@reformer/ui-kit` — это слой «batteries-included» поверх headless-примитивов
`@reformer/cdk`. Там, где cdk даёт компоненты без стилей (`FormArray`,
`FormWizard`, `FormField`), ui-kit предоставляет drop-in, доступные, уже
стилизованные контролы — инпуты, селекты, чекбоксы, кнопки, контейнеры — построенные
на Tailwind CSS и Radix UI.

Компоненты спроектированы под контракт `value` / `onChange` / `onBlur` у
`FieldNode<T>`, поэтому в M1-архитектуре компонент и его props объявляются прямо в
ноде схемы (`component` + `componentProps`), а в JSX рендерится
`<FormField control={form.x} />`, который сам подцепляет значение, ошибку и
pending-состояние поля.

## Установка

```bash
npm install @reformer/ui-kit @reformer/core
```

`@reformer/ui-kit` рендерится с помощью Tailwind CSS — обязательно настройте
Tailwind в приложении, иначе utility-классы компонентов (`h-9`, `rounded-md`,
`border-input`, `text-destructive`, …) не будут сгенерированы и контролы окажутся
без стилей. Для темизации через CSS-переменные (`--primary`, `--destructive`,
`--ring`, …) используйте конфигурацию shadcn/ui или собственную аналогичную.
`@reformer/cdk` и `@reformer/renderer-react` — опциональные peer-зависимости,
нужны только если вы задействуете реэкспортированные `FormArray` / `FormWizard`.

## Компоненты

| Компонент                     | Роль                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `Input`                       | Текстовое поле (`text` / `email` / `number` / `tel` / `url`), тип сужает props. |
| `InputMask`                   | Поле ввода со строковой маской (телефон, дата, ИНН).                            |
| `InputPassword`               | Поле пароля с переключателем видимости.                                         |
| `Textarea`                    | Многострочное текстовое поле.                                                   |
| `Select`                      | Radix-выпадающий список (`+ SelectItem`, `SelectTrigger`, …).                   |
| `Checkbox`                    | Булев чекбокс с label рядом с контролом.                                        |
| `RadioGroup`                  | Группа радио-кнопок (одиночный выбор) из массива `options`.                     |
| `Button`                      | Кнопка с вариантами (`variant`, `size`, `asChild`).                             |
| `Box` / `Section`             | Layout-контейнеры для группировки контролов.                                    |
| `Collapsible`                 | Разворачиваемый / сворачиваемый контейнер.                                      |
| `AsyncBoundary`               | Контейнер с состояниями `loading` / `error` / `ready` для async UI.             |
| `FormField`                   | Обёртка «label + control + error + pending» поверх cdk.                         |
| `ErrorState` / `LoadingState` | Компоненты отображения состояний (`@reformer/ui-kit/state`).                    |

## Быстрый пример

```tsx
import { useMemo } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';

type RegistrationForm = {
  email: string;
  password: string;
};

function RegistrationPage() {
  const { model, form, schema } = useMemo(() => {
    // 1) Модель — источник истины значений.
    const model = createModel<RegistrationForm>({ email: '', password: '' });
    // 2) Схема: компонент и его props объявляются прямо в ноде.
    const schema = {
      children: [
        {
          value: model.$.email,
          component: Input,
          componentProps: { label: 'Email', type: 'email', testId: 'email' },
          validators: [required({ message: 'Email обязателен' }), email()],
        },
        {
          value: model.$.password,
          component: InputPassword,
          componentProps: { label: 'Пароль', testId: 'password' },
          validators: [required({ message: 'Пароль обязателен' })],
        },
      ],
    };
    // 3) createForm привязывает ноды к сигналам модели → FormProxy.
    const form = createForm<RegistrationForm>({ model, schema });
    return { model, form, schema };
  }, []);

  const onSubmit = async () => {
    form.markAsTouched();
    const res = await validateFormModel(model, schema);
    if (!res.valid) return;
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
      {/* FormField сам подцепляет value / error / pending через cdk */}
      <FormField control={form.email} />
      <FormField control={form.password} />
      <Button type="submit">Зарегистрироваться</Button>
    </form>
  );
}
```

## Дальше

- [Input — интерактивная документация](../ui-kit/input)
- [@reformer/cdk](./cdk) — headless-основа
