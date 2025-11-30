---
sidebar_position: 1
---

# Загрузка данных

Как загрузить данные из API и заполнить форму.

## Обзор

В предыдущих разделах туториала мы создали форму заявки на кредит с вложенными структурами: `personalData`, `passportData` и `registrationAddress`. Теперь научимся загружать данные в эту форму из API.

ReFormer предоставляет два метода:

- `setValue()` - полностью заменить значение (поле, группа или форма)
- `patchValue()` - частично обновить значения (только указанные поля)

## Мок API сервис

Создадим мок-сервис, который возвращает данные, соответствующие структуре формы:

```typescript title="reformer-tutorial/src/forms/credit-application/services/api.ts"
import type { CreditApplicationForm } from '../types/credit-application.types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Получить профиль текущего пользователя
 * Используется для предзаполнения формы новой заявки
 */
export async function fetchUserProfile(): Promise<UserProfile> {
  await delay(500);

  return {
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: 'Петрович',
    email: 'ivan.ivanov@example.com',
    phone: '+79001234567',
    birthDate: '1990-05-15',
  };
}

/**
 * Получить существующую заявку по ID
 * Используется для редактирования заявки
 */
export async function fetchApplication(id: string): Promise<ApiApplicationData> {
  await delay(800);

  // Мок-данные существующей заявки
  return {
    loanType: 'consumer',
    loanAmount: 500000,
    loanTerm: 24,
    loanPurpose: 'Ремонт квартиры',
    propertyValue: 0,
    initialPayment: 0,
    carBrand: '',
    carModel: '',
    carYear: 0,
    carPrice: 0,
    personalData: {
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Петрович',
      birthDate: '1990-05-15',
      birthPlace: 'г. Москва',
      gender: 'male',
    },
    passportData: {
      series: '4515',
      number: '123456',
      issueDate: '2015-03-20',
      issuedBy: 'ОВД г. Москвы',
      departmentCode: '770-001',
    },
    inn: '123456789012',
    snils: '12345678901',
    phoneMain: '+79001234567',
    phoneAdditional: '',
    email: 'ivan.ivanov@example.com',
    emailAdditional: '',
    registrationAddress: {
      region: 'Москва',
      city: 'Москва',
      street: 'ул. Ленина',
      house: '10',
      apartment: '25',
      postalCode: '123456',
    },
    sameAsRegistration: true,
    residenceAddress: {
      region: 'Москва',
      city: 'Москва',
      street: 'ул. Ленина',
      house: '10',
      apartment: '25',
      postalCode: '123456',
    },
    employmentStatus: 'employed',
    companyName: 'ООО Рога и Копыта',
    companyInn: '1234567890',
    companyPhone: '+74951234567',
    companyAddress: 'г. Москва, ул. Тверская, 1',
    position: 'Менеджер',
    workExperienceTotal: 60,
    workExperienceCurrent: 24,
    monthlyIncome: 100000,
    additionalIncome: 0,
    additionalIncomeSource: '',
    businessType: '',
    businessInn: '',
    businessActivity: '',
    maritalStatus: 'married',
    dependents: 1,
    education: 'higher',
    hasProperty: false,
    properties: [],
    hasExistingLoans: false,
    existingLoans: [],
    hasCoBorrower: false,
    coBorrowers: [],
    agreePersonalData: false,
    agreeCreditHistory: false,
    agreeMarketing: false,
    agreeTerms: false,
    confirmAccuracy: false,
    electronicSignature: '',
  };
}

/**
 * Сохранить заявку на сервер
 */
export async function saveApplication(
  data: ApiApplicationData
): Promise<{ id: string; status: string }> {
  await delay(1000);

  // Имитация отправки на сервер
  console.log('Отправка заявки на сервер:', data);

  // Возвращаем ID созданной заявки
  return {
    id: 'app-' + Date.now(),
    status: 'pending',
  };
}
```

## Заполнение формы данными

Существует 2 способа заполнения формы данными это `setValue(value)` и `patchValue(value)`.
`setValue(value)` - Заполняет все поля
`patchValue(value)` - заполняет только те поля которые есть в переданном значении

### Использование setValue()

`setValue(value)` полностью заменяет значение любого контрола (поле, группа или форма):

```typescript
// Установка всей формы
form.setValue(applicationData);

// Установка вложенной группы
form.personalData.setValue({
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: 'Петрович',
  birthDate: new Date('1990-05-15'),
  birthPlace: 'Москва',
  gender: 'male',
});

// Установка одного поля
form.loanAmount.setValue(500000);

// Установка с опциями
form.email.setValue('user@example.com', {
  emitEvent: false, // Не триггерить валидацию
});
```

### Использование patchValue()

`patchValue(value)` обновляет только указанные поля, остальные остаются без изменений:

```typescript
// Обновление только персональных данных
form.patchValue({
  personalData: {
    firstName: 'Иван',
    lastName: 'Иванов',
  },
  email: 'ivan@example.com',
  phoneMain: '+79001234567',
});

// Остальные поля (loanAmount, passportData и т.д.) не изменяются
```

### Загрузка полной заявки

```tsx title="reformer-tutorial/src/forms/credit-application/CreditApplicationForm.tsx"
interface CreditApplicationFormProps {
  applicationId: string;
}

function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Создаём экземпляр формы
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Ref для доступа к методам навигации
  const navRef = useRef<StepNavigationHandle<CreditApplicationFormType>>(null);

  // Отправка формы
  const handleSubmit = async (values: CreditApplicationFormType) => {
    ...
  };

  // Загрузка формы
  useEffect(() => {
    async function loadApplication() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchApplication(applicationId);

        // Загрузка всех данных в форму
        form.setValue(data);
      } catch (error: unknown) {
        console.error(error);
        setError('Не удалось загрузить заявку');
      } finally {
        setIsLoading(false);
      }
    }

    loadApplication();
  }, [form, applicationId]);

  if (isLoading) {
    return <div>Загрузка заявки...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <StepNavigation ref={navRef} form={form} config={STEP_CONFIG}>
      ...
    </StepNavigation>
  );
}

export default CreditApplicationForm;
```

## Ключевые моменты

1. **`setValue()`** - полностью заменяет значение (работает с любым контролом)
2. **`patchValue()`** - частичное обновление (только указанные поля)
3. Оба метода работают с вложенными структурами (`personalData`, `passportData` и т.д.)
4. Оба метода по умолчанию триггерят валидацию
5. Используйте `{ emitEvent: false }` чтобы пропустить валидацию при загрузке
6. Всегда обрабатывайте состояния загрузки и ошибок

## Следующие шаги

- [Преобразование данных](./2-data-transformation.md) - Конвертация данных между форматами формы и API
- [Валидация и сохранение](./3-validation-and-saving.md) - Валидация и отправка данных формы
