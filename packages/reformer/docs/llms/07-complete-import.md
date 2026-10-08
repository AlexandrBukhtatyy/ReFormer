## Import Patterns

```typescript
// Модель, форма, хуки, типы — из @reformer/core
import {
  // фабрики
  createModel,
  createForm,
  createFormFromModel,
  arrayOf, // массив модели с шаблоном новой строки
  // хуки
  useFormBundle,
  useFormControl,
  useFormControlValue,
  useArrayLength,
} from '@reformer/core';

// Типы
import type {
  FormModel,        // реактивная модель данных
  FormProxy,        // тип формы для props компонентов
  FormBundle,       // результат createForm: { model, form, validation, render }
  FieldNode,        // нода одного поля
  GroupNode,        // нода группы
  ModelArrayNode,   // нода массива под-форм
  ModelArray,       // реактивный массив модели (push/removeAt/at/map/length)
  ModelSignals,     // дерево ручек ($)
  PathAwareSignal,  // ручка, знающая свой путь
  ValidationError,
  FormSchemaNode,   // узел схемы: поле | массив под-форм | подформа | контейнер
  FormValidation,   // правила формы как данные: { steps, extras, strategy }
  FieldControlState,
} from '@reformer/core';

// Схема валидации: операторы + раннер — из /validation
import {
  defineValidationSchema,
  validate,
  validateAsync,
  validateWhen,
  apply,     // правила подформы: apply(model.$.group, rules); композиция: apply(rulesA, rulesB)
  applyEach, // правила строк массива: applyEach(model.$.items, rules)
  validateModel, // раннер: сбор + разнос, Promise<boolean>
  runValidation, // только сбор: Promise<ValidationResult>
  applyValidationResult, // разнос собранного результата по нодам
} from '@reformer/core/validation';
import type {
  Rule,             // (value) => ValidationError | null
  AsyncRule,        // (value, { signal }) => Promise<ValidationError | null>
  ValidationSchema, // ({ model, cross }) => void — cross берётся из аргумента схемы
  ValidationResult, // { status, errors, failures }
} from '@reformer/core/validation';

// Валидаторы — чистые фабрики из /validators (кладутся в validate(sig, [...]))
import { required, min, max, email, minLength, pattern } from '@reformer/core/validators';

// Декларативный DSL behaviors — из /behaviors
import {
  defineFormBehavior,
  compute,
  computeFrom,
  copyFrom,
  onChange,
  enableWhen,
  disableWhen,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
  apply,
  applyEach,
  aggregateInto,
  exclusiveFlag,
} from '@reformer/core/behaviors';

// Примитивы над сигналами (принимают сигналы, возвращают cleanup) — из /model, в корне их нет
import { computeFrom, copyFrom, watchField } from '@reformer/core/model';
```

### Form-shape тип должен быть `type`, а не `interface`

Прокси `createForm<T>` и типы `ModelArrayNode<U>` / `GroupNode<U>` требуют, чтобы form-shape
структурно совпадал с `Record<string, FormValue>`. У `interface` нет неявной index signature,
поэтому объявляй form-shape (и типы элементов массива, и вложенные группы) через `type`-alias:

```typescript
export type AddressForm = {
  street: string;
  city: string;
};

export type CoBorrower = {
  fullName: string;
  phone: string;
};
```

См. `30-type-safety-recipes.md`.
