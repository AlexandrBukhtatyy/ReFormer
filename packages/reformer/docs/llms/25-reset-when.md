# resetWhen — Условный сброс полей

## Purpose

`resetWhen` сбрасывает значение поля к `resetValue`, когда `condition` истинно. Это
альтернатива `enableWhen({ resetOnDisable: true })`, когда поле остаётся **enabled**, но
содержимое нужно очистить (например, переключение способа оплаты обнуляет «номер карты», но
поле по-прежнему доступно). По умолчанию пишет `null`; `resetValue` задаёт произвольное значение.

## API

Одинаково в примитиве (`@reformer/core`) и DSL (`@reformer/core/behaviors`):

```typescript
// примитив: возвращает cleanup
function resetWhen<T>(target: Signal<T>, condition: () => boolean, options?: { resetValue?: T }): () => void;

// DSL: cleanup управляется формой
function resetWhen<T>(target: Signal<T>, condition: () => boolean, options?: { resetValue?: T }): void;
```

`target` — сигнал (`model.$.field`). `condition` — реактивное условие (читает `model.*`).
`resetValue` по умолчанию `null`. Опций `onlyIfDirty`/`debounce` нет; флаги dirty/touched
поля не трогаются оператором (значения принадлежат модели).

## Examples

### Базовый сценарий — сброс номера карты при смене способа оплаты

```typescript
import { defineFormBehavior, resetWhen } from '@reformer/core/behaviors';

type CheckoutForm = { paymentType: 'card' | 'cash'; cardNumber: string };

export const checkoutBehavior = defineFormBehavior<CheckoutForm>(({ model }) => {
  resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
});
```

Пример: `resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' })`.

### resetValue для числовых полей

```typescript
import { defineFormBehavior, resetWhen } from '@reformer/core/behaviors';

type MortgageForm = { propertyValue: number | null; initialPayment: number };

export const mortgageBehavior = defineFormBehavior<MortgageForm>(({ model }) => {
  // initialPayment теряет смысл без propertyValue — сбрасываем в 0
  resetWhen(model.$.initialPayment, () => !model.propertyValue, { resetValue: 0 });
});
```

### Как примитив (вне defineFormBehavior)

```typescript
import { resetWhen } from '@reformer/core';
const stop = resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
```

## Anti-patterns

```typescript
// ❌ resetWhen вместо enableWhen для disable-сценария
resetWhen(model.$.field, () => !model.show);
// поле останется enabled и валидируемым — ошибка required всё равно прилетит

// ✅ Если поле должно «исчезнуть» — блокируем + сбрасываем
enableWhen(model.$.field, () => model.show, { resetOnDisable: true });
```

```typescript
// ❌ resetValue с типом, отличным от поля
resetWhen(model.$.amount, () => model.skipPayment, { resetValue: 'none' }); // amount: number ← string

// ✅ resetValue совместим с типом поля
resetWhen(model.$.amount, () => model.skipPayment, { resetValue: 0 });
```

```typescript
// ❌ Для строкового поля без resetValue прилетит null, а Input ждёт string
resetWhen(model.$.cardNumber, () => model.paymentType !== 'card');

// ✅ Явный resetValue для строк
resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
```

```typescript
// ❌ condition читает саму цель — самотриггер (см. 22-cycle-detection.md)
resetWhen(model.$.cardNumber, () => model.cardNumber !== '');

// ✅ condition зависит только от независимого поля
resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
```

## Troubleshooting

**Q: Сброс не срабатывает, хотя `condition` возвращает true.**
A: Проверьте, что behavior зарегистрирован (`createForm({ behavior })`) или примитив не отписан,
и что `condition` читает реактивные поля (`model.*`), а не снимок `model.get()`.

**Q: Реактивная цепочка resetWhen → compute → resetWhen ломается.**
A: Убедитесь, что `condition` не зависит от значения самого поля, иначе после сброса попадёте
в новый триггер.

**Q: Сбросить вложенную группу целиком?**
A: `resetWhen` рассчитан на скалярные сигналы. Для группы используй `enableWhen({ resetOnDisable: true })`
(проходит по поддереву) или `model.reset()` для сброса всей формы к initial-снимку.

## See also

- [04-common-patterns.md](./04-common-patterns.md) — `enableWhen({ resetOnDisable: true })` как альтернатива
- [23-copy-from.md](./23-copy-from.md) — копирование, у которого нет встроенного отката
- [22-cycle-detection.md](./22-cycle-detection.md) — почему `condition` не должен читать целевое поле
