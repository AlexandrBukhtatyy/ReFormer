---
sidebar_position: 3
---

# Схема валидации

[Схема валидации](/docs/reference/glossary) — правила формы, описанные отдельно от разметки. Это
функция над моделью, обёрнутая в `defineValidation`: внутри неё операторы указывают сигнал поля и
список правил.

## Когда нужно

Как только у формы появляются правила. Эта страница — про формат схемы: из чего она состоит и как
подключается к форме. Сами правила, тексты замечаний и момент проверки описаны в разделе
«Валидация»:

- [Обзор валидации](/docs/validation/overview) — как устроена проверка, результат прогона, тексты
  замечаний;
- [Встроенные валидаторы](/docs/validation/built-in) — `required`, `email`, `min`, даты и другие;
- [Кастомные валидаторы](/docs/validation/custom) — свои правила и правила над несколькими полями;
- [Асинхронная валидация](/docs/validation/async) — проверка на сервере;
- [Стратегии валидации](/docs/validation/validation-strategies) — когда проверять поле при вводе.

## Минимальный пример

```typescript
import { createForm } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';

type User = { name: string; email: string };

// Схема валидации — константа модуля, отдельно от схемы формы.
const userValidation = defineValidation<User>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});

const user = createForm<User>({ initial: { name: '', email: '' }, validation: userValidation });

const result = await user.validate(); // замечания появятся у нод user.form.name и user.form.email
result.status; // 'valid' | 'invalid' | 'error' | 'cancelled'
```

## Из чего состоит схема

Функция схемы получает область `{ model, cross }`: модель и оператор правила над несколькими
полями. Остальные операторы импортируются из `@reformer/core/validation`.

| Оператор                               | Что делает                                                       | Подробнее                                          |
| -------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| `validate(model.$.x, [rules])`         | синхронные правила поля                                          | [Встроенные валидаторы](/docs/validation/built-in) |
| `validateAsync(model.$.x, [rules])`    | асинхронные правила поля                                         | [Асинхронная валидация](/docs/validation/async)    |
| `cross(model.$.x, check)`              | правило по значениям всей области; замечание садится на поле `x` | [Кастомные валидаторы](/docs/validation/custom)    |
| `validateWhen(condition, () => { … })` | правила внутри действуют, пока условие истинно                   | [Обзор валидации](/docs/validation/overview)       |
| `apply(model.$.group, groupRules)`     | схема группы — в области этой группы                             | [Повторяющиеся группы](./composition.md)           |
| `applyEach(model.$.items, rowRules)`   | схема строки — к каждой строке массива                           | [Повторяющиеся группы](./composition.md)           |
| `apply(rulesA, rulesB)`                | объединить несколько схем над одной моделью                      | [Общие поля и правила](./shared-parts.md)          |

## Правило и замечание

Правило — функция от значения поля. Она возвращает [замечание](/docs/reference/glossary) или
`null`. Текста в замечании нет: только код, параметры и важность. Текст по коду даёт словарь
сообщений.

```typescript
import type { ValidationIssue } from '@reformer/core';
import type { Rule } from '@reformer/core/validation';

// Rule<T> = (value: T) => ValidationIssue | null
const noSpaces: Rule<string> = (value) => (value.includes(' ') ? { code: 'login.spaces' } : null);

// ValidationIssue = { code, params?, severity? }; severity: 'warning' не блокирует отправку.
const weak: ValidationIssue = { code: 'password.weak', severity: 'warning' };
```

Тип правила сверяется с типом поля: `validate(model.$.age, [email()])` не скомпилируется, потому
что `email` проверяет строку.

## Подключение к форме

Схему передают в `createForm` полем `validation` — саму по себе или в объекте с настройками:

```typescript
createForm<User>({
  initial,
  validation: { rules: userValidation, strategy: 'blur', debounce: 300 },
});
```

| Ключ              | Что задаёт                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `rules`           | полный набор правил формы                                                                |
| `extras`          | правила, которые проверяются только целиком, при отправке, — не на шагах                 |
| `strategy`        | когда проверять при вводе: `submit` (по умолчанию), `blur`, `change`, `afterFirstSubmit` |
| `debounce`        | задержка живой проверки, мс                                                              |
| `liveAfterSubmit` | как проверять после первой отправки при `afterFirstSubmit`: `change` или `blur`          |

У многошаговой формы правила шагов задают в потоке — `flow: { steps: [{ id, rules }] }`. Полный
набор для отправки сборка соберёт сама из правил шагов и `extras`. См.
[FormWizard](/docs/cdk/form-wizard).

## Запуск проверки

| Вызов                               | Что делает                                                          |
| ----------------------------------- | ------------------------------------------------------------------- |
| `bundle.validate()`                 | проверить всю форму и показать замечания                            |
| `bundle.validateStep(id)`           | проверить правила одного шага                                       |
| `bundle.submission.submit(handler)` | проверить всё и, если блокирующих замечаний нет, вызвать обработчик |
| `bundle.flow?.next()`               | проверить текущий шаг и перейти к следующему                        |

Без сборки — в тесте или на сервере — схему прогоняет `runValidation(model, rules)`: он только
собирает результат и ноды не трогает. Результат прогона и его статусы разобраны в
[Обзоре валидации](/docs/validation/overview).

## Подводные камни

- **Схема — константа модуля.** Сборка отменяет устаревшие проверки по ссылке на схему. Схема,
  созданная заново при каждой перерисовке, этого не даёт.
- **`cross` берётся из аргумента схемы.** Отдельного импорта `cross` нет. В схеме группы `cross`
  получает значения группы, а не всей формы.
- **`validateWhen` не выключает поле.** Он управляет только проверкой. Выключить или скрыть поле —
  задача [поведения](./behavior-schema.md): `enableWhen`, `hideWhen`.
- **Правил в узлах схемы формы нет.** Узел описывает компонент и пропсы, правила — только здесь.

## См. также

- [Обзор валидации](/docs/validation/overview) — результат прогона, тексты замечаний.
- [Схема формы](./form-schema.md) — разметка без правил.
- [Повторяющиеся группы](./composition.md) — правила группы и строк массива.
- [Общие поля и правила](./shared-parts.md) — наборы правил для многих форм.
