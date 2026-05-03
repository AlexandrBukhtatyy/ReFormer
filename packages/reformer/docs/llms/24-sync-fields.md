# syncFields — Двусторонняя синхронизация полей

## Purpose

`syncFields` создаёт двунаправленную связь между двумя полями: изменение любого из них переписывает второе. Применяется для дублей одного значения в разных частях формы (тех. поле + видимое представление, мобильный/десктопный input, mirror-поля для отчётов). Внутренний флаг `isUpdating` плюс `runOutsideEffect` исключают петли. Если нужно одностороннее копирование — берите [`copyFrom`](./23-copy-from.md), для расчётов — [`computeFrom`](./03-api-signatures.md).

## API

```typescript
function syncFields<TForm extends FormFields, T extends FormValue>(
  field1: FieldPathNode<TForm, T>,
  field2: FieldPathNode<TForm, T>,
  options?: SyncFieldsOptions<T>
): void;

interface SyncFieldsOptions<T> {
  /** Преобразование при синхронизации field1 → field2 (НЕ применяется в обратную сторону). */
  transform?: (value: T) => T;

  /** Debounce в миллисекундах. */
  debounce?: number;
}
```

Поля должны иметь совместимый тип `T`. `transform` асимметричен: он работает только при движении значения от `field1` к `field2`.

## Examples

### Базовый сценарий — отзеркаливание текста

```typescript
import { syncFields, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface MirrorForm {
  syncField1: string;
  syncField2: string;
}

export const mirrorBehavior: BehaviorSchemaFn<MirrorForm> = (path) => {
  syncFields(path.syncField1, path.syncField2);
};
```

Source: `BehaviorsExamples.tsx:249` (monorepo example).

### С трансформацией — нормализация при прямой записи

```typescript
import { syncFields, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface DisplayForm {
  internalCode: string; // канонический формат
  displayCode: string; // показываем пользователю
}

export const codeBehavior: BehaviorSchemaFn<DisplayForm> = (path) => {
  // internalCode → displayCode: нормализация в верхний регистр
  // displayCode → internalCode: значение пишется как есть
  syncFields(path.internalCode, path.displayCode, {
    transform: (value) => (typeof value === 'string' ? value.toUpperCase() : value),
    debounce: 150,
  });
};
```

### Edge case — sync с независимой валидацией

```typescript
import { syncFields, revalidateWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
import { required, pattern } from '@reformer/core/validators';

interface ContactForm {
  phoneA: string;
  phoneB: string;
}

export const contactValidation = (path: FieldPath<ContactForm>) => {
  required(path.phoneA);
  pattern(path.phoneB, /^\+\d{10,12}$/);
};

export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path) => {
  syncFields(path.phoneA, path.phoneB);

  // Когда явно нужно перезапустить валидацию обоих после синхронизации
  revalidateWhen(path.phoneA, [path.phoneB]);
  revalidateWhen(path.phoneB, [path.phoneA]);
};
```

## Anti-patterns

```typescript
// ❌ Симметрично через два copyFrom — приведёт к "Cycle detected"
copyFrom(path.a, path.b);
copyFrom(path.b, path.a);

// ✅ syncFields умеет двусторонней связь без циклов
syncFields(path.a, path.b);
```

```typescript
// ❌ Ожидание, что transform применится в обе стороны
syncFields(path.a, path.b, { transform: (v) => v.trim() });
// при записи в b значение НЕ trim-ается

// ✅ Если нужны симметричные трансформы, делайте syncFields + transformValue
import { transformValue } from '@reformer/core/behaviors';
syncFields(path.a, path.b);
transformValue(path.a, (v) => (typeof v === 'string' ? v.trim() : v));
transformValue(path.b, (v) => (typeof v === 'string' ? v.trim() : v));
```

```typescript
// ❌ Поля разного типа — рантайм-приведение и баги
syncFields(path.amountString, path.amountNumber); // string ↔ number

// ✅ Используйте computeFrom + ручное обратное связывание
computeFrom([path.amountString], path.amountNumber, (v) => Number(v.amountString));
```

```typescript
// ❌ Sync для FormArray/FormGroup — компонент не сравнивает по содержимому
syncFields(path.itemsA, path.itemsB); // ссылочное равенство, потенциально лишние перезаписи

// ✅ Для коллекций — copyFrom + явный fields/transform либо ручной watchField
```

## Troubleshooting

**Q: Поля «дёргаются», вижу несколько перезаписей.**
A: Чаще всего внутри одного из полей висит `transformValue` или `computeFrom`. Передайте `debounce: 100…300` в `syncFields`, и/или проверьте, что у источника transform идемпотентен (`f(f(x)) === f(x)`).

**Q: Курсор/каретка прыгает в input.**
A: Симптом частых `setValue`. Поднимите `debounce` (минимум 150 ms) и убедитесь, что `transform` стабильный (не возвращает `new String(...)` или другой объект-обёртку). Лучше — храните «канонический» формат в одном поле и считайте отображаемый через `computeFrom`.

**Q: Sync не работает после `form.reset()`.**
A: `reset()` устанавливает оба поля одновременно. Это нормально — sync догонится при первом следующем изменении. Если нужна согласованность сразу после reset — задайте одинаковые initial values в схеме.

**Q: «Cycle detected» при включённом `syncFields`.**
A: Не вешайте `watchField(path.a, …)` + `watchField(path.b, …)`, которые сами пишут друг в друга. `syncFields` уже занимает оба направления. Перенесите side-эффекты в `watchField` на одно поле и не трогайте второе изнутри callback.

**Q: Как ограничить sync условием (как `when` у copyFrom)?**
A: У `syncFields` нет `when`. Сэмулируйте через `apply` под условием либо комбинируйте `copyFrom(a → b, { when })` и `copyFrom(b → a, { when })` с разными флагами, разрешая только одну активную сторону за раз.

## See also

- [23-copy-from.md](./23-copy-from.md) — однонаправленное копирование с `when`
- [26-transform-value.md](./26-transform-value.md) — нормализация значений на месте
- [22-cycle-detection.md](./22-cycle-detection.md) — почему симметричный copy ломается
- [03-api-signatures.md](./03-api-signatures.md) — `computeFrom` для производных значений
