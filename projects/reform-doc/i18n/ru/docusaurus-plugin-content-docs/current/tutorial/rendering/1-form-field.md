---
sidebar_position: 1
---

# Компонент FormField

Универсальный компонент для отображения полей формы с валидацией.

## Обзор

Компонент `FormField` — это универсальная обёртка, которая связывает ваши UI-компоненты с состоянием формы ReFormer. Он:

- Отображает label из `componentProps`
- Связывает значение с состоянием формы
- Обрабатывает события `onChange` и `onBlur`
- Показывает ошибки валидации
- Отображает состояние ожидания при асинхронной валидации

## Хук useFormControl

Хук `useFormControl` извлекает реактивное состояние из `FieldNode`:

```tsx
import { useFormControl, type FieldNode } from 'reformer';

const { value, errors, pending, disabled, shouldShowError, componentProps } = useFormControl(control);
```

### Возвращаемые значения

| Свойство | Тип | Описание |
|----------|-----|----------|
| `value` | `T` | Текущее значение поля |
| `errors` | `ValidationError[]` | Массив ошибок валидации |
| `pending` | `boolean` | `true` во время асинхронной валидации |
| `disabled` | `boolean` | Заблокировано ли поле |
| `shouldShowError` | `boolean` | `true` если поле тронуто и есть ошибки |
| `componentProps` | `object` | Пропсы для компонента (label, placeholder и т.д.) |

## Реализация FormField

```tsx title="src/components/ui/FormField.tsx"
import * as React from 'react';
import { useFormControl, type FieldNode } from 'reformer';
import { Checkbox } from './checkbox';

export interface FormFieldProps {
  control: FieldNode<any>;
  className?: string;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className }) => {
  const { value, errors, pending, disabled, shouldShowError, componentProps } =
    useFormControl(control);

  const Component = control.component;
  const isCheckbox = Component === Checkbox;

  // Конвертируем null/undefined в безопасные значения
  const safeValue = value ?? (isCheckbox ? false : '');

  return (
    <div className={className}>
      {/* Отображаем label (кроме чекбоксов, у которых встроенный label) */}
      {componentProps.label && !isCheckbox && (
        <label className="block mb-1 text-sm font-medium">
          {componentProps.label}
        </label>
      )}

      {/* Рендерим сам компонент */}
      <Component
        {...componentProps}
        value={safeValue}
        onChange={(e: unknown) => {
          // Для чекбоксов e — это boolean напрямую
          // Для обычных input e — это event с target.value
          const newValue = isCheckbox
            ? e
            : ((e as { target?: { value?: unknown } })?.target?.value ?? e);
          control.setValue(newValue);
        }}
        onBlur={() => {
          control.markAsTouched();
        }}
        disabled={disabled}
        aria-invalid={shouldShowError}
      />

      {/* Показываем ошибку валидации */}
      {shouldShowError && (
        <span className="text-red-500 text-sm mt-1 block">
          {errors[0]?.message}
        </span>
      )}

      {/* Показываем состояние ожидания при асинхронной валидации */}
      {pending && (
        <span className="text-gray-500 text-sm mt-1 block">
          Проверка...
        </span>
      )}
    </div>
  );
};
```

## Мемоизация

Чтобы предотвратить лишние ререндеры при изменении других полей, оберните компонент в `React.memo`:

```tsx title="src/components/ui/FormField.tsx"
export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  // Возвращаем true, если пропсы НЕ изменились (пропустить ререндер)
  return (
    prevProps.control === nextProps.control &&
    prevProps.className === nextProps.className
  );
});
```

Эта оптимизация важна, потому что:
- Каждый `FieldNode` — это стабильная ссылка
- Компонент ререндерится только при изменении своего конкретного поля
- Изменения в других полях не вызовут ререндер этого компонента

## Использование

```tsx
import { FormField } from './components/ui/FormField';

function MyForm() {
  const form = createForm<PersonalInfo>({
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' }
    },
    agreeToTerms: {
      value: false,
      component: Checkbox,
      componentProps: { label: 'Я согласен с условиями' }
    }
  });

  return (
    <form>
      <FormField control={form.controls.firstName} className="mb-4" />
      <FormField control={form.controls.agreeToTerms} className="mb-4" />
    </form>
  );
}
```

## Ключевые концепции

### Связывание значения

`FormField` читает текущее значение из `useFormControl` и передаёт его компоненту. Когда пользователь изменяет значение, вызывается `control.setValue()` для обновления состояния формы.

### Состояние touched

Вызов `control.markAsTouched()` при blur помечает поле как "тронутое". Это используется в `shouldShowError` для показа ошибок валидации только после того, как пользователь взаимодействовал с полем.

### Отображение ошибок

Флаг `shouldShowError` равен `true`, когда:
- Поле было тронуто (`touched = true`)
- Поле имеет ошибки валидации (`errors.length > 0`)

Это предотвращает показ ошибок до того, как пользователь успел заполнить поле.

## Следующий шаг

Теперь, когда у вас есть компонент `FormField`, нужно создать сами UI-компоненты (Input, Select, Checkbox и т.д.), которые будут рендериться внутри него.
