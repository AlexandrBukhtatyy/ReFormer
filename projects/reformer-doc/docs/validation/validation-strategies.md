---
sidebar_position: 5
---

# Стратегии валидации

Как и **когда** запускать проверки: момент запуска на уровне поля (`updateOn`), гейт перехода между
шагами (`validateModelSync`) и полная проверка на submit (`validateFormModel`).

## Момент запуска поля — `updateOn`

Опция `updateOn` узла схемы задаёт, когда поле проверяет себя реактивно:
`'change' | 'blur' | 'submit'` (по умолчанию `'blur'`).

```typescript
const schema = {
  // Мгновенная обратная связь — проверка на каждый ввод
  username: {
    value: model.$.username,
    component: Input,
    validators: [required(), minLength(3)],
    updateOn: 'change',
  },
  // По уходу фокуса (по умолчанию) — менее навязчиво
  email: {
    value: model.$.email,
    component: Input,
    validators: [required(), email()],
    updateOn: 'blur',
  },
  // Только по submit — для длинных текстов и необязательных полей
  feedback: {
    value: model.$.feedback,
    component: Textarea,
    validators: [minLength(10)],
    updateOn: 'submit',
  },
};
```

| `updateOn`              | Когда проверяет             | Подходит для                          |
| ----------------------- | --------------------------- | ------------------------------------- |
| `'change'`              | на каждое изменение         | простые поля, real-time-подсказки     |
| `'blur'` (по умолчанию) | при потере фокуса           | большинство полей                     |
| `'submit'`              | только по запуску валидации | большие textarea, необязательные поля |

`debounce` (мс) откладывает запуск (полезно для полей с async-проверкой) — см.
[Асинхронную валидацию](/docs/validation/async#debounce).

## Пошаговые формы — `validateModelSync`

`validateModelSync(model, schema)` прогоняет **только синхронные** валидаторы и не делает сетевых
запросов. Это идеальный быстрый gate «можно ли перейти на следующий шаг мастера»: обычно шаг
проверяют по под-схеме текущего шага.

```typescript
import { validateModelSync } from '@reformer/core';

function canGoNext(stepSchema: FormSchemaNode): boolean {
  const { valid } = validateModelSync(model, stepSchema);
  return valid;
}

const goNext = () => {
  form.touchAll(); // раскрыть ошибки текущего шага
  if (canGoNext(step1Schema)) setStep((s) => s + 1);
};
```

:::info sync vs full
`validateModelSync` пропускает `asyncValidators` — он синхронный и возвращает результат сразу.
Полную проверку (с сетью) оставляют на финальный submit.
:::

## Полная проверка на submit

На отправке запускают полную валидацию — `validateFormModel(model, schema)` (в React, роутит ошибки
в ноды) или `validateModel(model, schema)` (headless: server action, тест). Обе прогоняют sync + async.

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.touchAll();

  const { valid } = await validateFormModel(model, schema);
  if (valid) await api.save(model.get());
};
```

```typescript
// Вне React — только данные, без нод:
async function process(raw: Partial<MyForm>) {
  const model = createModel<MyForm>(initialValues);
  model.patch(raw);
  const { valid, errors } = await validateModel(model, schema);
  return valid ? { ok: true, data: model.get() } : { ok: false, errors };
}
```

## Условная валидация

Правила, действующие только в части формы, включаются узлом-веткой `{ when, children }`. Когда `when`
ложно, поддерево пропускается, а ошибки его полей очищаются — не нужно «прятать» лишние ошибки в UI.

```typescript
import { validateFormModel } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';

const schema = {
  accountType: { value: model.$.accountType, component: Select, validators: [required()] },
  // Поля бизнес-аккаунта проверяются, только когда выбран business
  businessBranch: {
    when: (_scope, root) => root.accountType === 'business',
    children: [
      { value: model.$.businessName, component: Input, validators: [required()] },
      {
        value: model.$.ein,
        component: Input,
        validators: [required(), pattern(/^\d{2}-\d{7}$/, { message: 'Некорректный EIN' })],
      },
    ],
  },
};

const { valid } = await validateFormModel(model, schema);
```

## Зависимые поля

Кросс-полевое правило вешается на поле, несущее ошибку, и читает соседей через `root`. Чтобы правило
**перепроверялось** при изменении зависимости, свяжите поля через `revalidateWhen` в behavior:

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, minLength } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type PasswordForm = { password: string; confirmPassword: string };

const model = createModel<PasswordForm>({ password: '', confirmPassword: '' });

const passwordsMatch: ModelValidator<string, unknown, PasswordForm> = (value, _scope, root) =>
  value && root.password && value !== root.password
    ? { code: 'passwordMismatch', message: 'Пароли не совпадают' }
    : null;

const schema = {
  password: { value: model.$.password, component: Input, validators: [required(), minLength(8)] },
  confirmPassword: {
    value: model.$.confirmPassword,
    component: Input,
    validators: [required(), passwordsMatch],
  },
};

// confirmPassword перепроверяется, когда меняется password
const behavior = defineFormBehavior<PasswordForm>(({ model }) => {
  revalidateWhen([model.$.password], () => void validateFormModel(model, schema));
});

const form = createForm({ model, schema, behavior });
```

## Валидация массива

Секция массива описывается как `{ componentProps: { control: model.<array>, itemComponent } }` —
`validateFormModel` проходит её по каждому элементу. Правило на **весь массив** (длина, уникальность)
пишется как `ModelValidator`, читающий массив через `root`, и вешается на **скалярное поле-носитель**
(реальный сигнал), а не на сам массив: `model.$.<array>` — это дерево сигналов, а не leaf-сигнал,
поэтому валидатор на нём молча не сработает.

```typescript
import {
  createModel,
  validateFormModel,
  type ModelValidator,
  type FormModel,
} from '@reformer/core';
import { required } from '@reformer/core/validators';

type TagForm = { listTitle: string; tags: { label: string }[] };

const model = createModel<TagForm>({ listTitle: '', tags: [{ label: '' }] });

const tagItem = (item: FormModel<{ label: string }>) => ({
  label: { value: item.$.label, validators: [required()] },
});

// Правило на весь массив — читает элементы через root, висит на скалярном поле-носителе
const uniqueTags: ModelValidator<string, unknown, TagForm> = (_v, _scope, root) => {
  const labels = root.tags.map((t) => t.label);
  return labels.length !== new Set(labels).size
    ? { code: 'notUnique', message: 'Метки должны быть уникальны' }
    : null;
};

const schema = {
  // носитель правила уровня массива — обычное скалярное поле (реальный сигнал)
  listTitle: { value: model.$.listTitle, validators: [required(), uniqueTags] },
  // сама секция массива — для per-item валидации элементов
  tags: { componentProps: { control: model.tags, itemComponent: tagItem } },
};

const { valid } = await validateFormModel(model, schema);
```

## Хорошие практики

- **Несколько узких валидаторов вместо одного «общего».** `[required(), minLength(8), strongPassword]`
  дают конкретные ошибки, которые проще показать и локализовать.
- **Синхронное — отдельно от асинхронного.** Sync-фабрики в `validators`, серверные проверки в
  `asyncValidators` — быстрая обратная связь плюс меньше запросов.
- **Debounce для дорогих проверок.** `debounce: 500` на поле с `asyncValidators`.
- **Условная валидация вместо «спрятать ошибку».** Узел `{ when, children }` не проверяет выключенную
  ветку — это дешевле, чем валидировать всё и прятать лишнее в UI.
- **Именуйте вынесенные правила по смыслу.** Разросшийся кросс-полевой валидатор или ветку выносите в
  именованную константу (`initialPaymentVsPropertyValue`, `businessBranch`), типизируя её
  `ModelValidator` / `FormSchemaNode` — схема остаётся плоской и читается как оглавление.

## Дальше

- [Асинхронная валидация](/docs/validation/async) — серверные проверки, debounce, отмена.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и кросс-полевые проверки.
- [Обработка ошибок](/docs/validation/error-handling) — чтение, фильтрация и отображение ошибок.
