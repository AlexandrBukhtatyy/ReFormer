---
sidebar_position: 5
---

# Стратегии валидации

Как и **когда** запускать проверки. В актуальном контракте валидация — **отдельный слой**: правила
живут в `defineValidationSchema`, а не в layout-узлах, и прогоняются **по требованию** раннером
`validateModel`. Отсюда три момента запуска: живая обратная связь на уровне поля (мост
`revalidateWhen`), гейт перехода между шагами (`validateModel` по под-схеме шага) и полная проверка на
submit.

## Прогон по требованию — `validateModel`

Layout-узел (`RenderNode` / JSON / схема формы) больше **не несёт валидаторы** — он описывает только
разметку. Правила собраны в отдельную `ValidationSchema<T>` (функция `({ model }) => void`), а её
прогоняет внешний раннер `validateModel(model, schema)`. Раннер синхронно регистрирует правила,
дожидается async-проверок, **сам разносит ошибки по нодам формы** и гасит поля, ставшие валидными.
Возвращает `boolean` (`severity: 'warning'` не блокирует).

```typescript
import { validateModel } from '@reformer/core/validation';

// schema — ValidationSchema<T>, отдельная от layout-схемы формы.
const valid = await validateModel(model, schema); // Promise<boolean>
// ошибки уже доехали до нод — UI подсветит поля; отдельного { errors } возвращать не нужно
```

Раз валидация запускается явно, «момент проверки» выбирает **приложение**. Три канонических точки:

| Момент запуска            | Чем запускается                                                   | Подходит для                      |
| ------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| Живая обратная связь      | `revalidateWhen([deps], () => void validateModel(model, s))`      | пересчёт зависимого поля по вводу |
| Гейт шага мастера         | `validateModel(model, stepSchema)` (через `makeValidationConfig`) | многошаговые формы (wizard)       |
| Полная проверка на submit | `validateModel(model, fullSchema)`                                | финальная отправка                |

:::warning `form.submit()` / `form.validate()` схему больше не прогоняют
С разделением слоёв метод формы `form.validate()` (и вызывающий его `form.submit()`) **не запускает
schema-валидацию** — он лишь читает текущее состояние ошибок нод, которое заполняет `validateModel`.
Поэтому валидацию инициирует приложение: вызовите `await validateModel(model, schema)` перед отправкой
(в wizard это делает `validateAll` из конфига — см. ниже).
:::

## Пошаговые формы — гейт шага

Каждый шаг мастера описывается своей `ValidationSchema<T>`; переход «вперёд» — это прогон под-схемы
текущего шага через `validateModel`. Он дожидается и sync-, и async-правил, поэтому всегда `await`.

```typescript
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

const step1Schema = defineValidationSchema<LoanForm>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [required(), min(50000)]);
});

const goNext = async () => {
  form.markAsTouched(); // раскрыть ошибки текущего шага
  if (await validateModel(model, step1Schema)) setStep((s) => s + 1);
};
```

Для `FormWizard` этот же прогон оформляют конфигом `{ validateStep, validateAll }`. Полная схема —
композиция шагов через `apply`; каждый шаг и полная схема — **стабильные `const`-ссылки** (важно для
отмены устаревших прогонов внутри `validateModel`).

```typescript
import {
  apply,
  defineValidationSchema,
  validateModel,
  type ValidationSchema,
} from '@reformer/core/validation';
import type { FormModel } from '@reformer/core';

const STEP_SCHEMAS: readonly ValidationSchema<LoanForm>[] = [step1Schema, step2Schema /* … */];

/** Полная схема формы: все шаги подряд над той же моделью. */
const fullSchema = defineValidationSchema<LoanForm>(() => apply(...STEP_SCHEMAS));

/** Колбэки валидации для FormWizard: гейт шага + полная проверка на submit. */
export function makeValidationConfig(model: FormModel<LoanForm>) {
  return {
    validateStep: (step: number) => validateModel(model, STEP_SCHEMAS[step - 1]),
    validateAll: () => validateModel(model, fullSchema),
  };
}
```

```tsx
// Конфиг отдаётся FormWizard — он сам зовёт validateStep при «Далее» и validateAll при submit.
const config = useMemo(() => makeValidationConfig(model), [model]);
<FormWizard form={form} config={config} steps={STEPS} onSubmit={onSubmit} />;
```

:::info Одного шага мало — не тащите async в каждый шаг
`validateModel` дожидается async-правил (`validateAsync`). Дорогую серверную проверку (код из СМС,
уникальность) держите в схеме того шага, где она уместна, или в полной схеме — тогда гейт остальных
шагов остаётся быстрым.
:::

## Полная проверка на submit

На отправке приложение прогоняет полную схему и по результату решает, слать ли данные. Ошибки уже
разнесены по нодам — форма подсветит поля сама.

```tsx
import { validateModel } from '@reformer/core/validation';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAsTouched(); // раскрыть все ошибки в UI

  const valid = await validateModel(model, fullSchema);
  if (valid) await api.save(model.get());
};
```

:::info Читать сами ошибки — из нод
`validateModel` возвращает только `boolean`; конкретные ошибки полей читаются реактивно через
`useFormControl(form.<field>).errors` или из нод формы (см.
[Обработку ошибок](/docs/validation/error-handling)). Прогон вне React работает так же — ошибки
роутятся в ноды, если они есть; для чисто «данных» соберите форму на модели и прочитайте валидность
из результата.
:::

## Условная валидация

Правила, действующие только в части формы, оборачиваются оператором `validateWhen(cond, cb)`. Пока
`cond()` ложно, правила внутри не срабатывают, а их поля **гасятся** (`setErrors([])`) — не нужно
«прятать» лишние ошибки в UI.

```typescript
import {
  validate,
  validateWhen,
  defineValidationSchema,
  validateModel,
} from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';

type AccountForm = { accountType: string; businessName: string; ein: string };

const schema = defineValidationSchema<AccountForm>(({ model }) => {
  validate(model.$.accountType, [required()]);
  // Поля бизнес-аккаунта проверяются, только когда выбран business
  validateWhen(
    () => model.accountType === 'business',
    () => {
      validate(model.$.businessName, [required()]);
      validate(model.$.ein, [
        required(),
        pattern(/^\d{2}-\d{7}$/, { message: 'Некорректный EIN' }),
      ]);
    }
  );
});

const valid = await validateModel(model, schema);
```

Условие читает значение поля через прокси модели (`model.accountType`), а сигнал для `validate` — через
`model.$.accountType`. `validateWhen` можно вкладывать: правило внутри активно, только когда истинны
**все** охватывающие условия.

## Зависимые поля

Кросс-полевое правило вешается оператором `cross(sig, fn)` на поле, которое должно нести ошибку; `fn`
получает **снапшот** модели текущего scope (`model.get()`) и читает соседей из него. Чтобы правило
**перепроверялось** при изменении зависимости, свяжите поля через `revalidateWhen` в behavior — это
единственный мост от реактивного слоя поведения к прогону валидации по требованию.

```typescript
import { createModel, createForm, type ValidationError } from '@reformer/core';
import { validate, cross, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';

type PasswordForm = { password: string; confirmPassword: string };

const model = createModel<PasswordForm>({ password: '', confirmPassword: '' });

// Кросс-полевое правило — обычная функция над снапшотом формы (без scope/root-аргументов).
const passwordsMatch = (f: PasswordForm): ValidationError | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwordMismatch', message: 'Пароли не совпадают' }
    : null;

const schema = defineValidationSchema<PasswordForm>(({ model }) => {
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch); // ошибка садится на confirmPassword
});

// confirmPassword перепроверяется, когда меняется password
const behavior = defineFormBehavior<PasswordForm>(({ model }) => {
  revalidateWhen([model.$.password], () => void validateModel(model, schema));
});

// поведение подключается к форме; layout-схема (RenderNode) — отдельный аргумент:
const form = createForm({ model, schema: layout, behavior });
```

:::note `cross` берёт снапшот, а не живой сигнал
`fn` внутри `cross` видит `model.get()` на момент прогона — это чистое чтение, без подписок. Живость
даёт `revalidateWhen`: он перезапускает `validateModel` при изменении зависимости, и правило считается
заново по свежему снапшоту.
:::

## Валидация массива

Элементы массива проверяются оператором `each(arr, itemFn)` — `itemFn` получает под-модель элемента и
описывает его поля обычным `validate`. Правило на **весь массив** (длина, уникальность) пишется как
функция над снапшотом и вешается через `cross` на **скалярное поле-носитель** (реальный leaf-сигнал),
а не на сам массив: `model.$.<array>` — дерево сигналов, а не leaf, и ошибка на нём не сядет в ноду.

```typescript
import { createModel, type FormModel, type ValidationError } from '@reformer/core';
import {
  validate,
  cross,
  each,
  defineValidationSchema,
  validateModel,
} from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type TagForm = { listTitle: string; tags: { label: string }[] };

const model = createModel<TagForm>({ listTitle: '', tags: [{ label: '' }] });

// Под-схема одного элемента массива — функция над под-моделью элемента.
const tagItem = (im: FormModel<{ label: string }>): void => {
  validate(im.$.label, [required()]);
};

// Правило уровня массива — читает снапшот, садится на скалярное поле-носитель.
const uniqueTags = (f: TagForm): ValidationError | null => {
  const labels = f.tags.map((t) => t.label);
  return labels.length !== new Set(labels).size
    ? { code: 'notUnique', message: 'Метки должны быть уникальны' }
    : null;
};

const schema = defineValidationSchema<TagForm>(({ model }) => {
  validate(model.$.listTitle, [required()]);
  cross(model.$.listTitle, uniqueTags); // правило уровня массива на скалярном носителе
  each(model.tags, tagItem); // per-item валидация элементов
});

const valid = await validateModel(model, schema);
```

Под-схему элемента (адрес, созаёмщик и т.п.) удобно переиспользовать **прямым вызовом** над под-моделью:
`addressSchema({ model: model.registrationAddress })` — схема это просто функция.

## Хорошие практики

- **Несколько узких правил вместо одного «общего».** `validate(sig, [required(), minLength(8), strongPassword])`
  даёт конкретные ошибки, которые проще показать и локализовать.
- **Композиция шагов через `apply`.** Полную схему собирайте из под-схем шагов
  (`apply(...STEP_SCHEMAS, formExtras)`), а не дублируйте правила — так гейт шага и submit проверяют
  ровно одно и то же.
- **`validateWhen` вместо «спрятать ошибку».** Выключенная ветка не проверяется и гасит свои поля — это
  дешевле и честнее, чем валидировать всё и прятать лишнее в UI.
- **Стабильные `const`-ссылки на схемы.** `validateModel` отменяет устаревший прогон по идентичности
  `(model, schema)` — держите схемы в `const` / `defineValidationSchema`, не создавайте инлайн-стрелку
  на каждый вызов.
- **Именуйте вынесенные правила по смыслу.** Разросшийся кросс-полевой валидатор или под-схему выносите в
  именованную константу (`initialPaymentVsProperty`, `addressSchema`), типизируя её
  `(f: Root) => ValidationError | null` / `ValidationSchema<T>` — схема остаётся плоской и читается как
  оглавление.
- **Дорогую живую проверку дебаунсите сами.** `revalidateWhen` перезапускает валидацию сразу; для async
  вне ввода оберните колбэк собственным дебаунсом, а отменой устаревших ответов займётся `AbortSignal`
  из `validateAsync`.

## Дальше

- [Асинхронная валидация](/docs/validation/async) — серверные проверки, отмена устаревших запросов.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и кросс-полевые проверки.
- [Обработка ошибок](/docs/validation/error-handling) — чтение, фильтрация и отображение ошибок.
