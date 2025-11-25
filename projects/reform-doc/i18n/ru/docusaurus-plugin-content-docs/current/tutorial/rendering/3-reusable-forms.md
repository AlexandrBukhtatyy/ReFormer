---
sidebar_position: 3
---

# Переиспользуемые формы

Создание переиспользуемых вложенных компонентов форм и работа с массивами.

## Обзор

Переиспользуемые компоненты форм:
- Инкапсулируют группу связанных полей
- Могут использоваться многократно в разных контекстах
- Принимают проп `control`, типизированный под их структуру
- Экспортируют и схему, и компонент

Этот паттерн необходим для:
- Уменьшения дублирования кода
- Обеспечения единообразной раскладки полей
- Управления массивами сложных объектов

## Вложенные компоненты форм

### Создание переиспользуемой формы адреса

Создадим компонент `AddressForm`, который можно переиспользовать для адреса регистрации и проживания:

```tsx title="src/nested-forms/AddressForm.tsx"
import { memo } from 'react';
import type { FormSchema, GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { InputMask } from '@/components/ui/input-mask';

// 1. Определяем тип
export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
}

// 2. Определяем переиспользуемую схему
export const addressFormSchema: FormSchema<Address> = {
  region: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Регион',
      placeholder: 'Введите регион',
    },
  },
  city: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Город',
      placeholder: 'Введите город',
    },
  },
  street: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Улица',
      placeholder: 'Введите улицу',
    },
  },
  house: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дом',
      placeholder: '№',
    },
  },
  apartment: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Квартира',
      placeholder: '№',
    },
  },
  postalCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Индекс',
      placeholder: '000000',
      mask: '999999',
    },
  },
};

// 3. Определяем интерфейс пропсов
interface AddressFormProps {
  control: GroupNodeWithControls<Address>;
  testIdPrefix?: string;
}

// 4. Создаём компонент
const AddressFormComponent = ({ control, testIdPrefix = 'address' }: AddressFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.region} testId={`${testIdPrefix}-region`} />
        <FormField control={control.city} testId={`${testIdPrefix}-city`} />
      </div>

      <FormField control={control.street} testId={`${testIdPrefix}-street`} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.house} testId={`${testIdPrefix}-house`} />
        <FormField control={control.apartment} testId={`${testIdPrefix}-apartment`} />
        <FormField control={control.postalCode} testId={`${testIdPrefix}-postalCode`} />
      </div>
    </div>
  );
};

// 5. Мемоизируем для предотвращения лишних ре-рендеров
export const AddressForm = memo(AddressFormComponent);
```

### Использование вложенных форм в родительской схеме

Импортируйте и используйте вложенную схему в родительской форме:

```tsx title="src/schemas/create-credit-application-form.ts"
import { addressFormSchema, type Address } from '../nested-forms/AddressForm';

interface CreditApplicationForm {
  // ... другие поля
  registrationAddress: Address;
  residenceAddress: Address;
}

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ... другие поля

  // Используем переиспользуемую схему
  registrationAddress: addressFormSchema,
  residenceAddress: addressFormSchema,
};
```

### Использование в компонентах шагов

```tsx title="src/steps/ContactInfoForm.tsx"
import { AddressForm } from '../nested-forms/AddressForm';

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  return (
    <div className="space-y-6">
      {/* Адрес регистрации */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Адрес регистрации</h3>
        <AddressForm
          control={control.registrationAddress}
          testIdPrefix="registrationAddress"
        />
      </div>

      {/* Адрес проживания */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Адрес проживания</h3>
        <AddressForm
          control={control.residenceAddress}
          testIdPrefix="residenceAddress"
        />
      </div>
    </div>
  );
}
```

## Вложенные структуры с группами

Для сложных вложенных структур можно вкладывать группы внутри формы:

```tsx title="src/nested-forms/CoBorrowerForm.tsx"
import { memo } from 'react';
import type { FormSchema, GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

// Вложенная структура с группами
export interface CoBorrower {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

export const coBorrowerFormSchema: FormSchema<CoBorrower> = {
  // Вложенная группа
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date' },
    },
  },
  phone: {
    value: '',
    component: Input,
    componentProps: { label: 'Телефон', placeholder: '+7 (___) ___-__-__' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  relationship: {
    value: 'spouse',
    component: Select,
    componentProps: {
      label: 'Отношение к заёмщику',
      options: [
        { value: 'spouse', label: 'Супруг(а)' },
        { value: 'parent', label: 'Родитель' },
        { value: 'sibling', label: 'Брат/сестра' },
        { value: 'other', label: 'Другое' },
      ],
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный доход', type: 'number', min: 0 },
  },
};

interface CoBorrowerFormProps {
  control: GroupNodeWithControls<CoBorrower>;
}

const CoBorrowerFormComponent = ({ control }: CoBorrowerFormProps) => {
  return (
    <div className="space-y-3">
      {/* Доступ к полям вложенной группы */}
      <div className="grid grid-cols-3 gap-3">
        <FormField control={control.personalData.lastName} />
        <FormField control={control.personalData.firstName} />
        <FormField control={control.personalData.middleName} />
      </div>

      <FormField control={control.personalData.birthDate} />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.phone} />
        <FormField control={control.email} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.relationship} />
        <FormField control={control.monthlyIncome} />
      </div>
    </div>
  );
};

export const CoBorrowerForm = memo(CoBorrowerFormComponent);
```

## Работа с массивами

### Определение массива в схеме

Определяйте массивы в схеме с помощью обёртки `array`:

```tsx title="src/schemas/create-credit-application-form.ts"
import { array } from 'reformer';
import { propertyFormSchema, type Property } from '../nested-forms/PropertyForm';
import { coBorrowerFormSchema, type CoBorrower } from '../nested-forms/CoBorrowerForm';

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },

  // Массив имущества
  properties: array(propertyFormSchema),

  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть созаёмщик' },
  },

  // Массив созаёмщиков
  coBorrowers: array(coBorrowerFormSchema),
};
```

### Операции с массивами

`ArrayNodeWithControls` предоставляет следующие операции:

| Метод | Описание |
|-------|----------|
| `push()` | Добавить новый элемент со значениями по умолчанию из схемы |
| `removeAt(index)` | Удалить элемент по указанному индексу |
| `map(callback)` | Итерация по элементам массива |
| `length` | Получить текущую длину массива |

### Компонент FormArrayManager

Создайте переиспользуемый компонент для рендеринга элементов массива:

```tsx title="src/components/FormArrayManager.tsx"
import type { ComponentType } from 'react';
import { useFormControl, type ArrayNode, type FormFields, type GroupNodeWithControls } from 'reformer';
import { Button } from '@/components/ui/button';

interface FormArrayManagerProps {
  control: ArrayNode<FormFields>;
  component: ComponentType<{ control: unknown }>;
  itemLabel?: string;
  renderTitle?: (index: number) => string;
}

export function FormArrayManager({
  control,
  component: ItemComponent,
  itemLabel = 'Элемент',
  renderTitle,
}: FormArrayManagerProps) {
  // Подписка на изменения длины массива
  const { length } = useFormControl(control);

  return (
    <>
      {control.map((itemControl: GroupNodeWithControls<FormFields>, index: number) => {
        const title = renderTitle ? renderTitle(index) : `${itemLabel} #${index + 1}`;
        const key = itemControl.id || index;

        return (
          <div key={key} className="mb-4 p-4 bg-white rounded border">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">{title}</h4>
              <Button onClick={() => control.removeAt(index)}>Удалить</Button>
            </div>

            <ItemComponent control={itemControl} />
          </div>
        );
      })}
    </>
  );
}
```

### Компонент FormArraySection

Компонент более высокого уровня, объединяющий управление массивом с UI секции:

```tsx title="src/components/FormArraySection.tsx"
import {
  useFormControl,
  type ArrayNodeWithControls,
  type FormFields,
  type GroupNodeWithControls,
} from 'reformer';
import type { ComponentType } from 'react';
import { FormArrayManager } from './FormArrayManager';
import { Button } from '@/components/ui/button';

interface FormArraySectionProps<T extends object> {
  title: string;
  control: ArrayNodeWithControls<FormFields> | undefined;
  itemComponent: ComponentType<{ control: GroupNodeWithControls<T> }>;
  itemLabel: string;
  addButtonLabel: string;
  emptyMessage: string;
  hasItems: boolean;
}

export function FormArraySection<T extends object>({
  title,
  control,
  itemComponent,
  itemLabel,
  addButtonLabel,
  emptyMessage,
  hasItems,
}: FormArraySectionProps<T>) {
  const { length } = useFormControl(control);

  if (!hasItems || !control) {
    return null;
  }

  const isEmpty = length === 0;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={() => control.push()}>{addButtonLabel}</Button>
      </div>

      <FormArrayManager
        control={control}
        component={itemComponent}
        itemLabel={itemLabel}
      />

      {isEmpty && (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
```

### Использование массивов в компонентах шагов

```tsx title="src/steps/AdditionalInfoForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { FormArraySection } from '../components/FormArraySection';
import { PropertyForm } from '../nested-forms/PropertyForm';
import { CoBorrowerForm } from '../nested-forms/CoBorrowerForm';

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      {/* Массив имущества */}
      <div className="space-y-4">
        <FormField control={control.hasProperty} />
        {hasProperty && (
          <FormArraySection
            title="Имущество"
            control={control.properties}
            itemComponent={PropertyForm}
            itemLabel="Имущество"
            addButtonLabel="+ Добавить имущество"
            emptyMessage="Нажмите для добавления информации об имуществе"
            hasItems={hasProperty}
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
            itemLabel="Созаёмщик"
            addButtonLabel="+ Добавить созаёмщика"
            emptyMessage="Нажмите для добавления информации о созаёмщике"
            hasItems={hasCoBorrower}
          />
        )}
      </div>
    </div>
  );
}
```

## Лучшие практики

### 1. Всегда экспортируйте схему и тип

Экспортируйте и схему, и TypeScript интерфейс для переиспользования:

```tsx
// Экспорт типа для типизации
export interface Address { ... }

// Экспорт схемы для композиции форм
export const addressFormSchema: FormSchema<Address> = { ... }

// Экспорт компонента для рендеринга
export const AddressForm = memo(AddressFormComponent);
```

### 2. Используйте мемоизацию

Оборачивайте вложенные компоненты форм в `memo` для предотвращения лишних ре-рендеров:

```tsx
const AddressFormComponent = ({ control }: AddressFormProps) => { ... };

export const AddressForm = memo(AddressFormComponent);
```

### 3. Используйте уникальные ключи для элементов массива

Используйте свойство `id` из контролов как ключи вместо индекса массива:

```tsx
{control.map((itemControl, index) => (
  <div key={itemControl.id || index}>
    ...
  </div>
))}
```

### 4. Подписывайтесь на длину массива

При рендеринге массивов подписывайтесь на свойство `length` для триггера ре-рендеров при добавлении или удалении элементов:

```tsx
const { length } = useFormControl(control);
```

### 5. Сохраняйте фокус компонентов

Каждый вложенный компонент формы должен обрабатывать только свои поля. Не передавайте всю форму во вложенные компоненты.

## Следующий шаг

Теперь, когда вы понимаете, как создавать переиспользуемые формы и работать с массивами, давайте перейдём к добавлению поведений к полям формы.
