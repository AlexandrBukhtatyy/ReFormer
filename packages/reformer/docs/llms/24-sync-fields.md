# syncFields — Двусторонняя синхронизация полей

## Purpose

`syncFields` создаёт двунаправленную связь между двумя полями: изменение любого из них
переписывает второе. Применяется для дублей одного значения в разных частях формы
(тех. поле + видимое представление, mirror-поля). Внутренний флаг + `runOutsideEffect`
исключают петли. Для одностороннего копирования — [`copyFrom`](./23-copy-from.md); для
расчётов — [`compute`](./20-compute-vs-watch.md).

## API

Одинаково в примитиве (`@reformer/core`) и DSL (`@reformer/core/behaviors`):

```typescript
// примитив: возвращает cleanup
function syncFields<T>(a: Signal<T>, b: Signal<T>, options?: { transform?: (value: T) => T }): () => void;

// DSL: cleanup управляется формой
function syncFields<T>(a: Signal<T>, b: Signal<T>, options?: { transform?: (value: T) => T }): void;
```

`a`/`b` — сигналы (`model.$.field`) совместимого типа `T`. `transform` **асимметричен**:
применяется только при движении значения `a → b`. Опции `debounce`/`when` нет.

## Examples

### Базовый сценарий — отзеркаливание текста

```typescript
import { defineFormBehavior, syncFields } from '@reformer/core/behaviors';

type MirrorForm = { syncField1: string; syncField2: string };

export const mirrorBehavior = defineFormBehavior<MirrorForm>(({ model }) => {
  syncFields(model.$.syncField1, model.$.syncField2);
});
```

Пример: `syncFields(model.$.syncField1, model.$.syncField2)`.

### С трансформацией — нормализация при прямой записи

```typescript
import { defineFormBehavior, syncFields } from '@reformer/core/behaviors';

type DisplayForm = { internalCode: string; displayCode: string };

export const codeBehavior = defineFormBehavior<DisplayForm>(({ model }) => {
  // internalCode → displayCode: uppercase; обратно значение пишется как есть
  syncFields(model.$.internalCode, model.$.displayCode, {
    transform: (value) => (typeof value === 'string' ? value.toUpperCase() : value),
  });
});
```

### Как примитив (вне defineFormBehavior)

```typescript
import { syncFields } from '@reformer/core';
const stop = syncFields(model.$.syncField1, model.$.syncField2);
// stop() — отписаться
```

## Anti-patterns

```typescript
// ❌ Симметрично через два copyFrom — конфликт направлений
copyFrom(model.$.a, model.$.b);
copyFrom(model.$.b, model.$.a);

// ✅ syncFields умеет двустороннюю связь без петель
syncFields(model.$.a, model.$.b);
```

```typescript
// ❌ Ожидание, что transform применится в обе стороны
syncFields(model.$.a, model.$.b, { transform: (v) => v.trim() });
// при записи в b значение НЕ trim-ается

// ✅ Симметричные трансформы — syncFields + transformValue на обоих полях
syncFields(model.$.a, model.$.b);
transformValue(model.$.a, (v) => (typeof v === 'string' ? v.trim() : v));
transformValue(model.$.b, (v) => (typeof v === 'string' ? v.trim() : v));
```

```typescript
// ❌ Поля разного типа — рантайм-приведение и баги
syncFields(model.$.amountString, model.$.amountNumber); // string ↔ number

// ✅ Для конвертации — compute в обе стороны или один канонический формат + computed отображение
compute(model.$.amountNumber, () => Number(model.amountString));
```

## Troubleshooting

**Q: Поля «дёргаются», несколько перезаписей.**
A: Чаще всего на одном из полей висит `transformValue`/`compute`. Убедитесь, что transform
идемпотентен (`f(f(x)) === f(x)`).

**Q: «Cycle detected» при `syncFields`.**
A: Не вешайте дополнительно `onChange`/`watchField`, которые сами пишут в эти же поля.
`syncFields` уже занимает оба направления.

**Q: Как ограничить sync условием (как `when` у copyFrom)?**
A: У `syncFields` нет `when`. Эмулируй через два `copyFrom(a→b, { when })` / `copyFrom(b→a, { when })`
с флагами, разрешающими только одну активную сторону, либо через `apply` под условием.

## See also

- [23-copy-from.md](./23-copy-from.md) — однонаправленное копирование с `when`
- [26-transform-value.md](./26-transform-value.md) — нормализация значений на месте
- [22-cycle-detection.md](./22-cycle-detection.md) — почему симметричный copy ломается
- [20-compute-vs-watch.md](./20-compute-vs-watch.md) — `compute` для производных значений
