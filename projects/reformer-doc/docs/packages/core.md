---
id: core
title: '@reformer/core'
sidebar_label: 'core'
---

# @reformer/core

> Реактивное управление состоянием форм на сигналах — фундамент экосистемы ReFormer.

`@reformer/core` — это базовый пакет ReFormer. В его основе архитектура **M1**: значения
живут в реактивной модели (`createModel`), а форма (`createForm`) строит ноды поверх сигналов
модели. Одна схема связывает конфигурацию полей (компонент, валидаторы) с сигналами модели,
а behaviors описывают реактивную логику декларативно.

Это тот слой, поверх которого строится вся остальная экосистема: `@reformer/cdk`,
рендереры (`renderer-react`, `renderer-json`) и `@reformer/ui-kit` используют модель, схему
и хуки из ядра. Пакет tree-shakeable, полностью типизирован под TypeScript.

## Установка

```bash
npm install @reformer/core
```

## Быстрый старт

```tsx
import { useMemo } from 'react';
import {
  createModel,
  createForm,
  validateFormModel,
  useFormControl,
  type FieldNode,
} from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

interface RegistrationForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// 1. Реактивная модель — источник истины для значений.
const model = createModel<RegistrationForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
});

// 2. Схема — связывает конфиг поля с сигналами модели (`model.$.<field>`).
const schema = {
  children: [
    { value: model.$.username, component: Input, validators: [required(), minLength(2)] },
    { value: model.$.email, component: Input, validators: [required(), email()] },
    { value: model.$.password, component: Input, validators: [required(), minLength(8)] },
    { value: model.$.confirmPassword, component: Input, validators: [required()] },
  ],
};

// 3. Behavior — декларативная реактивная логика.
const behavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  onChange(model.$.password, () => {
    if (model.confirmPassword) model.confirmPassword = '';
  });
});

// 4. Простой компонент поля через useFormControl.
function FormField({ label, control }: { label: string; control: FieldNode<string> }) {
  const { value, errors, shouldShowError } = useFormControl(control);
  return (
    <div>
      <label>{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && <span className="error">{errors[0].message}</span>}
    </div>
  );
}

// 5. Форма.
function RegistrationFormExample() {
  const form = useMemo(() => createForm<RegistrationForm>({ model, schema, behavior }), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.touchAll();
    const { valid } = await validateFormModel(model, schema);
    if (valid) console.log('Form data:', model.get());
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Username" control={form.username} />
      <FormField label="Email" control={form.email} />
      <FormField label="Password" control={form.password} />
      <FormField label="Confirm Password" control={form.confirmPassword} />
      <button type="submit">Register</button>
    </form>
  );
}
```

## Что внутри

- **Model** (`createModel`, `validateFormModel`) — реактивная модель как источник истины
  для значений и запуск валидации всей модели против схемы (`validateFormModel(model, schema)`,
  также доступны `validateModel` / `validateModelSync`).
- **Signals** (`@reformer/core/signals`) — сигнальная основа: `createForm` строит ноды
  (`FieldNode`, `GroupNode`, `ArrayNode`) поверх сигналов модели, доступных как `model.$.<field>`.
- **Behaviors** (`@reformer/core/behaviors`) — декларативный DSL `defineFormBehavior` и операторы:
  `compute`, `computeFrom`, `copyFrom`, `onChange`, `enableWhen` / `disableWhen`, `transformValue`,
  `resetWhen`, `syncFields`, `revalidateWhen`, `apply`, `applyEach`, `aggregateInto`.
- **Validators** (`@reformer/core/validators`) — чистые фабрики `(value) => ValidationError | null`:
  `required`, `email`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `phone`, `url`,
  `integer` (а также `isNumber`, `multipleOf`, `nonNegative`, `nonZero`), даты
  `minDate` / `maxDate` / `pastDate` / `futureDate` / `minAge` / `maxAge`.
- **React hooks** — `useFormControl` (полное состояние поля: `value`, `errors`, `disabled`,
  `touched`, `valid`, `shouldShowError`, `componentProps`), `useFormControlValue`
  (значение `T` напрямую — не деструктурируй!), `useArrayLength` (реактивная длина массива).

## Дальше

- [Начало работы](../getting-started/quick-start)
- [Core API Reference](../api)
