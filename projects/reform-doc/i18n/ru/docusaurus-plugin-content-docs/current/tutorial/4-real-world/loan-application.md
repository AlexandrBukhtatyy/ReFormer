---
sidebar_position: 1
---

# Форма заявки на кредит

В этом финальном уроке мы создадим полную форму заявки на кредит, демонстрирующую все концепции, изученные в этом туториале.

## Что мы построим

Многошаговую форму заявки на кредит с:
- **Вложенными группами** для организации секций
- **Динамическими массивами** для созаемщиков и источников дохода
- **Валидацией** на всех уровнях
- **Вычисляемыми полями** для расчета кредита
- **Условной логикой** для деталей трудоустройства
- **Многошаговым интерфейсом-мастером**

## Структура формы

```typescript title="src/components/LoanApplication/form.ts"
import { GroupNode } from 'reformer';
import { required, email, min, max, minLength, pattern } from 'reformer/validators';
import { computed, visible } from 'reformer/behaviors';

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

  // Созаемщики (динамический массив)
  coBorrowers: Array<{
    firstName: string;
    lastName: string;
    relationship: string;
  }>;
}

const phonePattern = /^\+?[\d\s\-()]+$/;

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

    coBorrowers: [{
      firstName: { value: '' },
      lastName: { value: '' },
      relationship: { value: '' },
    }],
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

    // Условная: поля работодателя обязательны для занятых/самозанятых
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

    // Валидация созаемщиков
    required(path.coBorrowers.$each.firstName);
    required(path.coBorrowers.$each.lastName);
    required(path.coBorrowers.$each.relationship);
  },

  behaviors: (path, { use }) => [
    // Показывать поля работодателя только для занятых/самозанятых
    use(visible(
      path.employment.employerName,
      [path.employment.status],
      (status) => status === 'employed' || status === 'self-employed'
    )),

    use(visible(
      path.employment.position,
      [path.employment.status],
      (status) => status === 'employed' || status === 'self-employed'
    )),

    use(visible(
      path.employment.yearsEmployed,
      [path.employment.status],
      (status) => status === 'employed' || status === 'self-employed'
    )),

    // Рассчитать ежемесячный платеж (упрощенная формула)
    use(computed(
      path.loanDetails.monthlyPayment,
      [path.loanDetails.amount, path.loanDetails.term],
      (amount, term) => {
        if (!amount || !term) return 0;
        const monthlyRate = 0.05 / 12; // 5% годовая ставка
        const payment = (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                       (Math.pow(1 + monthlyRate, term) - 1);
        return Math.round(payment * 100) / 100;
      }
    )),
  ],
});
```

## Многошаговый компонент

```tsx title="src/components/LoanApplication/index.tsx"
import { useState } from 'react';
import { useFormControl } from 'reformer';
import { loanApplicationForm } from './form';

export function LoanApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = () => {
    // Валидировать текущий шаг перед продолжением
    const currentSection = getCurrentSection();
    currentSection.markAllAsTouched();

    if (currentSection.valid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loanApplicationForm.markAllAsTouched();

    if (!loanApplicationForm.valid) {
      return;
    }

    console.log('Заявка на кредит:', loanApplicationForm.value);
    alert('Заявка успешно отправлена!');
  };

  const getCurrentSection = () => {
    switch (currentStep) {
      case 1: return loanApplicationForm.controls.personalInfo;
      case 2: return loanApplicationForm.controls.employment;
      case 3: return loanApplicationForm.controls.loanDetails;
      default: return loanApplicationForm;
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
        <div className={currentStep >= 4 ? 'step active' : 'step'}>Созаемщики</div>
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

// Шаг 1: Личная информация
function PersonalInfoStep() {
  const firstName = useFormControl(loanApplicationForm.controls.personalInfo.controls.firstName);
  const lastName = useFormControl(loanApplicationForm.controls.personalInfo.controls.lastName);
  const email = useFormControl(loanApplicationForm.controls.personalInfo.controls.email);
  const phone = useFormControl(loanApplicationForm.controls.personalInfo.controls.phone);
  const dateOfBirth = useFormControl(loanApplicationForm.controls.personalInfo.controls.dateOfBirth);

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
        {email.touched && email.errors?.email && (
          <span className="error">Некорректный email</span>
        )}
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

// Шаг 2: Трудоустройство (с условными полями)
function EmploymentStep() {
  const status = useFormControl(loanApplicationForm.controls.employment.controls.status);
  const employerName = useFormControl(loanApplicationForm.controls.employment.controls.employerName);
  const position = useFormControl(loanApplicationForm.controls.employment.controls.position);
  const monthlyIncome = useFormControl(loanApplicationForm.controls.employment.controls.monthlyIncome);
  const yearsEmployed = useFormControl(loanApplicationForm.controls.employment.controls.yearsEmployed);

  return (
    <div className="step-content">
      <h2>Информация о трудоустройстве</h2>

      <div>
        <label>Статус трудоустройства</label>
        <select
          value={status.value}
          onChange={(e) => status.setValue(e.target.value as any)}
        >
          <option value="employed">Работает</option>
          <option value="self-employed">Самозанятый</option>
          <option value="retired">На пенсии</option>
          <option value="unemployed">Безработный</option>
        </select>
      </div>

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
        <label>Ежемесячный доход ($)</label>
        <input
          type="number"
          value={monthlyIncome.value}
          onChange={(e) => monthlyIncome.setValue(Number(e.target.value))}
        />
      </div>

      {yearsEmployed.visible && (
        <div>
          <label>Лет на работе</label>
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

// Шаг 3: Детали кредита (с вычисляемым ежемесячным платежом)
function LoanDetailsStep() {
  const amount = useFormControl(loanApplicationForm.controls.loanDetails.controls.amount);
  const term = useFormControl(loanApplicationForm.controls.loanDetails.controls.term);
  const purpose = useFormControl(loanApplicationForm.controls.loanDetails.controls.purpose);
  const monthlyPayment = useFormControl(loanApplicationForm.controls.loanDetails.controls.monthlyPayment);

  return (
    <div className="step-content">
      <h2>Детали кредита</h2>

      <div>
        <label>Сумма кредита ($)</label>
        <input
          type="number"
          value={amount.value}
          onChange={(e) => amount.setValue(Number(e.target.value))}
        />
        {amount.touched && amount.errors?.min && (
          <span className="error">Минимум $1,000</span>
        )}
        {amount.touched && amount.errors?.max && (
          <span className="error">Максимум $500,000</span>
        )}
      </div>

      <div>
        <label>Срок кредита (месяцев)</label>
        <input
          type="number"
          value={term.value}
          onChange={(e) => term.setValue(Number(e.target.value))}
        />
        {term.touched && term.errors?.min && (
          <span className="error">Минимум 6 месяцев</span>
        )}
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
          <span className="error">Укажите больше деталей (минимум 10 символов)</span>
        )}
      </div>

      {/* Вычисляемое поле */}
      <div className="computed-field">
        <label>Предполагаемый ежемесячный платеж</label>
        <strong>${monthlyPayment.value.toFixed(2)}</strong>
      </div>
    </div>
  );
}

// Шаг 4: Созаемщики (динамический массив)
function CoBorrowersStep() {
  const coBorrowers = useFormControl(loanApplicationForm.controls.coBorrowers);

  return (
    <div className="step-content">
      <h2>Созаемщики (необязательно)</h2>

      {coBorrowers.items.map((coBorrower, index) => {
        const firstName = useFormControl(coBorrower.controls.firstName);
        const lastName = useFormControl(coBorrower.controls.lastName);
        const relationship = useFormControl(coBorrower.controls.relationship);

        return (
          <div key={coBorrower.id} className="co-borrower">
            <h3>Созаемщик {index + 1}</h3>

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
              <label>Родство</label>
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

            <button
              type="button"
              onClick={() => coBorrowers.removeAt(index)}
            >
              Удалить созаемщика
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => coBorrowers.push()}
      >
        Добавить созаемщика
      </button>
    </div>
  );
}
```

## Ключевые продемонстрированные возможности

### 1. Вложенные группы
```typescript
personalInfo: { ... }  // Вложенный объект становится группой
employment: { ... }    // Вложенный объект становится группой
loanDetails: { ... }   // Вложенный объект становится группой
```

### 2. Динамические массивы
```typescript
coBorrowers: [{        // Синтаксис массива с шаблоном элемента
  firstName: { value: '' },
  lastName: { value: '' },
  relationship: { value: '' },
}]
```

### 3. Валидация
- Обязательные поля
- Паттерны email и телефона
- Числовые диапазоны (min/max)
- Условная валидация с `when`

### 4. Вычисляемые поля
```typescript
use(computed(
  path.loanDetails.monthlyPayment,
  [path.loanDetails.amount, path.loanDetails.term],
  (amount, term) => calculatePayment(amount, term)
))
```

### 5. Условная логика
```typescript
use(visible(
  path.employment.employerName,
  [path.employment.status],
  (status) => status === 'employed' || status === 'self-employed'
))
```

### 6. Многошаговый мастер
- Пошаговая навигация
- Валидация на уровне секций
- Индикатор прогресса
- Состояние формы сохраняется между шагами

## Поздравляем!

Вы завершили туториал по ReFormer! Теперь вы знаете, как:
- ✅ Создавать формы с простым синтаксисом конфигурации
- ✅ Добавлять валидацию со встроенными валидаторами
- ✅ Обрабатывать отправку формы
- ✅ Организовывать сложные формы с вложенными объектами
- ✅ Управлять динамическими списками с синтаксисом массивов
- ✅ Создавать вычисляемые поля
- ✅ Реализовывать условную логику
- ✅ Добавлять асинхронную валидацию

## Следующие шаги

- Изучите [Справочник API](/docs/api) для детальной документации
- Ознакомьтесь с [Основными концепциями](/docs/core-concepts/nodes) для более глубокого понимания
- Просмотрите [Поведения](/docs/behaviors/overview) для изучения продвинутых паттернов
- Присоединяйтесь к сообществу и делитесь своими формами на ReFormer!
