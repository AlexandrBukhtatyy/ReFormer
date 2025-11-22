---
sidebar_position: 5
---

# Watch Behaviors

Реакция на изменения полей с кастомной логикой.

## watchField

Выполнение callback при изменении значения поля.

```typescript
import { watchField } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  watchField(path.country, (newValue, oldValue) => {
    console.log(`Страна изменилась с ${oldValue} на ${newValue}`);
    // Загрузить города для новой страны
    loadCities(newValue);
  }),
]
```

### Пример: Динамические опции

```typescript
const form = new GroupNode({
  schema: {
    category: new FieldNode({ value: '' }),
    subcategory: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    watchField(path.category, async (category) => {
      // Сбросить подкатегорию
      form.controls.subcategory.setValue('');

      // Загрузить подкатегории
      const options = await fetchSubcategories(category);
      setSubcategoryOptions(options);
    }),
  ],
});
```

### Пример: Аналитика

```typescript
behaviorSchema: (path, ctx) => [
  watchField(path.step, (step) => {
    analytics.track('form_step_changed', { step });
  }),
]
```

## revalidateWhen

Запуск повторной валидации поля при изменении другого поля.

```typescript
import { revalidateWhen } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  // Перевалидировать confirmPassword при изменении password
  revalidateWhen(
    path.confirmPassword,
    [path.password]
  ),
]
```

### Пример: Диапазон дат

```typescript
const form = new GroupNode({
  schema: {
    startDate: new FieldNode({ value: '' }),
    endDate: new FieldNode({ value: '' }),
  },
  validationSchema: (path, { validate }) => [
    validate(path.endDate, (value, ctx) => {
      const start = ctx.root.controls.startDate.value;
      if (start && value && value < start) {
        return { endBeforeStart: true };
      }
      return null;
    }),
  ],
  behaviorSchema: (path, ctx) => [
    // Перевалидировать endDate при изменении startDate
    revalidateWhen(path.endDate, [path.startDate]),
  ],
});
```

### Пример: Кросс-валидация

```typescript
behaviorSchema: (path, ctx) => [
  // Сложность пароля зависит от username (не может содержать его)
  revalidateWhen(path.password, [path.username]),

  // Подтверждение пароля должно совпадать с паролем
  revalidateWhen(path.confirmPassword, [path.password]),
]
```

## Отслеживание нескольких полей

Отслеживание нескольких полей:

```typescript
behaviorSchema: (path, ctx) => [
  watchField([path.firstName, path.lastName], () => {
    // Вызывается при изменении любого из них
    updateDisplayName();
  }),
]
```

## Debounced Watch

Предотвращение слишком частых обновлений:

```typescript
behaviorSchema: (path, ctx) => [
  watchField(
    path.searchQuery,
    async (query) => {
      const results = await search(query);
      setSearchResults(results);
    },
    { debounce: 300 }
  ),
]
```

## Watch с очисткой

Возврат функции очистки:

```typescript
behaviorSchema: (path, ctx) => [
  watchField(path.livePreview, (enabled) => {
    if (enabled) {
      const interval = setInterval(refreshPreview, 1000);
      return () => clearInterval(interval); // Очистка
    }
  }),
]
```

## Комбинирование Watch с другими Behaviors

```typescript
behaviorSchema: (path, ctx) => [
  // Показать premium поля
  showWhen(path.premiumOptions, () =>
    form.controls.plan.value === 'premium'
  ),

  // Отслеживать изменения плана
  watchField(path.plan, (plan) => {
    analytics.track('plan_selected', { plan });
  }),

  // Перевалидировать зависимые поля
  revalidateWhen(path.features, [path.plan]),
]
```

## Следующие шаги

- [Валидация](/docs/validation/overview) — комбинирование с валидацией
- [React интеграция](/docs/react/hooks) — использование в React-компонентах
