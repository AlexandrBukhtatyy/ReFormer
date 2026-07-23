# Условные поля — видимость, доступность и валидация

## Purpose

«Показать поле X только если Y» под M1 решается тремя независимыми механизмами — выбирай по
тому, что именно должно быть условным:

1. **Видимость / доступность** (поле остаётся в модели, но выключается/включается и не валидируется)
   — behaviors: `enableWhen`, а для условной записи значения — `compute` / `copyFrom` с опцией `{ when }`.
2. **Условная валидация** (правила применяются только в истинной ветке) — оператор
   `validateWhen(() => cond, () => {…})` внутри схемы `defineValidationSchema`, прогоняется раннером `validateModel`.
3. **Скрытие из разметки** (узел вообще не рендерится) — `useFormControlValue` + условный рендер в JSX.

> Условная **валидация** — оператор `validateWhen` из `@reformer/core/validation`; старого branch-узла
> `{ when, children }` и хелпера `applyWhen` больше нет — см.
> [Anti-patterns удалённого контракта валидации](#anti-patterns-удалённого-контракта-валидации) и `17-nonexistent-api.md`.

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

Правила, действующие только при выполнении условия, оборачиваются оператором
`validateWhen(() => cond, () => {…})` внутри схемы `defineValidationSchema<T>(({ model }) => …)`.
Условие `cond` читает модель напрямую (`model.field` — снимок на момент прогона): при истинном условии
раннер применяет вложенные `validate`/`cross`/…, при ложном — правила ветки **гасятся** (поля,
затронутые ранее, получают `setErrors([])`). Прогон — внешним раннером
`validateModel(model, schema): Promise<boolean>` (ошибки сами роутятся в ноды формы).

```typescript
import {
  validate,
  validateWhen,
  defineValidationSchema,
  validateModel,
} from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

const schema = defineValidationSchema<CreditForm>(({ model }) => {
  validate(model.$.loanType, [required()]);

  // ветка применяется только для ипотеки
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [required(), min(1_000_000)]);
      validate(model.$.initialPayment, [required()]);
    },
  );
});

const ok: boolean = await validateModel(model, schema);
```

Переключение `loanType` с `mortgage` на другой тип автоматически снимает ошибки `required` с
`propertyValue`/`initialPayment` — при ложном условии ветка `validateWhen` гасит их (`setErrors([])`).
`validateWhen` управляет только **валидацией**; чтобы поля ещё и выпадали из состояния (сброс
значения), держи их под `enableWhen` из раздела выше — слои независимы.

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
сочетай его с `enableWhen({ resetOnDisable: true })` (доступность) или `validateWhen` (валидация).

## Anti-patterns удалённого контракта валидации

Условную валидацию раньше собирали иначе; эти формы удалены при переходе на `@reformer/core/validation`.
Ниже — **как НЕ надо** (чтобы не регрессировать); рабочий вариант — `validateWhen` из раздела выше.

- **Нет branch-узла `{ when, children }` в дереве схемы.** Старая схема была деревом
  `{ value, validators: [...] }` с ветками `{ when: (scope, root) => boolean, children: [...] }`,
  которое обходил `validateFormModel`. Теперь схема — функция `({ model }) => void`, а условие —
  оператор `validateWhen(() => cond, () => {…})`; отдельного объекта-узла нет.

  ```typescript
  // УДАЛЕНО — так больше нельзя
  const schema = {
    children: [
      { value: model.$.loanType, validators: [required()] },
      { when: (_s, root) => root.loanType === 'mortgage', children: [ /* … */ ] },
    ],
  };
  await validateFormModel(model, schema); // символа нет
  ```

- **`applyWhen` не существует** — ни как экспорт, ни как локальный сахар: он эмитил branch-узел,
  которого больше нет. Оборачивай условные правила оператором `validateWhen`.

- **`ValidationSchemaFn` удалён** (тип старой path-схемы). Тип схемы — `ValidationSchema<T>`
  (`(ctx: { model: FormModel<T> }) => void`), фабрика-обёртка — `defineValidationSchema<T>(fn)`.

- **Cross-field — обычная функция над снапшотом, а не `ModelValidator (value, scope, root)`.**
  Соседние поля читаются из снимка модели (`f: Root`, эквивалент `model.get()`), а правило навешивается
  оператором `cross(sig, fn)`. Каноничное использование — `complex-multy-step-form/schemas/validation.ts`.

  ```typescript
  import { cross } from '@reformer/core/validation';
  import type { ValidationError } from '@reformer/core';

  // (f: Root) => error — сравнение с соседним полем, без scope/root-параметров
  const passwordsMatch = (f: { password: string; confirmPassword: string }): ValidationError | null =>
    f.confirmPassword && f.password && f.confirmPassword !== f.password
      ? { code: 'mismatch', message: 'Пароли не совпадают' }
      : null;

  // внутри defineValidationSchema — fn получает снапшот текущего scope (model.get()):
  cross(model.$.confirmPassword, passwordsMatch);
  ```

## See also

- [03-api-signatures.md](./03-api-signatures.md) — сигнатуры `enableWhen`/`compute`/`copyFrom` (поведение) и `validate`/`validateWhen`/`cross`/`validateModel` (валидация)
- [17-nonexistent-api.md](./17-nonexistent-api.md) — полный список удалённого API (`applyWhen`, `ValidationSchemaFn`, `validateFormModel`, …)
- [25-reset-when.md](./25-reset-when.md) — `resetWhen` как альтернатива, когда поле остаётся enabled
- [19-reading-values.md](./19-reading-values.md) — `useFormControlValue` и чтение значений в React
