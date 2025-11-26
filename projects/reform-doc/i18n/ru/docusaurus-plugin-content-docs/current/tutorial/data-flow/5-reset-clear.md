---
sidebar_position: 5
---

# Сброс и очистка

Возврат формы в исходное состояние и очистка всех данных.

## Что мы строим

Возможности сброса формы:

- **Сброс на исходные** - Восстановление исходных значений
- **Очистка всех данных** - Опустошение всей формы
- **Сброс этапа** - Очистка определённого раздела
- **Сброс поля** - Очистка отдельного поля
- **Диалоги подтверждения** - Предотвращение случайных сбросов
- **Отметить как чистую** - Сброс грязного состояния
- **Очистить ошибки** - Удаление ошибок валидации

## Сброс vs Очистка

Понимание различия:

| Операция | Описание | Сценарий использования |
|----------|---------|----------------------|
| **Сброс** | Восстановить исходные значения | "Отменить мои изменения" |
| **Очистка** | Опустошить все поля | "Начать полностью заново" |
| **Сброс этапа** | Очистить один раздел | "Переделать этот этап" |
| **Сброс поля** | Очистить одно поле | "Удалить это значение" |

Пример:

```typescript
// Исходные значения: { name: "John", age: 30 }
// Пользователь изменил на: { name: "Jane", age: 25 }

form.reset();       // Вернуться к { name: "John", age: 30 }
form.clear();       // Опустошить { name: "", age: null }
```

## Почему сброс/очистка?

Пользователи нуждаются в:
- **Исправление ошибок** - Отмена нежелательных изменений
- **Начало заново** - Начало с чистого листа
- **Сравнение вариантов** - Сброс и попытка других значений
- **Очистка конфиденциальных данных** - Удаление конфиденциальной информации
- **Отказ от черновика** - Отбросить текущую работу

## Создание хука сброса

Создадим хук для операций сброса:

```bash
touch src/hooks/useFormReset.ts
```

### Реализация

```typescript title="src/hooks/useFormReset.ts"
import { useState, useCallback, useRef } from 'react';
import type { FormNode } from 'reformer';

/**
 * Опции сброса
 */
export interface ResetOptions {
  /** Отметить форму как чистую после сброса */
  markPristine?: boolean;
  /** Очистить ошибки валидации после сброса */
  clearErrors?: boolean;
  /** Подтверждение перед сбросом */
  confirm?: boolean;
  /** Сообщение подтверждения */
  confirmMessage?: string;
}

/**
 * Тип возврата хука
 */
export interface UseFormResetReturn {
  /** Сброс на исходные значения */
  reset: (options?: ResetOptions) => Promise<boolean>;
  /** Очистка всех данных (опустошение формы) */
  clear: (options?: ResetOptions) => Promise<boolean>;
  /** Сброс определённого этапа/группы */
  resetStep: (stepName: string, options?: ResetOptions) => Promise<boolean>;
  /** Сброс определённого поля */
  resetField: (fieldPath: string, options?: ResetOptions) => void;
  /** Получение исходных значений */
  getInitialValues: () => any;
  /** Проверка, есть ли изменения в форме */
  hasChanges: () => boolean;
}

/**
 * Хук для операций сброса формы
 */
export function useFormReset(form: FormNode): UseFormResetReturn {
  // Сохраняем исходные значения при монтировании
  const initialValuesRef = useRef(form.value.value);

  // Сброс на исходные значения
  const reset = useCallback(async (options: ResetOptions = {}): Promise<boolean> => {
    const {
      confirm = true,
      confirmMessage = 'Сбросить форму на исходные значения? Любые несохранённые изменения будут потеряны.',
      markPristine = true,
      clearErrors = true,
    } = options;

    // Подтверждение, если требуется
    if (confirm && form.isDirty.value) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return false;
      }
    }

    // Сброс на исходные значения
    form.patchValue(initialValuesRef.current);

    // Отметить как чистую
    if (markPristine) {
      form.markAsPristine();
    }

    // Очистить ошибки
    if (clearErrors) {
      form.clearErrors();
    }

    return true;
  }, [form]);

  // Очистка всех данных
  const clear = useCallback(async (options: ResetOptions = {}): Promise<boolean> => {
    const {
      confirm = true,
      confirmMessage = 'Очистить все данные формы? Это невозможно отменить.',
      markPristine = true,
      clearErrors = true,
    } = options;

    // Подтверждение, если требуется
    if (confirm && form.isDirty.value) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return false;
      }
    }

    // Очистка формы (сброс на пустые значения по умолчанию)
    form.reset();

    // Отметить как чистую
    if (markPristine) {
      form.markAsPristine();
    }

    // Очистить ошибки
    if (clearErrors) {
      form.clearErrors();
    }

    return true;
  }, [form]);

  // Сброс определённого этапа
  const resetStep = useCallback(async (
    stepName: string,
    options: ResetOptions = {}
  ): Promise<boolean> => {
    const {
      confirm = true,
      confirmMessage = `Сбросить ${stepName} на исходные значения?`,
      markPristine = false,
      clearErrors = true,
    } = options;

    // Получение узла этапа
    const step = form.group(stepName);
    if (!step) {
      console.error(`Этап не найден: ${stepName}`);
      return false;
    }

    // Подтверждение, если требуется
    if (confirm && step.isDirty.value) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return false;
      }
    }

    // Сброс этапа на исходные значения
    const initialStepValues = initialValuesRef.current[stepName];
    if (initialStepValues) {
      step.patchValue(initialStepValues);
    } else {
      step.reset();
    }

    // Отметить как чистую
    if (markPristine) {
      step.markAsPristine();
    }

    // Очистить ошибки
    if (clearErrors) {
      step.clearErrors();
    }

    return true;
  }, [form]);

  // Сброс определённого поля
  const resetField = useCallback((
    fieldPath: string,
    options: ResetOptions = {}
  ) => {
    const { markPristine = false, clearErrors = true } = options;

    // Получение узла поля
    const field = form.field(fieldPath);
    if (!field) {
      console.error(`Поле не найдено: ${fieldPath}`);
      return;
    }

    // Получение исходного значения для этого поля
    const pathParts = fieldPath.split('.');
    let initialValue = initialValuesRef.current;
    for (const part of pathParts) {
      initialValue = initialValue?.[part];
    }

    // Сброс поля
    if (initialValue !== undefined) {
      field.setValue(initialValue);
    } else {
      field.reset();
    }

    // Отметить как чистую
    if (markPristine) {
      field.markAsPristine();
    }

    // Очистить ошибки
    if (clearErrors) {
      field.clearErrors();
    }
  }, [form]);

  // Получение исходных значений
  const getInitialValues = useCallback(() => {
    return initialValuesRef.current;
  }, []);

  // Проверка, есть ли изменения в форме
  const hasChanges = useCallback(() => {
    return form.isDirty.value;
  }, [form]);

  return {
    reset,
    clear,
    resetStep,
    resetField,
    getInitialValues,
    hasChanges,
  };
}
```

## Создание диалогов подтверждения

Создадим переиспользуемые компоненты диалогов подтверждения:

```tsx title="src/components/ConfirmDialog.tsx"
import { useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog confirm-dialog">
        {/* Иконка в зависимости от варианта */}
        <div className={`dialog-icon ${variant}`}>
          {variant === 'danger' && <WarningIcon className="w-12 h-12" />}
          {variant === 'warning' && <AlertIcon className="w-12 h-12" />}
          {variant === 'info' && <InfoIcon className="w-12 h-12" />}
        </div>

        {/* Содержимое */}
        <h2>{title}</h2>
        <p>{message}</p>

        {/* Действия */}
        <div className="dialog-actions">
          <button
            onClick={onCancel}
            className="button-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`button-${variant === 'danger' ? 'danger' : 'primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Хук для программного подтверждения
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText: string;
    cancelText: string;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    confirmText: 'Подтвердить',
    cancelText: 'Отмена',
    resolve: null,
  });

  const confirm = (
    title: string,
    message: string,
    options: {
      variant?: 'danger' | 'warning' | 'info';
      confirmText?: string;
      cancelText?: string;
    } = {}
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        variant: options.variant || 'warning',
        confirmText: options.confirmText || 'Подтвердить',
        cancelText: options.cancelText || 'Отмена',
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    dialogState.resolve?.(true);
    setDialogState({ ...dialogState, isOpen: false, resolve: null });
  };

  const handleCancel = () => {
    dialogState.resolve?.(false);
    setDialogState({ ...dialogState, isOpen: false, resolve: null });
  };

  const dialog = dialogState.isOpen ? (
    <ConfirmDialog
      title={dialogState.title}
      message={dialogState.message}
      variant={dialogState.variant}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}

// Компоненты иконок
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
    </svg>
  );
}
```

## Создание кнопок управления сбросом

Создадим компонент с управлением сбросом:

```tsx title="src/components/ResetControls.tsx"
import { useFormReset } from '@/hooks/useFormReset';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import type { FormNode } from 'reformer';

interface ResetControlsProps {
  form: FormNode;
  onReset?: () => void;
  onClear?: () => void;
}

export function ResetControls({ form, onReset, onClear }: ResetControlsProps) {
  const { reset, clear, hasChanges } = useFormReset(form);
  const { confirm, dialog } = useConfirmDialog();

  const handleReset = async () => {
    const confirmed = await confirm(
      'Сброс формы',
      'Вернуть все поля к их исходным значениям? Любые несохранённые изменения будут потеряны.',
      { variant: 'warning', confirmText: 'Сбросить' }
    );

    if (confirmed) {
      const success = await reset({ confirm: false });
      if (success) {
        onReset?.();
      }
    }
  };

  const handleClear = async () => {
    const confirmed = await confirm(
      'Очистить форму',
      'Очистить все данные формы? Это удалит все значения и не может быть отменено.',
      { variant: 'danger', confirmText: 'Очистить всё' }
    );

    if (confirmed) {
      const success = await clear({ confirm: false });
      if (success) {
        onClear?.();
      }
    }
  };

  const hasAnyChanges = hasChanges();

  return (
    <>
      <div className="reset-controls">
        <button
          onClick={handleReset}
          disabled={!hasAnyChanges}
          className="button-secondary"
          title="Вернуться к исходным значениям"
        >
          <ResetIcon className="w-4 h-4" />
          <span>Сброс</span>
        </button>

        <button
          onClick={handleClear}
          className="button-secondary"
          title="Очистить все данные"
        >
          <ClearIcon className="w-4 h-4" />
          <span>Очистить всё</span>
        </button>
      </div>

      {dialog}
    </>
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
```

## Сброс на уровне этапа

Добавим кнопку сброса к каждому этапу:

```tsx title="src/components/StepHeader.tsx"
import { useFormReset } from '@/hooks/useFormReset';
import type { FormNode } from 'reformer';

interface StepHeaderProps {
  stepName: string;
  title: string;
  form: FormNode;
}

export function StepHeader({ stepName, title, form }: StepHeaderProps) {
  const { resetStep } = useFormReset(form);

  const handleResetStep = async () => {
    await resetStep(stepName, {
      confirmMessage: `Сбросить этап "${title}"? Все изменения в этом этапе будут потеряны.`,
    });
  };

  return (
    <div className="step-header">
      <h2>{title}</h2>
      <button
        onClick={handleResetStep}
        className="reset-step-button"
        title="Сбросить этот этап"
      >
        <ResetIcon className="w-4 h-4" />
        <span>Сбросить этап</span>
      </button>
    </div>
  );
}
```

## Сброс на уровне поля

Добавим кнопку сброса к отдельным полям:

```tsx title="src/components/FormField.tsx"
import { useFormReset } from '@/hooks/useFormReset';
import type { FormNode } from 'reformer';

interface FormFieldProps {
  form: FormNode;
  fieldPath: string;
  label: string;
  children: React.ReactNode;
}

export function FormField({ form, fieldPath, label, children }: FormFieldProps) {
  const { resetField } = useFormReset(form);
  const field = form.field(fieldPath);
  const isDirty = field?.isDirty.value;

  const handleResetField = () => {
    resetField(fieldPath, { clearErrors: true });
  };

  return (
    <div className="form-field">
      <div className="field-header">
        <label>{label}</label>
        {isDirty && (
          <button
            onClick={handleResetField}
            className="reset-field-button"
            title="Сбросить это поле"
          >
            <UndoIcon className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="field-input">
        {children}
      </div>
    </div>
  );
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}
```

## Интеграция с компонентом формы

Полный пример интеграции:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useDraftManager } from '@/hooks/useDraftManager';
import { useFormReset } from '@/hooks/useFormReset';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';
import { ResetControls } from '@/components/ResetControls';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Загрузка данных
  const { loading, error } = useDataLoader(form);

  // Автосохранение
  const { status } = useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => saveCurrentDraft(data),
  });

  // Управление черновиками
  const draftManager = useDraftManager(form);

  // Функциональность сброса
  const { reset, clear } = useFormReset(form);

  const handleReset = () => {
    // Опционально: Приостановка автосохранения во время сброса
    reset();
  };

  const handleClear = () => {
    // Очистка текущего черновика тоже
    clear();
    draftManager.clearCurrent();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="form-container">
      {/* Заголовок */}
      <div className="form-header">
        <h1>Кредитное заявление</h1>
        <div className="form-controls">
          <AutoSaveIndicator status={status} />
          <DraftSelector {...draftManager} />
          <ResetControls
            form={form}
            onReset={handleReset}
            onClear={handleClear}
          />
        </div>
      </div>

      {/* Форма */}
      <FormRenderer form={form} />
    </div>
  );
}
```

## Тестирование сброса и очистки

Протестируйте эти сценарии:

### Сценарий 1: Сброс на исходные
- [ ] Заполните форму с данными
- [ ] Нажмите "Сброс"
- [ ] Диалог подтверждения появляется
- [ ] Подтвердите сброс
- [ ] Форма восстанавливает исходные значения
- [ ] Грязное состояние очищено

### Сценарий 2: Очистка всех
- [ ] Заполните форму с данными
- [ ] Нажмите "Очистить всё"
- [ ] Диалог подтверждения появляется
- [ ] Подтвердите очистку
- [ ] Все поля опустошены
- [ ] Грязное состояние очищено

### Сценарий 3: Отмена сброса
- [ ] Заполните форму с данными
- [ ] Нажмите "Сброс"
- [ ] Диалог подтверждения появляется
- [ ] Нажмите "Отмена"
- [ ] Данные формы неизменены
- [ ] Можно продолжить редактирование

### Сценарий 4: Сброс этапа
- [ ] Заполните несколько этапов
- [ ] Нажмите "Сброс этапа" на одном этапе
- [ ] Подтвердите сброс
- [ ] Только этот этап сбрасывается
- [ ] Другие этапы не изменены

### Сценарий 5: Сброс поля
- [ ] Измените поле
- [ ] Смотрите иконку отмены
- [ ] Нажмите иконку отмены
- [ ] Поле сбрасывается на исходное значение
- [ ] Другие поля не изменены

### Сценарий 6: Сброс после загрузки
- [ ] Загрузите данные заявления
- [ ] Измените несколько полей
- [ ] Нажмите "Сброс"
- [ ] Форма возвращается к загруженным данным (не пусто)

## Ключевые выводы

1. **Сброс** - Возврат к исходным значениям
2. **Очистка** - Опустошение всех полей
3. **Подтверждение** - Предотвращение случайной потери данных
4. **Гранулярный контроль** - Сброс формы, этапа или поля
5. **Управление состоянием** - Очистка грязного и ошибочного состояний
6. **Исходные значения** - Захват при монтировании, не при сбросе

## Распространённые паттерны

### Базовый сброс
```typescript
const { reset } = useFormReset(form);
await reset();
```

### Очистка без подтверждения
```typescript
const { clear } = useFormReset(form);
await clear({ confirm: false });
```

### Сброс этапа
```typescript
const { resetStep } = useFormReset(form);
await resetStep('personalData');
```

### Сброс поля
```typescript
const { resetField } = useFormReset(form);
resetField('personalData.firstName');
```

### Пользовательское подтверждение
```typescript
const confirmed = await myCustomConfirm('Сбросить форму?');
if (confirmed) {
  await reset({ confirm: false });
}
```

## Что дальше?

В следующем разделе мы добавим функцию **Предзаполнение данных**:
- Загрузка данных профиля пользователя
- Автоматическое заполнение личной информации
- Автоматическое заполнение контактных данных
- Умная стратегия объединения
- Выборочное предзаполнение полей
- Ручное срабатывание предзаполнения

Мы сделаем заполнение формы быстрее, предварительно заполнив данные из профиля пользователя!
