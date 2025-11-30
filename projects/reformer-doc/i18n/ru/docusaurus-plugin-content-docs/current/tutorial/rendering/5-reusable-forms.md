---
sidebar_position: 5
---

# Переиспользуемые формы

Создание переиспользуемых вложенных компонентов форм и работа с массивами.

## Обзор

Переиспользуемые компоненты форм:

- Инкапсулируют группу связанных полей
- Могут использоваться многократно в разных контекстах
- Принимают проп `control`, типизированный под их структуру

Этот паттерн необходим для:

- Уменьшения дублирования кода
- Обеспечения единообразной раскладки полей
- Управления массивами сложных объектов

## Как работают вложенные формы

Паттерн вложенных форм состоит из трёх частей:

1. **Интерфейс пропсов** — определяет тип `control` через `GroupNodeWithControls<T>`
2. **Компонент** — отвечает только за layout полей, используя `FormField`
3. **Мемоизация** — оборачиваем в `memo()` для предотвращения лишних ре-рендеров

```tsx
// 1. Интерфейс пропсов
interface MyFormProps {
  control: GroupNodeWithControls<MyType>;
}

// 2. Компонент
const MyFormComponent = ({ control }: MyFormProps) => {
  return (
    <div className="space-y-4">
      <FormField control={control.field1} />
      <FormField control={control.field2} />
    </div>
  );
};

// 3. Мемоизация
export const MyForm = memo(MyFormComponent);
```

### Использование вложенной формы

Вложенная форма используется в родительском компоненте через передачу `control`:

```tsx
import { MyForm } from './sub-forms/MyForm';

export function ParentForm({ control }: ParentFormProps) {
  return (
    <div className="space-y-6">
      <h3>Секция 1</h3>
      <MyForm control={control.section1} />

      <h3>Секция 2</h3>
      <MyForm control={control.section2} />
    </div>
  );
}
```

## Где применять вложенные формы

- **Адреса** — регистрации, проживания, доставки
- **Персональные данные** — для заёмщика, созаёмщика, контактного лица
- **Документы** — паспорт, права, СНИЛС
- **Повторяющиеся блоки** — имущество, кредиты, источники дохода

## Реализация форм по туториалу

Все формы находятся в `reformer-tutorial/src/forms/credit-application/sub-forms/`.

### AddressForm

Форма адреса — регион, город, улица, дом, квартира, индекс.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/AddressForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { Address } from '../types/credit-application.types';

interface AddressFormProps {
  control: GroupNodeWithControls<Address>;
}

const AddressFormComponent = ({ control }: AddressFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.region} />
        <FormField control={control.city} />
      </div>

      <FormField control={control.street} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.house} />
        <FormField control={control.apartment} />
        <FormField control={control.postalCode} />
      </div>
    </div>
  );
};

export const AddressForm = memo(AddressFormComponent);
```

### PersonalDataForm

Персональные данные — ФИО, дата рождения, место рождения, пол.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/PersonalDataForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { PersonalData } from '../types/credit-application.types';

interface PersonalDataFormProps {
  control: GroupNodeWithControls<PersonalData>;
}

const PersonalDataFormComponent = ({ control }: PersonalDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.lastName} />
        <FormField control={control.firstName} />
        <FormField control={control.middleName} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.birthDate} />
        <FormField control={control.birthPlace} />
      </div>

      <FormField control={control.gender} />
    </div>
  );
};

export const PersonalDataForm = memo(PersonalDataFormComponent);
```

### PassportDataForm

Паспортные данные — серия, номер, дата выдачи, код подразделения, кем выдан.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/PassportDataForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { PassportData } from '../types/credit-application.types';

interface PassportDataFormProps {
  control: GroupNodeWithControls<PassportData>;
}

const PassportDataFormComponent = ({ control }: PassportDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.series} />
        <FormField control={control.number} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.issueDate} />
        <FormField control={control.departmentCode} />
      </div>

      <FormField control={control.issuedBy} />
    </div>
  );
};

export const PassportDataForm = memo(PassportDataFormComponent);
```

### CoBorrowerForm

Данные созаёмщика — персональные данные, телефон, email, родство, доход.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/CoBorrowerForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { CoBorrower } from '../types/credit-application.types';

interface CoBorrowerFormProps {
  control: GroupNodeWithControls<CoBorrower>;
}

const CoBorrowerFormComponent = ({ control }: CoBorrowerFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
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

### PropertyForm

Информация об имуществе — тип, стоимость, описание, обременение.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/PropertyForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { Property } from '../types/credit-application.types';

interface PropertyFormProps {
  control: GroupNodeWithControls<Property>;
}

const PropertyFormComponent = ({ control }: PropertyFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.type} />
        <FormField control={control.estimatedValue} />
      </div>

      <FormField control={control.description} />

      <FormField control={control.hasEncumbrance} />
    </div>
  );
};

export const PropertyForm = memo(PropertyFormComponent);
```

### ExistingLoanForm

Существующие кредиты — банк, тип, сумма, остаток, платёж, дата погашения.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/ExistingLoanForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { ExistingLoan } from '../types/credit-application.types';

interface ExistingLoanFormProps {
  control: GroupNodeWithControls<ExistingLoan>;
}

const ExistingLoanFormComponent = ({ control }: ExistingLoanFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.bank} />
        <FormField control={control.type} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.amount} />
        <FormField control={control.remainingAmount} />
        <FormField control={control.monthlyPayment} />
      </div>

      <FormField control={control.maturityDate} />
    </div>
  );
};

export const ExistingLoanForm = memo(ExistingLoanFormComponent);
```

## Работа с массивами

### Операции с массивами

`ArrayNodeWithControls` предоставляет следующие операции:

| Метод             | Описание                                                   |
| ----------------- | ---------------------------------------------------------- |
| `push()`          | Добавить новый элемент со значениями по умолчанию из схемы |
| `removeAt(index)` | Удалить элемент по указанному индексу                      |
| `map(callback)`   | Итерация по элементам массива                              |
| `length`          | Получить текущую длину массива                             |

### FormArrayManager

Универсальный компонент для управления массивами форм:

```tsx title="reformer-tutorial/src/components/ui/FormArrayManager.tsx"
import type { ComponentType } from 'react';
import {
  useFormControl,
  type ArrayNode,
  type FormFields,
  type GroupNodeWithControls,
} from 'reformer';
import { Button } from '@/components/ui/button';

interface FormArrayManagerProps {
  control: ArrayNode<FormFields>;
  component: ComponentType<{ control: GroupNodeWithControls<FormFields> }>;
  itemLabel?: string;
  addButtonLabel?: string;
  emptyMessage?: string;
}

export function FormArrayManager({
  control,
  component: ItemComponent,
  itemLabel = 'Элемент',
  addButtonLabel = '+ Добавить',
  emptyMessage = 'Нет элементов. Нажмите кнопку выше, чтобы добавить.',
}: FormArrayManagerProps) {
  const { length } = useFormControl(control);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {length} {itemLabel}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => control.push()}>
          {addButtonLabel}
        </Button>
      </div>

      {control.map((itemControl: GroupNodeWithControls<FormFields>, index: number) => {
        const key = itemControl.id || index;

        return (
          <div key={key} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-gray-900">
                {itemLabel} #{index + 1}
              </h4>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => control.removeAt(index)}
              >
                Удалить
              </Button>
            </div>

            <ItemComponent control={itemControl} />
          </div>
        );
      })}

      {length === 0 && (
        <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
```

### Использование FormArrayManager

```tsx title="reformer-tutorial/src/forms/credit-application/steps/AdditionalInfoForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import { FormArrayManager } from '@/components/forms/FormArrayManager';
import { PropertyForm } from '../sub-forms/PropertyForm';
import { CoBorrowerForm } from '../sub-forms/CoBorrowerForm';

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      <FormField control={control.hasProperty} />
      {hasProperty && (
        <FormArrayManager
          control={control.properties}
          component={PropertyForm}
          itemLabel="Имущество"
          addButtonLabel="+ Добавить имущество"
          emptyMessage="Нажмите для добавления информации об имуществе"
        />
      )}

      <FormField control={control.hasCoBorrower} />
      {hasCoBorrower && (
        <FormArrayManager
          control={control.coBorrowers}
          component={CoBorrowerForm}
          itemLabel="Созаёмщик"
          addButtonLabel="+ Добавить созаёмщика"
          emptyMessage="Нажмите для добавления информации о созаёмщике"
        />
      )}
    </div>
  );
}
```

## Лучшие практики

### 1. Всегда используйте memo()

Оборачивайте вложенные компоненты форм в `memo` для предотвращения лишних ре-рендеров:

```tsx
const AddressFormComponent = ({ control }: AddressFormProps) => { ... };

export const AddressForm = memo(AddressFormComponent);
```

### 2. Типизируйте пропсы через GroupNodeWithControls

```tsx
interface MyFormProps {
  control: GroupNodeWithControls<MyType>;
}
```

### 3. Используйте уникальные ключи для элементов массива

Используйте свойство `id` из контролов как ключи вместо индекса массива:

```tsx
{
  control.map((itemControl, index) => <div key={itemControl.id || index}>...</div>);
}
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
