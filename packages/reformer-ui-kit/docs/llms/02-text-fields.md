# Text fields

Текстовые поля ввода: `Input`, `InputNumber`, `InputSuggest`, `InputMask`, `InputPassword`,
`Textarea`. В форме каждое кладётся в `component` поля как есть — значение модели, `onChange`
и `onBlur` подключает обёртка поля (`FormField.Control` / рендерер). Диалекты разные:

| Компонент       | Собственный контракт                                     | Как связывается с формой                               |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `Input`         | нативный `<input>`: `value`, `onChange(event)`           | статика `nativeInputAdapter`: `e.target.value \|\| null` |
| `Textarea`      | нативный `<textarea>`: `value`, `onChange(event)`        | статика `nativeInputAdapter`                           |
| `InputNumber`   | `value: number \| null`, `onChange(number \| null)`      | seam как есть (уже value-based)                        |
| `InputSuggest`  | `value: string \| null`, `onChange(string)`              | статика `textValueAdapter`: пустой текст → `null`      |
| `InputMask`     | `value: string \| null`, `onChange(string \| null)`      | seam как есть                                          |
| `InputPassword` | `value: string \| null`, `onChange(string \| null)`      | seam как есть                                          |

Во всех случаях в модель уходит значение, а не событие: пустая строка → `null`, `onBlur()`
помечает поле `touched`. Формальный `FieldAdapter` в `RendererSettings.resolveFieldAdapter`
для них не нужен — он нужен только чужим компонентам без статики `reformerAdapter`.

> **Вне формы** (standalone) `Input` и `Textarea` — обычные нативные контролы: их `onChange`
> получает событие. Value-based `onChange(value)` у них появляется только внутри обёртки поля.

## Components

| Name            | Purpose                                                                                     | When to use                           |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| `Input`         | Однострочное поле, `type='text'/'email'/'tel'/'url'/'date'`.                                | По умолчанию для строк.               |
| `InputNumber`   | Числовое поле: `number \| null`, буфер промежуточного ввода («1.», «-»).                    | Суммы, сроки, возраст.                |
| `InputSuggest`  | Свободный ввод с подсказками (`suggestions`).                                               | Город, должность, компания.           |
| `InputMask`     | Поле + строковая маска-подсказка (`'9'` → цифра).                                           | Телефоны, ИНН, даты.                  |
| `InputPassword` | Поле пароля с переключателем «глаз».                                                        | Регистрация, логин, смена пароля.     |
| `Textarea`      | Многострочное поле с `rows`/`maxLength`.                                                    | Комментарии, адрес, длинные описания. |

## Подсказка-иконка (i) — `tooltip`

Все поля (как и любое поле кита) принимают `tooltip: string` — иконку (i) с тултипом внутри
поля, у правого края. Если справа уже есть родной элемент контрола, иконка встаёт левее него:

| Поле            | Где иконка                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------- |
| `Input`         | У правого края. У `type="date"` нативный индикатор календаря — левее (i).                    |
| `InputNumber`   | У правого края; нативный спиннер — левее (i).                                                |
| `InputMask`     | У правого края.                                                                              |
| `InputPassword` | Левее «глаза»; пока глаза нет (пустое значение / `showToggle={false}`) — у правого края.     |
| `Textarea`      | В правом верхнем углу, на уровне первой строки.                                              |

```tsx
{
  value: model.$.inn,
  component: Input,
  componentProps: { label: 'ИНН', tooltip: '10 цифр для юрлица, 12 — для ИП' },
}
```

Иконка у ПОДПИСИ поля — отдельный проп `labelTooltip`, его рисует `FormField`
(см. [05-form-field-integration.md](05-form-field-integration.md)). Правая зона резервируется
автоматически — текст под иконку не заезжает.

## Input

### API

```typescript
interface InputProps extends React.ComponentProps<'input'> {
  tooltip?: string; // иконка (i) у правого края
}
```

| Prop          | Тип                | Default  | Описание                                                                                                                           |
| ------------- | ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `value`       | `string`           | —        | Текущее значение. В форме `null`/`undefined` → пустое поле (адаптер).                                                              |
| `onChange`    | `(e) => void`      | —        | Нативное событие. В форме обёртка поля переводит его в значение: `e.target.value \|\| null`.                                       |
| `type`        | `string`           | `'text'` | HTML `type`. Для чисел — не `'number'`, а компонент `InputNumber`.                                                                 |
| `placeholder` | `string`           | —        | Подсказка.                                                                                                                         |
| `disabled`    | `boolean`          | `false`  | Блокирует ввод. **Seam-проп:** внутри формы приходит из состояния узла (`control.disable()`), а не из `componentProps` — см. ниже. |

> **`disabled` внутри формы задаётся не пропом.** `value`/`onChange`/`onBlur`/`disabled` подставляет
> обёртка поля (`FormField`, renderer-react, renderer-json): `FormFieldControl` ставит `disabled` из
> состояния узла ПОСЛЕ спреда `componentProps`, поэтому `componentProps.disabled` затирается и не
> работает. Props-схемы form-компонентов его намеренно не объявляют — в JSON-DSL он вернёт
> `has unknown property "disabled"`. Управляйте через `control.disable()` / `control.enable()`.

### Common Patterns

Email-поле формы (M1: `createModel` → layout-схема с листом
`{ value: model.$.email, component }` → `createForm({ model, schema })`; правила — в
отдельной `defineValidationSchema`, запуск `validateModel`):

```tsx
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { Input, FormField } from '@reformer/ui-kit';

const model = createModel<{ email: string }>({ email: '' });
const schema = {
  children: [
    {
      value: model.$.email,
      component: Input,
      componentProps: { type: 'email', label: 'Email', testId: 'email' },
    },
  ],
};
const validation = defineValidationSchema<{ email: string }>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});
const form = createForm<{ email: string }>({ model, schema });

// Через FormField значение/ошибки подцепляются автоматически:
<FormField control={form.email} testId="email" />;
```

Вне формы — как обычный `<input>`:

```tsx
<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
```

### Anti-patterns

- **Ставить `Input` с `type: 'number'` для числа.** `Input` отдаёт строку (`'42'`), а схема
  `Input` не объявляет `type: 'number'`. Числовое поле — `InputNumber`.
- Передавать `value: number` в `Input` — при следующем `onChange` значение придёт строкой и
  типы в форме разойдутся.
- Ждать value-based `onChange(value)` от `Input` вне формы — standalone это нативное событие.
  Внутри формы (`FormField` / рендерер) событие в значение переводит обёртка поля.

## InputNumber

Числовое поле: `value: number | null`, `onChange(number | null)`. Контракт уже value-based,
поэтому в форме кладётся в `component` как есть. Registry-имя в JSON-DSL — `InputNumber`.

```tsx
{
  value: model.$.age,
  component: InputNumber,
  componentProps: { label: 'Возраст', min: 0, testId: 'age' },
}
```

> **Edge cases.** Пустой ввод даёт `null` (а не `0`). При `min >= 0` любое отрицательное
> значение принудительно становится `0`. Частичный ввод («-», «.», «1e») не эмитится — поле
> не откатывается, буфер хранит набранное. Поэтому в модели поле должно иметь тип
> `number | null`, а не `number`.

Anti-patterns:

- Опускать `min={0}` и ожидать, что отрицательные числа отсекутся сами — нет, без `min`
  отрицательные значения проходят.
- Передавать `type` — у `InputNumber` его нет (всегда `number`).

## InputSuggest

Автокомплит со **свободным вводом**: значение — всегда введённый текст (`string | null`), список
лишь помогает его набрать. Registry-имя в JSON-DSL — `InputSuggest` (у `Input` пропа
`suggestions` нет).

| Prop          | Тип                                                    | Default | Описание                                                                     |
| ------------- | ------------------------------------------------------ | ------- | ---------------------------------------------------------------------------- |
| `suggestions` | `Array<string \| { value; label? }> \| ResourceConfig` | —       | Подсказки. Выбор пишет в поле `value`; `label` — только текст пункта списка. |
| `minChars`    | `number`                                               | `0`     | С какой длины текста показывать подсказки.                                   |
| `openOnFocus` | `boolean`                                              | `false` | Раскрывать список при фокусе, не дожидаясь ввода.                            |
| `filter`      | `(option, query) => boolean`                           | —       | Свой предикат совпадения (только из кода). По умолчанию — подстрока `label`. |

```tsx
// Статика: строки или { value, label? }
{
  value: model.$.city,
  component: InputSuggest,
  componentProps: { label: 'Город', suggestions: ['Москва', 'Казань', 'Новосибирск'] },
}

// Серверный поиск — тот же ResourceConfig, что у Select (static / preload / partial)
{
  value: model.$.company,
  component: InputSuggest,
  componentProps: {
    suggestions: { type: 'partial', pageSize: 20, load: ({ search, page }) => api.companies(search, page) },
    minChars: 2,
  },
}
```

В JSON-DSL: `"$component": "InputSuggest"` и `"suggestions": ["Москва", "Казань"]` или
`"suggestions": "$dataSource(CITIES)"` — через `$dataSource` можно отдать и `ResourceConfig` с
функцией `load`.

Клавиатура: ↓/↑ — по подсказкам, Enter — подставить подсвеченную (без подсветки Enter отправляет
форму), Esc — закрыть список. Фокус всё время остаётся в поле.

**`InputSuggest` или `Combobox creatable`?**

| Нужно                                                        | Берите                     |
| ------------------------------------------------------------ | -------------------------- |
| Любой текст, список — подсказка (город, должность, компания) | `InputSuggest`             |
| Значение — одна из опций, изредка добавить свою              | `Combobox` + `creatable`   |
| Строго одна из опций                                         | `SelectAsync` / `Combobox` |

Anti-patterns:

- Ждать, что значением станет `id` опции (`{ value: 'spb', label: 'Санкт-Петербург' }` → в поле
  окажется `spb`, и пользователь увидит `spb`). Для кодов берите `SelectAsync`/`Combobox`: здесь
  `value` подсказки — это текст, который увидит пользователь.
- Класть `suggestions` в `componentProps` компонента `Input` — у `Input` такого пропа нет
  (props-схема отклонит его в JSON-DSL). Нужен `InputSuggest`.
- Headless-ядро без ui-kit — `useAutocomplete` / `Autocomplete.*` из `@reformer/cdk/autocomplete`.

## InputMask

### API

```typescript
interface InputMaskProps {
  className?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  mask?: string; // '9' = цифра, остальные символы — литералы
  placeholder?: string; // если опущен — используется mask
  disabled?: boolean;
}
```

| Prop          | Тип      | Default | Описание                                                                                       |
| ------------- | -------- | ------- | ---------------------------------------------------------------------------------------------- |
| `mask`        | `string` | —       | Шаблон маски. `9` означает «цифра», остальные символы (`+`, `-`, `(`, `)`, пробел) — литералы. |
| `placeholder` | `string` | `mask`  | Подсказка. По умолчанию равна маске для подсветки формата.                                     |

### Common Patterns

Российский телефон:

```tsx
import { InputMask } from '@reformer/ui-kit';

<InputMask value={phone} onChange={setPhone} mask="+7 (999) 999-99-99" />;
```

ИНН (10 цифр):

```tsx
<InputMask value={inn} onChange={setInn} mask="9999999999" placeholder="ИНН" />
```

Дата `DD.MM.YYYY`:

```tsx
<InputMask value={birthDate} onChange={setBirthDate} mask="99.99.9999" />
```

### Anti-patterns

- **Рассчитывать, что маска отформатирует ввод.** `InputMask` ввод НЕ трансформирует:
  `onChange` отдаёт `event.target.value` как есть, а `mask` используется только как
  `placeholder`-подсказка. Наберёт пользователь `+7 (999) …` — столько и уедет в модель;
  наберёт `9999999999` — уедет без литералов. Если формат обязателен, проверяйте его
  правилом валидации, а нормализуйте в behavior `transformValue` или при сабмите.
- Поэтому регулярка валидации не должна требовать литералов, если только вы не приводите
  значение к формату сами: `/^\d{10}$/` пройдёт, а `/^\+7 \(\d{3}\)…/` — нет.
- Использовать `mask` для сложных правил (валидация диапазонов, контрольные
  суммы) — `InputMask` только направляет ввод, не валидирует. Валидацию вешать
  через `validate(model.$.x, [...])` в validation-схеме (запуск `validateModel`).

## InputPassword

### API

```typescript
interface InputPasswordProps {
  className?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string; // default: 'Password'
  disabled?: boolean;
  showToggle?: boolean; // default: true — показывать кнопку «глаз»
}
```

| Prop          | Тип       | Default      | Описание                                                                                                                        |
| ------------- | --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `showToggle`  | `boolean` | `true`       | Показывать ли иконку «глаз»/«перечеркнутый глаз» для переключения видимости. Иконка показывается только когда `value` непустой. |
| `placeholder` | `string`  | `'Password'` | Подсказка.                                                                                                                      |

### Common Patterns

Дефолт (с переключателем):

```tsx
import { InputPassword } from '@reformer/ui-kit';

<InputPassword value={password} onChange={setPassword} placeholder="Пароль" />;
```

Без переключателя видимости:

```tsx
<InputPassword value={password} onChange={setPassword} showToggle={false} />
```

Подтверждение пароля (через `compute-from` / `revalidate-when` на уровне формы):

```tsx
<InputPassword value={form.password.value} onChange={form.password.setValue} />
<InputPassword
  value={form.passwordConfirm.value}
  onChange={form.passwordConfirm.setValue}
  placeholder="Повторите пароль"
/>
```

### Anti-patterns

- Использовать `<Input type="password">` вместо `InputPassword`, если нужен
  переключатель видимости — `Input` его не имеет.
- Хранить пароль с побочными состояниями (`maskedValue`, `realValue`). Компонент
  всегда отдаёт raw-строку через `onChange`; маскирование — задача браузера.

## Textarea

### API

```typescript
interface TextareaProps extends React.ComponentProps<'textarea'> {
  tooltip?: string; // иконка (i) в правом верхнем углу
}
```

| Prop        | Тип      | Default | Описание                                                             |
| ----------- | -------- | ------- | -------------------------------------------------------------------- |
| `rows`      | `number` | `3`     | Видимая высота в строках. Resize по вертикали оставлен (`resize-y`). |
| `maxLength` | `number` | —       | Жёсткое ограничение длины (нативное HTML-поведение).                 |

Как и `Input`, standalone `Textarea` эмитит нативное событие; в форме обёртка поля переводит его
в значение (`e.target.value || null`).

### Common Patterns

Комментарий с лимитом:

```tsx
import { Textarea } from '@reformer/ui-kit';

{
  value: model.$.comment,
  component: Textarea,
  componentProps: { label: 'Комментарий', rows: 5, maxLength: 500, placeholder: 'Опишите проблему' },
}
```

Адрес доставки вне формы:

```tsx
<Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="Адрес" />
```

### Anti-patterns

- Передавать `rows={1}` — для одной строки используйте `Input`. Textarea не
  имеет логики авто-роста.
- Полагаться на `maxLength` как валидатор: это soft-лимит на ввод; для бизнес-
  правил (например, `длина <= 500 на русском, <= 1000 на английском`) ставить
  `validators` в лист схемы (`{ value: model.$.field, component, validators }`).

## See also

- [03-choice-fields.md](03-choice-fields.md) — `SelectAsync`, `CheckboxWithLabel`, `RadioGroupOptions`.
- [05-form-field-integration.md](05-form-field-integration.md) — как все эти поля автоматически подключаются через `FormField`.
- [06-troubleshooting.md](06-troubleshooting.md) — «number возвращает строку», «mask пропускает символы», «password toggle не появляется».
