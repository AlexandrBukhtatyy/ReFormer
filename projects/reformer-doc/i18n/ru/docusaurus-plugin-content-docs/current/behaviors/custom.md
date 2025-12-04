---
sidebar_position: 6
---

# Кастомные Поведения

Создавайте переиспользуемые поведения для добавления реактивной логики в ваши формы.

## Что такое Поведения?

Поведения — это реактивные побочные эффекты, которые выполняются при изменении значений формы. Они полезны для:

- Автосохранения данных формы
- Синхронизации полей
- Управления фокусом
- Клавиатурных сокращений
- Отслеживания аналитики
- Кастомной логики форм

## Простое Кастомное Поведение

Используйте `use()` для применения кастомных поведений:

```typescript
behaviors: (path, { use }) => [
  // Простое поведение
  use({
    key: 'myBehavior',
    paths: [path.field1],
    run: (values) => {
      console.log('Field1 изменилось:', values.field1);
    },
  }),
];
```

## Поведение с Множественными Зависимостями

Реагируйте на изменения в нескольких полях:

```typescript
behaviors: (path, { use }) => [
  use({
    key: 'calculateTotal',
    paths: [path.price, path.quantity, path.tax],
    run: (values) => {
      const { price, quantity, tax } = values;
      const subtotal = price * quantity;
      const total = subtotal + (subtotal * tax) / 100;
      console.log('Итого:', total);
    },
  }),
];
```

## Переиспользуемая Фабрика Поведений

Создавайте фабрики поведений для переиспользования в формах:

```typescript title="behaviors/auto-save.ts"
import { Behavior } from '@reformer/core';

interface AutoSaveOptions {
  /**
   * Задержка в мс перед сохранением
   */
  debounce?: number;
  /**
   * Функция для сохранения данных
   */
  onSave: (data: any) => Promise<void>;
}

export function autoSave<T>(options: AutoSaveOptions): Behavior<T> {
  const { debounce = 1000, onSave } = options;
  let timeoutId: NodeJS.Timeout;

  return {
    key: 'autoSave',
    paths: [], // Пустой массив = слушать все поля
    run: (values, ctx) => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        try {
          await onSave(ctx.form.getValue());
          console.log('Автосохранено');
        } catch (error) {
          console.error('Ошибка автосохранения:', error);
        }
      }, debounce);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Использование
import { autoSave } from './behaviors/auto-save';

behaviors: (path, { use }) => [
  use(
    autoSave({
      debounce: 2000,
      onSave: async (data) => {
        await fetch('/api/save', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
    })
  ),
];
```

## Поведение с Очисткой

Очищайте ресурсы при уничтожении поведения:

```typescript title="behaviors/field-focus.ts"
import { Behavior } from '@reformer/core';

interface FocusFieldOptions {
  fieldName: string;
  delay?: number;
}

export function focusField<T>(options: FocusFieldOptions): Behavior<T> {
  const { fieldName, delay = 0 } = options;
  let timeoutId: NodeJS.Timeout;

  return {
    key: `focusField:${fieldName}`,
    paths: [],
    run: (_values, ctx) => {
      timeoutId = setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(`[name="${fieldName}"]`);
        input?.focus();
      }, delay);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Использование - фокус на первом поле с ошибкой
behaviors: (path, { use }) => [use(focusField({ fieldName: 'email', delay: 100 }))];
```

## Условное Поведение

Выполняйте поведение только при выполнении условия:

```typescript title="behaviors/conditional-sync.ts"
import { Behavior } from '@reformer/core';

interface ConditionalSyncOptions<T> {
  condition: (form: T) => boolean;
  targetPath: any;
  sourcePath: any;
}

export function conditionalSync<T>(options: ConditionalSyncOptions<T>): Behavior<T> {
  const { condition, targetPath, sourcePath } = options;

  return {
    key: 'conditionalSync',
    paths: [sourcePath],
    run: (values, ctx) => {
      const formValue = ctx.form.getValue();

      if (condition(formValue)) {
        const sourceValue = values[sourcePath.__key];
        ctx.form[targetPath.__key].setValue(sourceValue);
      }
    },
  };
}

// Использование - копировать адрес доставки в адрес плательщика при установке флажка
behaviors: (path, { use }) => [
  use(
    conditionalSync({
      condition: (form) => form.sameAsShipping,
      targetPath: path.shippingAddress,
      sourcePath: path.billingAddress,
    })
  ),
];
```

## Практические Примеры

### Автодополнение из API

```typescript title="behaviors/auto-complete.ts"
import { Behavior } from '@reformer/core';

interface AutoCompleteOptions {
  searchPath: any;
  resultPath: any;
  fetchResults: (query: string) => Promise<any[]>;
  minLength?: number;
  debounce?: number;
}

export function autoComplete<T>(options: AutoCompleteOptions): Behavior<T> {
  const { searchPath, resultPath, fetchResults, minLength = 2, debounce = 300 } = options;

  let timeoutId: NodeJS.Timeout;

  return {
    key: 'autoComplete',
    paths: [searchPath],
    run: (values, ctx) => {
      clearTimeout(timeoutId);

      const query = values[searchPath.__key];

      if (!query || query.length < minLength) {
        ctx.form[resultPath.__key].setValue([]);
        return;
      }

      timeoutId = setTimeout(async () => {
        try {
          const results = await fetchResults(query);
          ctx.form[resultPath.__key].setValue(results);
        } catch (error) {
          console.error('Ошибка автодополнения:', error);
        }
      }, debounce);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Использование
behaviors: (path, { use }) => [
  use(
    autoComplete({
      searchPath: path.citySearch,
      resultPath: path.citySuggestions,
      fetchResults: async (query) => {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
        return response.json();
      },
      minLength: 3,
      debounce: 500,
    })
  ),
];
```

### Клавиатурные Сокращения

```typescript title="behaviors/keyboard-shortcuts.ts"
import { Behavior } from '@reformer/core';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: (ctx: any) => void;
}

export function keyboardShortcuts<T>(shortcuts: KeyboardShortcut[]): Behavior<T> {
  const handleKeyDown = (event: KeyboardEvent, ctx: any) => {
    for (const shortcut of shortcuts) {
      if (
        event.key === shortcut.key &&
        event.ctrlKey === !!shortcut.ctrl &&
        event.shiftKey === !!shortcut.shift &&
        event.altKey === !!shortcut.alt
      ) {
        event.preventDefault();
        shortcut.action(ctx);
        return;
      }
    }
  };

  return {
    key: 'keyboardShortcuts',
    paths: [],
    run: (_values, ctx) => {
      const listener = (e: KeyboardEvent) => handleKeyDown(e, ctx);
      document.addEventListener('keydown', listener);

      return () => {
        document.removeEventListener('keydown', listener);
      };
    },
  };
}

// Использование
behaviors: (path, { use }) => [
  use(
    keyboardShortcuts([
      {
        key: 's',
        ctrl: true,
        action: (ctx) => {
          ctx.form.markAsTouched();
          if (ctx.form.valid.value) {
            console.log('Сохранение...', ctx.form.getValue());
          }
        },
      },
      {
        key: 'Escape',
        action: (ctx) => {
          ctx.form.reset();
        },
      },
    ])
  ),
];
```

### Отслеживание Аналитики

```typescript title="behaviors/analytics.ts"
import { Behavior } from '@reformer/core';

interface AnalyticsOptions {
  trackChanges?: boolean;
  trackErrors?: boolean;
  trackSubmit?: boolean;
}

export function analytics<T>(options: AnalyticsOptions = {}): Behavior<T> {
  const { trackChanges = true, trackErrors = true } = options;

  return {
    key: 'analytics',
    paths: [], // Слушать все поля
    run: (values, ctx) => {
      if (trackChanges) {
        // Отслеживание изменений полей
        Object.keys(values).forEach((key) => {
          const field = ctx.form[key];
          if (field?.touched?.value) {
            window.analytics?.track('Form Field Changed', {
              form: ctx.form.constructor.name,
              field: key,
              hasError: !!field.errors?.value,
            });
          }
        });
      }

      if (trackErrors) {
        // Отслеживание ошибок валидации
        Object.keys(values).forEach((key) => {
          const field = ctx.form[key];
          if (field?.errors?.value) {
            window.analytics?.track('Form Validation Error', {
              form: ctx.form.constructor.name,
              field: key,
              errors: Object.keys(field.errors.value),
            });
          }
        });
      }
    },
  };
}

// Использование
behaviors: (path, { use }) => [
  use(
    analytics({
      trackChanges: true,
      trackErrors: true,
    })
  ),
];
```

### Синхронизация с LocalStorage

```typescript title="behaviors/local-storage-sync.ts"
import { Behavior } from '@reformer/core';

interface LocalStorageSyncOptions {
  key: string;
  debounce?: number;
}

export function localStorageSync<T>(options: LocalStorageSyncOptions): Behavior<T> {
  const { key, debounce = 500 } = options;
  let timeoutId: NodeJS.Timeout;

  return {
    key: 'localStorageSync',
    paths: [], // Слушать все поля
    run: (values, ctx) => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        try {
          const data = ctx.form.getValue();
          localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
          console.error('Ошибка сохранения в localStorage:', error);
        }
      }, debounce);
    },
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// Загрузка из хранилища
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Ошибка загрузки из localStorage:', error);
    return null;
  }
}

// Использование
const savedData = loadFromLocalStorage('myForm');

const form = new GroupNode({
  form: {
    name: { value: savedData?.name || '' },
    email: { value: savedData?.email || '' },
  },
  behaviors: (path, { use }) => [use(localStorageSync({ key: 'myForm', debounce: 1000 }))],
});
```

### Отслеживание Видимости Полей

```typescript title="behaviors/visibility-watcher.ts"
import { Behavior } from '@reformer/core';

interface VisibilityWatcherOptions {
  onVisibilityChange: (fieldName: string, visible: boolean) => void;
}

export function visibilityWatcher<T>(options: VisibilityWatcherOptions): Behavior<T> {
  const { onVisibilityChange } = options;
  const previousState = new Map<string, boolean>();

  return {
    key: 'visibilityWatcher',
    paths: [], // Слушать все поля
    run: (_values, ctx) => {
      Object.keys(ctx.form).forEach((key) => {
        const field = ctx.form[key];
        const currentlyVisible = field?.visible?.value ?? true;
        const wasVisible = previousState.get(key);

        if (wasVisible !== currentlyVisible) {
          previousState.set(key, currentlyVisible);
          onVisibilityChange(key, currentlyVisible);
        }
      });
    },
  };
}

// Использование
behaviors: (path, { use }) => [
  use(
    visibilityWatcher({
      onVisibilityChange: (fieldName, visible) => {
        console.log(`Поле ${fieldName} теперь ${visible ? 'видимо' : 'скрыто'}`);
      },
    })
  ),
];
```

## Комбинирование Нескольких Поведений

```typescript
import { autoSave } from './behaviors/auto-save';
import { analytics } from './behaviors/analytics';
import { keyboardShortcuts } from './behaviors/keyboard-shortcuts';

const form = new GroupNode({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
  behaviors: (path, { use }) => [
    // Автосохранение каждые 2 секунды
    use(
      autoSave({
        debounce: 2000,
        onSave: async (data) => {
          await fetch('/api/save', {
            method: 'POST',
            body: JSON.stringify(data),
          });
        },
      })
    ),

    // Отслеживание взаимодействий с формой
    use(
      analytics({
        trackChanges: true,
        trackErrors: true,
      })
    ),

    // Добавление клавиатурных сокращений
    use(
      keyboardShortcuts([
        {
          key: 's',
          ctrl: true,
          action: (ctx) => console.log('Сохранение...'),
        },
      ])
    ),
  ],
});
```

## Советы по Кастомным Поведениям

### 1. Всегда Указывайте Уникальный Ключ

```typescript
// ✅ Хорошо - уникальный ключ
use({
  key: 'myBehavior',
  paths: [path.field],
  run: () => {},
});

// ❌ Плохо - отсутствует ключ
use({
  paths: [path.field],
  run: () => {},
});
```

### 2. Очищайте Ресурсы

```typescript
// ✅ Хорошо - очищает таймер
use({
  key: 'myBehavior',
  paths: [path.field],
  run: () => {
    const timerId = setTimeout(() => {}, 1000);
  },
  cleanup: () => {
    clearTimeout(timerId);
  },
});
```

### 3. Указывайте Зависимости

```typescript
// ✅ Хорошо - реагирует только на конкретные поля
paths: [path.field1, path.field2];

// ❌ Плохо - реагирует на все изменения (если не задумано)
paths: [];
```

### 4. Обрабатывайте Ошибки

```typescript
use({
  key: 'myBehavior',
  paths: [path.field],
  run: async (values, ctx) => {
    try {
      await someAsyncOperation(values);
    } catch (error) {
      console.error('Ошибка поведения:', error);
      // Не пробрасывайте ошибку - поведения не должны ломать форму
    }
  },
});
```

## Следующие Шаги

- [Вычисляемые Поля](/docs/behaviors/computed) — Встроенное вычисляемое поведение
- [Условная Логика](/docs/behaviors/conditional) — Встроенные условные поведения
- [Композиция схем](/docs/core-concepts/schemas/composition) — Композиция сложных форм
