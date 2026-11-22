---
sidebar_position: 2
---

# Встроенные валидаторы

Встроенные [правила](../reference/glossary.md) — фабрики из `@reformer/core/validators`. Фабрику
вызывают со скобками прямо в массиве оператора `validate`:
`validate(model.$.email, [required(), email()])`. Каждая возвращает правило `Rule<T>` — функцию,
которая проверяет одно значение и отдаёт замечание или `null`.

```typescript
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

type ContactForm = { name: string; email: string };

const contactValidation = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});
```

Фрагменты ниже показывают по одной фабрике: каждый вызов `validate(...)` стоит внутри такой
`defineValidation`. Как правила попадают в форму и когда проверяются — в
[Обзоре валидации](./overview.mdx).

Общие правила:

- **Пустое значение — не ошибка.** `''`, `null` и `undefined` все фабрики, кроме `required()`,
  пропускают. Правила длины, чисел и дат пропускают и значения не своего типа. Обязательность
  проверяет только `required()`.
- **Опции `{ code, params }` (`RuleOptions`).** Текста у правила нет. Свой `code` заменяет встроенный:
  `min(18, { code: 'age.min' })` даст замечание `{ code: 'age.min', params: { min: 18, actual } }`.
  `params` добавляют значения для текста. Текст ищется по коду — см.
  [Тексты замечаний](./overview.mdx#тексты-замечаний).

## Общие

### `required(options?)`

Поле должно быть заполнено. Пустыми считаются `null`, `undefined`, `''`, `[]` (пустой массив),
`NaN`, а для `boolean` — любое значение, кроме `true` (обязательный чекбокс).

```typescript
import { required } from '@reformer/core/validators';

validate(model.$.email, [required()]);
// Замечание: { code: 'required' }
validate(model.$.agreeToTerms, [required({ code: 'agreeToTerms.required' })]);
// Замечание: { code: 'agreeToTerms.required' } — свой код поля
```

### `pattern(regex, options?)`

Значение должно соответствовать регулярному выражению.

```typescript
import { pattern } from '@reformer/core/validators';

validate(model.$.code, [pattern(/^[A-Z]+$/)]);
// Замечание: { code: 'pattern', params: { pattern: '^[A-Z]+$' } }
```

### `email(options?)`

Формат email (упрощённый regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`).

```typescript
import { required, email } from '@reformer/core/validators';

validate(model.$.email, [required(), email()]);
// Замечание: { code: 'email' }
```

### `url(options?)`

Адрес сайта. Подходят `localhost`, IP-адрес, порт и кириллический домен; пробелы и логин в адресе
(`user@host`) — нет. Адрес без протокола (`example.com`) по умолчанию верен. Опции:

- `requireProtocol: true` — протокол обязателен;
- `allowedProtocols` — допустимые протоколы, по умолчанию `http` и `https`. Другой протокол даёт
  `url_protocol`. Если список задан явно, адрес без протокола тоже даёт `url_protocol`.

```typescript
import { url } from '@reformer/core/validators';

validate(model.$.website, [url()]);
validate(model.$.homepage, [url({ requireProtocol: true, allowedProtocols: ['https'] })]);
// Замечания: { code: 'url' } либо { code: 'url_protocol', params: { allowedProtocols } }
```

### `phone(options?)`

Номер телефона. Формат задаётся опцией `format` типа `PhoneFormat`:

```typescript
type PhoneFormat = 'international' | 'ru' | 'us' | 'any'; // по умолчанию 'any'
```

```typescript
import { required, phone } from '@reformer/core/validators';

validate(model.$.phone, [required(), phone({ format: 'ru' })]);
// Замечание: { code: 'phone', params: { format: 'ru' } }
```

## Длина строки

Работают со строкой или массивом (проверяется `value.length`).

### `minLength(n, options?)` · `maxLength(n, options?)`

```typescript
import { minLength, maxLength } from '@reformer/core/validators';

validate(model.$.name, [minLength(2)]);
validate(model.$.bio, [maxLength(500)]);
// minLength → { code: 'minLength', params: { minLength: 2, actualLength: 1 } }
// maxLength → { code: 'maxLength', params: { maxLength: 500, actualLength: 501 } }

// У массива (мультивыбор, список строк) длина — в элементах, и код свой:
validate(model.$.skills, [maxLength(3)]);
// maxLength → { code: 'maxItems', params: { maxLength: 3, actualLength: 4 } } — «Не больше 3 элементов»
```

:::tip Непустой массив
Требование «хотя бы один элемент» — это `minLength(1)` на поле-массиве:
`validate(model.$.tags, [minLength(1, { code: 'tags.minLength' })])`.
:::

## Числа

Все числовые фабрики пропускают `null`/`undefined`; кроме `isNumber`, они также пропускают не-числа
и `NaN` — строгую проверку типа даёт `isNumber()`.

### `min(n, options?)` · `max(n, options?)`

Границы значения (включительно).

```typescript
import { min, max } from '@reformer/core/validators';

validate(model.$.age, [min(18)]);
validate(model.$.discount, [max(50)]);
// min → { code: 'min', params: { min: 18, actual: 16 } }
// max → { code: 'max', params: { max: 50, actual: 75 } }
```

### `isNumber(options?)`

Значение — конечное число (не строка, не `NaN`).

```typescript
import { required, isNumber } from '@reformer/core/validators';

validate(model.$.amount, [required(), isNumber()]);
// Замечание: { code: 'isNumber' }
```

### `integer(options?)`

Число должно быть целым.

```typescript
import { integer } from '@reformer/core/validators';

validate(model.$.count, [integer()]);
// Замечание: { code: 'integer' }
```

### `multipleOf(n, options?)`

Число кратно делителю. Сравнение идёт с допуском, поэтому дробный шаг (`0.1`, `0.01`) работает
без ошибок округления. Делитель `0` или не конечное число — ошибка `RangeError` ещё при создании
правила.

```typescript
import { multipleOf } from '@reformer/core/validators';

validate(model.$.rating, [multipleOf(0.5)]);
// Замечание: { code: 'multipleOf', params: { multipleOf: 0.5 } }
```

### `nonNegative(options?)` · `nonZero(options?)`

`nonNegative` — число `≥ 0`; `nonZero` — число не равно нулю.

```typescript
import { nonNegative, nonZero } from '@reformer/core/validators';

validate(model.$.balance, [nonNegative()]);
validate(model.$.divisor, [nonZero()]);
// nonNegative → { code: 'nonNegative' }
// nonZero     → { code: 'nonZero' }
```

:::info Числовое поле — набор фабрик
Каждая числовая фабрика проверяет одно условие. Нужный набор складывают в одном `validate(...)`:

```typescript
import { isNumber, integer, min, max } from '@reformer/core/validators';

validate(model.$.percent, [isNumber(), integer(), min(0), max(100)]);
```

:::

## Даты

Принимают `Date` или строку строго в формате `YYYY-MM-DD` (`2024-03-07`). Другие строки — в том
числе дата со временем (`2024-03-07T10:00`) или `07.03.2024` — датой не считаются: `isDate()` даёт на
них `date_invalid`, а остальные правила дат такую строку пропускают. Сравнение — по датам без
времени. Пустые значения пропускаются; чтобы поле было обязательным и с верным форматом, ставьте
`required()` и `isDate()`.

### `isDate(options?)`

Значение — существующая дата в верном формате. Несуществующая дата (`2023-02-29`, `2024-13-01`)
тоже даёт `date_invalid`.

```typescript
import { required, isDate } from '@reformer/core/validators';

validate(model.$.eventDate, [required(), isDate()]);
// Замечание: { code: 'date_invalid' }
```

### `minDate(date, options?)` · `maxDate(date, options?)`

Границы даты (включительно).

```typescript
import { minDate, maxDate } from '@reformer/core/validators';

validate(model.$.startDate, [minDate(new Date())]);
validate(model.$.birthDate, [maxDate(new Date())]);
// minDate → { code: 'date_min', params: { minDate } }
// maxDate → { code: 'date_max', params: { maxDate } }
```

### `pastDate(options?)` · `futureDate(options?)`

`pastDate` — дата не в будущем; `futureDate` — дата не в прошлом (относительно сегодняшнего дня).

```typescript
import { pastDate, futureDate } from '@reformer/core/validators';

validate(model.$.birthDate, [pastDate()]);
validate(model.$.appointment, [futureDate()]);
// pastDate   → { code: 'date_future' } (дата оказалась в будущем)
// futureDate → { code: 'date_past' }   (дата оказалась в прошлом)
```

### `minAge(years, options?)` · `maxAge(years, options?)`

Возраст по дате рождения (в полных годах). Родившийся 29 февраля в невисокосный год взрослеет
28 февраля.

```typescript
import { required, minAge, maxAge } from '@reformer/core/validators';

validate(model.$.birthDate, [required(), minAge(18), maxAge(100)]);
// minAge → { code: 'date_min_age', params: { minAge: 18, currentAge } }
//          дата рождения в будущем → { code: 'date_future', params: { minAge: 18 } }
// maxAge → { code: 'date_max_age', params: { maxAge: 100, currentAge } }
//          будущую дату не оценивает — замечание о ней даёт minAge
```

## Файлы

Работают с одиночным файлом или массивом (`File` либо файлоподобный дескриптор с `name` / `size` /
`type`). Пустые значения пропускаются — обязательность проверяет `required()`. Размеры — в байтах;
в тексте замечания они выводятся строкой с единицей («5 МБ»).

### `maxFileSize(bytes, options?)` · `minFileSize(bytes, options?)`

Размер **каждого** файла; в замечание попадает первый нарушивший.

```typescript
import { maxFileSize } from '@reformer/core/validators';

validate(model.$.documents, [maxFileSize(5 * 1024 * 1024)]);
// Замечание: { code: 'maxFileSize', params: { maxFileSize, fileName, actualSize } }
```

### `maxTotalFileSize(bytes, options?)`

Суммарный размер всех файлов.

```typescript
import { maxTotalFileSize } from '@reformer/core/validators';

validate(model.$.documents, [maxTotalFileSize(20 * 1024 * 1024)]);
// Замечание: { code: 'maxTotalFileSize', params: { maxTotalFileSize, actualTotal } }
```

### `fileType(accept, options?)`

Тип файла по строке в синтаксисе атрибута `<input type="file" accept>`: расширения (`.pdf`), MIME
(`image/png`), категории (`image/*`), список через запятую. Нативный `accept` — только подсказка
диалогу выбора, на drag-and-drop он не действует; правило проверяет всё.

```typescript
import { fileType } from '@reformer/core/validators';

validate(model.$.documents, [fileType('image/*,.pdf')]);
// Замечание: { code: 'fileType', params: { accept, fileName } }
```

### `minFiles(n, options?)` · `maxFiles(n, options?)`

Количество файлов.

```typescript
import { required, minFiles, maxFiles } from '@reformer/core/validators';

validate(model.$.documents, [required(), minFiles(1), maxFiles(5)]);
// minFiles → { code: 'minFiles', params: { minFiles: 1, actualCount } }
// maxFiles → { code: 'maxFiles', params: { maxFiles: 5, actualCount } }
```

## Комбинирование

К одному полю можно применить несколько правил в одном массиве `validate(...)` — выполняются все,
замечания собираются в массив. Если два правила одного вида проверяют разное, дайте им свои коды —
тогда и тексты будут разными:

```typescript
import { required, minLength, pattern } from '@reformer/core/validators';

validate(model.$.password, [
  required(),
  minLength(8),
  pattern(/[A-Z]/, { code: 'password.uppercase' }),
  pattern(/[0-9]/, { code: 'password.digit' }),
]);
```

## Справочник

| Категория | Фабрика                         | Код ошибки                          | `params`                                |
| --------- | ------------------------------- | ----------------------------------- | --------------------------------------- |
| Общие     | `required()`                    | `required`                          | —                                       |
| Общие     | `pattern(regex)`                | `pattern`                           | `{ pattern }`                           |
| Общие     | `email()`                       | `email`                             | —                                       |
| Общие     | `url()`                         | `url` / `url_protocol`              | `{ allowedProtocols }`                  |
| Общие     | `phone()`                       | `phone`                             | `{ format }`                            |
| Длина     | `minLength(n)`                  | `minLength`; у массива — `minItems` | `{ minLength, actualLength }`           |
| Длина     | `maxLength(n)`                  | `maxLength`; у массива — `maxItems` | `{ maxLength, actualLength }`           |
| Числа     | `min(n)`                        | `min`                               | `{ min, actual }`                       |
| Числа     | `max(n)`                        | `max`                               | `{ max, actual }`                       |
| Числа     | `isNumber()`                    | `isNumber`                          | —                                       |
| Числа     | `integer()`                     | `integer`                           | —                                       |
| Числа     | `multipleOf(n)`                 | `multipleOf`                        | `{ multipleOf }`                        |
| Числа     | `nonNegative()`                 | `nonNegative`                       | —                                       |
| Числа     | `nonZero()`                     | `nonZero`                           | —                                       |
| Даты      | `isDate()`                      | `date_invalid`                      | —                                       |
| Даты      | `minDate(d)`                    | `date_min`                          | `{ minDate }`                           |
| Даты      | `maxDate(d)`                    | `date_max`                          | `{ maxDate }`                           |
| Даты      | `pastDate()`                    | `date_future`                       | —                                       |
| Даты      | `futureDate()`                  | `date_past`                         | —                                       |
| Даты      | `minAge(n)`                     | `date_min_age`                      | `{ minAge, currentAge }`                |
| Даты      | `minAge(n)`, рождение в будущем | `date_future`                       | `{ minAge }`                            |
| Даты      | `maxAge(n)`                     | `date_max_age`                      | `{ maxAge, currentAge }`                |
| Файлы     | `maxFileSize(b)`                | `maxFileSize`                       | `{ maxFileSize, fileName, actualSize }` |
| Файлы     | `minFileSize(b)`                | `minFileSize`                       | `{ minFileSize, fileName, actualSize }` |
| Файлы     | `maxTotalFileSize(b)`           | `maxTotalFileSize`                  | `{ maxTotalFileSize, actualTotal }`     |
| Файлы     | `fileType(accept)`              | `fileType`                          | `{ accept, fileName }`                  |
| Файлы     | `minFiles(n)`                   | `minFiles`                          | `{ minFiles, actualCount }`             |
| Файлы     | `maxFiles(n)`                   | `maxFiles`                          | `{ maxFiles, actualCount }`             |

## См. также

- [Кастомные валидаторы](./custom.md) — свои правила и правила над несколькими полями.
- [Асинхронная валидация](./async.mdx) — проверка через сервер.
- [Обработка ошибок](./error-handling.md) — чтение и показ замечаний.
