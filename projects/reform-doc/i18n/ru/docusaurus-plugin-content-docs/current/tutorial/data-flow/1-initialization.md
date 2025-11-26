---
sidebar_position: 1
---

# Инициализация формы

Загрузка и инициализация данных формы из различных источников.

## Обзор

Формы часто нужно инициализировать существующими данными:

- **Режим редактирования** - Загрузка существующей заявки на кредит для редактирования
- **Восстановление черновика** - Восстановление ранее сохраненного черновика
- **Частичное предзаполнение** - Предзаполнение некоторых полей (например, из профиля пользователя)
- **Значения по умолчанию** - Установка начальных значений в схеме

## Установка начальных значений в схеме

Самый простой способ инициализации через свойство `value` схемы:

```typescript title="src/schemas/credit-application-schema.ts"
import type { FormSchema } from 'reformer';

interface CreditApplicationForm {
  loanType: 'consumer' | 'mortgage' | 'car';
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
}

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  loanType: {
    value: 'consumer', // Значение по умолчанию
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский кредит' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
      ],
    },
  },
  loanAmount: {
    value: 100000, // По умолчанию 100,000
    component: Input,
    componentProps: {
      label: 'Сумма кредита',
      type: 'number',
    },
  },
  loanTerm: {
    value: 12, // По умолчанию 12 месяцев
    component: Input,
    componentProps: {
      label: 'Срок (месяцев)',
      type: 'number',
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход',
      type: 'number',
    },
  },
};
```

## setValue - Полная замена

Используйте `setValue` для замены всего значения формы:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useEffect } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';

interface CreditApplicationFormProps {
  applicationId?: string;
}

function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    if (applicationId) {
      // Загрузка существующей заявки
      loadApplication(applicationId).then((data) => {
        // Замена всего значения формы
        form.setValue(data);
      });
    }
  }, [applicationId, form]);

  return (
    // ... UI формы
  );
}

async function loadApplication(id: string) {
  const response = await fetch(`/api/applications/${id}`);
  return response.json();
}
```

### setValue с опциями

Управление способом установки значения:

```typescript
// Установка значения без пометки как тронутое
form.setValue(data, { markAsTouched: false });

// Установка значения с генерацией событий
form.setValue(data, { emitEvent: true });

// Установка значения без запуска валидации
form.setValue(data, { validate: false });
```

## patchValue - Частичное обновление

Используйте `patchValue` для обновления только определенных полей:

```typescript title="src/components/ApplicantInfoStep.tsx"
import { useEffect } from 'react';

function ApplicantInfoStep({ form }: ApplicantInfoStepProps) {
  useEffect(() => {
    // Предзаполнение из профиля пользователя
    const userProfile = getCurrentUserProfile();

    if (userProfile) {
      // Обновление только полей персональной информации
      form.patchValue({
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        middleName: userProfile.middleName,
        birthDate: userProfile.birthDate,
        email: userProfile.email,
        phoneMain: userProfile.phone,
      });
    }
  }, [form]);

  return (
    // ... UI шага
  );
}
```

### Обновление вложенных объектов

Частичное обновление вложенных объектов:

```typescript
// Обновление только города в адресе регистрации
form.patchValue({
  registrationAddress: {
    city: 'Москва',
  },
});

// Другие поля адреса остаются без изменений
```

### Обновление массивов

Обновление конкретных элементов массива:

```typescript
// Обновление дохода первого созаемщика
form.patchValue({
  coBorrowers: [
    { monthlyIncome: 50000 }, // Первый элемент
    undefined, // Пропуск второго элемента
    { monthlyIncome: 60000 }, // Третий элемент
  ],
});
```

## Загрузка с API

### Простая загрузка

```typescript title="src/hooks/useLoadApplication.ts"
import { useEffect, useState } from 'react';
import type { FormNode } from 'reformer';

export function useLoadApplication(
  form: FormNode<CreditApplicationForm>,
  applicationId?: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!applicationId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/applications/${applicationId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Не удалось загрузить заявку');
        return res.json();
      })
      .then((data) => {
        form.setValue(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [applicationId, form]);

  return { loading, error };
}
```

Использование:

```typescript
function CreditApplicationForm({ applicationId }: Props) {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { loading, error } = useLoadApplication(form, applicationId);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <FormContent form={form} />;
}
```

### Загрузка с трансформацией

Трансформация данных API перед установкой:

```typescript title="src/utils/transform-application.ts"
interface ApiApplication {
  id: string;
  loan_amount: number; // snake_case из API
  loan_term: number;
  applicant: {
    first_name: string;
    last_name: string;
    birth_date: string;
  };
}

export function transformApiToForm(
  apiData: ApiApplication
): Partial<CreditApplicationForm> {
  return {
    loanAmount: apiData.loan_amount,
    loanTerm: apiData.loan_term,
    firstName: apiData.applicant.first_name,
    lastName: apiData.applicant.last_name,
    birthDate: apiData.applicant.birth_date,
  };
}

// Использование
loadApplication(id).then((apiData) => {
  const formData = transformApiToForm(apiData);
  form.setValue(formData);
});
```

## Автосохранение и восстановление черновика

### Сохранение черновика

```typescript title="src/hooks/useAutoSaveDraft.ts"
import { useEffect } from 'react';
import { debounce } from 'lodash';

export function useAutoSaveDraft(
  form: FormNode<CreditApplicationForm>,
  draftKey: string
) {
  useEffect(() => {
    // Функция сохранения с дебаунсом
    const saveDraft = debounce(() => {
      const value = form.value.value;
      localStorage.setItem(draftKey, JSON.stringify(value));
      console.log('Черновик сохранен');
    }, 1000);

    // Подписка на изменения формы
    const subscription = form.value.subscribe(() => {
      saveDraft();
    });

    return () => {
      subscription.unsubscribe();
      saveDraft.cancel();
    };
  }, [form, draftKey]);
}
```

### Восстановление черновика

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<CreditApplicationForm | null>(null);

  useEffect(() => {
    // Проверка сохраненного черновика
    const savedDraft = localStorage.getItem('credit-application-draft');

    if (savedDraft) {
      try {
        const data = JSON.parse(savedDraft);
        setDraftData(data);
        setShowDraftPrompt(true);
      } catch (error) {
        console.error('Не удалось разобрать черновик', error);
      }
    }
  }, []);

  const handleRestoreDraft = () => {
    if (draftData) {
      form.setValue(draftData);
      setShowDraftPrompt(false);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('credit-application-draft');
    setShowDraftPrompt(false);
  };

  // Автосохранение черновика
  useAutoSaveDraft(form, 'credit-application-draft');

  return (
    <>
      {showDraftPrompt && (
        <DraftPrompt
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardDraft}
        />
      )}
      <FormContent form={form} />
    </>
  );
}
```

## Условная инициализация

### На основе типа пользователя

```typescript
function CreditApplicationForm({ userType }: Props) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    if (userType === 'returning') {
      // Предзаполнение из предыдущей заявки
      loadPreviousApplication().then((data) => {
        form.patchValue({
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          email: data.email,
          phoneMain: data.phoneMain,
        });
      });
    } else if (userType === 'employee') {
      // Предвыбор конкретного типа кредита для сотрудников
      form.patchValue({
        loanType: 'consumer',
        employmentStatus: 'employed',
      });
    }
  }, [form, userType]);

  return <FormContent form={form} />;
}
```

### На основе параметров URL

```typescript
import { useSearchParams } from 'react-router-dom';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Предзаполнение из параметров URL
    const loanType = searchParams.get('loanType');
    const amount = searchParams.get('amount');

    if (loanType || amount) {
      form.patchValue({
        loanType: loanType as any,
        loanAmount: amount ? parseInt(amount) : undefined,
      });
    }
  }, [form, searchParams]);

  return <FormContent form={form} />;
}
```

## Лучшие практики

### 1. Используйте setValue для полных данных

```typescript
// ✅ Используйте setValue при загрузке полной заявки
loadApplication(id).then((data) => {
  form.setValue(data);
});

// ❌ Не используйте patchValue для полной замены
loadApplication(id).then((data) => {
  form.patchValue(data); // Может оставить старые данные в нетронутых полях
});
```

### 2. Используйте patchValue для частичных обновлений

```typescript
// ✅ Используйте patchValue для частичных обновлений
form.patchValue({
  loanAmount: 150000,
});

// ❌ Не используйте setValue для частичных обновлений
form.setValue({
  loanAmount: 150000,
  // Все остальные поля будут undefined!
});
```

### 3. Трансформируйте данные API

```typescript
// ✅ Трансформируйте перед установкой
const formData = transformApiToForm(apiData);
form.setValue(formData);

// ❌ Не устанавливайте данные API напрямую
form.setValue(apiData); // Имена полей могут не совпадать
```

### 4. Обрабатывайте состояния загрузки

```typescript
// ✅ Показывайте индикатор загрузки
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
return <FormContent form={form} />;

// ❌ Не показывайте форму во время загрузки
return (
  <>
    {loading && <LoadingSpinner />}
    <FormContent form={form} /> {/* Показывает пустую форму во время загрузки */}
  </>
);
```

### 5. Валидируйте после загрузки

```typescript
// ✅ Опционально валидируйте после установки данных
form.setValue(data);
await form.validate();

// Проверьте, валидны ли загруженные данные
if (!form.valid.value) {
  console.warn('Загруженная заявка содержит ошибки валидации');
}
```

## Распространенные паттерны

### Режим редактирования vs создания

```typescript
interface FormProps {
  mode: 'create' | 'edit';
  applicationId?: string;
}

function CreditApplicationForm({ mode, applicationId }: FormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  useEffect(() => {
    if (mode === 'edit' && applicationId) {
      loadApplication(applicationId).then((data) => {
        form.setValue(data);
      });
    } else {
      // Режим создания - используйте значения по умолчанию из схемы
      // Или предзаполните из профиля пользователя
      const profile = getUserProfile();
      if (profile) {
        form.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
        });
      }
    }
  }, [mode, applicationId, form]);

  return <FormContent form={form} />;
}
```

### Многошаговая форма с сохранением прогресса

```typescript
function MultiStepForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [currentStep, setCurrentStep] = useState(1);

  // Сохранение прогресса на каждом шаге
  const handleNextStep = async () => {
    await form.validate();

    if (form.valid.value) {
      // Сохранение текущего состояния
      await saveProgress(form.value.value);
      setCurrentStep((prev) => prev + 1);
    }
  };

  // Загрузка прогресса при монтировании
  useEffect(() => {
    loadProgress().then((data) => {
      if (data) {
        form.setValue(data.formData);
        setCurrentStep(data.step);
      }
    });
  }, [form]);

  return (
    <Stepper currentStep={currentStep}>
      {/* Компоненты шагов */}
    </Stepper>
  );
}
```

## Следующий шаг

Теперь, когда вы понимаете инициализацию формы, давайте изучим, как сбрасывать формы и восстанавливать значения по умолчанию.
