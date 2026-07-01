## 13. EXTENDED COMMON MISTAKES

### Reuse via apply / applyEach — не дублируй код

```typescript
import { defineFormBehavior, apply, applyEach, compute } from '@reformer/core/behaviors';

// ✅ apply — одна под-схема на несколько групп
const addressBehavior = defineFormBehavior<Address>(({ model }) => {
  compute(model.$.full, () => `${model.city}, ${model.street}`);
});

const behavior = defineFormBehavior<Form>(({ model }) => {
  apply([model.$.homeAddress, model.$.workAddress], addressBehavior);

  // ✅ applyEach — под-схема на КАЖДЫЙ элемент массива (реагирует на add/remove)
  applyEach(
    model.$.items,
    defineFormBehavior<Item>(({ model: row }) => {
      compute(row.$.lineTotal, () => row.qty * row.price);
    })
  );
});
```

### Идемпотентность transformValue

```typescript
// ❌ неидемпотентный transformer — бесконечный цикл setValue → callback → setValue
transformValue(model.$.field, (v) => `prefix-${v}`); // f(f(x)) ≠ f(x)

// ✅ guard «уже преобразовано»
transformValue(model.$.field, (v) => (v?.startsWith('prefix-') ? v : `prefix-${v}`));
```

### compute для производных полей вместо ручной синхронизации

```typescript
// ❌ ручной onChange + запись — легко зациклить/забыть кейс
onChange(model.$.firstName, () => { model.fullName = `${model.firstName} ${model.lastName}`; });

// ✅ compute: цель не входит в источники → цикла нет, запись идемпотентна (peek-guard)
compute(model.$.fullName, () => [model.firstName, model.lastName].filter(Boolean).join(' '));
```

### Расходящийся цикл compute (Cycle detected)

Взаимные `compute`/`computeFrom` без стабилизации preact обрывает как «Cycle detected».
DSL перехватывает это и бросает понятную ошибку с именем поля. Решение — разорвать цикл
условием `when` или читать одну сторону через `peek()`:

```typescript
// ❌ взаимный пересчёт без стабилизации
compute(model.$.a, () => model.b + 1);
compute(model.$.b, () => model.a + 1); // расходится → Cycle detected

// ✅ добавь стабилизирующее условие или однонаправленную зависимость
compute(model.$.total, () => model.price * model.qty); // одно направление
```

### Cross-field валидация — через `root`

```typescript
import type { ModelValidator } from '@reformer/core';

// Правило вешается на ПОЛЕ-НОСИТЕЛЬ ошибки. Соседние поля читаются через root.
const field1LessThanField2: ModelValidator<number, unknown, Form> = (_value, _scope, root) =>
  root.field1 > root.field2 ? { code: 'error', message: 'Invalid' } : null;

const schema = {
  field1: { value: model.$.field1, component: Input, validators: [field1LessThanField2] },
};

// Чтобы правило перезапускалось при изменении field2:
import { revalidateWhen } from '@reformer/core';
revalidateWhen([model.$.field2], () => validateFormModel(model, schema));
```

> **Удалённый API.** Операторы `validate`/`validateAsync`/`applyWhen`/`apply` (валидации),
> `validateGroup`/`validateTree`/`validateForm`, типы `FieldPath`/`ValidationSchemaFn`/`BehaviorSchemaFn`
> и `ctx.form.*`/`ctx.setFieldValue` — из старой path-based архитектуры и УДАЛЕНЫ. См. `17-nonexistent-api.md`.
