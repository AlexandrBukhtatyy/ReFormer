# transformValue — Автоматическая трансформация значений

## Purpose

`transformValue` подписывается на изменение поля и переписывает его трансформированной
версией: uppercase для кодов, trim+toLowerCase для email, округление для чисел. Применяется
единообразно ко всем источникам изменения (пользователь, `model.field = …`, `model.set/patch`,
`copyFrom`). **Идемпотентность (`f(f(x)) === f(x)`) обязательна** — иначе бесконечный цикл.
Оператор откладывает запись вне effect-контекста (`runOutsideEffect`) и не пишет, если
`transformer(value) === value` — базовый guard от циклов.

## API

Одинаково в примитиве (`@reformer/core`) и DSL (`@reformer/core/behaviors`):

```typescript
// примитив: возвращает cleanup
function transformValue<T>(target: Signal<T>, transformer: (value: T) => T): () => void;

// DSL: cleanup управляется формой
function transformValue<T>(target: Signal<T>, transformer: (value: T) => T): void;
```

`target` — сигнал (`model.$.field`). `transformer` — чистая идемпотентная функция значения.
Дополнительных опций (`debounce`, `onUserChangeOnly`, `emitEvent`) и готового набора
`transformers`/`createTransformer` НЕТ — трансформер пишется как обычная функция.

## Examples

### Базовый сценарий — uppercase для кода

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

type PromoForm = { uppercaseField: string };

export const promoBehavior = defineFormBehavior<PromoForm>(({ model }) => {
  transformValue(model.$.uppercaseField, (value) => (value ?? '').toUpperCase());
});
```

Пример: `transformValue(model.$.uppercaseField, (v) => (v ?? '').toUpperCase())`.

### Несколько трансформаций

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

type ContactForm = { email: string; phone: string; amount: number };

export const contactBehavior = defineFormBehavior<ContactForm>(({ model }) => {
  // email: trim + lowercase
  transformValue(model.$.email, (value) => (value ?? '').trim().toLowerCase());

  // телефон: только цифры → формат
  transformValue(model.$.phone, (value) => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
    }
    return value;
  });

  // округление до целого
  transformValue(model.$.amount, (value) => (typeof value === 'number' ? Math.round(value) : value));
});
```

### Как примитив (вне defineFormBehavior)

```typescript
import { transformValue } from '@reformer/core';
const stop = transformValue(model.$.promoCode, (v) => (v ?? '').toUpperCase());
```

### Переиспользуемые трансформеры — обычные функции

Готового набора нет, но легко собрать свои и применять их к любому сигналу:

```typescript
const toUpper = (target: Signal<string>) => transformValue(target, (v) => (v ?? '').toUpperCase());
const trim = (target: Signal<string>) => transformValue(target, (v) => (v ?? '').trim());

// в схеме поведения:
toUpper(model.$.promoCode);
trim(model.$.username);
```

## Anti-patterns

```typescript
// ❌ Неидемпотентный transformer — бесконечный цикл
transformValue(model.$.field, (v) => `prefix-${v}`); // f(f(x)) ≠ f(x)

// ✅ Guard внутри transformer
transformValue(model.$.field, (v) => (v?.startsWith('prefix-') ? v : `prefix-${v}`));
```

```typescript
// ❌ transformValue ОДНОВРЕМЕННО с syncFields на том же поле
syncFields(model.$.a, model.$.b);
transformValue(model.$.b, (v) => v.toUpperCase()); // взаимные перезаписи

// ✅ Трансформируй источник ДО синхронизации
transformValue(model.$.a, (v) => v.toUpperCase());
syncFields(model.$.a, model.$.b);
```

```typescript
// ❌ transformValue для производных полей (нет доступа к другим полям)
transformValue(model.$.fullName, () => `${model.firstName} ${model.lastName}`);

// ✅ Для зависимостей от других полей — compute
compute(model.$.fullName, () => `${model.firstName} ${model.lastName}`);
```

## Troubleshooting

**Q: «Cycle detected» при transformValue.**
A: 99% — неидемпотентный transformer. Проверь `transformer(transformer(x)) === transformer(x)`.

**Q: Трансформация не применяется.**
A: Проверь, что behavior зарегистрирован (`createForm({ behavior })`) / примитив не отписан,
и что форма не пересоздаётся на каждый рендер (используй `useMemo`).

**Q: Каретка input прыгает при наборе.**
A: Симптом частых записей. Форматирование с динамическими разделителями (телефон, кредитка)
лучше делать через `<InputMask>` из `@reformer/ui-kit`, а не `transformValue`.

## See also

- [24-sync-fields.md](./24-sync-fields.md) — порядок применения с syncFields
- [23-copy-from.md](./23-copy-from.md) — `transform`-опция при копировании
- [22-cycle-detection.md](./22-cycle-detection.md) — про идемпотентность
- [16-ui-components.md](./16-ui-components.md) — `<InputMask>` для тяжёлого форматирования
