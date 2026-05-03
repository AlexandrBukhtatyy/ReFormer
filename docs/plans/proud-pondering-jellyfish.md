# Type-safety fix для схем mcp-credit-application-v\* + cleanup компонентов и документации

## Context

В `projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts` и сопутствующем `index.tsx` сейчас 40 ошибок типов (по `tsc --noEmit -p tsconfig.app.json`). Раскладка по корневым причинам:

1. **Один неверный импорт** в schema.ts ломает 36 ошибок цепочкой:
   `import { ... type ValidationSchemaFn } from '@reformer/core/validators'` → TS2614 (нет такого экспорта в submodule). После этого все `path` параметры в `ValidationSchemaFn`-callback'ах становятся `implicit any`, далее 21× `path.X is FieldPath<unknown>` (TS2339) и 9× `parameter implicitly any` (TS7006). `applyWhen`-callback'и теряют тип `p` по той же цепочке.

2. **Ручные `as`-касты в `computeFrom`** — это симптом, а не баг. Сигнатура `computeFn: (values: TForm) => TTarget` ([compute-from.ts:86](packages/reformer/src/core/behavior/behaviors/compute-from.ts#L86)) корректна, но при деструктуризации `({ x }) => ...` без явной аннотации TS не выводит тип отдельных полей. В коде это компенсируется кастами `as PersonalData | undefined`, `as number | null`, `as string`, `as CoBorrowerItem[] | undefined`.

3. **`FormArraySection.initialValue` теряет generic-связь с типом элемента**. В [form-array-section.tsx:76](packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx#L76) тип `Partial<FormFields>` (вместо `Partial<T>`), хотя сам компонент generic `<T extends FormFields>`. То же в headless [FormArrayAddButton types.ts:48](packages/reformer-cdk/src/components/form-array/types.ts#L48). Из-за этого `initialValue={createPropertyItem()}` в [index.tsx:398](projects/react-playground/src/pages/examples/mcp-credit-application-v9/index.tsx#L398) даёт TS2322 (3 ошибки в v9, аналогично в любом callsite с union-literal элементами массива).

4. **`FormWizard ref` сужается до `Ref<FormWizardHandle<Record<string, unknown>>>`** ([index.tsx:515](projects/react-playground/src/pages/examples/mcp-credit-application-v9/index.tsx#L515) и [complex-multy-step-form/CreditApplicationForm.tsx:109,111](projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx#L109)). Constraint `T extends Record<string, unknown>` в [form-wizard.tsx:65-67](packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx#L65-L67) мешает выводу T из props в JSX — TS использует bound вместо инференса. Headless cdk-обёртка ([cdk/form-wizard/FormWizard.tsx:348](packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx#L348)) имеет более широкий `extends Record<string, any>`, который инференс позволяет.

5. **Документация уже содержит рекомендации**, но в неоптимальном виде:
   - [packages/reformer/llms.txt:285-323](packages/reformer/llms.txt#L285) рекомендует `(path: any)` workaround для TS2589 — это и приводит MCP-генератор к implicit-any в схемах вида v9 (которая на самом деле НЕ настолько глубокая, чтобы триггерить TS2589).
   - В [llms.txt:441-450](packages/reformer/llms.txt#L441) корректный паттерн импортов есть, но он внизу, после workaround-блока, и легко пропускается.
   - Про type-safe `computeFrom` (без `as` кастов) рекомендации нет.

Цель — закрыть все 40 ошибок tsc, убрать `as`-касты в схемах, и обновить документацию так, чтобы MCP-генератор и Cursor/Claude писали правильный код в новых формах.

## Файлы изменяемые

- [projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts)
- [projects/react-playground/src/components/RendererFormWizard.tsx](projects/react-playground/src/components/RendererFormWizard.tsx)
- [packages/reformer-cdk/src/components/form-array/types.ts](packages/reformer-cdk/src/components/form-array/types.ts)
- [packages/reformer-cdk/src/components/form-array/FormArrayAddButton.tsx](packages/reformer-cdk/src/components/form-array/FormArrayAddButton.tsx)
- [packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx](packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx)
- [packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx](packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx)
- [packages/reformer/docs/llms/05-common-mistakes.md](packages/reformer/docs/llms/05-common-mistakes.md)
- [packages/reformer/docs/llms/20-compute-vs-watch.md](packages/reformer/docs/llms/20-compute-vs-watch.md)
- (новый) [packages/reformer/docs/llms/30-type-safety-recipes.md](packages/reformer/docs/llms/30-type-safety-recipes.md)
- [packages/reformer-ui-kit/llms.txt](packages/reformer-ui-kit/llms.txt) — после ре-генерации
- [packages/reformer/llms.txt](packages/reformer/llms.txt) — после ре-генерации

После правок `.md` нужно прогнать `npm run generate:llms` в каждом пакете (если такой скрипт есть) — судя по шапке `# AUTO-GENERATED. Edit docs/llms/*.md or JSDoc in src/ and run npm run generate:llms.`

---

## Часть A — schema.ts (mcp-credit-application-v9)

### A1. Исправить импорт `ValidationSchemaFn`

[schema.ts:24-35](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L24-L35)

```ts
// Было
import { createForm, type FormSchema, type FormProxy, type FieldPath } from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email as emailValidator,
  pattern,
  applyWhen,
  apply,
  type ValidationSchemaFn,
} from '@reformer/core/validators';

// Стало
import {
  createForm,
  type FormSchema,
  type FormProxy,
  type FieldPath,
  type ValidationSchemaFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email as emailValidator,
  pattern,
  applyWhen,
  apply,
} from '@reformer/core/validators';
```

Эффект: 30 цепочечных ошибок исчезают.

### A2. Аннотировать деструктуризацию в `computeFrom`-callback'ах

[schema.ts:856-920](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L856-L920) — 7 callback'ов. Шаблон правки: добавить `: CreditApplicationForm` после деструктуризации, удалить связанные `as`-касты в теле.

| Строка                                                                                           | Поля → target                                           | Удаляется                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------- |
| [856](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L856)     | `personalData` → `fullName`                             | `as PersonalData \| undefined`     |
| [863](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L863)     | `personalData` → `age`                                  | `as PersonalData \| undefined`     |
| [870](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L870)     | `loanType` → `interestRate`                             | `as string`                        |
| [875-883](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L875) | `loanAmount, loanTerm, interestRate` → `monthlyPayment` | 3× `as number \| null`             |
| [887](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L887)     | `propertyValue` → `initialPayment`                      | `as number \| null`                |
| [894-902](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L894) | `monthlyIncome, additionalIncome` → `totalIncome`       | 2× `as number \| null`             |
| [905-914](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L905) | `monthlyPayment, totalIncome` → `paymentToIncomeRatio`  | 2× `as number \| null`             |
| [917-920](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L917) | `coBorrowers` → `coBorrowersIncome`                     | `as CoBorrowerItem[] \| undefined` |

Пример canonical-формы:

```ts
// Было
computeFrom([path.loanType], path.interestRate, ({ loanType }) =>
  ratePerLoanType(loanType as string)
);

// Стало
computeFrom([path.loanType], path.interestRate, ({ loanType }: CreditApplicationForm) =>
  ratePerLoanType(loanType)
);
```

```ts
// Было
computeFrom(
  [path.loanAmount, path.loanTerm, path.interestRate],
  path.monthlyPayment,
  ({ loanAmount, loanTerm, interestRate }) => {
    const a = (loanAmount as number | null) ?? 0;
    const t = (loanTerm as number | null) ?? 0;
    const r = (interestRate as number | null) ?? 0;
    return annuityMonthly(a, t, r);
  }
);

// Стало
computeFrom(
  [path.loanAmount, path.loanTerm, path.interestRate],
  path.monthlyPayment,
  ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
    annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
);
```

```ts
// Было
computeFrom([path.coBorrowers], path.coBorrowersIncome, ({ coBorrowers }) => {
  const arr = (coBorrowers as CoBorrowerItem[] | undefined) ?? [];
  return arr.reduce((sum, c) => sum + (c?.monthlyIncome ?? 0), 0);
});

// Стало
computeFrom([path.coBorrowers], path.coBorrowersIncome, ({ coBorrowers }: CreditApplicationForm) =>
  coBorrowers.reduce((sum, c) => sum + (c?.monthlyIncome ?? 0), 0)
);
```

### A3. Актуализировать комментарий в шапке

[schema.ts:1-14](projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts#L1-L14): убрать упоминания «`as PersonalData | undefined` cast как Patch I» и описать актуальную идиому: «computeFrom callback'и аннотируются типом формы на параметре деструктуризации, без `as`-кастов; импорт `ValidationSchemaFn` — из `@reformer/core`, не из `/validators`».

---

## Часть B — компоненты FormArray (cdk + ui-kit)

### B1. `FormArrayAddButtonProps` → generic

[packages/reformer-cdk/src/components/form-array/types.ts:43-49](packages/reformer-cdk/src/components/form-array/types.ts#L43-L49)

```ts
// Было
export interface FormArrayAddButtonProps extends Omit<...> {
  initialValue?: Partial<FormFields>;
}

// Стало
export interface FormArrayAddButtonProps<T extends FormFields = FormFields> extends Omit<...> {
  initialValue?: Partial<T>;
}
```

[packages/reformer-cdk/src/components/form-array/FormArrayAddButton.tsx:30](packages/reformer-cdk/src/components/form-array/FormArrayAddButton.tsx#L30) — обёртка `forwardRef<HTMLButtonElement, FormArrayAddButtonProps>` ломает generic. Применить тот же приём, что в [cdk/form-wizard/FormWizard.tsx:348](packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx#L348):

```ts
const FormArrayAddButtonInner = <T extends FormFields>(
  { children, initialValue, asChild = false, ...props }: FormArrayAddButtonProps<T>,
  ref: React.ForwardedRef<HTMLButtonElement>
) => {
  // ... существующее тело ...
};

export const FormArrayAddButton = forwardRef(FormArrayAddButtonInner) as <T extends FormFields>(
  props: FormArrayAddButtonProps<T> & { ref?: React.Ref<HTMLButtonElement> }
) => React.ReactElement | null;
```

### B2. `FormArraySectionProps.initialValue: Partial<T>`

[packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx:76](packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx#L76)

```ts
// Было
initialValue?: Partial<FormFields>;

// Стало
initialValue?: Partial<T>;
```

После B1 тип `<FormArray.AddButton initialValue={initialValue} ...>` на [строке 190](packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx#L190) и [243](packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx#L243) корректно подхватит generic.

Потенциальный риск: если внутри FormArraySection generic T выводится через `control: ArrayNode<T>` — нужно проверить что типы по всем 3 формам control (FormArrayProxy/ArrayNode/FieldPathNode) синхронизированы. Если FieldPathNode даёт `<unknown, unknown>`, то T выводится как FormFields-широкий — придётся явно указывать generic в callsite (`<FormArraySection<PropertyItem> ... />`). Это приемлемо.

### B3. Снести unused import

[packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx](packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx) или [projects/react-playground/src/components/RendererFormWizard.tsx:23](projects/react-playground/src/components/RendererFormWizard.tsx#L23) — удалить неиспользуемый импорт `UiKitFormWizardProps` (TS6133).

---

## Часть C — `FormWizard` generic-проброс

### C1. Расширить constraint в FormWizardProps

[packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx:65-67](packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx#L65-L67)

```ts
// Было
export interface FormWizardProps<
  T extends Record<string, unknown>,
> extends FormWizardHeadlessProps<T> {

// Стало — синхронизировать с headless cdk (Record<string, any>)
export interface FormWizardProps<
  T extends Record<string, any>,
> extends FormWizardHeadlessProps<T> {
```

И аналогично:

```ts
// form-wizard.tsx:116
function FormWizardInner<T extends Record<string, any>>(...)

// form-wizard.tsx:155
const FormWizardForwarded = forwardRef(FormWizardInner) as <T extends Record<string, any>>(
  props: FormWizardProps<T> & { ref?: React.Ref<FormWizardHandle<T>> }
) => ReactElement | null;
```

`Record<string, any>` плох семантически, но он совпадает с headless cdk и снимает блокер инференции в JSX. Альтернатива — `<T extends FormFields>`, но тогда `FormFields` придётся экспортировать из cdk (он живёт в core), что осложняет импорт-граф ui-kit'а. `any` здесь не утечка — он только для constraint, не для прямого использования.

### C2. Verification

После C1 проверить:

- [v9/index.tsx:514](projects/react-playground/src/pages/examples/mcp-credit-application-v9/index.tsx#L514) — `<FormWizard ref={navRef} form={form} ...>` должен инферить `T = CreditApplicationForm`.
- [complex-multy-step-form/CreditApplicationForm.tsx:109,111](projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx#L109) — то же.
- Если инференция всё равно не сработает (известная проблема React + forwardRef + generic + JSX), fallback — добавить в callsite явный generic-каст один раз в module-scope:
  ```ts
  const TypedFormWizard = FormWizard as unknown as ComponentType<
    FormWizardProps<CreditApplicationForm> & {
      ref?: React.Ref<FormWizardHandle<CreditApplicationForm>>;
    }
  >;
  ```
  Тогда в JSX используется `<TypedFormWizard ...>`. Это решение консумер-уровня, его не закатываем в библиотеку, но это план B если C1 не помог.

---

## Часть D — документация (чтобы MCP подхватил рекомендации)

### D1. Понизить роль `(path: any)`-workaround

[packages/reformer/docs/llms/04-common-patterns.md](packages/reformer/docs/llms/04-common-patterns.md) (если оттуда генерится секция «Validation callback canonical shape» в `llms.txt:285`) — пометить это как **legacy workaround только для TS2589 (forms with 6+ levels of nesting)**, и явно сказать: «для обычных форм используйте `ValidationSchemaFn<T>` сигнатуру с явным generic, без `any`». Найти исходник можно через `grep -rn "Validation callback canonical shape" packages/reformer/docs/llms/`.

### D2. Новая секция: type-safe `computeFrom`

Создать [packages/reformer/docs/llms/30-type-safety-recipes.md](packages/reformer/docs/llms/30-type-safety-recipes.md) (или дополнить [20-compute-vs-watch.md](packages/reformer/docs/llms/20-compute-vs-watch.md)) с разделом:

```markdown
## computeFrom — type-safe callback

Annotate the destructured argument with the form type. Without annotation,
TS infers field types as `unknown` because `computeFn: (values: TForm) => T`
sees the full form, not a narrowed Pick.

❌ DON'T — leads to `as` casts
computeFrom([path.loanAmount, path.loanTerm], path.monthlyPayment,
({ loanAmount, loanTerm }) => {
const a = (loanAmount as number | null) ?? 0; // implicit cast
return annuityMonthly(a, ...);
}
);

✅ DO — annotated destructuring, no casts
computeFrom([path.loanAmount, path.loanTerm], path.monthlyPayment,
({ loanAmount, loanTerm }: MyForm) =>
annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, ...)
);
```

Включить эту секцию в индекс llms (header в каждом `*.md` файле описывает что и где искать).

### D3. Импорт-памятка — поднять выше

В [packages/reformer/docs/llms/05-common-mistakes.md](packages/reformer/docs/llms/05-common-mistakes.md) или [07-complete-import.md](packages/reformer/docs/llms/07-complete-import.md) поднять блок «Imports — types from `@reformer/core`, validators from `/validators`» в самое начало раздела. Сейчас он в [llms.txt:441](packages/reformer/llms.txt#L441) ниже всех common patterns — MCP читает по порядку и часто не доходит.

Конкретно — продублировать DO/DON'T-блок в шапку common-mistakes.md:

```markdown
### Imports rule (number 1 cause of cascading errors)

Types come from `@reformer/core`. Functions come from submodules.

❌ DON'T:
import { type ValidationSchemaFn } from '@reformer/core/validators'; // TS2614

✅ DO:
import { type ValidationSchemaFn } from '@reformer/core';
import { required, applyWhen } from '@reformer/core/validators';
```

### D4. UI-kit doc: FormArraySection generic

[packages/reformer-ui-kit/docs/llms/](packages/reformer-ui-kit/docs/llms/) — раздел про FormArraySection (если есть `08-form-array-section.md` — упомянут в индексе) — добавить пример с typed-generic после части B:

```markdown
## Type-safe initialValue

`initialValue` is typed as `Partial<T>` where T is the array element type.
Pass a factory that returns the element shape; TS will check assignment.

<FormArraySection<PropertyItem>
control={control.properties}
itemComponent={PropertyItemForm}
initialValue={createPropertyItem()} // PropertyItem - checked
/>
```

### D5. Регенерация `llms.txt`

После правок `*.md`:

```bash
cd packages/reformer && npm run generate:llms
cd packages/reformer-ui-kit && npm run generate:llms
cd packages/reformer-cdk && npm run generate:llms
```

(если такого скрипта нет в package — проверить и спросить, как собирается llms.txt)

---

## Verification

1. **tsc по всему playground'у**:

   ```bash
   cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
   ```

   Ожидаемое: `0`. Сейчас: `43`.

2. **Регрессия `as`-кастов в схеме**:

   ```bash
   grep -nE " as (string|number|PersonalData|CoBorrowerItem)" projects/react-playground/src/pages/examples/mcp-credit-application-v9/schema.ts
   ```

   Ожидаемое: пусто.

3. **Сборка пакетов** (после правок cdk/ui-kit):

   ```bash
   cd packages/reformer-cdk && npm run build
   cd packages/reformer-ui-kit && npm run build
   ```

   Без ошибок типов.

4. **Runtime smoke** (после всех правок):
   - `npm run dev` → открыть `/mcp-credit-application-v9`, нажать «🎭 Заполнить тестовыми данными».
   - Пройти все 6 шагов мастера, дойти до submit.
   - Проверить computed-поля (`fullName`, `age`, `interestRate`, `monthlyPayment`, `initialPayment`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`) обновляются как раньше — поведение runtime не должно меняться, всё compile-time-only.
   - Открыть `/complex-multy-step-form` и `/mcp-credit-application-renderer-v9` для регрессии (FormWizard и FormArraySection используются там же).

5. **Документация — проверка регенерации**:

   ```bash
   grep -A 5 "computeFrom — type-safe callback" packages/reformer/llms.txt
   ```

   Раздел должен появиться после `npm run generate:llms`.

6. **MCP integration test** (опционально, если есть заготовки): прогнать MCP-генератор схемы для какой-нибудь spec'и и убедиться, что в выходе нет `(path: any)` и нет `as`-кастов в `computeFrom`.

## Заметки про порядок выполнения

- A1 → A2 → A3 — **последовательно** в одном PR (schema-only).
- B1 → B2 — **связаны** (B2 зависит от B1 для типа `initialValue`).
- B3 — независимо.
- C1 — независимо от B; ставить в один PR с B (общая тема: ui-kit/cdk generics).
- D1–D5 — отдельный PR (только docs), после A/B/C мерджа, чтобы примеры в docs ссылались на актуальный API.
