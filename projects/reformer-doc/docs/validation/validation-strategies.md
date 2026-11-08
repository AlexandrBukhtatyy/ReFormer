---
sidebar_position: 5
---

# Стратегии валидации

[Стратегия валидации](../reference/glossary.md) решает, когда проверять поля и когда показывать
замечания. Она задаётся одной опцией `strategy` в конфиге валидации сборки формы. Правила от неё не
меняются.

## Когда показывать ошибки

Выбирайте стратегию по тому, как пользователь заполняет форму:

| Задача                                                       | `strategy`              |
| ------------------------------------------------------------ | ----------------------- |
| Короткая форма: не мешать вводу, проверить при отправке      | `submit` (по умолчанию) |
| Длинная анкета: подсказывать по мере заполнения              | `blur`                  |
| Поле, где ответ нужен сразу: пароль, логин, промокод         | `change`                |
| Не ругать до первой попытки, а после неё помогать исправлять | `afterFirstSubmit`      |

Как ведёт себя каждая стратегия:

| `strategy`         | Когда проверяет                                                      | Чьи замечания видны                         |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------- |
| `submit`           | только при отправке и по `bundle.validate()`                         | всех проверенных полей                      |
| `blur`             | при каждом уходе из поля, и повторном тоже                           | полей, которые трогали                      |
| `change`           | на каждый ввод, после паузы `debounce`                               | полей, которые трогали или меняли           |
| `afterFirstSubmit` | до первой отправки — как `submit`, после — на каждый ввод (или уход) | после неудачной отправки — всех полей формы |

Живая проверка (`blur`, `change`, фаза после отправки у `afterFirstSubmit`) не отмечает поля
[тронутыми](../reference/glossary.md). Замечание видно, когда поле трогали или меняли
(`shouldShowIssues`). Поэтому пользователь не видит ошибок в полях, до которых ещё не дошёл.

## Пример

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';
import { Button, FormField } from '@reformer/ui-kit';

type Login = { email: string; password: string };

// Правила — константа модуля.
const loginValidation = defineValidation<Login>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function LoginForm() {
  const login = useFormBundle(() =>
    createForm<Login>({
      initial: { email: '', password: '' },
      schema: loginSchema,
      // Тихо до первой отправки, дальше — проверка на ввод с паузой 400 мс.
      validation: { rules: loginValidation, strategy: 'afterFirstSubmit', debounce: 400 },
    })
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await login.submission.submit((values) => api.login(values));
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={login.form.email} />
      <FormField control={login.form.password} />
      <Button type="submit">Войти</Button>
    </form>
  );
}
```

Живую проверку запускает `useFormBundle` в эффекте компонента. На сервере (SSR) эффекты не
выполняются, поэтому сборка там ничего не подписывает.

## Опции

Конфиг `validation` сборки — либо сами правила (`validation: rules`, стратегия `submit`), либо
объект:

| Опция             | По умолчанию | Что делает                                                                      |
| ----------------- | ------------ | ------------------------------------------------------------------------------- |
| `rules`           | —            | правила формы                                                                   |
| `extras`          | —            | правила, которые проверяются только целиком, при отправке; не по шагам          |
| `strategy`        | `'submit'`   | когда проверять                                                                 |
| `debounce`        | `0`          | пауза в мс перед живой проверкой — для `change` и живой фазы `afterFirstSubmit` |
| `liveAfterSubmit` | `'change'`   | чем идёт живая фаза `afterFirstSubmit`: `'change'` или `'blur'`                 |

## Что включает живую фазу `afterFirstSubmit`

Живую фазу включает только **попытка отправки** — `bundle.submission.submit(handler)`. Кнопка
«Проверить» (`bundle.validate()`), проверка шага (`bundle.validateStep(id)`) и «Далее»
(`flow.next()`) показывают замечания, но оставляют форму в тихой фазе.

Кого проверка отмечает тронутым:

| Вызов                                      | Тронутыми становятся            |
| ------------------------------------------ | ------------------------------- |
| отправка с итогом `invalid` или `error`    | вся форма                       |
| отправка с итогом `submitted` или `failed` | поля, которые проверяли правила |
| отправка с итогом `cancelled`              | никто                           |
| `bundle.validate()`                        | поля, которые проверяли правила |
| `bundle.validateStep(id)`, `flow.next()`   | поля шага                       |
| живая проверка                             | никто                           |

## Многошаговая форма

Стратегия — свойство всей формы, а не шага. У многошаговой формы проверок три, и стратегия меняет
только первую:

- **живая проверка** — по стратегии; проверяет все правила, а замечания показывает только у полей,
  которые трогали или меняли. Поэтому поля следующих шагов ошибок не показывают;
- **«Далее»** (`flow.next()`) — правила текущего шага; при замечаниях форма остаётся на шаге;
- **отправка** — все правила: шаги и `extras`.

```typescript
const credit = createForm<Credit>({
  initial,
  schema: creditSchema, // узлы шагов с selector 'loan', 'applicant', 'confirm'
  validation: { extras: crossStepRules, strategy: 'blur' },
  flow: {
    steps: [
      { id: 'loan', rules: loanRules },
      { id: 'applicant', rules: applicantRules },
      { id: 'confirm' }, // шаг без правил
    ],
  },
});
```

`id` шага совпадает с `selector` узла шага в схеме. Подробнее — в [FormWizard](/docs/cdk/form-wizard).

:::tip Дорогие проверки — не в каждом шаге
«Далее» дожидается асинхронных правил шага. Запрос к серверу держите в правилах того шага, где он
нужен, или в `extras` — тогда остальные шаги переключаются быстро.
:::

## Зависимые поля

Правило над двумя полями (`cross`) проверяет снимок формы и само за соседним полем не следит.
«Повторите пароль» перепроверится после правки пароля, если:

- у формы живая стратегия `change` или `blur` — она проверяет все правила;
- или поведение запускает проверку при правке соседа — оператор `revalidateWhen`.

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

const passwordBehavior = defineFormBehavior<PasswordForm>(({ model }) => {
  // Пароль изменился — перепроверить правила, в том числе правило повтора.
  revalidateWhen([model.$.password], () => void validateModel(model, passwordValidation));
});
```

`revalidateWhen` нужен, когда живая проверка всей формы избыточна. Подробнее — в
[Реакциях на изменения](../behaviors/watch.md).

## Форма без сборки

Если форма собрана без `createForm` — например, `createFormFromModel` для формы элемента, — ту же
стратегию даёт хук `useFormValidation` из `@reformer/core/react`:

```tsx
const { submit, validate, isValidating } = useFormValidation({
  model,
  schema: loginValidation,
  strategy: 'afterFirstSubmit',
});

const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  if (await submit()) await api.login(model.get()); // true — блокирующих замечаний нет
};
```

- `submit()` — попытка отправки: при отказе раскрывает всю форму и включает живую фазу
  `afterFirstSubmit`;
- `validate()` — проверка без отправки, для кнопки «Проверить»;
- оба возвращают `true` только при статусе `valid`.

Без React — в тесте или своей оболочке — тот же контроллер создаёт `createFormValidation(model,
rules, { strategy })` из `@reformer/core/validation`. Его `start()` включает живую проверку и
возвращает функцию, которая её выключает.

## Подводные камни

- **Правила — константа модуля.** Устаревшие проверки отменяются по паре «модель + правила»; новая
  функция правил на каждый рендер ломает отмену.
- **Не ставьте `useFormValidation` поверх сборки.** У сборки уже есть свой контроллер — второй
  проверял бы ту же форму параллельно. Стратегию сборке задаёт поле `validation`.
- **`bundle.validate()` не включает живую фазу `afterFirstSubmit`.** Её включает только отправка.
- **Ключей `updateOn` и `debounce` у узла поля нет.** Момент проверки задаёт только стратегия
  формы.
- **Предупреждения не блокируют.** Замечание с `severity: 'warning'` видно, но отправка проходит.

## См. также

- [Обзор валидации](./overview.mdx) — правила, прогон и тексты замечаний.
- [Асинхронная валидация](./async.mdx) — пауза и отмена устаревших запросов.
- [Отправка и сброс](../patterns/submit-and-reset.mdx) — итоги отправки.
- [FormWizard](/docs/cdk/form-wizard) — многошаговая форма поверх потока шагов.
- [Многошаговые формы](/docs/guides/multi-step-forms) — что проверяется при переходе между шагами.
