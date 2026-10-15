---
sidebar_position: 5
---

# Стратегии валидации

Как и **когда** запускать проверки. Валидация — **отдельный слой**: правила живут в
`defineValidation` и подключаются к сборке `createForm({ validation })`. Проверку на отправке и на
шаге потока сборка запускает сама (`bundle.submission.submit`, `flow.next()`), а **живую** проверку
во время ввода выбирают **декларативно, одной опцией** — `strategy` в конфиге валидации. Стратегия —
тонкий слой поверх того же движка прогона: она лишь решает, когда запустить проверку и раскрывать ли
замечания.

## Выбор стратегии одной опцией

Конфиг валидации сборки — либо голая схема правил (`validation: rules`), либо объект
`FormValidation`:

```typescript
interface FormValidation<T> {
  rules?: ValidationDefinition<T>; // полный набор правил
  extras?: ValidationDefinition<T>; // правила, которые проверяются только целиком (отправка)
  strategy?: 'submit' | 'blur' | 'change' | 'afterFirstSubmit'; // по умолчанию 'submit'
  debounce?: number; // мс, для живых прогонов
  liveAfterSubmit?: 'change' | 'blur'; // живая фаза afterFirstSubmit, по умолчанию 'change'
}
```

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { validate, defineValidation } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Button } from '@reformer/ui-kit';

type LoginForm = { email: string; password: string };

// Правила — СТАБИЛЬНАЯ ссылка (константа модуля), иначе ломается отмена устаревших прогонов.
const loginValidation = defineValidation<LoginForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function LoginFormView() {
  // useFormBundle собирает форму один раз и армирует живую стратегию на клиенте.
  const login = useFormBundle(() =>
    createForm<LoginForm>({
      initial: { email: '', password: '' },
      schema: loginSchema,
      validation: {
        rules: loginValidation,
        strategy: 'afterFirstSubmit', // тихо до 1-й отправки, дальше — живая проверка
        debounce: 400,
      },
    })
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Попытка отправки: при отказе раскрыта вся форма, afterFirstSubmit уходит в живую фазу.
    await login.submission.submit((values) => api.login(values));
  };

  return (
    <form onSubmit={onSubmit}>
      <FormField control={login.form.email} />
      <FormField control={login.form.password} />
      <Button type="submit">Войти</Button>
    </form>
  );
}
```

Четыре стратегии и их семантика:

| `strategy`           | Когда прогон                              | `touch`                                  | Что раскрывается                    |
| -------------------- | ----------------------------------------- | ---------------------------------------- | ----------------------------------- |
| `submit` (по умолч.) | только явно: `validate()` / отправка      | `true`                                   | всё — на отправке                   |
| `blur`               | смена `touched` поля (потеря фокуса)      | `false`                                  | только сблюренные (по `touched`)    |
| `change`             | на каждый ввод (+ `debounce`)             | `false`                                  | только редактированные (по `dirty`) |
| `afterFirstSubmit`   | тихо до 1-й попытки отправки, затем live¹ | `true` на явных прогонах, live — `false` | тихо → всё на отправке → далее live |

¹ `afterFirstSubmit` переходит в живую фазу только после **попытки отправки** —
`bundle.submission.submit(handler)` или `submit()` хука `useFormValidation`. Проверка без отправки —
`bundle.validate()`, `bundle.validateStep(id)`, «Далее» (`flow.next()`), `validate()` хука — фазу не
меняет. Чем идёт живая фаза, задаёт `liveAfterSubmit: 'change' | 'blur'` (по умолчанию `'change'`).
`debounce` (мс) применим к живому прогону (`change` и живой фазе `afterFirstSubmit`).

Живой прогон не метит поля тронутыми: замечание видно, только когда поле уже `touched` или `dirty`
(`shouldShowIssues`). Стратегия армируется только на клиенте — в React это делает `useFormBundle` в
эффекте, поэтому сборка безопасна при SSR.

:::warning Правила — стабильная ссылка
Передавайте **одну и ту же** `ValidationDefinition<T>` — константу модуля. Прогоны дедуплицируются
и отменяются по идентичности пары «модель + правила»; новая инлайн-стрелка на каждый рендер ломает
этот дедуп.
:::

## Стратегия `submit` — проверка на отправке

Дефолт: пока не позвали `bundle.validate()` или отправку, поля не проверяются; на отправке идёт
полный прогон с раскрытием замечаний — при отказе (`invalid`, `error`) тронутой помечается вся
форма, — они разносятся по нодам, форма подсвечивает поля сама.

```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  const outcome = await bundle.submission.submit((values) => api.save(values));
  if (outcome.status !== 'submitted') return; // замечания уже на полях
};
```

:::info Читать сами замечания — из нод
`bundle.validate()` возвращает `ValidationResult` (статус и замечания по ручкам полей); конкретные
замечания полей читаются реактивно через `useFormControl(form.<field>).issues` или из нод формы (см.
[Обработку ошибок](/docs/validation/error-handling)).
:::

## Форма без сборки — `useFormValidation`

Если форма собрана без `createForm` (например, `createFormFromModel` для формы элемента или своей
сборки), ту же стратегию даёт хук `useFormValidation` из `@reformer/core/react`. Он берёт модель,
правила и стратегию, армирует подписки и возвращает два разных прогона и флаг `isValidating`:

- `submit()` — **попытка отправки**: полный прогон; при отказе тронутой помечается вся форма,
  `afterFirstSubmit` переходит в живую фазу. Для `onSubmit`;
- `validate()` — **проверка без отправки**: полный прогон, раскрыты замечания проверенных полей,
  фаза `afterFirstSubmit` не меняется. Для кнопки «Проверить».

Оба отвечают `boolean` — `true` только при статусе `valid` — и стабильны между рендерами.

```tsx
import { useFormValidation } from '@reformer/core/react';

const { submit, validate, isValidating } = useFormValidation({
  model,
  schema: loginValidation,
  strategy: 'afterFirstSubmit',
});

const onSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  if (await submit()) await api.login(model.get());
};

// Кнопка «Проверить»: показать замечания, не включая живую фазу.
const onCheck = () => void validate();
```

Вне React тот же прогон — прямой вызов раннера: `await validateModel(model, rules, { touch: true })`
(server action, юнит-тест).

## Пошаговые формы

У пошаговой формы два независимых момента прогона, которые стратегия **не меняет**: гейт шага (правила
текущего шага на «Далее») и полная проверка (все шаги + `extras` на отправке). Оба описаны в потоке
сборки:

```tsx
const credit = useFormBundle(() =>
  createForm<Credit>({
    initial,
    schema: creditSchema, // узлы шагов: selector 'loan', 'applicant', 'confirm'
    validation: {
      extras: crossFieldRules, // cross-field/warnings уровня формы — только на отправке
      strategy: 'blur', // ЖИВАЯ проверка поверх шагов
    },
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'applicant', rules: applicantRules },
        { id: 'confirm' }, // без правил
      ],
    },
  })
);

// Визард — адаптер потока: берёт его из сборки в контексте или из пропа flow.
<FormWizard form={credit.form} flow={credit.flow}>
  {/* …Step / Actions… */}
</FormWizard>;
```

Здесь `blur`-стратегия подсвечивает замечания по мере потери фокуса, но «Далее» по-прежнему
проверяет правила текущего шага целиком (`flow.next()` → `{ status: 'stayed', reason: 'invalid' }`,
если не прошли), а отправка — все правила одним прогоном (`bundle.submission.submit`). Стратегия
только добавляет ранний фидбек, гейт и финальную проверку не подменяет. Правила шага адресуются по
`id` шага — он же `selector` узла шага в схеме, поэтому перестановка шагов не рассинхронизирует
правила. См. [FormWizard](/docs/cdk/form-wizard).

:::info Не тащите async в каждый шаг
Проверка шага дожидается async-правил (`validateAsync`). Дорогую серверную проверку (код из СМС,
уникальность) держите в правилах того шага, где она уместна, или в `extras` (только отправка) —
тогда гейт остальных шагов и живой слой остаются быстрыми.
:::

## Под капотом

Стратегия — не второй движок. Она решает ровно две вещи: **когда** запустить прогон и с каким
`touch`. Разнос замечаний, гашение валидных полей, отмену устаревших прогонов и дедуп по паре
«модель + правила» делает один и тот же раннер (`validateModel` и его половины `runValidation` /
`applyValidationResult`).

- **`createFormValidation(model, rules, options)`** из `@reformer/core/validation` — headless-фабрика
  контроллера. Она **чиста до `start()`**: подписки армируются только на клиенте, поэтому фабрика
  SSR-safe. `start()` возвращает `dispose`, снимающий подписки.

  ```ts
  type ValidationStrategyKind = 'submit' | 'blur' | 'change' | 'afterFirstSubmit';

  interface ValidationStrategyOptions {
    strategy?: ValidationStrategyKind;
    debounce?: number;
    liveAfterSubmit?: 'change' | 'blur';
  }

  interface FormValidationRunOptions {
    touch?: true | 'all'; // true (по умолчанию) — проверенные поля; 'all' — при отказе вся форма
    submit?: boolean; // попытка отправки: afterFirstSubmit переходит в живую фазу
  }

  interface FormValidationController {
    validate(): Promise<boolean>; // полный прогон, touch: true; фазу afterFirstSubmit не меняет
    run(options?: FormValidationRunOptions): Promise<ValidationResult>; // с полным результатом
    start(): () => void; // армирует подписки (только на клиенте) → dispose
    dispose(): void;
    readonly isValidating: boolean;
    readonly validating: ReadonlySignal<boolean>;
  }
  ```

- **Сборка** создаёт такой контроллер из `validation` и держит его в служебном поле
  `bundle.validation` (`{ rules, controller }`); `useFormBundle` армирует его в `useEffect`.
  `bundle.validate()` — это `controller.run()`, проверка отправки `bundle.submission.submit` —
  `controller.run({ touch: 'all', submit: true })`.
- **`useFormValidation`** — React-обёртка над фабрикой для формы без сборки: мемоизирует контроллер,
  армирует его в `useEffect`; `submit()` — это `controller.run({ touch: 'all', submit: true })`,
  `validate()` — `controller.validate()`.
- **`revalidateWhen([deps], () => void validateModel(model, rules))`** остаётся низкоуровневым мостом
  от реактивного слоя поведения к раннеру — для точечных случаев, когда декларативной стратегии мало
  (например, перепроверка зависимого поля при изменении соседа, см. ниже).

:::note `touch: true` раскрывает только проверенное
Проверка (`validate()`) и успешная отправка помечают `touched` **только те поля, которые правило
реально проверило**, — это не сплошной `form.markAsTouched()`. Вся форма помечается тронутой лишь
при отказе отправки (`invalid`, `error`; в опциях прогона — `touch: 'all'`); отменённая отправка
(`cancelled`) форму не трогает. Замечания с `severity: 'warning'` показываются пользователю, но
**не блокируют** отправку — прогон получит статус `valid` (см.
[Обработку ошибок](/docs/validation/error-handling)).
:::

## Условная валидация

Правила, действующие только в части формы, оборачиваются оператором `validateWhen(cond, cb)`. Пока
`cond()` ложно, правила внутри не срабатывают, а их поля **гасятся** (`setIssues([])`) — не нужно
«прятать» лишние замечания в UI.

```typescript
import { validate, validateWhen, defineValidation } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';

type AccountForm = { accountType: string; businessName: string; ein: string };

const accountValidation = defineValidation<AccountForm>(({ model }) => {
  validate(model.$.accountType, [required()]);
  // Поля бизнес-аккаунта проверяются, только когда выбран business
  validateWhen(
    () => model.accountType === 'business',
    () => {
      validate(model.$.businessName, [required()]);
      validate(model.$.ein, [required(), pattern(/^\d{2}-\d{7}$/, { code: 'ein.pattern' })]);
    }
  );
});
```

Условие читает значение поля через прокси модели (`model.accountType`), а ручку для `validate` — через
`model.$.accountType`. `validateWhen` можно вкладывать: правило внутри активно, только когда истинны
**все** охватывающие условия.

## Зависимые поля

Кросс-полевое правило вешается оператором `cross(handle, check)` на поле, которое должно нести
замечание; `check` получает **снимок** модели области (`model.get()`) и читает соседей из него.
Чтобы правило **перепроверялось** при изменении зависимости, есть два пути: живая стратегия
(`change` / `blur` перепроверяют всю форму) или точечный мост `revalidateWhen` в behavior.

```typescript
import { createForm, type ValidationIssue } from '@reformer/core';
import { validate, defineValidation, validateModel } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';

type PasswordForm = { password: string; confirmPassword: string };

// Кросс-полевое правило — обычная функция над снимком формы.
const passwordsMatch = (f: PasswordForm): ValidationIssue | null =>
  f.confirmPassword && f.password && f.confirmPassword !== f.password
    ? { code: 'passwordMismatch' }
    : null;

const passwordValidation = defineValidation<PasswordForm>(({ model, cross }) => {
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch); // замечание садится на confirmPassword
});

// confirmPassword перепроверяется, когда меняется password
const passwordBehavior = defineFormBehavior<PasswordForm>(({ model }) => {
  revalidateWhen([model.$.password], () => void validateModel(model, passwordValidation));
});

const passwordForm = createForm<PasswordForm>({
  initial: { password: '', confirmPassword: '' },
  validation: passwordValidation,
  behavior: passwordBehavior,
});
```

:::note `cross` берёт снимок, а не живой сигнал
`check` внутри `cross` видит `model.get()` на момент прогона — это чистое чтение, без подписок.
Живость даёт стратегия или `revalidateWhen`: они перезапускают прогон при изменении зависимости, и
правило считается заново по свежему снимку.
:::

## Валидация массива

Строки массива под-форм проверяет оператор `applyEach(model.$.<массив>, rowRules)` — `rowRules`
описывает поля строки обычным `validate` в области строки. Правило на **весь массив** (длина,
уникальность) вешается на ручку самого массива: замечание сядет на ноду `FormArray`.

```typescript
import type { ValidationIssue } from '@reformer/core';
import { applyEach, defineValidation, validate } from '@reformer/core/validation';
import { minLength, required } from '@reformer/core/validators';

type Tag = { label: string };
type TagForm = { listTitle: string; tags: Tag[] };

// Правила одной строки.
const tagRules = defineValidation<Tag>(({ model }) => {
  validate(model.$.label, [required()]);
});

// Правило уровня массива — по снимку формы.
const uniqueTags = (f: TagForm): ValidationIssue | null => {
  const labels = f.tags.map((t) => t.label);
  return labels.length !== new Set(labels).size ? { code: 'tags.notUnique' } : null;
};

const tagValidation = defineValidation<TagForm>(({ model, cross }) => {
  validate(model.$.listTitle, [required()]);
  validate(model.$.tags, [minLength(1, { code: 'tags.minLength' })]); // хотя бы одна строка
  cross(model.$.tags, uniqueTags); // замечание — на ноде массива
  applyEach(model.$.tags, tagRules); // правила каждой строки
});
```

Схему группы (адрес, созаёмщик) подключают к группе оператором `apply(model.$.<группа>, rules)`.

## Хорошие практики

- **Стратегию выбирайте опцией, а не руками.** `validation: { rules, strategy }` сборки (или
  `useFormValidation` для формы без сборки) закрывает почти все случаи; ручной `revalidateWhen`
  берите только для точечной перепроверки зависимого поля.
- **Правила — стабильная ссылка.** Прогоны отменяются по идентичности пары «модель + правила» —
  держите схемы в константах модуля, не создавайте инлайн-стрелку на каждый рендер.
- **Несколько узких правил вместо одного «общего».** Массив
  `[required(), minLength(8), strongPassword]` даёт конкретные замечания, которые проще показать и
  перевести.
- **Шаги — через поток сборки.** Правила шагов задавайте в `flow.steps`, правила уровня формы — в
  `extras`: полный набор для отправки сборка соберёт сама, и гейт шага с отправкой проверят ровно одно
  и то же.
- **`validateWhen` вместо «спрятать замечание».** Выключенная ветка не проверяется и гасит свои
  поля — это дешевле и честнее, чем проверять всё и прятать лишнее в UI.
- **Дорогую живую проверку дебаунсите.** У стратегий `change` / `afterFirstSubmit` есть `debounce`;
  для ручного `revalidateWhen` оберните колбэк собственным дебаунсом, а отменой устаревших ответов
  займётся `AbortSignal` из `validateAsync`.

## Дальше

- [Асинхронная валидация](/docs/validation/async) — серверные проверки, отмена устаревших запросов.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и кросс-полевые проверки.
- [Обработка ошибок](/docs/validation/error-handling) — чтение, фильтрация и отображение замечаний.
- [FormWizard](/docs/cdk/form-wizard) — визард поверх потока шагов сборки.
