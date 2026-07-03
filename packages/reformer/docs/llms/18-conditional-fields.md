# Условные поля — видимость, доступность и валидация

## Purpose

«Показать поле X только если Y» под M1 решается тремя независимыми механизмами — выбирай по
тому, что именно должно быть условным:

1. **Видимость / доступность** (поле остаётся в модели, но выключается/включается и не валидируется)
   — behaviors: `enableWhen`, а для условной записи значения — `compute` / `copyFrom` с опцией `{ when }`.
2. **Условная валидация** (правила применяются только в истинной ветке) — нативный branch-узел
   схемы `{ when, children }`, исполняется `validateFormModel`.
3. **Скрытие из разметки** (узел вообще не рендерится) — `useFormControlValue` + условный рендер в JSX.

> Ни `applyWhen`, ни `ValidationSchemaFn` **не экспортируются** из `@reformer/core` — см. раздел
> [Не экспорт (частая ошибка)](#не-экспорт-частая-ошибка) и `17-nonexistent-api.md`.

## Видимость и доступность

`enableWhen(target, () => condition, { resetOnDisable })` из `@reformer/core/behaviors`
включает/выключает поле реактивно. При `disabled` поле не участвует в валидации; с
`resetOnDisable: true` его значение сбрасывается при выключении (иначе — сохраняется).

```typescript
import { defineFormBehavior, enableWhen, compute, copyFrom } from '@reformer/core/behaviors';

type CreditForm = {
  loanType: 'mortgage' | 'car' | 'consumer';
  propertyValue: number | null;
  initialPayment: number | null;
  sameEmail: boolean;
  email: string;
  emailAdditional: string;
};

export const creditBehavior = defineFormBehavior<CreditForm>(({ model }) => {
  // один или несколько таргетов; условие читает model.* реактивно
  enableWhen(
    [model.$.propertyValue, model.$.initialPayment],
    () => model.loanType === 'mortgage',
    { resetOnDisable: true },
  );

  // условная ЗАПИСЬ производного значения — compute с { when }
  compute(model.$.initialPayment, () => Math.round((model.propertyValue ?? 0) * 0.2), {
    when: () => model.loanType === 'mortgage',
  });

  // условное КОПИРОВАНИЕ из другого поля — copyFrom с { when }
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
});
```

Требования:

- **Все поля должны быть материализованы в модели** (`createModel`), даже те, что показываются
  только под условием. `enableWhen`/`compute`/`copyFrom` принимают сигналы `model.$.field`, а не
  строковые пути; сигнала для несуществующего поля нет.
- Поведение подключается к форме через `createForm({ model, schema, behavior })` — форма владеет
  жизненным циклом, DSL-операторы регистрируют свой cleanup сами (ручной массив cleanup'ов не нужен).
- Таргетом может быть и **группа**: `enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false)`
  проходит по поддереву; без `resetOnDisable` значение группы сохраняется (удобно, когда оно копируется
  из другого источника).

> **Групповой таргет работает только у DSL-`enableWhen` из `@reformer/core/behaviors`**, не у
> одноимённого корневого `enableWhen` из `@reformer/core` (тот резолвит только leaf-сигналы через
> реестр → на group-сигнале это тихий no-op). `get_symbol_docs("enableWhen")` возвращает именно
> корневой, не group-capable вариант.

## Условная валидация

Правила, действующие только при выполнении условия, задаются **нативным branch-узлом**
`{ when: (scope, root) => boolean, children: [...] }` прямо в дереве схемы. `validateFormModel`
обходит дерево: при истинном `when` валидирует `children`, при ложном — **поддерево пропускается,
а ошибки его полей очищаются** (движок вызывает `setErrors([])`). `scope` — ближайшая под-модель
(элемент массива или корень), `root` — корневая модель формы.

```typescript
import { validateFormModel } from '@reformer/core';
import { required, min } from '@reformer/core/validators';

const schema = {
  children: [
    { value: model.$.loanType, validators: [required()] },
    {
      // ветка применяется только для ипотеки
      when: (_scope, root) => root.loanType === 'mortgage',
      children: [
        { value: model.$.propertyValue, validators: [required(), min(1_000_000)] },
        { value: model.$.initialPayment, validators: [required()] },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

Переключение `loanType` с `mortgage` на другой тип автоматически снимает ошибки `required` с
`propertyValue`/`initialPayment` — их держать enabled и не валидировать помогает `enableWhen` выше.

## Скрытие в JSX

Чтобы условный блок вообще не рендерился, читай значение-триггер хуком `useFormControlValue(form.field)`
и делай ранний `return null`. Хук возвращает **только значение** (без деструктуризации `{ value }`).

```tsx
import { useFormControlValue } from '@reformer/core';

function MortgageFields({ form }: { form: CreditForm }) {
  const loanType = useFormControlValue(form.loanType);
  if (loanType !== 'mortgage') return null;

  return (
    <>
      <PropertyValueField form={form} />
      <InitialPaymentField form={form} />
    </>
  );
}
```

Скрытие в JSX — чисто визуальное: если поле должно ещё и **выпадать из валидации/состояния**,
сочетай его с `enableWhen({ resetOnDisable: true })` (доступность) или branch-узлом (валидация).

## Не экспорт (частая ошибка)

- **`applyWhen` — это ЛОКАЛЬНЫЙ typed-хелпер примера, а не экспорт `@reformer/core`.** Он лишь
  эмитит нативный branch-узел `{ when, children }`. Каноничное определение (см.
  `complex-multy-step-form/schemas/validation.ts`):

  ```typescript
  // локальный сахар в самом примере — НЕ импорт из библиотеки
  const applyWhen = (cond: (form: Root) => boolean, children: SchemaNode[]): SchemaNode => ({
    when: (_scope: unknown, root: unknown) => cond(root as Root),
    children,
  });
  ```

  Публичный API — сам `validateFormModel(model, schema)` и форма узла `{ when, children }`.
  Не пиши `import { applyWhen } from '@reformer/core'` — такого символа нет.

- **`ValidationSchemaFn` не существует** (тип старой path-схемы удалён при переходе на M1). Тип
  кастомного/cross-field валидатора — **`ModelValidator<TValue, TModel, TRoot>`**:

  ```typescript
  import type { ModelValidator } from '@reformer/core';

  // (value, scope, root) — cross-field читает соседей через root
  const passwordsMatch: ModelValidator<string, unknown, { password: string }> = (value, _scope, root) =>
    value && root.password && value !== root.password
      ? { code: 'mismatch', message: 'Пароли не совпадают' }
      : null;
  ```

## See also

- [03-api-signatures.md](./03-api-signatures.md) — сигнатуры `enableWhen`/`compute`/`copyFrom`, branch-узел, `ModelValidator`
- [17-nonexistent-api.md](./17-nonexistent-api.md) — полный список удалённого API (`applyWhen`, `ValidationSchemaFn`, …)
- [25-reset-when.md](./25-reset-when.md) — `resetWhen` как альтернатива, когда поле остаётся enabled
- [19-reading-values.md](./19-reading-values.md) — `useFormControlValue` и чтение значений в React
