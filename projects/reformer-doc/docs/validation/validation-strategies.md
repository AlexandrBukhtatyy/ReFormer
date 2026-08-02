---
sidebar_position: 5
---

# Стратегии валидации

Как и **когда** запускать проверки. В актуальном контракте валидация — **отдельный слой**: правила
живут в `defineValidationSchema`, а прогоняет их раннер `validateModel` **по требованию**. «Момент
прогона» больше не разводят руками — его выбирают **декларативно, одним пропом**: хук
`useFormValidation({ strategy })` для простой формы и опция `strategy` в `defineSteps` +
`useWizardStepValidation` для мастера. Стратегия — это тонкий слой ПОВЕРХ `validateModel`: она лишь
решает, когда дёрнуть раннер и с каким `touch`, а сам движок остаётся один.

## Выбор стратегии одним пропом — `useFormValidation`

Хук `useFormValidation` из `@reformer/core` берёт модель, схему и стратегию — и сам армит нужные
подписки. Возвращает `submit()` (полный прогон, метит touched, раскрывает все ошибки), `validate()`
(тот же полный прогон) и флаг `isValidating`.

```tsx
import { useMemo } from 'react';
import { createModel, createForm, useFormValidation } from '@reformer/core';
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type LoginForm = { email: string; password: string };

// schema — СТАБИЛЬНАЯ ссылка (module-level const), иначе ломается дедуп раннера.
const loginValidation = defineValidationSchema<LoginForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function LoginForm() {
  const { model, form } = useMemo(() => {
    const m = createModel<LoginForm>({ email: '', password: '' });
    return { model: m, form: createForm({ model: m, schema: layout }) };
  }, []);

  // Одна строка выбирает поведение валидации целиком.
  const { submit, isValidating } = useFormValidation({
    model,
    schema: loginValidation,
    strategy: 'afterFirstSubmit', // тихо до 1-й отправки, дальше — живая проверка
    debounce: 400,
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submit(); // сам метит touched → раскрывает все ошибки, ручной markAsTouched не нужен
    if (ok) await api.login(model.get());
  };

  return (
    <form onSubmit={onSubmit}>
      {/* …FormField control={form.email} / control={form.password}… */}
      <button type="submit" disabled={isValidating}>
        {isValidating ? 'Проверка…' : 'Войти'}
      </button>
    </form>
  );
}
```

Четыре стратегии и их семантика:

| `strategy`           | Когда прогон                         | `touch`                               | Что раскрывается                    |
| -------------------- | ------------------------------------ | ------------------------------------- | ----------------------------------- |
| `submit` (по умолч.) | только `validate()` / `submit()`     | `true`                                | всё — на submit                     |
| `blur`               | смена `touched` поля (потеря фокуса) | `false`                               | только сблюренные (по `touched`)    |
| `change`             | на каждый ввод (+ `debounce`)        | `false`                               | только редактированные (по `dirty`) |
| `afterFirstSubmit`   | тихо до 1-го submit, затем live¹     | `true` один раз на 1-м, далее `false` | тихо → всё на submit → далее live   |

¹ `afterFirstSubmit` переходит в живую фазу после первой отправки; чем именно (`liveAfterSubmit:
'change' | 'blur'`, по умолчанию `'change'`) — задаёт проп. `debounce` (мс) применим к живому прогону
(`change` и живой фазе `afterFirstSubmit`).

:::warning `schema` — стабильная ссылка
Передавайте **одну и ту же** `ValidationSchema<T>`: module-level `const` или `useMemo`. Раннер дедуплицирует и отменяет
устаревшие прогоны по идентичности пары `(model, schema)`; новая инлайн-стрелка на каждый рендер ломает
этот дедуп. `submit()` сам метит `touched` — отдельный `form.markAsTouched()` перед отправкой не нужен.
:::

## Стратегия `submit` — проверка на отправке

Дефолт: пока не позвали `submit()`/`validate()`, поля не проверяются; на отправке идёт полный прогон
схемы с `{ touch: true }`, ошибки разносятся по нодам, форма подсвечивает поля сама.

```tsx
const { submit } = useFormValidation({
  model,
  schema: fullValidation,
  strategy: 'submit', // прогон ТОЛЬКО на submit()/validate()
});

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (await submit()) await api.save(model.get());
};
```

Тот же submit-time доступен и низкоуровнево — прямым вызовом раннера (например, вне React: server
action, юнит-тест):

```tsx
import { validateModel } from '@reformer/core/validation';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAsTouched(); // руками раскрыть ошибки в UI
  if (await validateModel(model, fullSchema)) await api.save(model.get());
};
```

:::info Читать сами ошибки — из нод
`validateModel` (и `submit()`) возвращают только `boolean`; конкретные ошибки полей читаются реактивно
через `useFormControl(form.<field>).errors` или из нод формы (см.
[Обработку ошибок](/docs/validation/error-handling)). Прогон вне React работает так же — ошибки роутятся
в ноды, если они есть; для чисто «данных» соберите форму на модели и прочитайте валидность из результата.
:::

## Пошаговые формы — живая валидация внутри шага

У мастера два независимых момента прогона, которые стратегия **не меняет**: гейт шага (`validateStep`
на «Далее») и полная проверка (`validateAll` на submit). Оба уже инкапсулированы в `defineSteps`
(см. [FormWizard](/docs/cdk/form-wizard)) и идут с `{ touch: true }`. Новое — **живой слой ПОВЕРХ
них**: опция `strategy` в `defineSteps` включает выбранную стратегию **внутри активного шага**, а хук
`useWizardStepValidation` армит её под текущий шаг и снимает при переходе/размонтировании.

```tsx
import { FormWizard, defineSteps, useWizardStepValidation } from '@reformer/cdk/form-wizard';

// step1 / step2 / crossFieldRules — ValidationSchema<Root>
const config = defineSteps<'loan' | 'applicant' | 'confirm', Root>(model, {
  steps: {
    loan: step1,
    applicant: step2,
    confirm: null, // без правил — объявлено ЯВНО
  },
  extras: crossFieldRules, // cross-field/warnings уровня формы — только на submit (validateAll)
  strategy: 'blur', // ЖИВАЯ проверка внутри активного шага
  liveAfterSubmit: 'change',
});

// Хук читает currentStep из FormWizardContext → живёт ВНУТРИ <FormWizard>.
function StepLiveValidation() {
  useWizardStepValidation(config); // no-op, если strategy не задана / 'submit' / у шага нет правил
  return null;
}

<FormWizard form={form} config={config}>
  <StepLiveValidation />
  {/* …Step / Actions… */}
</FormWizard>;
```

Здесь `blur`-стратегия подсвечивает ошибки шага по мере потери фокуса, но кнопка «Далее» по-прежнему
гоняет `validateStep` целиком, а submit — `validateAll`. Стратегия только добавляет ранний фидбек, гейт
и финальную проверку не подменяет.

:::info Низкоуровневая альтернатива — `STEP_SCHEMAS[step - 1]`
Раньше гейт разводили руками: массив под-схем и `validateStep: (step) => validateModel(model, STEP_SCHEMAS[step - 1])`.
Такая индексация **хрупкая** (перестановка шага молча рассинхронизирует правила) и не даёт живого слоя.
`defineSteps` адресует правила по `selector` шага и принимает `strategy` — предпочитайте его; ручной
массив оставляйте только когда визард собран без `defineSteps`.
:::

:::info Не тащите async в каждый шаг
`validateModel` дожидается async-правил (`validateAsync`). Дорогую серверную проверку (код из СМС,
уникальность) держите в схеме того шага, где она уместна, или в `extras` (только submit) — тогда гейт
остальных шагов и живой слой остаются быстрыми.
:::

## Под капотом

Стратегия — не второй движок. Она решает ровно две вещи: **когда** позвать `validateModel` и с каким
`touch`. Всю маршрутизацию ошибок, гашение валидных полей, отмену устаревших прогонов и дедуп по
`(model, schema)` по-прежнему делает единственный раннер `validateModel`.

- **`createFormValidation(model, schema, options)`** из `@reformer/core/validation` — headless-фабрика
  контроллера. Она **чиста до `start()`**: подписки армятся только на клиенте, поэтому фабрика SSR-safe.
  `start()` возвращает `dispose`, снимающий подписки.

  ```ts
  type ValidationStrategyKind = 'submit' | 'blur' | 'change' | 'afterFirstSubmit';

  interface ValidationStrategyOptions {
    strategy?: ValidationStrategyKind;
    debounce?: number;
    liveAfterSubmit?: 'change' | 'blur';
  }

  interface FormValidationController {
    validate(): Promise<boolean>; // полный прогон, touch:true; переводит afterFirstSubmit в live-фазу
    start(): () => void; // армит подписки (только на клиенте) → dispose
    dispose(): void;
    readonly isValidating: boolean;
    readonly validating: ReadonlySignal<boolean>;
  }
  ```

- **`useFormValidation`** — React-обёртка над фабрикой: мемоизирует контроллер, армит его в `useEffect`
  (SSR-safe), а `submit()` — это `controller.validate()`.
- **В мастере** тот же контроллер отдаёт `defineSteps(model, …).createStepController(step)` (или `null`,
  если у шага нет правил / нет стратегии), а `useWizardStepValidation` армит его под текущий шаг.
- **`revalidateWhen([deps], () => void validateModel(model, schema))`** остаётся низкоуровневым мостом
  от реактивного слоя поведения к раннеру — для точечных случаев, когда декларативной стратегии мало
  (например, перепроверка зависимого поля при изменении соседа, см. ниже). Он не заменяет стратегию, а
  дополняет её.

:::note `{ touch: true }` раскрывает только провалидированное
`validate()`/`submit()` идут с `{ touch: true }`, но помечают `touched` **только те поля, которые
правило реально проверило**, — это не сплошной `form.markAsTouched()`. Поля без правил остаются
нетронутыми. Ошибки с `severity: 'warning'` показываются пользователю, но **не блокируют** submit —
`validate()` вернёт `true` даже при одних предупреждениях (см. [Обработку ошибок](/docs/validation/error-handling)).
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
единственный мост от реактивного слоя поведения к прогону валидации по требованию (см. «Под капотом»).

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

- **Стратегию выбирайте пропом, а не руками.** `useFormValidation({ strategy })` (форма) и
  `defineSteps({ strategy }) + useWizardStepValidation` (мастер) закрывают почти все случаи; ручной
  `revalidateWhen` берите только для точечной перепроверки зависимого поля.
- **`schema` — стабильная ссылка.** `validateModel` отменяет устаревший прогон по идентичности
  `(model, schema)` — держите схемы в `const` / `useMemo`, не создавайте инлайн-стрелку на каждый рендер:
  иначе рвётся дедуп раннера и стратегии.
- **Несколько узких правил вместо одного «общего».** `validate(sig, [required(), minLength(8), strongPassword])`
  даёт конкретные ошибки, которые проще показать и локализовать.
- **Композиция шагов через `defineSteps` / `apply`.** Полную схему собирайте из под-схем шагов
  (`extras` для cross-field/warnings), а не дублируйте правила — так гейт шага и submit проверяют
  ровно одно и то же.
- **`validateWhen` вместо «спрятать ошибку».** Выключенная ветка не проверяется и гасит свои поля — это
  дешевле и честнее, чем валидировать всё и прятать лишнее в UI.
- **Не смешивайте слои на одном поле.** Node-level `updateOn` (реактивные триггеры) и активная
  schema-стратегия оба пишут ошибки в ноду — на **одних и тех же** полях это даёт мерцание. Выберите
  один слой на поле.
- **Дорогую живую проверку дебаунсите.** У стратегий `change`/`afterFirstSubmit` есть проп `debounce`;
  для ручного `revalidateWhen` оберните колбэк собственным дебаунсом, а отменой устаревших ответов
  займётся `AbortSignal` из `validateAsync`.

## Дальше

- [Асинхронная валидация](/docs/validation/async) — серверные проверки, отмена устаревших запросов.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и кросс-полевые проверки.
- [Обработка ошибок](/docs/validation/error-handling) — чтение, фильтрация и отображение ошибок.
- [FormWizard](/docs/cdk/form-wizard) — `defineSteps`, гейт шага и `validateAll`.
