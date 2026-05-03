# transformValue — Автоматическая трансформация значений

## Purpose

`transformValue` подписывается на изменение поля и переписывает его трансформированной версией: uppercase для кодов, trim+toLowerCase для email, маска для телефона, округление для чисел. В отличие от `valueParser` в `<input>`, работает декларативно в схеме формы и применяется единообразно ко всем источникам изменения (пользователь, programmatic `setValue`, `patchValue`, async `copyFrom`). Идемпотентность (`f(f(x)) === f(x)`) обязательна — иначе бесконечный цикл `setValue → callback → setValue`.

## API

```typescript
function transformValue<TForm extends FormFields, TValue extends FormValue = FormValue>(
  field: FieldPathNode<TForm, TValue>,
  transformer: (value: TValue) => TValue,
  options?: TransformValueOptions & { debounce?: number },
): void;

interface TransformValueOptions {
  /** Применять только когда поле touched (т.е. правил пользователь, не programmatic). */
  onUserChangeOnly?: boolean;

  /** Эмитить событие изменения после трансформации. По умолчанию true. */
  emitEvent?: boolean;
}

// Хелперы
function createTransformer<TValue>(
  transformer: (value: TValue) => TValue,
  defaultOptions?: TransformValueOptions,
): (field: FieldPathNode<TForm, TValue>, options?: …) => void;

const transformers: {
  toUpperCase: …; toLowerCase: …; trim: …; removeSpaces: …;
  digitsOnly: …; round: …; roundTo2: …;
};
```

`setValue` вызывается только если `transformer(value) !== value` — это базовый guard от циклов.

## Examples

### Базовый сценарий — uppercase для кода

```typescript
import { transformValue, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface PromoForm {
  uppercaseField: string;
}

export const promoBehavior: BehaviorSchemaFn<PromoForm> = (path) => {
  transformValue(path.uppercaseField, (value) => (value ?? '').toUpperCase());
};
```

Source: `BehaviorsExamples.tsx:239` (monorepo example).

### Несколько трансформаций — нормализация email + форматирование телефона

```typescript
import { transformValue, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface ContactForm {
  email: string;
  phone: string;
  amount: number;
}

export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path) => {
  // email: trim + lowercase
  transformValue(path.email, (value) => (value ?? '').trim().toLowerCase());

  // телефон: оставить только цифры и собрать формат
  transformValue(path.phone, (value) => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
    }
    return value;
  });

  // округление до целого
  transformValue(path.amount, (value) => (typeof value === 'number' ? Math.round(value) : value));
};
```

### С `transformers` — готовые трансформеры

```typescript
import { transformers, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface RegistrationForm {
  username: string;
  promoCode: string;
  inn: string;
  amount: number;
}

export const registrationBehavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
  transformers.trim(path.username);
  transformers.toUpperCase(path.promoCode);
  transformers.digitsOnly(path.inn);
  transformers.roundTo2(path.amount);
};
```

### `onUserChangeOnly` — пропуск programmatic изменений

```typescript
import { transformValue, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface UserForm {
  preformatted: string; // изначально приходит с сервера в нужном виде
}

export const userBehavior: BehaviorSchemaFn<UserForm> = (path) => {
  // Не трогаем значение, пришедшее через patchValue от useLoadCreditApplication;
  // переформатируем только если пользователь начал править
  transformValue(path.preformatted, (value) => (value ?? '').toUpperCase(), {
    onUserChangeOnly: true,
  });
};
```

## Anti-patterns

```typescript
// ❌ Не идемпотентный transformer — бесконечный цикл
transformValue(path.field, (v) => `prefix-${v}`); // f(f(x)) = "prefix-prefix-x" ≠ f(x)

// ✅ Делайте guard внутри transformer
transformValue(path.field, (v) => (v?.startsWith('prefix-') ? v : `prefix-${v}`));
```

```typescript
// ❌ Трансформация ОДНОВРЕМЕННО с syncFields на том же поле
syncFields(path.a, path.b);
transformValue(path.b, (v) => v.toUpperCase());
// При записи в `a` → b получит сырой v, transformValue запишет b обратно,
// syncFields перезапишет a, и т. д.

// ✅ Трансформируйте источник до синхронизации
transformValue(path.a, (v) => v.toUpperCase());
syncFields(path.a, path.b);
```

```typescript
// ❌ Тяжёлая логика в transformer без debounce
transformValue(path.text, (v) => heavyParse(v));

// ✅ Дебаунсим перерасчёт
transformValue(path.text, (v) => heavyParse(v), { debounce: 250 });
```

```typescript
// ❌ Использование transformValue для производных полей
transformValue(path.fullName, () => `${form.firstName} ${form.lastName}`);
// transformValue не имеет доступа к форме, только к value одного поля

// ✅ Для зависимостей от других полей — computeFrom
computeFrom([path.firstName, path.lastName], path.fullName, (v) => `${v.firstName} ${v.lastName}`);
```

## Troubleshooting

**Q: Цикл «Cycle detected» при transformValue.**
A: 99% случаев — неидемпотентный transformer. Проверьте: `transformer(transformer(x)) === transformer(x)` для типичных значений. Добавьте guard «уже преобразовано».

**Q: Трансформация не применяется при загрузке через `patchValue`.**
A: Если стоит `onUserChangeOnly: true` — это by design. Если не стоит, проверьте, что behavior зарегистрирован (передан в `createForm({ behavior })`) и форма не пересоздаётся при каждом рендере (используйте `useMemo`).

**Q: Каретка input прыгает в начало строки при наборе.**
A: Симптом — `setValue` в transformValue вызывает re-render. Лучшие практики: (1) `debounce: 100…200`; (2) держать преобразование как можно ближе к идемпотентному; (3) форматирование с динамическими разделителями (телефон, кредитка) лучше делать через `<InputMask>` из `@reformer/ui-kit`, а не через transformValue.

**Q: Хочу трансформировать только при blur, а не на каждом keystroke.**
A: Стандартная опция отсутствует, но эффект достигается через `onUserChangeOnly: true` + большой `debounce` (500-700 мс) — пользователь успевает закончить ввод. Альтернатива — слушать blur вручную через React-обработчик.

**Q: Как сделать переиспользуемые трансформации?**
A: Используйте `createTransformer<T>((value) => …)` — возвращает функцию вида `(path) => void`, которую можно применять в любых behaviour-схемах. См. готовый набор `transformers.{toUpperCase, trim, digitsOnly, roundTo2}`.

## See also

- [24-sync-fields.md](./24-sync-fields.md) — порядок применения с syncFields
- [23-copy-from.md](./23-copy-from.md) — `transform`-опция при копировании
- [22-cycle-detection.md](./22-cycle-detection.md) — про идемпотентность
- [16-ui-components.md](./16-ui-components.md) — `<InputMask>` для тяжёлого форматирования
