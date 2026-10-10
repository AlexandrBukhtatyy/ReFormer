---
sidebar_position: 1
---

# Обзор валидации

Валидация в ReFormer — **декларативная**, **headless** и живёт в **отдельном от разметки слое**.
Схема формы (дерево узлов, JSON-документ) **не несёт правил** — правила описываются отдельной
**схемой валидации** (обычной функцией над моделью) и подключаются к сборке формы. Сама проверка —
прогон **по требованию**: на отправке, на шаге потока или по выбранной стратегии живой проверки.
Прогон раскладывает замечания по полям, и UI подсвечивает их автоматически.

## Как это устроено

Схема валидации — обычная функция `({ model, cross }) => void`, обёрнутая в `defineValidation<T>`.
Внутри вызываются свободные операторы из `@reformer/core/validation`; значение поля проверяет
`validate(model.$.<field>, [rules])`. Правила — это чистые **фабрики** (`required()`, `email()`,
`min(18)`, …) из `@reformer/core/validators`, возвращающие функцию `(value) => ValidationIssue | null`.

```typescript
import { createForm } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type ContactForm = { name: string; email: string };

// Валидация — отдельная схема: обычная функция над моделью, обёрнутая в defineValidation.
const contactValidation = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

// Правила подключаются к сборке рядом со схемой разметки.
const contact = createForm<ContactForm>({
  initial: { name: '', email: '' },
  schema: contactSchema,
  validation: contactValidation,
});
```

Операторы из `@reformer/core/validation` (вызываются только внутри схемы, во время прогона):

- `validate(handle, [rules])` — синхронные правила поля;
- `validateAsync(handle, [asyncRules])` — асинхронные правила (правило получает `AbortSignal`);
- `validateWhen(cond, cb)` — условная валидация (см. ниже);
- `cross(handle, check)` — правило над несколькими полями: `check` получает снимок модели; `cross`
  приходит аргументом схемы (`({ model, cross }) => …`);
- `apply(model.$.<группа>, rules)` — схема группы в её области; `apply(...schemas)` — композиция схем
  над той же моделью;
- `applyEach(model.$.<массив>, rowRules)` — правила каждой строки массива под-форм.

:::info Правила — чистые фабрики
`required()`, `min(50000)`, `email()` возвращают функцию-правило и **вызываются со скобками** прямо
в массиве оператора: `validate(model.$.amount, [required(), min(50000)])`. Прогон запускает не поле,
а сборка формы (или раннер).
:::

## Запуск валидации

Валидация выполняется **по требованию** — обычно на отправке или при переходе на следующий шаг. Сборка
формы даёт три точки:

- `bundle.validate()` — проверить всю форму, разнести замечания по нодам, показать их; возвращает
  `ValidationResult`;
- `bundle.submit(handler)` — один прогон всех правил и, если блокирующих замечаний нет, вызов
  `handler(значения)`; возвращает `SubmitResult`;
- `bundle.validateStep(id)` и `bundle.flow?.next()` — правила шага пошаговой формы.

```typescript
const result = await contact.validate();
// result.status: 'valid' | 'invalid' | 'error' | 'cancelled'
// замечания уже разнесены по нодам: form.name.issues, form.email.issues — UI подсветит поля
```

Канонический поток отправки — `bundle.submit`:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const outcome = await contact.submit((values) => api.save(values));

  if (outcome.status === 'submitted') model.reset();
  else if (outcome.status === 'invalid') showHint('Проверьте выделенные поля');
  else if (outcome.status === 'error') showToast('Не удалось проверить форму, повторите попытку');
  else if (outcome.status === 'failed') showToast('Не удалось отправить');
};
```

| `ValidationResult.status` | Что значит                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| `valid`                   | блокирующих замечаний нет (`severity: 'warning'` не блокирует)         |
| `invalid`                 | есть блокирующие замечания                                             |
| `error`                   | async-правило не вернуло результат (сеть, исключение) — см. `failures` |
| `cancelled`               | прогон устарел: для той же пары «модель + правила» запущен следующий   |

:::tip Один движок — разные точки вызова
Под сборкой работает раннер `validateModel(model, rules)` (ответ — `boolean`) и его половины
`runValidation` (собрать результат без нод) и `applyValidationResult` (разнести его по нодам). Ими
пользуются вне сборки: server action, юнит-тест, форма из `createFormFromModel`. Момент живого
прогона выбирается **декларативно** — стратегией `validation: { rules, strategy }` сборки или хуком
`useFormValidation` (`submit` / `blur` / `change` / `afterFirstSubmit`), см.
[Стратегии валидации](/docs/validation/validation-strategies).
:::

## Чтение состояния поля

В компонентах реактивное состояние поля читают через `useFormControl`, а текст замечания — через
`useIssueMessage`:

```tsx
import { useFormControl, useIssueMessage } from '@reformer/core/react';

function NameField() {
  const { value, issues, shouldShowError } = useFormControl(form.name);
  const message = useIssueMessage();
  // issues: ValidationIssue[] — пустой [] когда поле валидно
  // shouldShowError: invalid && (touched || dirty) — показывать замечание только после взаимодействия

  return (
    <div>
      <input value={value} onChange={(e) => form.name.setValue(e.target.value)} />
      {shouldShowError && issues[0] && <span className="error">{message(issues[0])}</span>}
    </div>
  );
}
```

| Поле состояния      | Тип                 | Назначение                                              |
| ------------------- | ------------------- | ------------------------------------------------------- |
| `value`             | `T`                 | текущее значение поля                                   |
| `issues`            | `ValidationIssue[]` | замечания поля; `[]` когда валидно                      |
| `valid` / `invalid` | `boolean`           | нет / есть блокирующие замечания                        |
| `touched` / `dirty` | `boolean`           | взаимодействовал ли пользователь / менялось ли значение |
| `shouldShowError`   | `boolean`           | `invalid && (touched \|\| dirty)` — удобный флаг для UI |
| `pending`           | `boolean`           | идёт асинхронная проверка поля                          |

:::info `@reformer/ui-kit`
Универсальный `FormField` из `@reformer/ui-kit` уже подписан на `useFormControl` — он сам покажет
текст замечания и индикатор `pending`. Свои обёртки нужны, только если вы не используете ui-kit.
:::

## Объект замечания

Каждое замечание — это `ValidationIssue`. Текста в нём нет — только код и параметры:

```typescript
interface ValidationIssue {
  code: string; // встроенный код ('required', 'minLength') или свой ('name.required')
  params?: Record<string, unknown>; // значения для текста: { minLength: 2, actualLength: 1 }
  severity?: 'error' | 'warning'; // 'error' (по умолчанию) блокирует отправку; 'warning' — нет
}
```

```typescript
// Пример содержимого form.name.issues.value:
[]; // — когда валидно
[{ code: 'required' }]; // — required не пройден
[{ code: 'minLength', params: { minLength: 2, actualLength: 1 } }];
[{ code: 'name.required' }]; // — правило со своим кодом: required({ code: 'name.required' })
```

Опции фабрик — `RuleOptions = { code?, params? }`: свой код вместо встроенного и дополнительные
параметры для текста. Опции `message` у правил нет.

## Тексты замечаний

Человекочитаемый текст замечание получает **при показе**, а не при проверке, — поэтому смена языка
переводит уже показанные замечания без повторной валидации. Порядок поиска текста по `code`:

1. **словарь формы** — запись по коду (`defineIssueMessages`): текст конкретного поля;
2. `validation.<code>` из словаря **активной локали**;
3. встроенный английский текст ядра;
4. сам `code` — для своих кодов, которых нет ни в одном словаре.

Встроенные правила переводит локаль (`I18nProvider`), поэтому для них словарь не обязателен. Свой
текст поля — свой код правила и запись в словаре формы:

```tsx
import { defineIssueMessages } from '@reformer/core/i18n';
import { I18nProvider } from '@reformer/core/react';
import { ru } from '@reformer/core/locale/ru';
import { ValidationMessagesProvider } from '@reformer/cdk';

// Правила несут только код…
const creditValidation = defineValidation<CreditForm>(({ model }) => {
  validate(model.$.loanAmount, [required({ code: 'loanAmount.required' }), min(50000)]);
  validate(model.$.purpose, [minLength(10)]);
});

// …а тексты живут в словаре формы. Шаблон — с параметрами правила; можно и функцию.
export const creditMessages = defineIssueMessages({
  'loanAmount.required': 'Укажите сумму кредита',
  min: (params, i18n) => `Не меньше ${i18n.number(Number(params.min))} ₽`,
  minLength: 'Не меньше {minLength} символов',
});

<I18nProvider locale={ru}>
  <ValidationMessagesProvider messages={creditMessages}>
    <CreditFormView />
  </ValidationMessagesProvider>
</I18nProvider>;
```

`FormField` (`@reformer/cdk`, `@reformer/ui-kit`) берёт текст у ближайшего
`ValidationMessagesProvider`; в своём компоненте текст даёт `useIssueMessage(messages?)` из
`@reformer/core/react`, а вне React — `resolveIssueMessage(issue, i18n, messages?)` из
`@reformer/core/i18n`.

:::note Прежний контракт
Удалены: опция `message` у правил, `messageKey`, тип `ValidationError` (→ `ValidationIssue`),
`resolveValidationError` (→ `resolveIssueMessage`), хук `useValidationMessage` (→ `useIssueMessage`),
cdk `createMessageResolver` / `defaultErrorResolver` (→ `ValidationMessagesProvider`,
`useIssueMessageResolver`).
:::

## Условная валидация

Правила, действующие только в части формы, оборачиваются оператором `validateWhen(cond, cb)`. Пока
`cond()` возвращает `false`, правила внутри `cb` не выполняются, а поля, которых они касаются,
**гасятся** — их замечания очищаются.

```typescript
const orderValidation = defineValidation<OrderForm>(({ model }) => {
  validate(model.$.contactMethod, [required()]);
  // Телефон обязателен, только если выбран контакт по телефону:
  validateWhen(
    () => model.contactMethod === 'phone',
    () => validate(model.$.phone, [required()])
  );
});
```

Условие `cond` читает значения напрямую из модели (`model.contactMethod`), а не из ручки
(`model.$.contactMethod`) — прогон вычисляет его в момент проверки. `validateWhen` управляет только
активностью правил; включение/сброс самого поля — это уже [поведение](/docs/behaviors/overview)
(`enableWhen`), отдельный слой.

## Дальше

- [Встроенные валидаторы](/docs/validation/built-in) — полный список фабрик с сигнатурами.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и кросс-полевые проверки.
- [Асинхронная валидация](/docs/validation/async) — проверки через сервер.
- [Стратегии валидации](/docs/validation/validation-strategies) — когда проверять: `submit` / `blur` / `change` / `afterFirstSubmit`, пошаговые формы.
- [Обработка ошибок](/docs/validation/error-handling) — чтение, фильтрация и отображение замечаний.
