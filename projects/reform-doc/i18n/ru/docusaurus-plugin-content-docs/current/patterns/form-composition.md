---
sidebar_position: 3
---

# Композиция Форм

Компонуйте сложные формы из простых, переиспользуемых частей.

## Зачем Компоновать Формы?

Композиция форм помогает:

- Разбить большие формы на управляемые части
- Переиспользовать секции форм в разных формах
- Создавать многошаговые мастера
- Строить динамические формы, адаптирующиеся к вводу пользователя
- Поддерживать и тестировать меньшие единицы форм

## Базовая Композиция

Объедините простые схемы в сложную форму:

```typescript title="forms/registration-form.ts"
import { GroupNode } from 'reformer';
import { personSchema, type Person } from '../schemas/person-schema';
import { addressSchema, type Address } from '../schemas/address-schema';
import { validatePerson } from '../validators/person-validators';
import { validateAddress } from '../validators/address-validators';

interface RegistrationForm {
  personalInfo: Person;
  mailingAddress: Address;
  billingAddress: Address;
  sameAsMailingAddress: boolean;
}

export const createRegistrationForm = () =>
  new GroupNode<RegistrationForm>({
    form: {
      personalInfo: personSchema(),
      mailingAddress: addressSchema(),
      billingAddress: addressSchema(),
      sameAsMailingAddress: { value: true },
    },
    validation: (path) => {
      validatePerson(path.personalInfo);
      validateAddress(path.mailingAddress);

      // Валидировать адрес плательщика только если отличается
      when(
        () => !form.controls.sameAsMailingAddress.value.value,
        (path) => validateAddress(path.billingAddress)
      );
    },
    behaviors: (path, { use }) => [
      // Копировать адрес доставки в адрес плательщика при установке флажка
      use({
        key: 'syncAddresses',
        paths: [path.mailingAddress, path.sameAsMailingAddress],
        run: (values, ctx) => {
          if (values.sameAsMailingAddress) {
            const mailing = ctx.form.mailingAddress.getValue();
            ctx.form.billingAddress.setValue(mailing);
          }
        },
      }),
    ],
  });
```

## Многошаговый Мастер

Создайте многошаговую форму с навигацией:

```typescript title="forms/multi-step-wizard.ts"
import { GroupNode } from 'reformer';
import { signal } from '@preact/signals-core';

interface Step1Data {
  firstName: string;
  lastName: string;
  email: string;
}

interface Step2Data {
  company: string;
  position: string;
  experience: number;
}

interface Step3Data {
  street: string;
  city: string;
  zipCode: string;
}

interface WizardForm {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
}

export const createWizardForm = () => {
  const currentStep = signal(1);
  const completedSteps = signal<number[]>([]);

  const form = new GroupNode<WizardForm>({
    form: {
      step1: {
        firstName: { value: '' },
        lastName: { value: '' },
        email: { value: '' },
      },
      step2: {
        company: { value: '' },
        position: { value: '' },
        experience: { value: 0 },
      },
      step3: {
        street: { value: '' },
        city: { value: '' },
        zipCode: { value: '' },
      },
    },
    validation: (path) => {
      // Валидация шага 1
      required(path.step1.firstName);
      required(path.step1.lastName);
      required(path.step1.email);
      email(path.step1.email);

      // Валидация шага 2
      required(path.step2.company);
      required(path.step2.position);
      min(path.step2.experience, 0);

      // Валидация шага 3
      required(path.step3.street);
      required(path.step3.city);
      required(path.step3.zipCode);
      pattern(path.step3.zipCode, /^\d{6}$/, 'Неверный индекс');
    },
  });

  const nextStep = () => {
    const stepKey = `step${currentStep.value}` as keyof WizardForm;
    const stepNode = form.controls[stepKey];

    // Отметить поля шага как touched
    stepNode.markAsTouched();

    // Валидировать текущий шаг
    if (stepNode.valid.value) {
      completedSteps.value = [...completedSteps.value, currentStep.value];
      currentStep.value = Math.min(currentStep.value + 1, 3);
    }
  };

  const prevStep = () => {
    currentStep.value = Math.max(currentStep.value - 1, 1);
  };

  const goToStep = (step: number) => {
    if (completedSteps.value.includes(step - 1) || step === 1) {
      currentStep.value = step;
    }
  };

  return {
    form,
    currentStep,
    completedSteps,
    nextStep,
    prevStep,
    goToStep,
  };
};
```

### UI Компонент Мастера

```tsx title="components/WizardForm.tsx"
import { useFormControl } from 'reformer';
import { useSignal } from '@preact/signals-react';
import { createWizardForm } from '../forms/multi-step-wizard';

export function WizardForm() {
  const wizard = useMemo(() => createWizardForm(), []);
  const { form, currentStep, nextStep, prevStep, goToStep } = wizard;

  const step1 = useFormControl(form.controls.step1);
  const step2 = useFormControl(form.controls.step2);
  const step3 = useFormControl(form.controls.step3);

  return (
    <div className="wizard">
      {/* Индикатор шагов */}
      <div className="wizard__steps">
        {[1, 2, 3].map((step) => (
          <button
            key={step}
            onClick={() => goToStep(step)}
            className={currentStep.value === step ? 'active' : ''}
          >
            Шаг {step}
          </button>
        ))}
      </div>

      {/* Шаг 1: Личная информация */}
      {currentStep.value === 1 && (
        <div className="wizard__step">
          <h2>Личная информация</h2>
          <TextField field={step1.firstName} label="Имя" />
          <TextField field={step1.lastName} label="Фамилия" />
          <TextField field={step1.email} label="Email" type="email" />
        </div>
      )}

      {/* Шаг 2: Профессиональная информация */}
      {currentStep.value === 2 && (
        <div className="wizard__step">
          <h2>Профессиональная информация</h2>
          <TextField field={step2.company} label="Компания" />
          <TextField field={step2.position} label="Должность" />
          <NumberField field={step2.experience} label="Лет опыта" />
        </div>
      )}

      {/* Шаг 3: Адрес */}
      {currentStep.value === 3 && (
        <div className="wizard__step">
          <h2>Адрес</h2>
          <TextField field={step3.street} label="Улица" />
          <TextField field={step3.city} label="Город" />
          <TextField field={step3.zipCode} label="Индекс" />
        </div>
      )}

      {/* Навигация */}
      <div className="wizard__navigation">
        {currentStep.value > 1 && <button onClick={prevStep}>Назад</button>}
        {currentStep.value < 3 && <button onClick={nextStep}>Далее</button>}
        {currentStep.value === 3 && (
          <button onClick={() => console.log(form.getValue())}>Отправить</button>
        )}
      </div>
    </div>
  );
}
```

## Динамические Секции Формы

Добавление/удаление секций формы динамически:

```typescript title="forms/dynamic-education-form.ts"
import { GroupNode } from 'reformer';

interface Education {
  institution: string;
  degree: string;
  startDate: Date | null;
  endDate: Date | null;
}

interface EducationForm {
  educations: Education[];
}

export const createEducationForm = () =>
  new GroupNode<EducationForm>({
    form: {
      educations: [
        {
          institution: { value: '' },
          degree: { value: '' },
          startDate: { value: null },
          endDate: { value: null },
        },
      ],
    },
    validation: (path) => {
      required(path.educations.$each.institution);
      required(path.educations.$each.degree);
      required(path.educations.$each.startDate);
    },
  });
```

### UI Динамических Секций

```tsx title="components/EducationForm.tsx"
import { useFormControl } from 'reformer';
import { createEducationForm } from '../forms/dynamic-education-form';

export function EducationForm() {
  const form = useMemo(() => createEducationForm(), []);
  const educations = useFormControl(form.controls.educations);

  const addEducation = () => {
    form.controls.educations.push({
      institution: '',
      degree: '',
      startDate: null,
      endDate: null,
    });
  };

  const removeEducation = (index: number) => {
    form.controls.educations.removeAt(index);
  };

  return (
    <div className="education-form">
      <h2>Образование</h2>

      {educations.controls.map((education, index) => (
        <div key={education.id} className="education-form__item">
          <h3>Образование {index + 1}</h3>
          <TextField field={education.controls.institution} label="Учебное заведение" />
          <TextField field={education.controls.degree} label="Степень" />
          <DateField field={education.controls.startDate} label="Дата начала" />
          <DateField field={education.controls.endDate} label="Дата окончания" />

          {educations.controls.length > 1 && (
            <button onClick={() => removeEducation(index)}>Удалить</button>
          )}
        </div>
      ))}

      <button onClick={addEducation}>Добавить образование</button>
    </div>
  );
}
```

## Вложенные Формы с Вкладками

Создайте формы с вкладками и вложенными секциями:

```typescript title="forms/settings-form.ts"
import { GroupNode } from 'reformer';

interface ProfileSettings {
  displayName: string;
  bio: string;
  avatar: string;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showEmail: boolean;
  showPhone: boolean;
}

interface SettingsForm {
  profile: ProfileSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

export const createSettingsForm = () =>
  new GroupNode<SettingsForm>({
    form: {
      profile: {
        displayName: { value: '' },
        bio: { value: '' },
        avatar: { value: '' },
      },
      notifications: {
        email: { value: true },
        push: { value: false },
        sms: { value: false },
      },
      privacy: {
        profileVisibility: { value: 'public' },
        showEmail: { value: false },
        showPhone: { value: false },
      },
    },
    validation: (path) => {
      required(path.profile.displayName);
      minLength(path.profile.displayName, 3);
      maxLength(path.profile.bio, 500);
    },
  });
```

### UI Настроек с Вкладками

```tsx title="components/SettingsForm.tsx"
import { useState, useMemo } from 'react';
import { useFormControl } from 'reformer';
import { createSettingsForm } from '../forms/settings-form';

type Tab = 'profile' | 'notifications' | 'privacy';

export function SettingsForm() {
  const form = useMemo(() => createSettingsForm(), []);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const profile = useFormControl(form.controls.profile);
  const notifications = useFormControl(form.controls.notifications);
  const privacy = useFormControl(form.controls.privacy);

  const handleSave = () => {
    form.markAsTouched();
    if (form.valid.value) {
      console.log('Сохранение:', form.getValue());
    }
  };

  return (
    <div className="settings-form">
      {/* Вкладки */}
      <div className="settings-form__tabs">
        <button
          onClick={() => setActiveTab('profile')}
          className={activeTab === 'profile' ? 'active' : ''}
        >
          Профиль
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={activeTab === 'notifications' ? 'active' : ''}
        >
          Уведомления
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={activeTab === 'privacy' ? 'active' : ''}
        >
          Приватность
        </button>
      </div>

      {/* Содержимое */}
      <div className="settings-form__content">
        {activeTab === 'profile' && (
          <div>
            <TextField field={profile.displayName} label="Отображаемое имя" />
            <TextareaField field={profile.bio} label="О себе" />
            <FileUploadField field={profile.avatar} label="Аватар" />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <Checkbox field={notifications.email} label="Email уведомления" />
            <Checkbox field={notifications.push} label="Push уведомления" />
            <Checkbox field={notifications.sms} label="SMS уведомления" />
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <Select
              field={privacy.profileVisibility}
              label="Видимость профиля"
              options={[
                { value: 'public', label: 'Публичный' },
                { value: 'private', label: 'Приватный' },
                { value: 'friends', label: 'Только друзья' },
              ]}
            />
            <Checkbox field={privacy.showEmail} label="Показывать Email" />
            <Checkbox field={privacy.showPhone} label="Показывать телефон" />
          </div>
        )}
      </div>

      <button onClick={handleSave}>Сохранить настройки</button>
    </div>
  );
}
```

## Условные Секции

Показ/скрытие секций формы на основе условий:

```typescript title="forms/job-application-form.ts"
import { GroupNode } from 'reformer';

interface JobApplication {
  hasExperience: boolean;
  experience?: {
    years: number;
    companies: string[];
  };
  needsVisa: boolean;
  visaInfo?: {
    country: string;
    type: string;
  };
}

export const createJobApplicationForm = () =>
  new GroupNode<JobApplication>({
    form: {
      hasExperience: { value: false },
      experience: {
        years: { value: 0 },
        companies: [{ value: '' }],
      },
      needsVisa: { value: false },
      visaInfo: {
        country: { value: '' },
        type: { value: '' },
      },
    },
    validation: (path) => {
      // Условная валидация
      when(
        () => form.controls.hasExperience.value.value,
        (path) => {
          required(path.experience.years);
          min(path.experience.years, 1);
          required(path.experience.companies.$each);
        }
      );

      when(
        () => form.controls.needsVisa.value.value,
        (path) => {
          required(path.visaInfo.country);
          required(path.visaInfo.type);
        }
      );
    },
    behaviors: (path, { use }) => [
      // Показ/скрытие секции опыта
      use({
        key: 'toggleExperience',
        paths: [path.hasExperience],
        run: (values, ctx) => {
          const visible = values.hasExperience;
          ctx.form.experience.setVisible(visible);
        },
      }),

      // Показ/скрытие секции визы
      use({
        key: 'toggleVisa',
        paths: [path.needsVisa],
        run: (values, ctx) => {
          const visible = values.needsVisa;
          ctx.form.visaInfo.setVisible(visible);
        },
      }),
    ],
  });
```

## Паттерн Расширения Формы

Расширьте базовые формы дополнительными полями:

```typescript title="forms/base-user-form.ts"
import { GroupNode, FormSchema } from 'reformer';

export interface BaseUser {
  email: string;
  firstName: string;
  lastName: string;
}

export const baseUserSchema = (): FormSchema<BaseUser> => ({
  email: { value: '' },
  firstName: { value: '' },
  lastName: { value: '' },
});

export function createBaseUserForm() {
  return new GroupNode<BaseUser>({
    form: baseUserSchema(),
    validation: (path) => {
      required(path.email);
      email(path.email);
      required(path.firstName);
      required(path.lastName);
    },
  });
}
```

```typescript title="forms/admin-user-form.ts"
import { GroupNode } from 'reformer';
import { baseUserSchema, type BaseUser } from './base-user-form';

interface AdminUser extends BaseUser {
  role: 'admin' | 'superadmin';
  permissions: string[];
}

export function createAdminUserForm() {
  return new GroupNode<AdminUser>({
    form: {
      ...baseUserSchema(),
      role: { value: 'admin' },
      permissions: [{ value: '' }],
    },
    validation: (path) => {
      // Базовая валидация
      required(path.email);
      email(path.email);
      required(path.firstName);
      required(path.lastName);

      // Специфичная для администратора валидация
      required(path.role);
      required(path.permissions.$each);
    },
  });
}
```

## Общее Состояние Между Формами

Разделяйте данные между несколькими формами:

```typescript title="forms/checkout-forms.ts"
import { GroupNode } from 'reformer';
import { signal } from '@preact/signals-core';

// Общее состояние
const sharedCheckoutData = signal({
  customerEmail: '',
  saveForLater: false,
});

// Шаг 1: Форма доставки
export function createShippingForm() {
  return new GroupNode({
    form: {
      email: { value: sharedCheckoutData.value.customerEmail },
      address: {
        street: { value: '' },
        city: { value: '' },
        zipCode: { value: '' },
      },
    },
    behaviors: (path, { use }) => [
      // Сохранить email в общее состояние
      use({
        key: 'syncEmail',
        paths: [path.email],
        run: (values) => {
          sharedCheckoutData.value = {
            ...sharedCheckoutData.value,
            customerEmail: values.email,
          };
        },
      }),
    ],
  });
}

// Шаг 2: Форма оплаты
export function createPaymentForm() {
  return new GroupNode({
    form: {
      email: { value: sharedCheckoutData.value.customerEmail },
      cardNumber: { value: '' },
      expiryDate: { value: '' },
      cvv: { value: '' },
    },
  });
}
```

## Лучшие Практики

### 1. Держите Модули Форм Маленькими

```typescript
// ✅ Хорошо - сфокусированные модули
import { personalInfoSchema } from './schemas/personal-info';
import { addressSchema } from './schemas/address';
import { paymentSchema } from './schemas/payment';

// ❌ Плохо - всё в одном файле
const massiveSchema = {
  // 500 строк определений схем
};
```

### 2. Используйте Композицию Вместо Дублирования

```typescript
// ✅ Хорошо - композиция из переиспользуемых частей
const registrationForm = {
  personal: personSchema(),
  contact: contactSchema(),
  address: addressSchema(),
};

// ❌ Плохо - повторение определений схем
const registrationForm = {
  firstName: { value: '' },
  lastName: { value: '' },
  email: { value: '' },
  phone: { value: '' },
  // ... повторяющиеся поля
};
```

### 3. Разделяйте Ответственности

```typescript
// ✅ Хорошо - отдельные файлы
// schema.ts - структура формы
// validators.ts - логика валидации
// behaviors.ts - реактивная логика
// index.ts - публичный API

// ❌ Плохо - всё смешано вместе
const form = new GroupNode({
  form: {
    // 100 строк схемы
  },
  validation: () => {
    // 100 строк валидации
  },
  behaviors: () => {
    // 100 строк поведений
  },
});
```

### 4. Типизируйте Составные Формы

```typescript
// ✅ Хорошо - типизированная композиция
interface RegistrationForm {
  personal: Person;
  contact: ContactInfo;
  address: Address;
}

const form = new GroupNode<RegistrationForm>({
  form: {
    personal: personSchema(),
    contact: contactSchema(),
    address: addressSchema(),
  },
});

// Полная типобезопасность
const email: string = form.controls.contact.controls.email.value.value;
```

### 5. Документируйте Композицию

```typescript
/**
 * Форма регистрации с тремя секциями:
 * - Personal: firstName, lastName, birthDate
 * - Contact: email, phone, preferredContact
 * - Address: street, city, state, zipCode
 *
 * Поведения:
 * - Автоформатирование номера телефона
 * - Проверка доступности email (async)
 */
export function createRegistrationForm() {
  // ...
}
```

## Следующие Шаги

- [Переиспользуемые Схемы](/docs/patterns/reusable-schemas) — Создание переиспользуемых частей форм
- [Стратегии Валидации](/docs/validation/validation-strategies) — Продвинутые паттерны валидации
- [Кастомные Поведения](/docs/behaviors/custom) — Добавление реактивной логики к составным формам
