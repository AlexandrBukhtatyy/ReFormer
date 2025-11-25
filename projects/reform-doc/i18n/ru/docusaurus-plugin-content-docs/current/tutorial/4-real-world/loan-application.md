---
sidebar_position: 1
---

# Форма заявки на кредит

В этом финальном уроке мы создадим полную форму заявки на кредит, демонстрирующую все концепции, изученные в этом туториале.

## Что мы построим

Многошаговую форму заявки на кредит с полной валидацией, вычисляемыми полями и условной логикой.

## Чему вы научитесь

При создании этой формы вы освоите:

- **Вложенные группы** — Организация сложных форм в логические секции (personalInfo, employment, loanDetails)
- **Динамические массивы** — Управление списками созаёмщиков с функциональностью добавления/удаления
- **Комплексная валидация** — Обязательные поля, паттерны, диапазоны и условная валидация с `when()`
- **Вычисляемые поля** — Автоматический расчёт ежемесячного платежа на основе суммы и срока кредита
- **Условная логика** — Показ/скрытие полей трудоустройства в зависимости от статуса занятости
- **Многошаговый мастер** — Навигация по шагам формы с валидацией и отслеживанием прогресса

## Шаг 1: Определение структуры данных

Сначала определим TypeScript интерфейс для данных нашей формы. Это обеспечивает типобезопасность и документирует структуру формы.

```typescript title="src/components/LoanApplication/form.ts"
interface LoanApplicationData {
  // Личная информация
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };

  // Информация о трудоустройстве
  employment: {
    status: 'employed' | 'self-employed' | 'retired' | 'unemployed';
    employerName: string;
    position: string;
    monthlyIncome: number;
    yearsEmployed: number;
  };

  // Детали кредита
  loanDetails: {
    amount: number;
    term: number; // месяцы
    purpose: string;
    monthlyPayment: number; // вычисляется
  };

  // Созаёмщики (динамический массив)
  coBorrowers: Array<{
    firstName: string;
    lastName: string;
    relationship: string;
  }>;
}
```

## Шаг 2: Создание структуры формы

Теперь создадим структуру формы используя декларативный синтаксис ReFormer. Обратите внимание как:

- Вложенные объекты становятся экземплярами `GroupNode`
- Массивы становятся экземплярами `ArrayNode` с шаблонами элементов
- Простые значения используют синтаксис `{ value: ... }`

```typescript
import { GroupNode } from 'reformer';

export const loanApplicationForm = new GroupNode<LoanApplicationData>({
  form: {
    personalInfo: {
      firstName: { value: '' },
      lastName: { value: '' },
      email: { value: '' },
      phone: { value: '' },
      dateOfBirth: { value: '' },
    },

    employment: {
      status: { value: 'employed' },
      employerName: { value: '' },
      position: { value: '' },
      monthlyIncome: { value: 0 },
      yearsEmployed: { value: 0 },
    },

    loanDetails: {
      amount: { value: 10000 },
      term: { value: 12 },
      purpose: { value: '' },
      monthlyPayment: { value: 0 },
    },

    coBorrowers: [
      {
        firstName: { value: '' },
        lastName: { value: '' },
        relationship: { value: '' },
      },
    ],
  },
});
```

## Шаг 3: Добавление валидации

Добавим комплексные правила валидации, включая условную валидацию для полей трудоустройства.

```typescript
import { required, email, min, max, minLength, pattern } from 'reformer/validators';

const phonePattern = /^\+?[\d\s\-()]+$/;

export const loanApplicationForm = new GroupNode<LoanApplicationData>({
  form: {
    /* ... из Шага 2 ... */
  },

  validation: (path, { when }) => {
    // Валидация личной информации
    required(path.personalInfo.firstName);
    minLength(path.personalInfo.firstName, 2);
    required(path.personalInfo.lastName);
    minLength(path.personalInfo.lastName, 2);
    required(path.personalInfo.email);
    email(path.personalInfo.email);
    required(path.personalInfo.phone);
    pattern(path.personalInfo.phone, phonePattern);
    required(path.personalInfo.dateOfBirth);

    // Валидация трудоустройства
    required(path.employment.status);
    required(path.employment.monthlyIncome);
    min(path.employment.monthlyIncome, 0);

    // Условная валидация: поля работодателя обязательны для работающих/самозанятых
    when(
      () => {
        const status = loanApplicationForm.controls.employment.controls.status.value;
        return status === 'employed' || status === 'self-employed';
      },
      (path) => {
        required(path.employment.employerName);
        required(path.employment.position);
        required(path.employment.yearsEmployed);
        min(path.employment.yearsEmployed, 0);
      }
    );

    // Валидация деталей кредита
    required(path.loanDetails.amount);
    min(path.loanDetails.amount, 1000);
    max(path.loanDetails.amount, 500000);
    required(path.loanDetails.term);
    min(path.loanDetails.term, 6);
    max(path.loanDetails.term, 360);
    required(path.loanDetails.purpose);
    minLength(path.loanDetails.purpose, 10);

    // Валидация созаёмщиков
    required(path.coBorrowers.$each.firstName);
    required(path.coBorrowers.$each.lastName);
    required(path.coBorrowers.$each.relationship);
  },
});
```

## Шаг 4: Добавление реактивного поведения

Настроим вычисляемые поля и условную видимость с помощью behaviors.

```typescript
import { computed, visible } from 'reformer/behaviors';

export const loanApplicationForm = new GroupNode<LoanApplicationData>({
  form: {
    /* ... */
  },
  validation: {
    /* ... */
  },

  behaviors: (path, { use }) => [
    // Показывать поля работодателя только для работающих/самозанятых
    use(
      visible(
        path.employment.employerName,
        [path.employment.status],
        (status) => status === 'employed' || status === 'self-employed'
      )
    ),

    use(
      visible(
        path.employment.position,
        [path.employment.status],
        (status) => status === 'employed' || status === 'self-employed'
      )
    ),

    use(
      visible(
        path.employment.yearsEmployed,
        [path.employment.status],
        (status) => status === 'employed' || status === 'self-employed'
      )
    ),

    // Вычислить ежемесячный платёж (упрощённая формула)
    use(
      computed(
        path.loanDetails.monthlyPayment,
        [path.loanDetails.amount, path.loanDetails.term],
        (amount, term) => {
          if (!amount || !term) return 0;
          const monthlyRate = 0.05 / 12; // годовая ставка 5%
          const payment =
            (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) /
            (Math.pow(1 + monthlyRate, term) - 1);
          return Math.round(payment * 100) / 100;
        }
      )
    ),
  ],
});
```

## Шаг 5: Создание компонентов шагов

Создадим отдельные компоненты для каждого шага мастера.

### Шаг 5.1: Личная информация

```tsx
import { useFormControl } from 'reformer';
import { loanApplicationForm } from './form';

function PersonalInfoStep() {
  const firstName = useFormControl(loanApplicationForm.controls.personalInfo.controls.firstName);
  const lastName = useFormControl(loanApplicationForm.controls.personalInfo.controls.lastName);
  const email = useFormControl(loanApplicationForm.controls.personalInfo.controls.email);
  const phone = useFormControl(loanApplicationForm.controls.personalInfo.controls.phone);
  const dateOfBirth = useFormControl(
    loanApplicationForm.controls.personalInfo.controls.dateOfBirth
  );

  return (
    <div className="step-content">
      <h2>Личная информация</h2>

      <div>
        <label htmlFor="firstName">Имя</label>
        <input
          id="firstName"
          value={firstName.value}
          onChange={(e) => firstName.setValue(e.target.value)}
          onBlur={() => firstName.markAsTouched()}
        />
        {firstName.touched && firstName.errors?.required && (
          <span className="error">Имя обязательно</span>
        )}
      </div>

      <div>
        <label htmlFor="lastName">Фамилия</label>
        <input
          id="lastName"
          value={lastName.value}
          onChange={(e) => lastName.setValue(e.target.value)}
          onBlur={() => lastName.markAsTouched()}
        />
        {lastName.touched && lastName.errors?.required && (
          <span className="error">Фамилия обязательна</span>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
          onBlur={() => email.markAsTouched()}
        />
        {email.touched && email.errors?.email && <span className="error">Некорректный email</span>}
      </div>

      <div>
        <label htmlFor="phone">Телефон</label>
        <input
          id="phone"
          value={phone.value}
          onChange={(e) => phone.setValue(e.target.value)}
          onBlur={() => phone.markAsTouched()}
        />
        {phone.touched && phone.errors?.pattern && (
          <span className="error">Некорректный формат телефона</span>
        )}
      </div>

      <div>
        <label htmlFor="dateOfBirth">Дата рождения</label>
        <input
          id="dateOfBirth"
          type="date"
          value={dateOfBirth.value}
          onChange={(e) => dateOfBirth.setValue(e.target.value)}
          onBlur={() => dateOfBirth.markAsTouched()}
        />
      </div>
    </div>
  );
}
```

### Шаг 5.2: Трудоустройство

Этот шаг демонстрирует условную видимость полей в зависимости от статуса занятости.

```tsx
function EmploymentStep() {
  const status = useFormControl(loanApplicationForm.controls.employment.controls.status);
  const employerName = useFormControl(
    loanApplicationForm.controls.employment.controls.employerName
  );
  const position = useFormControl(loanApplicationForm.controls.employment.controls.position);
  const monthlyIncome = useFormControl(
    loanApplicationForm.controls.employment.controls.monthlyIncome
  );
  const yearsEmployed = useFormControl(
    loanApplicationForm.controls.employment.controls.yearsEmployed
  );

  return (
    <div className="step-content">
      <h2>Информация о трудоустройстве</h2>

      <div>
        <label>Статус занятости</label>
        <select value={status.value} onChange={(e) => status.setValue(e.target.value as any)}>
          <option value="employed">Работаю</option>
          <option value="self-employed">Самозанятый</option>
          <option value="retired">На пенсии</option>
          <option value="unemployed">Безработный</option>
        </select>
      </div>

      {/* Условно видимые поля */}
      {employerName.visible && (
        <div>
          <label>Название работодателя</label>
          <input
            value={employerName.value}
            onChange={(e) => employerName.setValue(e.target.value)}
            onBlur={() => employerName.markAsTouched()}
          />
          {employerName.touched && employerName.errors?.required && (
            <span className="error">Название работодателя обязательно</span>
          )}
        </div>
      )}

      {position.visible && (
        <div>
          <label>Должность</label>
          <input
            value={position.value}
            onChange={(e) => position.setValue(e.target.value)}
            onBlur={() => position.markAsTouched()}
          />
          {position.touched && position.errors?.required && (
            <span className="error">Должность обязательна</span>
          )}
        </div>
      )}

      <div>
        <label>Ежемесячный доход (₽)</label>
        <input
          type="number"
          value={monthlyIncome.value}
          onChange={(e) => monthlyIncome.setValue(Number(e.target.value))}
        />
      </div>

      {yearsEmployed.visible && (
        <div>
          <label>Лет работы</label>
          <input
            type="number"
            value={yearsEmployed.value}
            onChange={(e) => yearsEmployed.setValue(Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}
```

### Шаг 5.3: Детали кредита

Этот шаг демонстрирует вычисляемое поле, которое автоматически рассчитывает ежемесячный платёж.

```tsx
function LoanDetailsStep() {
  const amount = useFormControl(loanApplicationForm.controls.loanDetails.controls.amount);
  const term = useFormControl(loanApplicationForm.controls.loanDetails.controls.term);
  const purpose = useFormControl(loanApplicationForm.controls.loanDetails.controls.purpose);
  const monthlyPayment = useFormControl(
    loanApplicationForm.controls.loanDetails.controls.monthlyPayment
  );

  return (
    <div className="step-content">
      <h2>Детали кредита</h2>

      <div>
        <label>Сумма кредита (₽)</label>
        <input
          type="number"
          value={amount.value}
          onChange={(e) => amount.setValue(Number(e.target.value))}
        />
        {amount.touched && amount.errors?.min && <span className="error">Минимум 1 000₽</span>}
        {amount.touched && amount.errors?.max && <span className="error">Максимум 500 000₽</span>}
      </div>

      <div>
        <label>Срок кредита (месяцев)</label>
        <input
          type="number"
          value={term.value}
          onChange={(e) => term.setValue(Number(e.target.value))}
        />
        {term.touched && term.errors?.min && <span className="error">Минимум 6 месяцев</span>}
      </div>

      <div>
        <label>Цель кредита</label>
        <textarea
          value={purpose.value}
          onChange={(e) => purpose.setValue(e.target.value)}
          onBlur={() => purpose.markAsTouched()}
          rows={3}
        />
        {purpose.touched && purpose.errors?.minLength && (
          <span className="error">Пожалуйста, опишите подробнее (минимум 10 символов)</span>
        )}
      </div>

      {/* Вычисляемое поле - обновляется автоматически */}
      <div className="computed-field">
        <label>Расчётный ежемесячный платёж</label>
        <strong>{monthlyPayment.value.toFixed(2)}₽</strong>
      </div>
    </div>
  );
}
```

### Шаг 5.4: Созаёмщики

Этот шаг демонстрирует работу с динамическими массивами - добавление и удаление элементов.

```tsx
function CoBorrowersStep() {
  const coBorrowers = useFormControl(loanApplicationForm.controls.coBorrowers);

  return (
    <div className="step-content">
      <h2>Созаёмщики (опционально)</h2>

      {coBorrowers.items.map((coBorrower, index) => {
        const firstName = useFormControl(coBorrower.controls.firstName);
        const lastName = useFormControl(coBorrower.controls.lastName);
        const relationship = useFormControl(coBorrower.controls.relationship);

        return (
          <div key={coBorrower.id} className="co-borrower">
            <h3>Созаёмщик {index + 1}</h3>

            <div>
              <label>Имя</label>
              <input
                value={firstName.value}
                onChange={(e) => firstName.setValue(e.target.value)}
                onBlur={() => firstName.markAsTouched()}
              />
              {firstName.touched && firstName.errors?.required && (
                <span className="error">Имя обязательно</span>
              )}
            </div>

            <div>
              <label>Фамилия</label>
              <input
                value={lastName.value}
                onChange={(e) => lastName.setValue(e.target.value)}
                onBlur={() => lastName.markAsTouched()}
              />
            </div>

            <div>
              <label>Отношение</label>
              <select
                value={relationship.value}
                onChange={(e) => relationship.setValue(e.target.value)}
              >
                <option value="">Выберите...</option>
                <option value="spouse">Супруг(а)</option>
                <option value="parent">Родитель</option>
                <option value="sibling">Брат/сестра</option>
                <option value="friend">Друг</option>
              </select>
            </div>

            <button type="button" onClick={() => coBorrowers.removeAt(index)}>
              Удалить созаёмщика
            </button>
          </div>
        );
      })}

      <button type="button" onClick={() => coBorrowers.push()}>
        Добавить созаёмщика
      </button>
    </div>
  );
}
```

## Шаг 6: Создание главного компонента мастера

Теперь соберём всё вместе в многошаговом мастере с навигацией и валидацией.

```tsx title="src/components/LoanApplication/index.tsx"
import { useState } from 'react';
import { loanApplicationForm } from './form';

export function LoanApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = () => {
    // Валидировать текущий шаг перед переходом
    const currentSection = getCurrentSection();
    currentSection.markAsTouched();

    if (currentSection.valid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loanApplicationForm.markAsTouched();

    if (!loanApplicationForm.valid) {
      return;
    }

    console.log('Заявка на кредит:', loanApplicationForm.value);
    alert('Заявка успешно отправлена!');
  };

  const getCurrentSection = () => {
    switch (currentStep) {
      case 1:
        return loanApplicationForm.controls.personalInfo;
      case 2:
        return loanApplicationForm.controls.employment;
      case 3:
        return loanApplicationForm.controls.loanDetails;
      default:
        return loanApplicationForm;
    }
  };

  return (
    <div className="loan-application">
      <h1>Заявка на кредит</h1>

      {/* Индикатор прогресса */}
      <div className="steps">
        <div className={currentStep >= 1 ? 'step active' : 'step'}>Личная информация</div>
        <div className={currentStep >= 2 ? 'step active' : 'step'}>Трудоустройство</div>
        <div className={currentStep >= 3 ? 'step active' : 'step'}>Детали кредита</div>
        <div className={currentStep >= 4 ? 'step active' : 'step'}>Созаёмщики</div>
      </div>

      <form onSubmit={handleSubmit}>
        {currentStep === 1 && <PersonalInfoStep />}
        {currentStep === 2 && <EmploymentStep />}
        {currentStep === 3 && <LoanDetailsStep />}
        {currentStep === 4 && <CoBorrowersStep />}

        {/* Навигация */}
        <div className="navigation">
          {currentStep > 1 && (
            <button type="button" onClick={handleBack}>
              Назад
            </button>
          )}

          {currentStep < 4 ? (
            <button type="button" onClick={handleNext}>
              Далее
            </button>
          ) : (
            <button type="submit" disabled={!loanApplicationForm.valid}>
              Отправить заявку
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
```

## Поздравляем!

Вы завершили туториал ReFormer и создали production-ready форму заявки на кредит!

## Следующие шаги

Продолжите ваше обучение:

- **[API Reference](/docs/api)** — Изучите полную документацию API
- **[Основные концепции](/docs/core-concepts/nodes)** — Углубите понимание узлов и реактивного состояния
- **[Паттерны](/docs/patterns/project-structure)** — Изучите лучшие практики организации сложных форм
- **[Стратегии валидации](/docs/validation/validation-strategies)** — Продвинутые техники валидации
- **Присоединяйтесь к сообществу** — Делитесь своими формами ReFormer и получайте помощь от других разработчиков!
