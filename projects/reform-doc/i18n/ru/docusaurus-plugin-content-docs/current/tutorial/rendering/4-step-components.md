---
sidebar_position: 4
---

# Компоненты шагов

Создание отдельных компонентов шагов для многошаговой формы.

## Обзор

Каждый компонент шага:

- Получает экземпляр формы через проп `control`
- Отображает свои поля с помощью `FormField`
- Может показывать/скрывать поля на основе значений формы
- Использует `useFormControl` для подписки на изменения значений

## Структура компонента шага

Все компоненты шагов следуют одному паттерну:

```tsx
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface StepProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function StepName({ control }: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Заголовок шага</h2>

      <FormField control={control.fieldName} />
      {/* Другие поля... */}
    </div>
  );
}
```

## Шаг 1: Основная информация о кредите

Первый шаг собирает данные о кредите с условными полями:

```tsx title="src/steps/BasicInfoForm.tsx"
import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface BasicInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  // Подписка на изменения loanType
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Основная информация о кредите</h2>

      {/* Общие поля */}
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      <FormField control={control.loanTerm} />
      <FormField control={control.loanPurpose} />

      {/* Условные поля: Ипотека */}
      {loanType === 'mortgage' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о недвижимости</h3>
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </>
      )}

      {/* Условные поля: Автокредит */}
      {loanType === 'car' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация об автомобиле</h3>
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} />
            <FormField control={control.carPrice} />
          </div>
        </>
      )}
    </div>
  );
}
```

### Ключевые моменты

1. **`useFormControl`** — подписывается на изменения значения поля и вызывает ре-рендер
2. **Условный рендеринг** — показ/скрытие полей на основе `loanType`
3. **Grid-раскладка** — использование CSS grid для полей рядом

## Шаг 2: Персональные данные

Этот шаг демонстрирует использование вложенных форм:

```tsx title="src/steps/PersonalInfoForm.tsx"
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { PersonalDataForm } from '../nested-forms/PersonalDataForm';
import { PassportDataForm } from '../nested-forms/PassportDataForm';
import type { CreditApplicationForm } from '../types';

interface PersonalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function PersonalInfoForm({ control }: PersonalInfoFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Персональные данные</h2>

      {/* Вложенная форма: Личные данные */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Личные данные</h3>
        <PersonalDataForm control={control.personalData} />
      </div>

      {/* Вложенная форма: Паспортные данные */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Паспортные данные</h3>
        <PassportDataForm control={control.passportData} />
      </div>

      {/* Дополнительные документы */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Дополнительные документы</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.inn} />
          <FormField control={control.snils} />
        </div>
      </div>
    </div>
  );
}
```

## Шаг 3: Контактная информация

Демонстрирует переиспользование вложенных форм и операции с группами:

```tsx title="src/steps/ContactInfoForm.tsx"
import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { AddressForm } from '../nested-forms/AddressForm';
import type { CreditApplicationForm } from '../types';

interface ContactInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  // Копировать адрес регистрации в адрес проживания
  const copyAddress = () => {
    const regAddress = control.registrationAddress.getValue();
    control.residenceAddress.setValue(regAddress);
  };

  // Очистить адрес проживания
  const clearAddress = () => {
    control.residenceAddress.reset();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Контактная информация</h2>

      {/* Телефоны */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Телефоны</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.phoneMain} />
          <FormField control={control.phoneAdditional} />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Email</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.email} />
          <FormField control={control.emailAdditional} />
        </div>
      </div>

      {/* Адрес регистрации */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Адрес регистрации</h3>
        <AddressForm control={control.registrationAddress} />
      </div>

      {/* Чекбокс "совпадает" */}
      <FormField control={control.sameAsRegistration} />

      {/* Адрес проживания (условный) */}
      {!sameAsRegistration && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Адрес проживания</h3>
            <button
              type="button"
              onClick={copyAddress}
              className="text-sm text-blue-600 hover:underline"
            >
              Скопировать из регистрации
            </button>
          </div>

          <AddressForm control={control.residenceAddress} />

          <button
            type="button"
            onClick={clearAddress}
            className="text-sm text-gray-600 hover:underline"
          >
            Очистить
          </button>
        </div>
      )}
    </div>
  );
}
```

### Операции с группами

- **`getValue()`** — получить все значения из вложенной группы
- **`setValue()`** — установить все значения во вложенной группе
- **`reset()`** — сбросить группу к начальным значениям

## Шаг 4: Информация о занятости

Показывает условные секции на основе статуса занятости:

```tsx title="src/steps/EmploymentForm.tsx"
import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface EmploymentFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function EmploymentForm({ control }: EmploymentFormProps) {
  const { value: employmentStatus } = useFormControl(control.employmentStatus);

  const isEmployed = employmentStatus === 'employed';
  const isSelfEmployed = employmentStatus === 'selfEmployed';

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Информация о занятости</h2>

      <FormField control={control.employmentStatus} />

      {/* Секция для работающих */}
      {isEmployed && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold">Информация о компании</h3>
          <FormField control={control.companyName} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.companyInn} />
            <FormField control={control.companyPhone} />
          </div>
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.workExperienceTotal} />
            <FormField control={control.workExperienceCurrent} />
          </div>
        </div>
      )}

      {/* Секция для самозанятых */}
      {isSelfEmployed && (
        <div className="space-y-4 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold">Информация о бизнесе</h3>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </div>
      )}

      {/* Секция дохода (для работающих и самозанятых) */}
      {(isEmployed || isSelfEmployed) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Доход</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.monthlyIncome} />
            <FormField control={control.additionalIncome} />
          </div>
          <FormField control={control.additionalIncomeSource} />
        </div>
      )}
    </div>
  );
}
```

## Шаг 5: Дополнительная информация

Демонстрирует работу с массивами (рассматривается в следующем разделе):

```tsx title="src/steps/AdditionalInfoForm.tsx"
import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { FormArraySection } from '../components/FormArraySection';
import { PropertyForm } from '../nested-forms/PropertyForm';
import { ExistingLoanForm } from '../nested-forms/ExistingLoanForm';
import { CoBorrowerForm } from '../nested-forms/CoBorrowerForm';
import type { CreditApplicationForm } from '../types';

interface AdditionalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasExistingLoans } = useFormControl(control.hasExistingLoans);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Дополнительная информация</h2>

      {/* Общая информация */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Общие сведения</h3>
        <FormField control={control.maritalStatus} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.dependents} />
          <FormField control={control.education} />
        </div>
      </div>

      {/* Массив имущества */}
      <div className="space-y-4">
        <FormField control={control.hasProperty} />
        {hasProperty && (
          <FormArraySection
            title="Имущество"
            control={control.properties}
            itemComponent={PropertyForm}
            addButtonLabel="+ Добавить имущество"
          />
        )}
      </div>

      {/* Массив существующих кредитов */}
      <div className="space-y-4">
        <FormField control={control.hasExistingLoans} />
        {hasExistingLoans && (
          <FormArraySection
            title="Существующие кредиты"
            control={control.existingLoans}
            itemComponent={ExistingLoanForm}
            addButtonLabel="+ Добавить кредит"
          />
        )}
      </div>

      {/* Массив созаёмщиков */}
      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />
        {hasCoBorrower && (
          <FormArraySection
            title="Созаёмщики"
            control={control.coBorrowers}
            itemComponent={CoBorrowerForm}
            addButtonLabel="+ Добавить созаёмщика"
          />
        )}
      </div>
    </div>
  );
}
```

## Шаг 6: Подтверждение

Финальный шаг со всеми согласиями:

```tsx title="src/steps/ConfirmationForm.tsx"
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface ConfirmationFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ConfirmationForm({ control }: ConfirmationFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Подтверждение</h2>

      <div className="space-y-4">
        <FormField control={control.agreePersonalData} />
        <FormField control={control.agreeCreditHistory} />
        <FormField control={control.agreeMarketing} />
        <FormField control={control.agreeTerms} />
        <FormField control={control.confirmAccuracy} />
      </div>

      <div className="mt-6">
        <FormField control={control.electronicSignature} />
      </div>
    </div>
  );
}
```

## Лучшие практики

### 1. Используйте семантические секции

Группируйте связанные поля с заголовками:

```tsx
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Заголовок секции</h3>
  <FormField control={control.field1} />
  <FormField control={control.field2} />
</div>
```

### 2. Используйте Grid для раскладки

Используйте CSS grid для полей рядом:

```tsx
<div className="grid grid-cols-2 gap-4">
  <FormField control={control.firstName} />
  <FormField control={control.lastName} />
</div>
```

### 3. Условный рендеринг с `useFormControl`

Подписывайтесь только на нужные поля:

```tsx
const { value: status } = useFormControl(control.status);

// Ре-рендер только при изменении status
{status === 'active' && <ActiveSection />}
```

### 4. Выделяйте переиспользуемые паттерны

Если используете один и тот же layout несколько раз, выделите его:

```tsx
function TwoColumnFields({ left, right }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField control={left} />
      <FormField control={right} />
    </div>
  );
}
```

## Следующий шаг

Теперь давайте узнаем, как создавать переиспользуемые вложенные компоненты форм и работать с массивами.
