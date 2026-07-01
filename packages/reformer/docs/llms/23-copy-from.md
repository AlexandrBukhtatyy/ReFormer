# copyFrom — Копирование значений между полями

## Purpose

`copyFrom` декларативно копирует значение одного поля (или группы) в другое при выполнении
условия `when`. Используется для UX-сценариев «совпадает с …»: «адрес проживания = адрес
регистрации», «email для уведомлений = основной email», «billing = shipping». Оператор сам
выходит из reactive-контекста (`runOutsideEffect`), поэтому не порождает «Cycle detected».

## API

Есть две формы. **Примитив из `@reformer/core`** (сигнал → сигнал):

```typescript
function copyFrom<T>(
  source: ReadonlySignal<T>,
  target: Signal<T>,
  options?: { when?: () => boolean; transform?: (value: T) => T }
): () => void; // возвращает cleanup
```

**DSL-оператор из `@reformer/core/behaviors`** (сигнал ИЛИ группа):

```typescript
function copyFrom<T>(
  source: ReadonlySignal<T> | object,   // model.$.field или model.$.group
  target: Signal<T> | object,
  options?: { when?: () => boolean; transform?: (value: T) => T }
): void; // cleanup управляется формой
```

`when` — реактивное условие (читает сигналы модели через `model.*`). `transform` применяется
к значению перед записью в target. Отдельной опции `fields`/`debounce` нет.

## Examples

### Базовый сценарий — синхронизация двух адресов

```typescript
import { defineFormBehavior, copyFrom } from '@reformer/core/behaviors';

type OrderForm = {
  useShippingAsBilling: boolean;
  shippingAddress: string;
  billingAddress: string;
};

export const orderBehavior = defineFormBehavior<OrderForm>(({ model }) => {
  copyFrom(model.$.shippingAddress, model.$.billingAddress, {
    when: () => model.useShippingAsBilling === true,
  });
});
```

Source: `BehaviorsExamples.tsx` (monorepo example): `copyFrom(model.$.shippingAddress, model.$.billingAddress, { when: () => model.useShippingAsBilling })`.

### Копирование группы целиком

Когда source/target — группы (`model.$.registrationAddress`), копируется всё значение группы:

```typescript
import { defineFormBehavior, copyFrom } from '@reformer/core/behaviors';

type ProfileForm = {
  sameAsRegistration: boolean;
  registrationAddress: Address;
  residenceAddress: Address;
};

export const profileBehavior = defineFormBehavior<ProfileForm>(({ model }) => {
  copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
    when: () => model.sameAsRegistration === true,
  });
});
```

### Copy + transform — нормализация при копировании

```typescript
import { defineFormBehavior, copyFrom } from '@reformer/core/behaviors';

type ContactForm = { sameEmail: boolean; email: string; emailAdditional: string };

export const contactBehavior = defineFormBehavior<ContactForm>(({ model }) => {
  copyFrom(model.$.email, model.$.emailAdditional, {
    when: () => model.sameEmail === true,
    transform: (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  });
});
```

### Как примитив (вне defineFormBehavior)

```typescript
import { copyFrom } from '@reformer/core';

const cleanups = [
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true }),
];
// teardown: cleanups.forEach((c) => c());
```

## Anti-patterns

```typescript
// ❌ Двусторонняя связь через два copyFrom — конфликт направлений
copyFrom(model.$.a, model.$.b);
copyFrom(model.$.b, model.$.a);

// ✅ Двусторонняя синхронизация — это работа syncFields
syncFields(model.$.a, model.$.b);
```

```typescript
// ❌ when, читающий саму target — лишний триггер при перезаписи target
copyFrom(model.$.source, model.$.target, { when: () => model.target === '' });

// ✅ when опирается на независимый флаг
copyFrom(model.$.source, model.$.target, { when: () => model.copyEnabled === true });
```

## Troubleshooting

**Q: Скопированное значение не появляется в target.**
A: Проверьте, что (1) behavior передан в `createForm({ behavior })` (или примитив вызван и не
отписан); (2) `when` возвращает `true`; (3) типы source/target совместимы (`copyFrom` пишет как есть).

**Q: «Cycle detected» при копировании.**
A: Обычно `when` читает значение target (см. anti-pattern). Условие должно зависеть только от
source и независимых флагов.

**Q: Как откатить копию при снятии флага `when`?**
A: `copyFrom` при `when === false` просто не пишет (не сбрасывает). Для сброса используй параллельно
`resetWhen(model.$.target, () => !model.copyEnabled)` (см. `25-reset-when.md`).

## See also

- [24-sync-fields.md](./24-sync-fields.md) — двусторонняя синхронизация
- [25-reset-when.md](./25-reset-when.md) — сброс target при выключенном условии
- [20-compute-vs-watch.md](./20-compute-vs-watch.md) — `compute` для производных значений
- [22-cycle-detection.md](./22-cycle-detection.md) — почему `runOutsideEffect` защищает от циклов
