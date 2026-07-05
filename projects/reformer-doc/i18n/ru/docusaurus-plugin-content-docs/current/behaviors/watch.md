---
sidebar_position: 5
---

# Watch Behaviors

Реакция на изменения полей с кастомной логикой.

## watchField

Выполнение callback при изменении значения поля.

```typescript
import { defineFormBehavior, watchField } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  watchField(model.$.country, (country) => {
    console.log(`Страна изменилась на ${country}`);
    // Загрузить города для новой страны
    loadCities(country);
  });
});
```

### Пример: Динамические опции

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, watchField } from '@reformer/core/behaviors';

interface CategoryForm {
  category: string;
  subcategory: string;
}

const model = createModel<CategoryForm>({ category: '', subcategory: '' });

const behavior = defineFormBehavior<CategoryForm>(({ model, form }) => {
  watchField(model.$.category, async (category) => {
    // Сбросить подкатегорию
    model.subcategory = '';

    // Загрузить подкатегории
    const options = await fetchSubcategories(category);
    form.subcategory.updateComponentProps({ options });
  });
});

// `schema` связывает поля с компонентами (см. Быстрый старт).
const form = createForm<CategoryForm>({ model, schema, behavior });
```

### Пример: Аналитика

```typescript
const behavior = defineFormBehavior(({ model }) => {
  watchField(model.$.step, (step) => {
    analytics.track('form_step_changed', { step });
  });
});
```

## revalidateWhen

Запуск повторной валидации поля при изменении другого поля. Под M1 валидация
on-demand, поэтому колбэк ревалидации заново вызывает `validateFormModel(model, schema)`.

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

const behavior = defineFormBehavior(({ model }) => {
  // Перевалидировать схему при изменении password (правило confirmPassword перепроверится)
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, schema);
  });
});
```

### Пример: Диапазон дат

```typescript
import { createModel, createForm } from '@reformer/core';
import type { ModelValidator } from '@reformer/core';
import { validateFormModel } from '@reformer/core';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

interface DateRangeForm {
  startDate: string;
  endDate: string;
}

const model = createModel<DateRangeForm>({ startDate: '', endDate: '' });

// Кросс-валидация: endDate не может быть раньше startDate (читает root)
const endAfterStart: ModelValidator<string, unknown, DateRangeForm> = (value, _schema, root) =>
  root.startDate && value && value < root.startDate
    ? { code: 'endBeforeStart', message: 'Дата окончания раньше даты начала' }
    : null;

const schema = {
  startDate: { value: model.$.startDate, component: Input },
  endDate: { value: model.$.endDate, component: Input, validators: [endAfterStart] },
};

const behavior = defineFormBehavior<DateRangeForm>(({ model }) => {
  // Перевалидировать endDate при изменении startDate
  revalidateWhen([model.$.startDate], () => {
    void validateFormModel(model, schema);
  });
});

const form = createForm<DateRangeForm>({ model, schema, behavior });
```

### Пример: Кросс-валидация

```typescript
const behavior = defineFormBehavior(({ model }) => {
  // Сложность пароля зависит от username (не может содержать его)
  revalidateWhen([model.$.username], () => void validateFormModel(model, schema));

  // Подтверждение пароля должно совпадать с паролем
  revalidateWhen([model.$.password], () => void validateFormModel(model, schema));
});
```

## Отслеживание нескольких полей

Отслеживание нескольких полей:

```typescript
const behavior = defineFormBehavior(({ model }) => {
  // Вызывается при изменении любого из них
  watchField(model.$.firstName, () => updateDisplayName());
  watchField(model.$.lastName, () => updateDisplayName());
});
```

## Debounced Watch

Предотвращение слишком частых обновлений через `onChange` (debounce + AbortSignal):

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  onChange(
    model.$.searchQuery,
    async (query, { signal }) => {
      const results = await search(query, { signal });
      setSearchResults(results);
    },
    { debounce: 300 }
  );
});
```

## Watch с очисткой

Очистка при следующем изменении через abort-сигнал:

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  onChange(model.$.livePreview, (enabled, { signal }) => {
    if (enabled) {
      const interval = setInterval(refreshPreview, 1000);
      // signal аннулируется при следующем изменении — очищаем интервал
      signal.addEventListener('abort', () => clearInterval(interval));
    }
  });
});
```

## Комбинирование Watch с другими Behaviors

```typescript
import {
  defineFormBehavior,
  enableWhen,
  watchField,
  revalidateWhen,
} from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

const behavior = defineFormBehavior(({ model }) => {
  // Показать premium поля
  enableWhen(model.$.premiumOptions, () => model.plan === 'premium');

  // Отслеживать изменения плана
  watchField(model.$.plan, (plan) => {
    analytics.track('plan_selected', { plan });
  });

  // Перевалидировать зависимые поля
  revalidateWhen([model.$.plan], () => void validateFormModel(model, schema));
});
```

## Следующие шаги

- [Валидация](/docs/validation/overview) — комбинирование с валидацией
- [React интеграция](/docs/react/hooks) — использование в React-компонентах
