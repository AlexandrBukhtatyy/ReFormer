# Fix: Generic FormWizard wrapper in playground

## Context

В `CreditApplicationForm.tsx` передаётся `navConfig` с типом
`{ stepValidations: { 1: ValidationSchemaFn<CreditApplicationForm>; ... } }`.
Компонент `FormWizard` (локальная обёртка) принимает `config: FormWizardConfig<Record<string, any>>`.

Ошибка — **контравариантность параметров функции**:
- `ValidationSchemaFn<T> = (path: FieldPath<T>) => void`
- `ValidationSchemaFn<CreditApplicationForm>` принимает `FieldPath<CreditApplicationForm>` (конкретные поля)
- `ValidationSchemaFn<Record<string, any>>` принимает `FieldPath<Record<string, any>>` (индексная сигнатура)
- TypeScript не может доказать, что `FieldPath<Record<string,any>>` ≥ `FieldPath<CreditApplicationForm>` по набору свойств

**Причина**: локальный `FormWizard` не является настоящим generic-компонентом — тип захардкожен как `FC<FormWizardProps<FormValue>>`, что стирает обобщённость.

## Critical file

- `projects/react-playground/src/pages/examples/complex-multy-step-form/components/ui/FormWizzard/FormWizard.tsx`

## Fix

Текущий код:
```typescript
type FormValue = Record<string, any>;

export const FormWizard: FC<FormWizardProps<FormValue>> = forwardRef(
  (props: FormWizardProps<FormValue>, ref) => {
    const formWizardRef = useRef(null);
    useImperativeHandle(ref, () => formWizardRef.current);
    ...
  }
);
```

Проблема: `FC<FormWizardProps<FormValue>>` фиксирует `T = Record<string, any>`, дженерик не пробрасывается.

Исправленный код — стандартный паттерн для generic + forwardRef в TypeScript:
```typescript
import { forwardRef, useImperativeHandle, useRef, type FC, type ForwardedRef } from 'react';
import type { FormWizardHandle } from '@reformer/ui/form-wizard';
// ... остальные импорты

type FormValue = Record<string, any>;

interface FormWizardProps<T extends FormValue> extends FormWizardHeadlessProps<T> {
  className?: string;
  steps: FormWizardIndicatorStep[];
  onSubmit: FormWizardActionsProps['onSubmit'];
}

function FormWizardInner<T extends FormValue>(
  props: FormWizardProps<T>,
  ref: ForwardedRef<FormWizardHandle<T>>
) {
  const formWizardRef = useRef<FormWizardHandle<T>>(null);
  useImperativeHandle(ref, () => formWizardRef.current as FormWizardHandle<T>);
  // тело без изменений
  ...
}

export const FormWizard = forwardRef(FormWizardInner) as <T extends FormValue>(
  props: FormWizardProps<T> & { ref?: React.Ref<FormWizardHandle<T>> }
) => React.ReactElement | null;
```

Ключевые изменения:
1. Выносим реализацию в `FormWizardInner<T>` с явным параметром `ref: ForwardedRef<FormWizardHandle<T>>`
2. `forwardRef(FormWizardInner)` — TypeScript выводит generic через параметры функции
3. Явное приведение типа при экспорте (`as <T extends FormValue>(...)`) — стандартный workaround для `forwardRef` + дженерик

Никаких изменений в `CreditApplicationForm.tsx` не требуется.

## Verification

После правки:
1. `tsc --noEmit` должен пройти без ошибок в этом файле
2. В `CreditApplicationForm.tsx` `navConfig` будет корректно приведён к `FormWizardConfig<CreditApplicationFormType>`
3. `ref` типа `FormWizardHandle<CreditApplicationFormType>` продолжит работать корректно
