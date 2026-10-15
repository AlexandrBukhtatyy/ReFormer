---
sidebar_position: 3
---

# Схема валидации

Валидация — **отдельная** схема-функция `ValidationDefinition`, а не часть схемы формы. Схема формы
(дерево узлов, JSON-документ) описывает только структуру и UI и **не несёт** правил; правила
объявляются рядом, операторами из `@reformer/core/validation`, подключаются к сборке
`createForm({ validation })` и прогоняются **по требованию**: на отправке, на шаге потока, по
выбранной стратегии живой проверки.

## Отдельная схема валидации

Схема валидации — обычная функция над моделью: `defineValidation<T>(({ model, cross }) => { … })`.
Внутри вызываются свободные операторы, которые сами разносят замечания в нужные ноды формы. Поле
проверяется оператором `validate(handle, [rules])`, где `handle` — ручка модели (`model.$.<field>`), а
`rules` — массив правил-фабрик из `@reformer/core/validators`:

```typescript
import { createForm } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type User = { name: string; email: string };

// Схема валидации живёт отдельно от схемы формы.
const userValidation = defineValidation<User>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

const user = createForm<User>({ initial: { name: '', email: '' }, validation: userValidation });

// Прогон по требованию: замечания сами доедут до нод формы.
const result = await user.validate(); // ValidationResult: result.status === 'valid' | 'invalid' | …
```

`defineValidation` — тонкая identity-обёртка (как `defineFormBehavior` у behavior): она лишь задаёт
типы. Схема — **first-class значение**: её можно хранить в `const`, подключать к группе через `apply`,
собирать из шагов и юнит-тестировать без UI.

:::info Разметка и валидация — разные каналы
Схема формы (`createForm({ schema })` или JSON-документ) несёт только `model` / `component` /
`componentProps` — **никаких** правил. Схему разметки и схему валидации можно менять независимо:
правила пишутся раз, а вёрстка приходит хоть с сервера. См. [Схему формы](./form-schema).
:::

## Запуск валидации

Правила, переданные в сборку, запускает сама сборка:

| Вызов                               | Результат                   | Что делает                                                     |
| ----------------------------------- | --------------------------- | -------------------------------------------------------------- |
| `bundle.validate()`                 | `Promise<ValidationResult>` | проверить всю форму, разнести замечания по нодам и показать их |
| `bundle.validateStep(id)`           | `Promise<ValidationResult>` | проверить правила шага потока; неизвестный шаг — исключение    |
| `bundle.submission.submit(handler)` | `Promise<SubmitResult>`     | один прогон всех правил; при успехе — `handler(значения)`      |
| `bundle.submission.submitting`      | `ReadonlySignal<boolean>`   | идёт ли обработчик отправки                                    |
| `bundle.flow?.next()`               | `Promise<FlowTransition>`   | проверить правила текущего шага и при успехе перейти дальше    |

`ValidationResult` описывает прогон целиком:

```typescript
interface ValidationResult {
  status: 'valid' | 'invalid' | 'error' | 'cancelled';
  issues: ReadonlyMap<PathAwareSignal<unknown>, readonly ValidationIssue[]>; // по ручке поля
  failures: readonly ValidationFailure[]; // async-правила, которые не вернули результат
}
```

- `valid` — блокирующих замечаний нет (`severity: 'warning'` не блокирует);
- `invalid` — есть блокирующие замечания;
- `error` — хотя бы одно async-правило не вернуло результат (сеть, исключение) — см. `failures`;
- `cancelled` — прогон устарел: для той же пары «модель + правила» уже запущен следующий, модель
  изменилась, пока шла проверка отправки, либо сборку сняли (`bundle.dispose()`).

```typescript
const outcome = await user.submission.submit((values) => api.save(values));
if (outcome.status === 'invalid') showHint('Проверьте выделенные поля');
if (outcome.status === 'error') showToast('Не удалось проверить форму, повторите попытку');
```

Гарантии прогона:

- **Разнос по нодам.** Замечания садятся на ноды по ручке поля; разводить результат руками не нужно.
- **Показ только проверенного.** `validate()`, `validateStep()` и успешная отправка метят `touched`
  поля, которые правила проверили, — их замечания сразу видны. При отказе отправки (`invalid`,
  `error`) тронутой помечается вся форма; отменённая отправка (`cancelled`) ничего не трогает.
- **Warning не блокирует.** Правило с `severity: 'warning'` показывается в UI, но статус остаётся
  `valid` — submit не срывается.
- **Устаревшие прогоны отменяются.** Быстрый повторный вызов той же пары «модель + правила» отменяет
  предыдущий через `AbortSignal` (в т.ч. отменяет in-flight `fetch` async-правил).
- **Гашение.** Поле, ставшее валидным (или попавшее в выключенную `validateWhen`-ветку), получает
  `setIssues([])` автоматически.
- **`pending`.** Пока идут async-правила поля, его нода в `pending`.

:::warning Правила — стабильная ссылка
Отмена устаревших прогонов ключится по идентичности схемы правил, поэтому держите её в `const` /
`defineValidation` на уровне модуля. Инлайн-стрелка, созданная на каждый рендер, каждый раз
порождает новый прогон без дедупликации.
:::

### Без сборки — раннер

Те же прогоны доступны напрямую — например, вне React (server action, юнит-тест) или для формы,
собранной без `createForm`:

| Функция                                     | Результат                   | Ноды формы                                    |
| ------------------------------------------- | --------------------------- | --------------------------------------------- |
| `validateModel(model, rules, { touch? })`   | `Promise<boolean>`          | разносит замечания; `true` только для `valid` |
| `runValidation(model, rules)`               | `Promise<ValidationResult>` | не трогает — только сбор результата           |
| `applyValidationResult(result, { touch? })` | —                           | разносит собранный результат по нодам         |

```typescript
import { runValidation, validateModel } from '@reformer/core/validation';

const ok = await validateModel(model, userValidation, { touch: true }); // проверить и показать
const result = await runValidation(model, userValidation); // только посмотреть
```

## Пошаговые формы

Правила шагов задаются в потоке сборки: `flow: { steps: [{ id, rules }] }`, где `id` совпадает с
`selector` узла шага в схеме. Полный набор правил для отправки сборка собирает сама — из правил всех
шагов и `extras` (правила уровня формы, которые проверяются только целиком):

```typescript
import { createForm } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

const loanRules = defineValidation<Credit>(({ model }) => {
  validate(model.$.loanAmount, [required(), min(50000)]);
});
const contactsRules = defineValidation<Credit>(({ model }) => {
  validate(model.$.phone, [required()]);
});

const credit = createForm<Credit>({
  initial,
  schema: creditSchema, // узлы шагов с selector: 'loan', 'contacts', 'confirm'
  validation: { extras: crossStepRules }, // или голая схема: validation: rules
  flow: {
    steps: [
      { id: 'loan', rules: loanRules },
      { id: 'contacts', rules: contactsRules },
      { id: 'confirm' }, // шаг без правил
    ],
  },
});

await credit.flow?.next(); // { status: 'moved', from, to } | { status: 'stayed', step, reason, validation? }
await credit.validateStep('contacts'); // ValidationResult шага
await credit.submission.submit(sendApplication); // все шаги + extras одним прогоном
```

Визард `FormWizard` (`@reformer/cdk`, `@reformer/ui-kit`) — адаптер этого потока: он берёт поток из
сборки (или из пропа `flow`) и отправляет через `bundle.submission` на последнем шаге. См.
[FormWizard](/docs/cdk/form-wizard).

## Живая проверка и перепроверка

Когда проверять, пока пользователь вводит данные, задаёт **стратегия** — в конфиге валидации:

```typescript
createForm<User>({
  initial,
  validation: { rules: userValidation, strategy: 'afterFirstSubmit', debounce: 300 },
});
```

Стратегии — `submit` (по умолчанию, живой проверки нет), `blur`, `change`, `afterFirstSubmit`; в React
их армирует `useFormBundle`. Живую фазу `afterFirstSubmit` включает только попытка отправки
(`bundle.submission.submit`): `bundle.validate()`, `validateStep` и `flow.next()` её не включают.
Подробнее — в [Стратегиях валидации](../../validation/validation-strategies).

Точечную перепроверку **в ответ на изменение** другого поля (например, `amount` зависит от
`maxAmount`) выражают мостом из behavior — оператором `revalidateWhen`, который зовёт раннер со
своей стабильной схемой правил:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // При изменении maxAmount перепроверить amount.
  revalidateWhen([model.$.maxAmount], () => void validateModel(model, amountRules));
});
```

## Встроенные валидаторы

| Валидатор      | Описание                   |
| -------------- | -------------------------- |
| `required()`   | Поле должно иметь значение |
| `email()`      | Корректный email           |
| `minLength(n)` | Минимальная длина          |
| `maxLength(n)` | Максимальная длина         |
| `min(n)`       | Минимальное число          |
| `max(n)`       | Максимальное число         |
| `pattern(re)`  | Совпадение с регуляркой    |
| `isNumber()`   | Значение — число           |
| `integer()`    | Целое число                |

Фабрики импортируются из `@reformer/core/validators` и принимают опции `RuleOptions = { code?,
params? }`: свой код замечания (`required({ code: 'name.required' })`) и дополнительные параметры.
Текста у правила нет — его даёт словарь сообщений по коду (см.
[Обзор валидации](../../validation/overview#тексты-замечаний)). Фабрики кладутся прямо в массив
`rules` оператора `validate` и работают в том числе с nullable-полями. Полный список (числовые,
датовые, файловые) — в [Встроенных валидаторах](../../validation/built-in).

## Тип правила

Синхронное правило — это `Rule<TField>`: оно читает **только значение** и возвращает замечание
либо `null`:

```typescript
type Rule<TField> = (value: TField) => ValidationIssue | null;

interface ValidationIssue {
  code: string; // встроенный ('required') или свой ('loanAmount.required')
  params?: Record<string, unknown>; // значения для текста: { minLength: 8, actualLength: 3 }
  severity?: 'error' | 'warning'; // 'error' (по умолчанию) блокирует отправку
}
```

Правило, написанное для более широкого типа, подходит полю с более узким: `min()` годится и полю
`number`, и полю `number | null`. Обратное — ошибка компиляции: `validate(model.$.age, [email()])`
подсветится, потому что `email` ждёт строку. Правило над несколькими полями — не дополнительные
аргументы, а оператор `cross` (см. ниже).

Асинхронное правило — `AsyncRule<TField>`: получает `AbortSignal` и возвращает `Promise`:

```typescript
type AsyncRule<TField> = (
  value: TField,
  ctx: { signal: AbortSignal }
) => Promise<ValidationIssue | null>;
```

## Кастомные и cross-field правила

Кастомная проверка — обычная функция типа `Rule`, кладётся в тот же массив `validate`. Правило над
несколькими полями пишется оператором `cross(handle, check)` из аргумента схемы: `check` получает
**снимок** модели области (`model.get()`), а замечание садится на поле-носитель `handle`:

```typescript
import type { ValidationIssue } from '@reformer/core';
import { validate, defineValidation, type Rule } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type Signup = { password: string; confirmPassword: string };

// Правило по значению.
const strongPassword: Rule<string> = (value) =>
  !value || value.length < 8 ? { code: 'password.tooShort' } : null;

// Правило по снимку формы.
const passwordsMatch = (f: Signup): ValidationIssue | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password ? { code: 'mismatch' } : null;

const signupValidation = defineValidation<Signup>(({ model, cross }) => {
  validate(model.$.password, [required(), strongPassword]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch); // замечание сядет на confirmPassword
});
```

## Условная валидация

Чтобы правила действовали только при условии, оберните их в `validateWhen(cond, cb)`. Пока `cond()`
истинно — правила внутри `cb` активны; иначе их поля гасятся. Условие читает значения модели через
value-proxy (`model.<field>`):

```typescript
import { validate, validateWhen, defineValidation } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

const schema = defineValidation<Form>(({ model }) => {
  // Телефон обязателен только если пользователь хочет SMS.
  validateWhen(
    () => model.wantsSms,
    () => validate(model.$.phone, [required({ code: 'phone.required' })])
  );
});
```

:::info Условие валидации ≠ условная доступность
`validateWhen` управляет только **проверкой** правил. Если поле должно ещё и **отключаться** (или
скрываться) при невыполнении условия — это забота behavior: `enableWhen`, `hideWhen` (см.
[Схему behavior](./behavior-schema)). Валидация и доступность — независимые ветки.
:::

## Асинхронная валидация

Асинхронные проверки (например, уникальность на сервере) объявляются оператором
`validateAsync(handle, [asyncRules])`. Прогон дожидается их, держит ноду поля в `pending` и
прокидывает `AbortSignal` в каждое правило, чтобы устаревший запрос можно было отменить:

```typescript
import { validate, validateAsync, defineValidation } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

const schema = defineValidation<Form>(({ model }) => {
  validate(model.$.username, [required()]);
  validateAsync(model.$.username, [
    async (value, { signal }) => {
      if (!value || value.length < 3) return null;
      const res = await fetch(`/api/check?u=${encodeURIComponent(value)}`, { signal });
      const { available } = await res.json();
      return available ? null : { code: 'username.taken' };
    },
  ]);
});
```

Отклонённое правило (сеть, исключение) — сбой проверки, а не «замечаний нет»: прогон получает
статус `error`, поле — блокирующее замечание `ruleFailed`. Если недоступность сервиса не должна
мешать отправке, поймайте ошибку в правиле и верните `null`. Подробнее — в
[Асинхронной валидации](../../validation/async).

## Валидация по массиву

Правила для **каждой** строки массива под-форм подключает оператор `applyEach(model.$.<массив>, rules)`:
`rules` — обычная схема валидации над типом элемента, у каждой строки своя область (`cross` внутри
получает снимок строки). Правило уровня всего массива (длина, уникальность) вешается на ручку самого
массива — замечание сядет на ноду `FormArray`:

```typescript
import type { ValidationIssue } from '@reformer/core';
import { applyEach, defineValidation, validate } from '@reformer/core/validation';
import { minLength, required } from '@reformer/core/validators';

type OrderItem = { name: string };
type Order = { items: OrderItem[] };

// Правила одной строки.
const itemRules = defineValidation<OrderItem>(({ model }) => {
  validate(model.$.name, [required({ code: 'item.name.required' })]);
});

// Правило уровня массива — по снимку формы.
const uniqueItemNames = (order: Order): ValidationIssue | null => {
  const names = order.items.map((item) => item.name);
  return names.length !== new Set(names).size ? { code: 'items.duplicate' } : null;
};

const orderValidation = defineValidation<Order>(({ model, cross }) => {
  validate(model.$.items, [minLength(1, { code: 'items.minLength' })]); // хотя бы одна строка
  cross(model.$.items, uniqueItemNames); // замечание — на ноде массива
  applyEach(model.$.items, itemRules); // правила каждой строки
});
```

Массив примитивов (теги, мультивыбор) — одно значение поля: его проверяют целиком,
`validate(model.$.tags, [required(), maxLength(3)])`.

## Переиспользование и композиция

Списки правил и целые под-схемы легко выносятся и переиспользуются. Массив `Rule[]` — обычное
значение:

```typescript
import type { Rule } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

const nameRules: Rule<string>[] = [required(), minLength(2)];
const emailRules: Rule<string>[] = [required(), email()];

const schema = defineValidation<Profile>(({ model }) => {
  validate(model.$.firstName, nameRules);
  validate(model.$.lastName, nameRules);
  validate(model.$.email, emailRules);
});
```

Схему группы (адрес и т.п.) подключают к группе модели оператором `apply(model.$.<группа>, rules)` —
к одной группе или к нескольким сразу. Тот же `apply` с одними схемами в аргументах собирает
несколько схем над **одной** моделью:

```typescript
import { validate, validateWhen, apply, defineValidation } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';

// Схема адреса над типом группы.
const addressRules = defineValidation<Address>(({ model }) => {
  validate(model.$.city, [required()]);
  validate(model.$.postalCode, [required(), pattern(/^\d{6}$/)]);
});

const orderValidation = defineValidation<Order>(({ model }) => {
  apply(model.$.billing, addressRules); // схема — в области группы
  validateWhen(
    () => !model.sameAsBilling,
    () => apply(model.$.shipping, addressRules)
  );
});

// Композиция нескольких схем над одной моделью.
const fullValidation = defineValidation<Order>(() => apply(step1, step2, orderValidation));
```

## Дальше

- [Обзор валидации](../../validation/overview) — подробный гайд и тексты замечаний.
- [Встроенные валидаторы](../../validation/built-in) — весь список.
- [Кастомные валидаторы](../../validation/custom) — свои правила.
- [Композиция](./composition) — переиспользование наборов валидации.
