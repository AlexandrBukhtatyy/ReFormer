# План: Новый контракт валидаторов — операторы vs валидаторы

## Контекст

Текущий API валидации смешивает две ответственности в одних и тех же функциях:

- **Примитивы** `required`, `min`, `pattern`, `email`, … принимают `fieldPath` и одновременно регистрируют валидатор в реестре, и содержат логику проверки значения. Это делает их невозможными к переиспользованию вне схемы (нельзя протестировать `required` без формы), и плохо комбинируются.
- **Кастомная логика** через `validate(path, (value, ctx) => …)` использует сигнатуру `(value, ctx)`, где `ctx: FormContext<TForm>` — это объект с `form: FormProxy<TForm>`, `setFieldValue()`, `getFieldByPath()`. Текущий `control: FieldNode<TField>` спрятан внутри контекста и недоступен валидатору напрямую.
- **Cross-field валидация** через `validateTree((ctx) => …, { targetField: 'string' })` использует строковые пути (не type-safe) и не позволяет ограничить область применения поддеревом.

**Решение:** ввести строгое разделение на:

- **Валидаторы** — чистые функции `(value, control, root) => error | null`. Не знают про реестр, легко тестируются и комбинируются. Примитивы становятся фабриками таких функций.
- **Операторы** — функции, которые регистрируют валидаторы в схеме: `validate`, `validateAsync`, `validateGroup`, `apply`, `applyWhen`, `validateItems`. Они единственная точка контакта с реестром.

Это **breaking change** для major-версии — clean break без backward-compatibility слоя.

---

## Принятые решения

| Решение                          | Выбор                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `control` в чистом валидаторе    | `FormProxy<TField>`                                                           |
| `root` в чистом валидаторе       | `FormProxy<TForm>`                                                            |
| Совместимость                    | Breaking change (clean break)                                                 |
| Tree-валидаторы                  | Отдельный тип `GroupValidator<TForm, TScope = TForm>` со scope                |
| Имя оператора cross-field        | `validateGroup`                                                               |
| Примитивы (`required`, `min`, …) | Фабрики валидаторов из `@reformer/core/validators`, передаются в `validate()` |
| Async-валидаторы                 | Отдельный оператор `validateAsync(path, asyncFn, { debounce })`               |
| `targetField`                    | Только `FieldPathNode` (type-safe)                                            |

---

## Архитектура

```
┌───────────────────────────────────────────────────────────────┐
│                    ValidationSchemaFn<T>                      │
│           (path) => { … операторы регистрируют …}             │
├───────────────────────────────────────────────────────────────┤
│  ОПЕРАТОРЫ (работают со схемой / реестром)                    │
│  ─────────────────────────────────────────                    │
│  • validate(path, validator, options?)        — sync field    │
│  • validateAsync(path, asyncValidator, opts)  — async field   │
│  • validateGroup(path, validator, opts?)      — scope = root  │
│  • validateGroup(path.x, validator, opts?)    — scope = ветвь │
│  • apply(path|paths, schemaFn|schemaFns)      — композиция    │
│  • applyWhen(path, condition, schemaFn)       — условная      │
│  • validateItems(arrayPath, itemSchemaFn)     — для массивов  │
├───────────────────────────────────────────────────────────────┤
│  ВАЛИДАТОРЫ (чистые функции, не знают про реестр)             │
│  ──────────────────────────────────────────────               │
│  type Validator<TForm, TField> =                              │
│    (value, control, root) => ValidationError | null           │
│                                                               │
│  type AsyncValidator<TForm, TField> =                         │
│    (value, control, root) => Promise<ValidationError | null>  │
│                                                               │
│  type GroupValidator<TForm, TScope = TForm> =                 │
│    (scope, root) => ValidationError | null                    │
│                                                               │
│  Фабрики (@reformer/core/validators):                         │
│  • required(opts?)            → Validator                     │
│  • min(value, opts?)          → Validator                     │
│  • max(value, opts?)          → Validator                     │
│  • minLength(n, opts?)        → Validator                     │
│  • maxLength(n, opts?)        → Validator                     │
│  • pattern(regex, opts?)      → Validator                     │
│  • email(opts?), url(opts?), phone(opts?), number(opts?)      │
│  • minAge, maxAge, minDate, maxDate, isDate, futureDate, …    │
└───────────────────────────────────────────────────────────────┘
```

---

## Новые типы

[packages/reformer/src/core/types/validation-schema.ts](packages/reformer/src/core/types/validation-schema.ts) — переписать.

```typescript
import type { FormProxy } from './form-proxy';
import type { FieldPath, FieldPathNode } from './field-path';
import type { FormFields, ValidationError } from './index';

// ============================================================================
// Validator types (чистые функции — не знают про реестр)
// ============================================================================

export type Validator<TForm, TField> = (
  value: TField,
  control: FormProxy<TField>,
  root: FormProxy<TForm>
) => ValidationError | null;

export type AsyncValidator<TForm, TField> = (
  value: TField,
  control: FormProxy<TField>,
  root: FormProxy<TForm>
) => Promise<ValidationError | null>;

export type GroupValidator<TForm, TScope = TForm> = (
  scope: FormProxy<TScope>,
  root: FormProxy<TForm>
) => ValidationError | null;

export type ConditionFn<T> = (value: T) => boolean;

// ============================================================================
// Опции
// ============================================================================

export interface ValidateOptions {
  message?: string;
  params?: FormFields;
}

export interface ValidateAsyncOptions extends ValidateOptions {
  debounce?: number;
}

export interface ValidateGroupOptions<TForm> {
  /** Поле, к которому привязать ошибку. Type-safe (FieldPathNode). */
  targetField?: FieldPathNode<TForm, unknown>;
}

// ============================================================================
// Schema function
// ============================================================================

export type ValidationSchemaFn<T> = (path: FieldPath<T>) => void;

// ============================================================================
// Internal registration
// ============================================================================

export interface ValidatorRegistration {
  fieldPath: string;
  type: 'sync' | 'async' | 'group';
  validator:
    | Validator<unknown, unknown>
    | AsyncValidator<unknown, unknown>
    | GroupValidator<unknown, unknown>;
  options?: ValidateOptions | ValidateAsyncOptions | ValidateGroupOptions<unknown>;
  /** Для group-валидатора — путь до scope (для root формы — пустая строка ''). */
  scopePath?: string;
  /** Для условной валидации (applyWhen). */
  condition?: {
    fieldPath: string;
    conditionFn: ConditionFn<unknown>;
  };
}
```

**Удаляются типы:** `ContextualValidatorFn`, `ContextualAsyncValidatorFn`, `TreeValidatorFn`, `ValidateTreeOptions`.

**Удаляется `FormContext`:** [packages/reformer/src/core/types/form-context.ts](packages/reformer/src/core/types/form-context.ts) больше не нужен — он встроенно был "control + root + helpers". В новом API `control` и `root` передаются явно. `setFieldValue` / `getFieldByPath` доступны через `root` proxy.

---

## API операторов

### validate

[packages/reformer/src/core/validation/core/validate.ts](packages/reformer/src/core/validation/core/validate.ts)

```typescript
export function validate<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  validator: Validator<TForm, TField>,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerSync(path, validator, options);
}
```

### validateAsync

[packages/reformer/src/core/validation/core/validate-async.ts](packages/reformer/src/core/validation/core/validate-async.ts)

```typescript
export function validateAsync<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField>,
  validator: AsyncValidator<TForm, TField>,
  options?: ValidateAsyncOptions
): void {
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerAsync(path, validator, options);
}
```

### validateGroup

Новый файл — [packages/reformer/src/core/validation/core/validate-group.ts](packages/reformer/src/core/validation/core/validate-group.ts). Удалить [packages/reformer/src/core/validation/core/validate-tree.ts](packages/reformer/src/core/validation/core/validate-tree.ts).

**Одна сигнатура, без перегрузок.** Первый аргумент всегда обязателен — это путь до scope. Для root формы передаётся сам `path` (он представляет всю форму как `FieldPathNode<TForm, TForm>`); для поддерева — конкретное поле.

```typescript
export function validateGroup<TForm, TScope = TForm>(
  scopePath: FieldPathNode<TForm, TScope>,
  validator: GroupValidator<TForm, TScope>,
  options?: ValidateGroupOptions<TForm>
): void {
  const path = extractPath(scopePath);
  getCurrentValidationRegistry().registerGroup(
    validator as GroupValidator<unknown, unknown>,
    options,
    path
  );
}
```

**Использование:**

```typescript
// Scope = вся форма (path передаётся как FieldPathNode<TForm, TForm>)
validateGroup(
  path,
  (root, _root) => {
    const v = root.getValue();
    if (v.initialPayment > v.propertyValue) {
      return { code: 'tooHigh', message: 'Взнос > стоимости' };
    }
    return null;
  },
  { targetField: path.initialPayment }
);

// Scope = поддерево personalData
validateGroup(path.personalData, (scope, root) => {
  if (scope.lastName.value === scope.firstName.value) {
    return { code: 'sameNames', message: 'Фамилия = Имя?' };
  }
  return null;
});
```

**Требуется на стороне типов:** `FieldPath<T>` должен быть совместим с `FieldPathNode<T, T>`. Сейчас `FieldPath<T>` — это типизированный path-proxy (доступ к полям через `path.fieldName`). Нужно убедиться, что `FieldPath<T> extends FieldPathNode<T, T>` (либо сам root path-node имеет одновременно и доступ к полям, и метаданные node). Проверить и при необходимости подтянуть в [packages/reformer/src/core/types/field-path.ts](packages/reformer/src/core/types/field-path.ts).

### apply / applyWhen / validateItems

Не меняются по сигнатуре — только подтянуть импорты типов.

---

## Примитивы как фабрики валидаторов

Все 16 примитивов из [packages/reformer/src/core/validation/validators/](packages/reformer/src/core/validation/validators/) переписываются с одного паттерна на другой.

### Эталон — required

**Было** (`required.ts:51-78`):

```typescript
export function required<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;
  validate(fieldPath, (value) => {
    if (value === null || value === undefined || value === '') {
      return { code: 'required', message: options?.message ?? '...', params: options?.params };
    }
    if (typeof value === 'boolean' && value !== true) {
      return { code: 'required', message: options?.message ?? '...', params: options?.params };
    }
    return null;
  });
}
```

**Стало:**

```typescript
export function required<TForm = unknown, TField = unknown>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return {
        code: 'required',
        message: options?.message ?? 'Поле обязательно для заполнения',
        params: options?.params,
      };
    }
    if (typeof value === 'boolean' && value !== true) {
      return {
        code: 'required',
        message: options?.message ?? 'Поле обязательно для заполнения',
        params: options?.params,
      };
    }
    return null;
  };
}
```

**Использование:**

```typescript
import { required, min } from '@reformer/core/validators';
import { validate } from '@reformer/core';

validate(path.loanType, required({ message: 'Выберите тип кредита' }));
validate(path.loanAmount, required());
validate(path.loanAmount, min(50000, { message: 'Min 50 000 ₽' }));
```

Тот же паттерн для всех остальных:

- [required.ts](packages/reformer/src/core/validation/validators/required.ts)
- [min.ts](packages/reformer/src/core/validation/validators/min.ts), [max.ts](packages/reformer/src/core/validation/validators/max.ts)
- [min-length.ts](packages/reformer/src/core/validation/validators/min-length.ts), [max-length.ts](packages/reformer/src/core/validation/validators/max-length.ts)
- [pattern.ts](packages/reformer/src/core/validation/validators/pattern.ts)
- [email.ts](packages/reformer/src/core/validation/validators/email.ts), [url.ts](packages/reformer/src/core/validation/validators/url.ts), [phone.ts](packages/reformer/src/core/validation/validators/phone.ts), [number.ts](packages/reformer/src/core/validation/validators/number.ts)
- [min-age.ts](packages/reformer/src/core/validation/validators/min-age.ts), [max-age.ts](packages/reformer/src/core/validation/validators/max-age.ts)
- [min-date.ts](packages/reformer/src/core/validation/validators/min-date.ts), [max-date.ts](packages/reformer/src/core/validation/validators/max-date.ts)
- [is-date.ts](packages/reformer/src/core/validation/validators/is-date.ts), [past-date.ts](packages/reformer/src/core/validation/validators/past-date.ts), [future-date.ts](packages/reformer/src/core/validation/validators/future-date.ts)
- [array-validators.ts](packages/reformer/src/core/validation/validators/array-validators.ts) — `notEmpty()` тоже становится фабрикой. `validateItems` остаётся оператором.

---

## Изменения в runtime

### validation-applicator.ts

[packages/reformer/src/core/validation/validation-applicator.ts](packages/reformer/src/core/validation/validation-applicator.ts)

**`applyFieldValidators` (строки 117–203):** заменить вызов `validator(value, context)` на `validator(value, controlProxy, rootProxy)`. Где взять proxy:

- `rootProxy = this.form.getProxy()` — есть уже на `GroupNode` (см. `validation-context.ts:36`).
- `controlProxy`:
  - `FieldNode<TField>` — нужно убедиться, что у `FieldNode` есть `getProxy()` или эквивалент. Если нет — добавить getter, который возвращает сам node, типизированный как `FormProxy<TField>` для лиф-нод (`FormProxy<primitive>` ≡ `FieldNode<primitive>` в существующей системе).
  - `GroupNode<TField>` — `(control as GroupNode<TField>).getProxy()`.
  - `ArrayNode<TItem>` — нужно решить, что такое `FormProxy<TItem[]>`. Скорее всего — обёртка над `getValue()` + item proxies.

**`applyTreeValidators` → `applyGroupValidators` (строки 213–248):**

- Переименовать.
- В registration всегда есть `scopePath`. Если `scopePath === ''` — `scopeProxy = rootProxy`. Иначе — навигация по `getFieldByPath(scopePath)` + `.getProxy()`.
- Вызывать `validator(scopeProxy, rootProxy)` вместо `validator(context)`.
- `targetField` теперь `FieldPathNode`, в registration лежит уже как `string` (после `extractPath`).

### validation-registry.ts

[packages/reformer/src/core/validation/validation-registry.ts](packages/reformer/src/core/validation/validation-registry.ts)

- `registerSync(path, validator, options)` — сигнатура `validator` меняется на новый `Validator<unknown, unknown>`.
- `registerAsync(path, validator, options)` — сигнатура `validator` меняется на новый `AsyncValidator<unknown, unknown>`.
- `registerTree(...)` → `registerGroup(validator, options?, scopePath: string)`. `scopePath` для root формы — пустая строка `''`. Сохранить registration с `type: 'group'`.

### validation-context.ts

[packages/reformer/src/core/validation/validation-context.ts](packages/reformer/src/core/validation/validation-context.ts) — **удалить весь файл.**

Классы `ValidationContextImpl`, `TreeValidationContextImpl`, `ArrayValidationContextImpl` больше не нужны:

- `ValidationContextImpl` — данные (control, root) теперь передаются в валидатор аргументами.
- `TreeValidationContextImpl` — то же самое для group.
- `ArrayValidationContextImpl.value()` — в новом API `value` приходит первым аргументом валидатора. Для ArrayNode передаётся `control.getValue()` в applicator'е.

**Удалить также re-export `ValidationContextImpl` из** [packages/reformer/src/core/validation/index.ts](packages/reformer/src/core/validation/index.ts) (строка ~48).

### form-context.ts

[packages/reformer/src/core/types/form-context.ts](packages/reformer/src/core/types/form-context.ts) — **удалить файл целиком**, убрать из `types/index.ts`.

---

## Миграция существующих использований

### Внутри пакета `@reformer/core` (тесты + примитивы)

| Группа              | Файлы                                                                                                                                                                                                                                           | Кол-во |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Типы и runtime      | `validation-schema.ts`, `validation-applicator.ts`, `validation-registry.ts`, `validate.ts`, `validate-async.ts`, `validate-tree.ts`→`validate-group.ts`, `validation-context.ts` (удалить), `form-context.ts` (удалить), `validation/index.ts` | 9      |
| Примитивы → фабрики | `validators/*.ts` (без `index.ts` и `date-utils.ts`)                                                                                                                                                                                            | 16     |
| Тесты               | `packages/reformer/src/__tests__/**/validation*`, `packages/reformer/src/__tests__/**/validators*`                                                                                                                                              | ~20    |

### Use-site код в playground / tutorials

12 файлов `*-validation.ts` в `projects/react-playground/`:

- [complex-multy-step-form/schemas/credit-application-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-validation.ts)
- [components/steps/BasicInfo/basic-info-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts)
- [components/steps/PersonalData/](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/PersonalData/personal-data-validation.ts)
- [components/steps/ContactInfo/contact-info-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/ContactInfo/contact-info-validation.ts)
- [components/steps/Employment/employment-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/Employment/employment-validation.ts)
- [components/steps/AdditionalInfo/additional-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/AdditionalInfo/additional-validation.ts)
- [components/steps/Confirmation/confirmation-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/Confirmation/confirmation-validation.ts)
- [components/nested-forms/Address/address-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/Address/address-validation.ts)
- [components/nested-forms/CoBorrower/co-borrower-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/CoBorrower/co-borrower-validation.ts)
- [components/nested-forms/ExistingLoan/existing-loan-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/ExistingLoan/existing-loan-validation.ts)
- [components/nested-forms/Property/property-validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/Property/property-validation.ts)
- [simple-form/validation/registration-validation.ts](projects/react-playground/src/pages/examples/registration-form/validation/registration-validation.ts)

Плюс [complex-multy-step-form/utils/validators/validate-age.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/utils/validators/validate-age.ts), [warnings.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/utils/validators/warnings.ts).

**Паттерны кодмода:**

```typescript
// 1. required(path.X, opts) → validate(path.X, required(opts))
required(path.loanType, { message: 'Выберите тип' })
// →
validate(path.loanType, required({ message: 'Выберите тип' }))

// 2. validateTree<T>(fn, { targetField: 'X' }) → validateGroup(path, fn, { targetField: path.X })
validateTree<CreditApplicationForm>(
  (ctx) => { const form = ctx.form.getValue(); ... },
  { targetField: 'initialPayment' }
)
// →
validateGroup(path, (scope, _root) => { const form = scope.getValue(); ... },
  { targetField: path.initialPayment }
)

// 3. validate(path.X, (value, ctx) => ...) → validate(path.X, (value, control, root) => ...)
validate(path.birthDate, (value, ctx) => {
  const form = ctx.form.getValue();
  ...
})
// →
validate(path.birthDate, (value, control, root) => {
  const form = root.getValue();
  ...
})
```

### Docs

23 файла со ссылками на `validateTree`, 18 со ссылками на `validateAsync`. Основные:

- [docs/validation.md](docs/validation.md)
- [packages/reformer/llms.txt](packages/reformer/llms.txt)
- [packages/reformer/docs/llms/](packages/reformer/docs/llms/) — 03, 04, 14, 21, 31
- [projects/reformer-doc/docs/validation/](projects/reformer-doc/docs/validation/) (+ i18n/ru)
- [projects/reformer-doc/docs/tutorial/validation/](projects/reformer-doc/docs/tutorial/validation/)
- [docs/presentations/01-technical.md](docs/presentations/01-technical.md), [03-quickstart.md](docs/presentations/03-quickstart.md)

### MCP templates

- [packages/reformer-mcp/src/prompts/templates/add-validation.md](packages/reformer-mcp/src/prompts/templates/add-validation.md) — обновить под новый API. **Критично:** до обновления MCP будет генерировать сломанный код.

---

## Порядок выполнения (sequencing)

Между фазами 1 и 4 репозиторий в broken state (broken-by-design — clean break).

1. **Phase 1 — Types & Runtime** (один атомарный коммит):
   - `validation-schema.ts` — новые типы.
   - `validate.ts`, `validate-async.ts` — новые сигнатуры.
   - `validate-tree.ts` → `validate-group.ts` (новый файл, старый удалить).
   - `validation-applicator.ts` — вызов `(value, control, root)` / `(scope, root)`.
   - `validation-registry.ts` — `registerGroup` вместо `registerTree`.
   - Удалить `validation-context.ts`, `form-context.ts`.
   - Обновить `validation/index.ts`, `types/index.ts`.

2. **Phase 2 — Primitive factories** (атомарный коммит):
   - Переписать все 16 фабрик.
   - Обновить `validators/index.ts`.

3. **Phase 3 — Internal tests:**
   - Unit-тесты фабрик (теперь без формы).
   - Integration: применение, scope в `validateGroup`, condition в `applyWhen`.

4. **Phase 4 — Use-site migration:**
   - 12+ файлов `*-validation.ts` в playground.
   - 2 файла кастомных валидаторов (`validate-age.ts`, `warnings.ts`).
   - Полная проверка `complex-multy-step-form` через e2e.

5. **Phase 5 — Docs & MCP templates:**
   - 23 файла с упоминаниями `validateTree`.
   - `add-validation.md` для MCP.

---

## Риски

**R1 — TypeScript inference для фабрик.** `required<TForm, TField>(opts): Validator<TForm, TField>` без явных параметров полагается на contextual inference из `validate(path, validator)`. Если не работает — добавить специальные перегрузки или дженерики по умолчанию (`TField = unknown`). **Mitigation:** прототипировать на `required` до начала миграции.

**R2 — `FormProxy<TField>` для array/group полей.** Сейчас `FormProxy<T>` хорошо определён для group, для лифа — это сам `FieldNode<T>`. Для `ArrayNode` контракт `FormProxy<TItem[]>` не очевиден. **Mitigation:** для array-полей валидатор получает `control.getValue()` как `value` (массив значений), `control` proxy упрощается до `{ getValue, length }` либо пользователь обращается через `root`.

**R3 — Synthetic-поля как targetField.** Поля типа `monthlyPayment`, `paymentToIncomeRatio` могут быть computed и не входить в тип `CreditApplicationForm`. После перехода на `FieldPathNode` — компиляция таких use-site сломается. **Mitigation:** проверить целевые поля до миграции, при необходимости включить их в тип формы как computed-нода.

**R4 — ArrayNode-валидаторы.** `applyFieldValidators` (`validation-applicator.ts:144-151`) специально обрабатывает ArrayNode через `ArrayValidationContextImpl`. После удаления контекстов нужно передавать `control.getValue()` как `value` и оборачивать `control` так, чтобы у валидатора был доступ хотя бы к `value`/`length`. **Mitigation:** написать минимальный proxy-adapter для ArrayNode.

**R5 — Внешние reexports.** Re-export `ValidationContextImpl` из `validation/index.ts:48` — публичный API. Внешний код (если есть) сломается. Допустимо в major.

**R6 — Объём миграции в playground.** ~30 файлов use-site плюс docs. Без кодмода — много ручной работы. **Mitigation:** написать простой кодмод (regex-based) для 3 паттернов из раздела "Use-site". ROI оправдан.

**R7 — MCP-генерация в gap-фазе.** Между Phase 1 и Phase 5 MCP будет генерировать код по обоим API. **Mitigation:** Phase 5 (templates) сделать раньше — например, до Phase 4. MCP-template без работающей реализации в core пока не критичен (это input для LLM, не runtime).

---

## Верификация

После завершения миграции:

1. **`pnpm typecheck` в `packages/reformer`** — должен пройти без ошибок. Старые типы (`ContextualValidatorFn`, `TreeValidatorFn`) должны быть полностью удалены.
2. **`pnpm test` в `packages/reformer`** — все unit + integration тесты валидации проходят. Должны появиться новые unit-тесты для фабрик (без `createForm`).
3. **`pnpm dev` в `projects/react-playground`** — открыть `/examples/complex-multy-step-form`, заполнить форму до конца, убедиться, что:
   - `required`-ошибки появляются на пустых полях после `touch`/`submit`.
   - `min`/`max` работают для `loanAmount`.
   - Cross-step: `initialPaymentTooHigh` (validateGroup) показывается на `initialPayment`.
   - Async-валидация INN (если есть) работает с debounce.
4. **`pnpm test:e2e --project=complex-form` в `projects/react-playground-e2e`** — все scenarios проходят без регрессий.
5. **Проверить через MCP:** сгенерировать форму с валидацией через `mcp__reformer__find_recipe topic="validation"` — recipe должен вернуть новый API.
6. **Размер бандла:** удаление 3 контекст-классов и упрощение примитивов должны слегка уменьшить runtime-размер `@reformer/core`. Проверить через `pnpm build` → размер dist.

---

## Открытые вопросы

Эти решения можно принять во время реализации, не блокируют план:

1. **`FormProxy<TField>` для array-полей** — какой конкретно интерфейс отдавать в `control` валидатору на `ArrayNode`. Зависит от того, есть ли уже у `ArrayNode.getProxy()` реализация.
2. **`compose(validator1, validator2, …)`** — встроенный helper в core или оставить пользователю писать самому. Не блокер, можно добавить позже.
3. **`GroupNode`-валидаторы** — сейчас `applyFieldValidators:133-138` отсекает GroupNode (`isFieldNode || isArrayNode`). Сохранить это поведение или разрешить регистрировать валидаторы на group-полях? По умолчанию — сохранить (валидация группы — это `validateGroup` со scope).
4. **Дефолтный debounce** для `validateAsync` — оставить undefined (без debounce) или дать дефолт 300ms.
5. **Кодмод** — написать или мигрировать руками. При 30+ файлах кодмод экономит время и снижает риск опечаток.
