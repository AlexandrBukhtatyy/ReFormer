# Тексты замечаний валидации — коды, словарь формы и резолвер

## Purpose

Замечание валидации текста не несёт. Правило сообщает **что** нарушено (`code`) и **с какими
числами** (`params`), а отображаемую строку по коду собирает резолвер в момент показа:

```typescript
interface ValidationIssue {
  readonly code: string; // встроенный ('required', 'minLength') либо свой ('loanAmount.required')
  readonly params?: Readonly<Record<string, unknown>>; // порог правила, фактическое значение
  readonly severity?: 'error' | 'warning'; // 'warning' показывается, но отправку не блокирует
}
```

Отсюда два следствия:

- смена языка переводит уже показанные замечания — повторная валидация не нужна;
- одно и то же правило получает разный текст у разных полей: правилу дают свой код, а текст кода
  кладут в словарь формы.

Опций `message` / `messageKey` у правил нет, у замечания нет поля `message` — см.
[17-nonexistent-api.md](./17-nonexistent-api.md).

## API

```typescript
// @reformer/core — опции фабрик @reformer/core/validators (второй или последний аргумент)
interface RuleOptions {
  code?: string; // свой код вместо встроенного; принято `<поле>.<правило>`
  params?: Readonly<Record<string, unknown>>; // доп. параметры — поверх параметров правила
}

// @reformer/core/i18n — без React
type IssueMessage =
  | string // шаблон: 'Не меньше {minLength} символов', plural, select
  | ((params: Readonly<Record<string, unknown>>, i18n: I18nHandle) => string);
type IssueMessages = Readonly<Record<string, IssueMessage>>; // код → текст

function defineIssueMessages<const M extends IssueMessages>(messages: M): M; // возвращает аргумент
function resolveIssueMessage(
  issue: ValidationIssue,
  i18n: I18nHandle, // createI18n(locale)
  messages?: IssueMessages // словарь формы
): string;

// @reformer/core/react
function useIssueMessage(messages?: IssueMessages): (issue: ValidationIssue) => string;

// @reformer/cdk — словарь формы для поддерева; FormField читает его сам
function ValidationMessagesProvider(props: {
  messages?: IssueMessages;
  resolver?: (issue: ValidationIssue) => string; // полное переопределение
  children: ReactNode;
}): ReactNode;
function useIssueMessageResolver(): (issue: ValidationIssue) => string;
```

### Порядок поиска текста

| Шаг | Источник                                                   | Когда срабатывает                                   |
| --- | ---------------------------------------------------------- | --------------------------------------------------- |
| 1   | словарь формы (`defineIssueMessages`) — запись по `code`   | у поля свой текст                                   |
| 2   | `validation.<code>` из словаря активной локали             | встроенный код либо свой код в словаре приложения   |
| 3   | `validation.<code>` из встроенной английской таблицы ядра  | встроенный код без провайдера локали                |
| 4   | сам `code`                                                 | свой код, которого нет ни в одном словаре           |

Свой код **не** падает обратно на текст встроенного правила: `required({ code: 'phone.required' })`
без записи `'phone.required'` в словаре покажет строку `phone.required`. Каждый свой код получает
запись в словаре формы (или ключ `validation.<код>` в словаре приложения).

### Встроенные коды и параметры

| Фабрика                         | `code`             | `params`                                   |
| ------------------------------- | ------------------ | ------------------------------------------ |
| `required()`                    | `required`         | —                                          |
| `min(n)` / `max(n)`             | `min` / `max`      | `min` / `max`, `actual`                    |
| `minLength(n)` / `maxLength(n)` | `minLength` / `maxLength`; у массива — `minItems` / `maxItems` | `minLength` / `maxLength`, `actualLength` |
| `email()`                       | `email`            | —                                          |
| `pattern(re)`                   | `pattern`          | `pattern` (исходник регулярки)             |
| `url()`                         | `url`, `url_protocol` | `allowedProtocols` (у `url_protocol`)   |
| `phone()`                       | `phone`            | `format`                                   |
| `isNumber()` / `integer()`      | `isNumber` / `integer` | —                                      |
| `multipleOf(n)`                 | `multipleOf`       | `multipleOf`                               |
| `nonNegative()` / `nonZero()`   | `nonNegative` / `nonZero` | —                                   |
| `isDate()`                      | `date_invalid`     | —                                          |
| `minDate(d)` / `maxDate(d)`     | `date_min` / `date_max` | `minDate` / `maxDate`                 |
| `pastDate()` / `futureDate()`   | `date_future` / `date_past` | — (код называет нарушение)        |
| `minAge(n)` / `maxAge(n)`       | `date_min_age` / `date_max_age` | `minAge` / `maxAge`, `currentAge` |
| `fileType(accept)`              | `fileType`         | `accept`, `fileName`                       |
| `maxFileSize(b)` / `minFileSize(b)` | `maxFileSize` / `minFileSize` | `maxFileSize` / `minFileSize`, `fileName`, `actualSize` |
| `maxFiles(n)` / `minFiles(n)`   | `maxFiles` / `minFiles` | `maxFiles` / `minFiles`, `actualCount` |
| `maxTotalFileSize(b)`           | `maxTotalFileSize` | `maxTotalFileSize`, `actualTotal`          |
| отклонённое async-правило       | `ruleFailed`       | —                                          |

Свой код (`{ code }`) заменяет только код: параметры правила остаются, `params` из опций
накладываются поверх них.

### Шаблон и функция

- Шаблон — тот же формат, что в словарях локали (подмножество ICU): подстановка `{minLength}`,
  `{count, plural, one{…} other{…}}`, `{kind, select, …}`.
- Параметры готовятся до подстановки: `Date` — по языку, массив — перечнем, размеры в байтах
  (`maxFileSize`, `minFileSize`, `actualSize`, `maxTotalFileSize`, `actualTotal`) — строкой с
  единицей. Числа остаются числами (иначе не сработал бы `plural`) и печатаются **без разрядов**.
- Число с разрядами, валюта, вычисление — функция `(params, i18n) => string`; `i18n` — ручка
  активной локали (`i18n.number`, `i18n.date`, `i18n.t`).
- Битый шаблон в словаре формы текст поля не прячет: резолвер идёт дальше по порядку поиска.

## Examples

### Свой код у правила и словарь формы

```typescript
// validation/loan.ts — правила несут коды
import { defineValidation, validate } from '@reformer/core/validation';
import { max, min, minLength, required } from '@reformer/core/validators';

export const loanRules = defineValidation<CreditForm>(({ model }) => {
  validate(model.$.loanAmount, [
    required({ code: 'loanAmount.required' }),
    min(50_000, { code: 'loanAmount.min' }),
  ]);
  validate(model.$.loanPurpose, [minLength(10, { code: 'loanPurpose.minLength' })]);
  validate(model.$.carYear, [max(new Date().getFullYear(), { code: 'carYear.max' })]);
  validate(model.$.email, [required()]); // встроенный код: текст даёт локаль
});
```

```typescript
// validation/messages.ts — тексты по кодам; константа модуля (стабильная ссылка)
import { defineIssueMessages } from '@reformer/core/i18n';

export const creditMessages = defineIssueMessages({
  'loanAmount.required': 'Укажите сумму кредита',
  'loanAmount.min': (params, i18n) => `Минимум ${i18n.number(Number(params.min))} ₽`,
  'loanPurpose.minLength': 'Минимум {minLength} символов',
  'carYear.max': 'Не позднее {max}',
  // встроенный код тоже можно переопределить — для всей формы
  required: 'Заполните поле',
});
```

### Подключение словаря — провайдер cdk

`FormField` из `@reformer/cdk` и `@reformer/ui-kit` резолвит замечания сам; словарь формы
подключается один раз на корне формы:

```tsx
import { ValidationMessagesProvider } from '@reformer/cdk';
import { creditMessages } from './validation/messages';

<ValidationMessagesProvider messages={creditMessages}>
  <FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />
</ValidationMessagesProvider>;
```

- Вложенные провайдеры с `messages` накладываются друг на друга: ближний важнее, код, которого в
  ближнем словаре нет, ищется во внешнем, затем в локали.
- `resolver` заменяет резолвер поддерева целиком: локаль и внешние провайдеры для его замечаний не
  участвуют (кроме `messages` этого же провайдера).
- Язык задаёт `I18nProvider` из `@reformer/core/react`; без него тексты английские — см.
  [34-i18n.md](./34-i18n.md).

### Свой компонент замечаний — `useIssueMessage`

```tsx
import type { FormControl } from '@reformer/core';
import { useFormControl, useIssueMessage } from '@reformer/core/react';
import { creditMessages } from './validation/messages';

function FieldIssues({ control }: { control: FormControl<string> }) {
  const message = useIssueMessage(creditMessages); // словарь формы → локаль → английский → код
  // shouldShowIssues — и у поля с одним предупреждением; shouldShowError — только у невалидного
  const { issues, shouldShowIssues } = useFormControl(control);
  if (!shouldShowIssues) return null;
  return (
    <ul role="alert">
      {issues.map((issue) => (
        <li key={issue.code}>{message(issue)}</li>
      ))}
    </ul>
  );
}
```

Внутри дерева с `ValidationMessagesProvider` — `useIssueMessageResolver()` из `@reformer/cdk`: он
учитывает словари всех провайдеров выше.

### Вне React

```typescript
import { createI18n, resolveIssueMessage } from '@reformer/core/i18n';
import { ru } from '@reformer/core/locale/ru';

const i18n = createI18n(ru);
resolveIssueMessage({ code: 'minLength', params: { minLength: 8 } }, i18n); // 'Не меньше 8 символов'
resolveIssueMessage({ code: 'loanAmount.required' }, i18n, creditMessages); // 'Укажите сумму кредита'
```

### Замечание из своего правила и с сервера

Своё правило, `cross` и ответ сервера возвращают тот же `ValidationIssue` — код и параметры; текст
кода — в словаре формы:

```typescript
const initialPaymentTooHigh = (loan: CreditForm): ValidationIssue | null =>
  loan.initialPayment !== null &&
  loan.propertyValue !== null &&
  loan.initialPayment > loan.propertyValue
    ? { code: 'initialPaymentTooHigh', params: { max: loan.propertyValue } }
    : null;

// ответ сервера — в ноду поля
form.email.setIssues([{ code: 'email.taken' }]);
```

### Несколько языков в словаре формы

Запись словаря — функция, получающая ручку локали, поэтому текст поля можно взять из словаря
приложения и переключать вместе с языком:

```typescript
export const creditMessages = defineIssueMessages({
  'loanAmount.required': (_params, i18n) => i18n.t('credit.loanAmount.required'),
});
```

Другой путь — ключ `validation.loanAmount.required` в словаре приложения (шаг 2 порядка поиска).

## Anti-patterns

```typescript
// ❌ Текст в правиле: у RuleOptions нет message — не скомпилируется
required({ message: 'Укажите телефон' });

// ✅ Свой код в правиле, текст — в словаре формы
required({ code: 'phone.required' });
const messages = defineIssueMessages({ 'phone.required': 'Укажите телефон' });
```

```tsx
// ❌ Словарь, собранный в рендере: новая ссылка — резолвер пересоздаётся на каждый рендер
const message = useIssueMessage(defineIssueMessages({ 'phone.required': 'Укажите телефон' }));

// ✅ Словарь — константа модуля
const messages = defineIssueMessages({ 'phone.required': 'Укажите телефон' });
function PhoneIssues() {
  const message = useIssueMessage(messages);
  /* … */
}
```

```tsx
// ❌ Показ замечания как строки: текста у замечания нет
<span>{issues[0].message}</span>

// ✅ Текст — через резолвер
<span>{message(issues[0])}</span>
```

```typescript
// ❌ Свой код без записи в словаре — на экране сам код «loanAmount.required»
validate(model.$.loanAmount, [required({ code: 'loanAmount.required' })]);

// ✅ Каждому своему коду — запись в словаре формы (или validation.<код> в локали приложения)
defineIssueMessages({ 'loanAmount.required': 'Укажите сумму кредита' });
```

```typescript
// ❌ Число с разрядами шаблоном — шаблон печатает 50000 без пробелов
'loanAmount.min': 'Минимум {min} ₽',

// ✅ Функция форматирует число сама
'loanAmount.min': (params, i18n) => `Минимум ${i18n.number(Number(params.min))} ₽`,
```

## See also

- [34-i18n.md](./34-i18n.md) — локаль, загрузка словарей, `I18nProvider`
- [03-api-signatures.md](./03-api-signatures.md) — фабрики правил и `RuleOptions`
- [38-form-flow.md](./38-form-flow.md) — `bundle.submission.submit` и проверка шагов
- [17-nonexistent-api.md](./17-nonexistent-api.md) — удалённые `message`, `messageKey`, `ValidationError`
