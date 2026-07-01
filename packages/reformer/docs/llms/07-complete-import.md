## Import Patterns

```typescript
// Модель, форма, валидация, хуки, типы, примитивы behaviors — из @reformer/core
import {
  // фабрики
  createModel,
  createForm,
  // валидация данных (headless)
  validateModel,
  validateModelSync,
  validateFormModel,
  // хуки
  useFormControl,
  useFormControlValue,
  useArrayLength,
  // примитивы behaviors (принимают сигналы, возвращают cleanup)
  computeFrom,
  copyFrom,
  watchField,
  enableWhen,
  disableWhen,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
} from '@reformer/core';

// Типы
import type {
  FormModel,        // реактивная модель данных
  FormProxy,        // тип формы для props компонентов
  FieldNode,        // узел одного поля
  GroupNode,        // узел группы
  ArrayNode,        // узел массива
  ModelArray,       // реактивный массив модели (push/removeAt/at/map/length)
  ModelSignals,     // дерево сигналов ($)
  PathAwareSignal,  // сигнал, знающий свой путь
  ModelValidator,   // (value, scope, root) => ValidationError | null
  ValidationError,
  FieldConfig,      // { value, component, componentProps?, validators?, ... }
  FormSchema,
  FieldControlState,
} from '@reformer/core';

// Валидаторы — чистые фабрики из /validators
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
```

### Form-shape тип должен быть `type`, а не `interface`

Прокси `createForm<T>` и типы `ArrayNode<U>` / `GroupNode<U>` требуют, чтобы form-shape
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
