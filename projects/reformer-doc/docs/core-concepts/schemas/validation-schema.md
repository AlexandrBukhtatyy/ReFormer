---
sidebar_position: 3
---

# Схема валидации

Валидация — **отдельная** схема-функция `ValidationSchema`, а не часть layout-схемы. Layout
(schema формы, JSON-DSL, `RenderNode`) описывает только структуру и UI и **не несёт** валидаторов;
правила объявляются рядом, операторами из `@reformer/core/validation`, и прогоняются **по требованию**
внешним раннером `validateModel(model, schema)`. Два слоя разведены: данные и вёрстка живут в форме,
проверка корректности — в своей функции, которую приложение вызывает на submit, на шаге wizard'а или
по реакции behavior.

## Отдельная схема валидации

Схема валидации — обычная функция над моделью: `defineValidationSchema<T>(({ model }) => { … })`.
Внутри вызываются свободные операторы, которые сами разносят ошибки в нужные ноды формы. Поле
проверяется оператором `validate(sig, [rules])`, где `sig` — сигнал модели (`model.$.<field>`), а
`rules` — массив правил-фабрик из `@reformer/core/validators`:

```typescript
import { createModel } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type User = { name: string; email: string };

const model = createModel<User>({ name: '', email: '' });

// Схема валидации живёт отдельно от layout-схемы формы.
const userValidation = defineValidationSchema<User>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

// Прогон по требованию (например, на submit): ошибки сами доедут до нод формы.
const ok = await validateModel(model, userValidation);
```

`defineValidationSchema` — тонкая identity-обёртка (как `defineFormBehavior` у behavior): она лишь
задаёт типы и делает схему легко переиспользуемой. Схема — **first-class значение**: её можно
хранить в `const`, передавать в `apply`, вызывать над под-моделью и юнит-тестировать без UI.

:::info Layout и валидация — разные каналы
Ту же модель форма получает через layout-схему (`createForm({ model, schema })` или JSON-DSL) — там
только `value`/`component`/`componentProps`, но **никаких** `validators`. Схему layout'а и схему
валидации можно менять независимо: правила пишутся раз, а вёрстка приходит хоть с сервера. См.
[Схему формы](./form-schema).
:::

## Запуск валидации

Единственный внешний раннер — `validateModel(model, schema): Promise<boolean>`. Он открывает
окно прогона, синхронно регистрирует правила, дожидается async-проверок и **сам разносит ошибки по
нодам формы** (`getNodeForSignal(sig).setErrors(...)`), гася поля, ставшие валидными. Возвращает
`true`, если нет блокирующих ошибок:

```typescript
import { validateModel } from '@reformer/core/validation';

async function submit() {
  form.markAsTouched(); // раскрыть ошибки в UI
  const valid = await validateModel(model, userValidation);
  if (!valid) return; // ошибки уже разведены по нодам, UI подсветит поля
  await api.save(model.get());
}
```

Здесь `form.markAsTouched()` лишь помечает поля тронутыми, чтобы ноды показали пришедшие ошибки —
сам вердикт даёт `validateModel`. Полный submit-флоу — в [Быстром старте](../../getting-started/quick-start).

Гарантии раннера:

- **Роутинг в ноды.** Ошибки садятся на ноды по сигналу поля — отдельный результат `{ valid, errors }`
  собирать и разводить руками не нужно. Пути (`'email'`, `'items.0.name'`) резолвит реестр сигнал→нода.
- **Warning не блокирует.** Правило с `severity: 'warning'` показывается в UI, но `validateModel`
  всё равно вернёт `true` — submit не срывается.
- **Устаревшие прогоны отменяются.** Быстрый повторный вызов той же пары `(model, schema)` отменяет
  предыдущий через `AbortSignal` (в т.ч. отменяет in-flight `fetch` async-правил).
- **Гашение.** Поле, ставшее валидным (или попавшее в выключенную `validateWhen`-ветку), получает
  `setErrors([])` автоматически.

:::warning `form.validate()` / `submit()` больше не валидируют схему
Прогон валидации инициирует **приложение** вызовом `validateModel`, а не форма. Методы формы
(`markAsTouched`, `clearErrors`, `markAsUntouched`) управляют только UI-состоянием нод. Поэтому
`validateModel` должна получать **стабильную** ссылку на схему (`const` / `defineValidationSchema`):
отмена устаревших прогонов ключится по идентичности схемы, а инлайн-стрелка каждый раз создаёт новый
прогон без дедупликации.
:::

Как это подключается в разных сценариях:

| Сценарий                          | Как запустить                                                     |
| --------------------------------- | ----------------------------------------------------------------- |
| Submit одной формы                | `await validateModel(model, schema)`                              |
| Шаг wizard'а / вся форма          | конфиг `{ validateStep, validateAll }` (см. ниже)                 |
| Реактивный перезапуск из behavior | `revalidateWhen([deps], () => void validateModel(model, schema))` |

Для многошаговой формы схема каждого шага — отдельный `ValidationSchema`, а полная валидация собирается
через `apply(...шаги)`. Конфиг для `FormWizard` строится один раз по модели:

```typescript
import type { FormModel } from '@reformer/core';
import { apply, defineValidationSchema, validateModel } from '@reformer/core/validation';

const STEP_SCHEMAS = [step1, step2, step3] as const;
const fullValidation = defineValidationSchema<Wizard>(() => apply(...STEP_SCHEMAS));

export function makeValidationConfig(model: FormModel<Wizard>) {
  return {
    validateStep: (n: number) => validateModel(model, STEP_SCHEMAS[n - 1]),
    validateAll: () => validateModel(model, fullValidation),
  };
}
```

Когда валидацию нужно перезапустить **в ответ на изменение** другого поля (например, `amount` зависит
от `maxAmount`), это выражается мостом из behavior — оператором `revalidateWhen`, который дёргает тот
же `validateModel`:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // При изменении maxAmount перепроверить amount новой схемой.
  revalidateWhen([model.$.maxAmount], () => void validateModel(model, amountValidation));
});
```

## Встроенные валидаторы

| Валидатор      | Описание                   |
| -------------- | -------------------------- |
| `required()`   | Поле должно иметь значение |
| `email()`      | Корректный email           |
| `minLength(n)` | Минимальная длина строки   |
| `maxLength(n)` | Максимальная длина строки  |
| `min(n)`       | Минимальное число          |
| `max(n)`       | Максимальное число         |
| `pattern(re)`  | Совпадение с регуляркой    |
| `isNumber()`   | Значение — число           |
| `integer()`    | Целое число                |

Фабрики импортируются из `@reformer/core/validators` и принимают опциональный `{ message }`
(`required({ message: 'Обязательно' })`). Они кладутся прямо в массив `rules` оператора `validate` и
работают в том числе с nullable-полями. Полный список (числовые, датовые и др.) — в
[Встроенных валидаторах](../../validation/built-in).

## Тип валидатора

Синхронное правило — это `Rule<TField>`: по ментальной модели оно читает **только значение** и
возвращает ошибку либо `null`:

```typescript
type Rule<TField> = (value: TField, scope: never, root: never) => ValidationError | null;
```

Позиционные `scope`/`root` помечены `never` намеренно — так и value-only фабрики (`required()`,
`min()`), и inline-правила `(value) => …` присваиваются в один `Rule<TField>[]` без потери проверки
типа поля (`validate(model.$.age, [email()])` подсветится ошибкой, потому что `email` ждёт `string`).
Cross-field — это **не** дополнительные аргументы, а отдельный оператор `cross` (см. ниже).

Асинхронное правило — `AsyncRule<TField>`: получает `AbortSignal` и возвращает `Promise`:

```typescript
type AsyncRule<TField> = (
  value: TField,
  ctx: { signal: AbortSignal }
) => Promise<ValidationError | null>;
```

## Кастомные и cross-field правила

Кастомная проверка — обычная функция типа `Rule`, кладётся в тот же массив `validate`. Cross-field
правило пишется отдельным оператором `cross(sig, fn)`: `fn` получает **снапшот** модели текущего scope
(`model.get()`), а ошибка садится на поле-носитель `sig`:

```typescript
import type { ValidationError } from '@reformer/core';
import type { Rule } from '@reformer/core/validation';
import { validate, cross, defineValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type Signup = { password: string; confirmPassword: string };

// Value-only правило.
const strongPassword: Rule<string> = (value) =>
  !value || value.length < 8 ? { code: 'too-short', message: 'Минимум 8 символов' } : null;

// Cross-field: сравниваем поля по снапшоту формы.
const passwordsMatch = (f: Signup): ValidationError | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'mismatch', message: 'Пароли не совпадают' }
    : null;

const signupValidation = defineValidationSchema<Signup>(({ model }) => {
  validate(model.$.password, [required(), strongPassword]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch); // ошибка сядет на confirmPassword
});
```

## Условная валидация

Чтобы правила действовали только при условии, оберните их в `validateWhen(cond, cb)`. Пока `cond()`
истинно — правила внутри `cb` активны; иначе их поля гасятся. Условие читает значения модели через
value-proxy (`model.<field>`):

```typescript
import { validate, validateWhen, defineValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

const schema = defineValidationSchema<Form>(({ model }) => {
  // Телефон обязателен только если пользователь хочет SMS.
  validateWhen(
    () => model.wantsSms,
    () => validate(model.$.phone, [required({ message: 'Укажите телефон для SMS' })])
  );
});
```

:::info Условие валидации ≠ условная доступность
`validateWhen` управляет только **проверкой** правил. Если поле должно ещё и **отключаться** (или
скрываться) при невыполнении условия — это забота behavior: используйте `enableWhen` (см.
[Схему behavior](./behavior-schema)) и условный рендер. Валидация и доступность — независимые ветки.
:::

## Асинхронная валидация

Асинхронные проверки (например, уникальность на сервере) объявляются оператором
`validateAsync(sig, [asyncRules])`. Раннер дожидается их и прокидывает `AbortSignal` в каждое правило,
чтобы устаревший запрос можно было отменить. Сетевой сбой не должен блокировать submit — ловите его и
возвращайте `null`:

```typescript
import { validate, validateAsync, defineValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

const schema = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.username, [required()]);
  validateAsync(model.$.username, [
    async (value, { signal }) => {
      if (!value || value.length < 3) return null;
      try {
        const res = await fetch(`/api/check?u=${encodeURIComponent(value)}`, { signal });
        const { available } = await res.json();
        return available ? null : { code: 'taken', message: 'Имя уже занято' };
      } catch {
        return null; // сбой сети не блокирует отправку
      }
    },
  ]);
});
```

Подробнее — в [Асинхронной валидации](../../validation/async).

## Валидация по массиву

Правила для **каждого** элемента массива объявляются оператором `each(arr, itemFn)`: `arr` — массив
модели (`model.<array>`), а `itemFn` получает под-модель элемента `FormModel<Item>` и валидирует её
поля обычными операторами. Правило уровня всего массива (уникальность, «хотя бы один элемент») пишется
как cross-field и вешается на поле-носитель ошибки через `cross`:

```typescript
import { validate, cross, each, defineValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { FormModel, ValidationError } from '@reformer/core';

type Order = { orderName: string; items: { name: string }[] };

// Правила одного элемента.
const orderItem = (im: FormModel<{ name: string }>): void => {
  validate(im.$.name, [required({ message: 'Имя элемента обязательно' })]);
};

// Правило уровня массива — читает снапшот формы.
const uniqueItemNames = (f: Order): ValidationError | null => {
  const names = f.items.map((i) => i.name);
  return names.length !== new Set(names).size
    ? { code: 'duplicate', message: 'Имена элементов должны быть уникальны' }
    : null;
};

const orderValidation = defineValidationSchema<Order>(({ model }) => {
  each(model.items, orderItem); // правила каждого элемента
  cross(model.$.orderName, uniqueItemNames); // правило массива — на поле-носитель
});
```

## Переиспользование и композиция

Списки правил и целые под-схемы легко выносятся и переиспользуются. Массив `Rule[]` — обычное
значение:

```typescript
import type { Rule } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

// Переиспользуемые списки правил.
const nameRules: Rule<string>[] = [required(), minLength(2)];
const emailRules: Rule<string>[] = [required(), email()];

const schema = defineValidationSchema<Profile>(({ model }) => {
  validate(model.$.firstName, nameRules);
  validate(model.$.lastName, nameRules);
  validate(model.$.email, emailRules);
});
```

Под-схему группы (адрес и т.п.) переиспользуют **прямым вызовом** над под-моделью — схема ведь обычная
функция. А несколько схем над одной моделью собираются оператором `apply`:

```typescript
import { validate, apply, defineValidationSchema } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';
import type { ValidationSchema } from '@reformer/core/validation';

// Под-схема адреса над FormModel<Address>.
const addressValidation: ValidationSchema<Address> = ({ model }) => {
  validate(model.$.city, [required()]);
  validate(model.$.postalCode, [required(), pattern(/^\d{6}$/)]);
};

const orderValidation = defineValidationSchema<Order>(({ model }) => {
  addressValidation({ model: model.billing }); // прямой вызов над под-моделью
  addressValidation({ model: model.shipping });
});

// Композиция нескольких схем над одной моделью.
const fullValidation = defineValidationSchema<Order>(() => apply(step1, step2, orderValidation));
```

## Дальше

- [Обзор валидации](../../validation/overview) — подробный гайд.
- [Встроенные валидаторы](../../validation/built-in) — весь список.
- [Кастомные валидаторы](../../validation/custom) — свои правила.
- [Композиция](./composition) — переиспользование наборов валидации.
