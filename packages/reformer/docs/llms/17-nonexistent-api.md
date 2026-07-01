## 15. NON-EXISTENT API (DO NOT USE)

**Следующего API НЕТ в @reformer/core** (частично — наследие старой path-based архитектуры,
удалено при переходе на M1):

| Wrong                            | Correct                                          | Notes                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `useForm`                        | `createModel` + `createForm`                     | Хука useForm нет                               |
| `validate`, `validateAsync`      | `validators: [...]` в схеме + `validateFormModel`| Операторов валидации нет; валидаторы — фабрики |
| `applyWhen`, `apply` (валидация) | branch-узел `{ when, children }` в схеме         | Условная валидация — узлом дерева схемы         |
| `validateItems`, `validateGroup`, `validateTree` | секция массива в схеме + `ModelValidator` | Удалены                                  |
| `validateForm`                   | `validateFormModel(model, schema)`               | Legacy-движок удалён                            |
| `ValidationSchemaFn`, `BehaviorSchemaFn` | `defineFormBehavior` / `ModelValidator`  | Типы path-схем удалены                          |
| `FieldPath`, `FieldPathNode`     | `model.$.field` (`PathAwareSignal`)              | Пути заменены сигналами                         |
| `ctx.form.x.value.value`         | `model.x` / `model.$.x.value`                    | В behaviors читаем модель напрямую              |
| `ctx.setFieldValue(name, value)` | `model.x = value` / `compute(...)`               | Не существует                                   |
| `transformers`, `createTransformer` | `transformValue(signal, fn)`                  | Готового набора трансформеров нет               |
| `equalTo`, `custom`, `notEmpty`, `date` (validators) | кастомный `ModelValidator`   | Таких фабрик нет; пиши функцию `(value, scope, root)` |
| `useHiddenCondition`             | `useFormControlValue` + условный рендер в JSX    | Хука нет                                        |
| `FormProvider`, `control` prop, `register()` | `<Component form={form} />`, `useFormControl(form.field)` | Форма передаётся через props |
| `getFieldValue()`                | `model.field` / `useFormControlValue(form.field)`| Не существует                                   |

### Common Import Errors

```typescript
// WRONG - эти символы НЕ существуют
import { useForm, validateForm } from '@reformer/core';           // NO!
import { validate, applyWhen, equalTo } from '@reformer/core/validators'; // NO!
import { transformers } from '@reformer/core/behaviors';          // NO!
import type { FieldPath, ValidationSchemaFn } from '@reformer/core'; // NO!

// CORRECT
import { createModel, createForm, validateFormModel, useFormControl } from '@reformer/core';
import { required, email, min } from '@reformer/core/validators';
import { defineFormBehavior, compute, onChange } from '@reformer/core/behaviors';
import type { FieldConfig, FieldNode, ModelValidator } from '@reformer/core';
```

### Schema Common Mistakes

```typescript
// WRONG - примитивные значения / value-литерал не работают под M1
const schema = {
  name: '',                       // нет привязки к сигналу
  email: { value: '', ... },      // value должен быть model.$.email, а не литерал
};

// CORRECT - каждое поле привязано к сигналу модели
const schema = {
  name:  { value: model.$.name,  component: Input, componentProps: { label: 'Name' } },
  email: { value: model.$.email, component: Input, componentProps: { label: 'Email' } },
};
```

### Behaviors Common Mistakes

```typescript
// WRONG - строковые пути и (form) => ... — старый API
enableWhen(path.city, (form) => Boolean(form.country));

// CORRECT - сигналы модели, условие читает model
enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true });
```
