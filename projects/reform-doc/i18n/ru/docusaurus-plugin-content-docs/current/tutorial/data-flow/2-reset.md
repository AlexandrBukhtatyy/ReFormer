---
sidebar_position: 2
---

# Сброс формы

Сброс форм к их начальному состоянию или очистка всех значений.

## Обзор

Формы нужно сбрасывать в различных сценариях:

- **После успешной отправки** - Очистка формы для следующего ввода
- **Отмена режима редактирования** - Возврат к исходным значениям
- **Очистка всех данных** - Начать заново
- **Сброс ошибок** - Очистка состояния валидации

## Базовый сброс

### reset() - Сброс к начальным значениям

Метод `reset()` восстанавливает форму к её начальному состоянию:

```typescript title="src/components/CreditApplicationForm.tsx"
import { createCreditApplicationForm } from '../schemas/create-form';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleCancel = () => {
    // Сброс к начальным значениям, определенным в схеме
    form.reset();
  };

  const handleSubmit = async () => {
    const result = await submitApplication(form.value.value);

    if (result.success) {
      // Сброс формы после успешной отправки
      form.reset();
      showSuccessMessage('Заявка отправлена!');
    }
  };

  return (
    <form>
      {/* Поля формы */}
      <button type="button" onClick={handleCancel}>
        Отмена
      </button>
      <button type="submit" onClick={handleSubmit}>
        Отправить
      </button>
    </form>
  );
}
```

### Что делает reset()

```typescript
form.reset();

// Восстанавливает:
// ✅ Значения к начальному состоянию
// ✅ Состояние touched в false
// ✅ Состояние dirty в false
// ✅ Очищает ошибки валидации
// ✅ Сбрасывает состояние pristine
```

## Сброс с новыми значениями

Сброс и установка новых начальных значений одновременно:

```typescript
// Сброс к конкретным значениям
form.reset({
  loanType: 'consumer',
  loanAmount: 100000,
  loanTerm: 12,
});

// Форма теперь использует эти значения как начальные
```

### Случай использования: Отмена режима редактирования

```typescript
function EditCreditApplication({ initialData }: Props) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    // Установка начальных значений из загруженных данных
    form.setValue(initialData);
  }, [form, initialData]);

  const handleCancel = () => {
    // Сброс к загруженным начальным значениям (отмена изменений)
    form.reset(initialData);
    navigateBack();
  };

  const handleSave = async () => {
    await submitChanges(form.value.value);
    form.reset(form.value.value); // Пометить текущее состояние как чистое
  };

  return (
    // ... UI формы
  );
}
```

## Очистка данных формы

### Очистка всех полей

Установка всех полей в пустые/дефолтные значения:

```typescript
import type { CreditApplicationForm } from '../types';

function ClearAllButton({ form }: Props) {
  const handleClear = () => {
    const emptyValues: Partial<CreditApplicationForm> = {
      loanType: undefined,
      loanAmount: 0,
      loanTerm: 0,
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phoneMain: '',
      // ... все поля в пустые значения
    };

    form.setValue(emptyValues);
  };

  return (
    <button type="button" onClick={handleClear}>
      Очистить все поля
    </button>
  );
}
```

### Очистка конкретной секции

```typescript
function PersonalInfoSection({ form }: Props) {
  const handleClearPersonalInfo = () => {
    form.patchValue({
      firstName: '',
      lastName: '',
      middleName: '',
      birthDate: '',
      birthPlace: '',
    });
  };

  return (
    <section>
      <h2>Персональная информация</h2>
      {/* Поля */}
      <button type="button" onClick={handleClearPersonalInfo}>
        Очистить секцию
      </button>
    </section>
  );
}
```

## Опции сброса

### Сброс без валидации

```typescript
// Сброс без запуска валидации
form.reset(undefined, { validate: false });
```

### Сброс без генерации событий

```typescript
// Тихий сброс
form.reset(undefined, { emitEvent: false });
```

## Сброс состояний полей

### Пометить как нетронутое

Сброс состояния touched без изменения значений:

```typescript
// Сброс состояния touched для всей формы
form.markAsUntouched();

// Пользователь теперь увидит валидацию только после повторного взаимодействия
```

### Пометить как нетронутое (pristine)

Сброс состояния dirty/pristine:

```typescript
// Пометить форму как нетронутую (без изменений)
form.markAsPristine();

// Полезно после сохранения: "текущее состояние теперь чистое"
```

## Очистка ошибок

### Очистка всех ошибок валидации

```typescript
// Очистка всех ошибок
form.clearErrors();

// Форма не показывает ошибок валидации
// Но правила валидации все еще применяются при следующем изменении/валидации
```

### Очистка ошибок конкретного поля

```typescript
// Очистка ошибок для конкретного поля
form.field('loanAmount').clearErrors();
```

## Сброс многошаговой формы

### Сброс текущего шага

```typescript
function MultiStepForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [currentStep, setCurrentStep] = useState(1);

  const handleResetStep = () => {
    if (currentStep === 1) {
      // Сброс деталей кредита
      form.patchValue({
        loanType: 'consumer',
        loanAmount: 0,
        loanTerm: 0,
        loanPurpose: '',
      });
    } else if (currentStep === 2) {
      // Сброс персональной информации
      form.patchValue({
        firstName: '',
        lastName: '',
        middleName: '',
        birthDate: '',
      });
    }
    // ... другие шаги
  };

  return (
    <div>
      <StepContent step={currentStep} form={form} />
      <button type="button" onClick={handleResetStep}>
        Сбросить этот шаг
      </button>
    </div>
  );
}
```

### Сброс и переход к первому шагу

```typescript
const handleResetAll = () => {
  form.reset();
  setCurrentStep(1);
  showMessage('Форма сброшена к началу');
};
```

## Условный сброс

### Сброс при изменении маршрута

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const location = useLocation();

  useEffect(() => {
    // Сброс формы при уходе и возвращении
    return () => {
      if (form.dirty.value) {
        const shouldReset = confirm('У вас есть несохраненные изменения. Отменить их?');
        if (shouldReset) {
          form.reset();
        }
      }
    };
  }, [location, form]);

  return (
    // ... UI формы
  );
}
```

### Сброс после таймаута

```typescript
function useAutoReset(form: FormNode<CreditApplicationForm>, timeoutMs: number) {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const subscription = form.value.subscribe(() => {
      // Очистка предыдущего таймаута
      clearTimeout(timeoutId);

      // Установка нового таймаута
      timeoutId = setTimeout(() => {
        if (form.dirty.value && !form.touched.value) {
          console.log('Авто-сброс формы после неактивности');
          form.reset();
        }
      }, timeoutMs);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [form, timeoutMs]);
}

// Использование
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Авто-сброс после 10 минут неактивности
  useAutoReset(form, 10 * 60 * 1000);

  return (
    // ... UI формы
  );
}
```

## Сброс массивов

### Очистка элементов массива

```typescript
// Очистка массива созаемщиков
form.patchValue({
  coBorrowers: [],
});

// Или сброс к начальному состоянию
form.field('coBorrowers').reset();
```

### Сброс массива к элементам по умолчанию

```typescript
const defaultCoBorrowers = [
  {
    firstName: '',
    lastName: '',
    email: '',
    monthlyIncome: 0,
  },
];

form.patchValue({
  coBorrowers: defaultCoBorrowers,
});
```

## Лучшие практики

### 1. Подтверждение перед отменой изменений

```typescript
// ✅ Спрашивайте пользователя перед сбросом грязной формы
const handleCancel = () => {
  if (form.dirty.value) {
    if (confirm('Отменить несохраненные изменения?')) {
      form.reset();
      navigateBack();
    }
  } else {
    navigateBack();
  }
};

// ❌ Не отменяйте изменения молча
const handleCancel = () => {
  form.reset(); // Пользователь может потерять работу
  navigateBack();
};
```

### 2. Сброс после успешной отправки

```typescript
// ✅ Сброс после успеха
const handleSubmit = async () => {
  const result = await submitApplication(form.value.value);

  if (result.success) {
    form.reset();
    showSuccessMessage();
  } else {
    showError(result.error);
    // Не сбрасывайте - сохраните данные пользователя
  }
};

// ❌ Не сбрасывайте перед отправкой
const handleSubmit = async () => {
  const data = form.value.value;
  form.reset(); // Неправильное время!
  await submitApplication(data);
};
```

### 3. Используйте reset() для начальных значений

```typescript
// ✅ Сброс к дефолтам схемы
form.reset();

// ✅ Сброс к конкретным значениям
form.reset(loadedData);

// ❌ Не устанавливайте каждое поле вручную
form.setValue({
  loanType: 'consumer',
  loanAmount: 0,
  // ... утомительно и подвержено ошибкам
});
```

### 4. Очищайте ошибки отдельно при необходимости

```typescript
// ✅ Очищайте ошибки без сброса значений
form.clearErrors();

// ❌ Не сбрасывайте только для очистки ошибок
form.reset(); // Это также очистит все значения!
```

## Распространенные паттерны

### Сохранение черновика и сброс

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSaveDraft = async () => {
    const draft = form.value.value;
    await saveDraft(draft);

    // Пометить текущее состояние как сохраненное (чистое)
    form.markAsPristine();

    showMessage('Черновик сохранен');
  };

  const handleDiscard = () => {
    if (confirm('Удалить этот черновик?')) {
      form.reset();
      localStorage.removeItem('credit-application-draft');
    }
  };

  return (
    <>
      <FormContent form={form} />
      <button type="button" onClick={handleSaveDraft}>
        Сохранить черновик
      </button>
      <button type="button" onClick={handleDiscard}>
        Удалить черновик
      </button>
    </>
  );
}
```

### Сброс с диалогом подтверждения

```typescript
function ResetButton({ form }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    if (form.dirty.value) {
      setShowConfirm(true);
    } else {
      form.reset();
    }
  };

  const confirmReset = () => {
    form.reset();
    setShowConfirm(false);
    showMessage('Форма сброшена');
  };

  return (
    <>
      <button type="button" onClick={handleReset}>
        Сбросить форму
      </button>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmReset}
        title="Сбросить форму?"
        message="Все несохраненные изменения будут потеряны."
      />
    </>
  );
}
```

### Сброс отдельных полей

```typescript
function LoanDetailsSection({ form }: Props) {
  const resetLoanAmount = () => {
    // Сброс одного поля к дефолту схемы
    form.field('loanAmount').reset();
  };

  const resetAllLoanFields = () => {
    // Сброс нескольких связанных полей
    form.field('loanAmount').reset();
    form.field('loanTerm').reset();
    form.field('loanType').reset();
    form.field('loanPurpose').reset();
  };

  return (
    <section>
      <FormField control={form.control.loanAmount} />
      <button type="button" onClick={resetLoanAmount}>
        Сбросить сумму
      </button>
      <button type="button" onClick={resetAllLoanFields}>
        Сбросить все поля кредита
      </button>
    </section>
  );
}
```

## Отслеживание состояния сброса

### Показ индикатора сброса

```typescript
function FormHeader({ form }: Props) {
  const { value: dirty } = useFormControl(form.dirty);

  return (
    <div className="form-header">
      <h2>Кредитная заявка</h2>
      {dirty && (
        <span className="badge badge-warning">Несохраненные изменения</span>
      )}
    </div>
  );
}
```

### Предотвращение навигации с несохраненными изменениями

```typescript
import { useBlocker } from 'react-router-dom';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Блокировка навигации, если форма грязная
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      form.dirty.value && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const shouldLeave = confirm('У вас есть несохраненные изменения. Покинуть все равно?');

      if (shouldLeave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  return (
    // ... UI формы
  );
}
```

## Следующий шаг

Теперь, когда вы понимаете инициализацию и сброс форм, давайте изучим, как обрабатывать отправку формы и валидацию.
