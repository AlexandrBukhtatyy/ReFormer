---
sidebar_position: 5
---

# Наблюдение за полями

Реакция на изменения полей с `watchField`.

## Обзор

Поведение `watchField` позволяет реагировать на изменения значений полей и выполнять побочные эффекты:

- Загрузка данных при изменении выбора (каскадные списки)
- Динамическое обновление свойств компонентов
- Очистка зависимых полей
- Пользовательская валидация
- Трансформация или форматирование значений

## watchField

```typescript
import { watchField } from 'reformer/behaviors';

watchField(
  sourceField,  // Поле для наблюдения
  callback,     // Функция, вызываемая при изменении значения
  options       // { immediate?: boolean, debounce?: number }
);
```

### Опции

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `immediate` | `boolean` | `true` | Запустить callback сразу с текущим значением |
| `debounce` | `number` | `0` | Задержка debounce в миллисекундах |

### Контекст callback

Callback получает значение поля и объект контекста:

```typescript
watchField(path.field, (value, ctx) => {
  // value - текущее значение поля
  // ctx.form - доступ ко всем полям формы
  // ctx.setFieldValue(path, value) - установить значение поля по строковому пути
});
```

## Базовые примеры

### Загрузка зависимых опций

Загрузка моделей автомобилей при изменении марки:

```typescript title="src/behaviors/car-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { fetchCarModels } from '../api';

interface CarForm {
  carBrand: string;
  carModel: string;
}

export const carBehavior: BehaviorSchemaFn<CarForm> = (path: FieldPath<CarForm>) => {
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      // Очищаем модель при смене марки
      ctx.form.carModel.reset();

      if (brand) {
        try {
          const { data: models } = await fetchCarModels(brand);
          ctx.form.carModel.updateComponentProps({ options: models });
        } catch (error) {
          ctx.form.carModel.updateComponentProps({ options: [] });
        }
      } else {
        ctx.form.carModel.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );
};
```

### Очистка массивов при изменении чекбокса

Очистка массива при снятии чекбокса:

```typescript title="src/behaviors/property-behavior.ts"
interface PropertyForm {
  hasProperty: boolean;
  properties: Property[];
}

export const propertyBehavior: BehaviorSchemaFn<PropertyForm> = (path) => {
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) {
        ctx.form.properties?.clear();
      }
    },
    { immediate: false }
  );
};
```

### Динамические ограничения полей

Обновление ограничений поля на основе других значений:

```typescript title="src/behaviors/loan-behavior.ts"
interface LoanForm {
  totalIncome: number;
  loanAmount: number;
  age: number;
  loanTerm: number;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Максимальная сумма кредита на основе дохода
  watchField(
    path.totalIncome,
    (totalIncome, ctx) => {
      if (totalIncome && totalIncome > 0) {
        const maxLoanAmount = Math.min(totalIncome * 12 * 10, 10000000);
        queueMicrotask(() => {
          ctx.form.loanAmount.updateComponentProps({ max: maxLoanAmount });
        });
      }
    },
    { immediate: false }
  );

  // Максимальный срок на основе возраста (погашение до 70 лет)
  watchField(
    path.age,
    (age, ctx) => {
      if (age && age >= 18) {
        const maxTermYears = Math.max(70 - age, 1);
        const maxTermMonths = Math.min(maxTermYears * 12, 240);
        queueMicrotask(() => {
          ctx.form.loanTerm.updateComponentProps({ max: maxTermMonths });
        });
      }
    },
    { immediate: false }
  );
};
```

## Продвинутые примеры

### Каскадные списки

Загрузка городов при изменении региона:

```typescript title="src/behaviors/address-behavior.ts"
interface Address {
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Загрузка городов при изменении региона
  watchField(
    path.region,
    async (region, ctx) => {
      if (region) {
        try {
          const { data: cities } = await fetchCities(region);
          ctx.form.city.updateComponentProps({ options: cities });
        } catch (error) {
          ctx.form.city.updateComponentProps({ options: [] });
        }
      }
    },
    { debounce: 300, immediate: false }
  );

  // Очистка города при изменении региона
  watchField(
    path.region,
    (_region, ctx) => {
      ctx.setFieldValue('city', '');
    },
    { immediate: false }
  );
};
```

### Валидация совпадения паролей

Валидация подтверждения пароля в реальном времени:

```typescript title="src/behaviors/registration-behavior.ts"
interface RegistrationForm {
  password: string;
  confirmPassword: string;
}

export const registrationBehavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
  // При изменении пароля проверяем confirmPassword
  watchField(path.password, (passwordValue, ctx) => {
    const confirmPasswordValue = ctx.form.confirmPassword.value.value;

    if (confirmPasswordValue) {
      if (passwordValue !== confirmPasswordValue) {
        ctx.form.confirmPassword.setErrors([
          {
            code: 'passwords-mismatch',
            message: 'Пароли не совпадают',
          },
        ]);
      } else {
        ctx.form.confirmPassword.clearErrors({ code: 'passwords-mismatch' });
      }
    }
  });

  // При изменении confirmPassword сравниваем с password
  watchField(path.confirmPassword, (confirmPasswordValue, ctx) => {
    const passwordValue = ctx.form.password.value.value;

    if (confirmPasswordValue && passwordValue) {
      if (passwordValue !== confirmPasswordValue) {
        ctx.form.confirmPassword.setErrors([
          {
            code: 'passwords-mismatch',
            message: 'Пароли не совпадают',
          },
        ]);
      } else {
        ctx.form.confirmPassword.clearErrors({ code: 'passwords-mismatch' });
      }
    }
  });
};
```

### Автоформатирование значений

Форматирование почтового индекса при вводе:

```typescript title="src/behaviors/postal-behavior.ts"
interface AddressForm {
  postalCode: string;
}

export const postalBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  watchField(
    path.postalCode,
    (postalCode, ctx) => {
      // Удаляем нецифровые символы и ограничиваем длину до 6
      const cleaned = postalCode?.replace(/\D/g, '').slice(0, 6);
      if (cleaned !== postalCode) {
        ctx.setFieldValue('postalCode', cleaned || '');
      }
    },
    { immediate: false }
  );
};
```

### Копирование с трансформацией

Копирование значения с трансформацией:

```typescript title="src/behaviors/transform-behavior.ts"
interface FormWithTransform {
  sourceValue: string;
  uppercaseValue: string;
  slug: string;
}

export const transformBehavior: BehaviorSchemaFn<FormWithTransform> = (path) => {
  // Копирование и трансформация в верхний регистр
  watchField(path.sourceValue, (value, ctx) => {
    ctx.form.uppercaseValue.setValue(value?.toUpperCase() || '');
  });

  // Создание slug из исходного значения
  watchField(path.sourceValue, (value, ctx) => {
    const slug = value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || '';
    ctx.form.slug.setValue(slug);
  });
};
```

## Подробнее об опциях

### immediate

По умолчанию `watchField` запускает callback сразу с текущим значением. Установите `immediate: false`, чтобы реагировать только на будущие изменения:

```typescript
// Запускается сразу с текущим значением + при изменениях
watchField(path.field, callback);

// Запускается только при будущих изменениях
watchField(path.field, callback, { immediate: false });
```

Используйте `immediate: false` когда:
- Загрузка данных (избегаем дублирования начальной загрузки)
- Очистка зависимых полей (не очищаем при инициализации формы)
- Выполнение побочных эффектов, которые не должны запускаться при монтировании

### debounce

Debounce callback для уменьшения количества API-вызовов или затратных вычислений:

```typescript
// Debounce 300мс - полезно для API-вызовов
watchField(path.searchQuery, async (query, ctx) => {
  const results = await searchAPI(query);
  ctx.form.results.setValue(results);
}, { debounce: 300 });
```

### queueMicrotask для безопасности сигналов

При обновлении свойств компонента внутри `watchField` используйте `queueMicrotask`, чтобы выйти из контекста эффекта сигнала:

```typescript
watchField(path.income, (income, ctx) => {
  if (income > 0) {
    // Выходим из контекста эффекта сигнала перед мутацией
    queueMicrotask(() => {
      ctx.form.loanAmount.updateComponentProps({ max: income * 10 });
    });
  }
}, { immediate: false });
```

## Лучшие практики

### 1. Используйте immediate: false для побочных эффектов

```typescript
// ✅ Не очищаем при инициализации
watchField(path.category, (category, ctx) => {
  ctx.form.subcategory.reset();
}, { immediate: false });

// ❌ Очищает subcategory при загрузке формы
watchField(path.category, (category, ctx) => {
  ctx.form.subcategory.reset();
});
```

### 2. Используйте debounce для API-вызовов

```typescript
// ✅ Debounce для уменьшения API-вызовов
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
}, { debounce: 300 });

// ❌ API-вызов на каждое нажатие клавиши
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
});
```

### 3. Обрабатывайте ошибки в асинхронных callback

```typescript
watchField(path.region, async (region, ctx) => {
  if (region) {
    try {
      const cities = await fetchCities(region);
      ctx.form.city.updateComponentProps({ options: cities });
    } catch (error) {
      console.error('Не удалось загрузить города:', error);
      ctx.form.city.updateComponentProps({ options: [] });
    }
  }
}, { immediate: false, debounce: 300 });
```

### 4. Избегайте циклических зависимостей

```typescript
// ❌ ПЛОХО: Создаёт бесконечный цикл
watchField(path.a, (value, ctx) => {
  ctx.form.b.setValue(value * 2);
});
watchField(path.b, (value, ctx) => {
  ctx.form.a.setValue(value / 2);
});

// ✅ ХОРОШО: Однонаправленный поток
watchField(path.a, (value, ctx) => {
  ctx.form.b.setValue(value * 2);
});
// b только для чтения или редактируется вручную
```

### 5. Используйте computeFrom для простых вычислений

```typescript
// ✅ Используйте computeFrom для производных значений
computeFrom([path.price, path.quantity], path.total,
  (values) => values.price * values.quantity
);

// ❌ watchField избыточен для простых вычислений
watchField(path.price, (price, ctx) => {
  const quantity = ctx.form.quantity.value.value;
  ctx.form.total.setValue(price * quantity);
});
watchField(path.quantity, (quantity, ctx) => {
  const price = ctx.form.price.value.value;
  ctx.form.total.setValue(price * quantity);
});
```

## Когда использовать watchField

| Сценарий | watchField | Альтернатива |
|----------|------------|--------------|
| Загрузка зависимых данных | ✅ | - |
| Очистка зависимых полей | ✅ | - |
| Обновление свойств компонента | ✅ | - |
| Пользовательская валидация | ✅ | Валидация схемы |
| Трансформация значений | ✅ | `transformValue` |
| Вычисление производных значений | Рассмотрите | `computeFrom` |
| Одностороннее копирование | Рассмотрите | `copyFrom` |
| Двусторонняя синхронизация | Рассмотрите | `syncFields` |

## Следующий шаг

Теперь, когда вы понимаете наблюдение за изменениями полей, давайте узнаем о поведениях перевалидации и сброса с `revalidateWhen` и `resetWhen`.
