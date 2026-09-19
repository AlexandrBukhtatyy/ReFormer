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

### Cross-field валидация — через `cross(sig, fn)`

Cross-field живёт в схеме валидации (`@reformer/core/validation`), а не в layout: правило вешается на
ПОЛЕ-НОСИТЕЛЬ ошибки оператором `cross(sig, fn)`, а `fn` читает снапшот текущего scope (`model.get()`).

```typescript
import { defineValidationSchema, validate, cross, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { revalidateWhen, type ValidationError } from '@reformer/core';

// ❌ старое (УДАЛЕНО): дерево { value, validators }, ModelValidator (value, scope, root), validateFormModel
const legacyRule: ModelValidator<number, unknown, Form> = (_value, _scope, root) =>
  root.field1 > root.field2 ? { code: 'error', message: 'Invalid' } : null;
const legacySchema = { field1: { value: model.$.field1, component: Input, validators: [legacyRule] } };
validateFormModel(model, legacySchema);

// ✅ новое: cross-правило — обычная функция над снапшотом (model.get()), не читает scope/root
const field1LessThanField2 = (f: Form): ValidationError | null =>
  f.field1 > f.field2 ? { code: 'error', message: 'Invalid' } : null;

const schema = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.field1, [required()]);
  cross(model.$.field1, field1LessThanField2); // правило на поле-носителе ошибки
});

// Прогон — ТОЛЬКО внешним раннером; ошибки сами доезжают до нод формы.
// ⚠️ form.validate()/submit() схему валидации больше НЕ прогоняют.
await validateModel(model, schema);

// Перезапуск правила при изменении соседнего поля — мост «поведение → валидация»:
revalidateWhen([model.$.field2], () => void validateModel(model, schema));
```

> **Актуальный vs удалённый API.** Операторы валидации `validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`
> ТЕПЕРЬ существуют — в `@reformer/core/validation` с новыми сигнатурами (ambient, активны только внутри прогона
> `validateModel`). УДАЛЕНЫ: `applyWhen`, `validateGroup`/`validateTree`/`validateForm`/`validateFormModel`,
> типы `FieldPath`/`ValidationSchemaFn`/`BehaviorSchemaFn` и `ctx.form.*`/`ctx.setFieldValue` (наследие
> path-based архитектуры). См. `17-nonexistent-api.md`.
