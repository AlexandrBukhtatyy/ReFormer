# Text fields

Текстовые поля ввода: `Input`, `InputMask`, `InputPassword`, `Textarea`. Все
четыре компонента следуют единому контракту:

- `value: string | number | null`,
- `onChange(value: string | number | null)` — пустая строка передаётся как `null`,
- `onBlur()` — без аргументов; используется `FormField` для пометки `touched`.

Это нужно, чтобы их можно было прозрачно подсунуть в `FormField` /
`RenderSchema`, не оборачивая в адаптеры.

## Components

| Name            | Purpose                                                                                | When to use                           |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| `Input`         | Однострочное поле, поддерживает `type='text'/'email'/'number'/'tel'/'url'/'password'`. | По умолчанию для строк и чисел.       |
| `InputMask`     | `Input` + строковая маска (`'9'` → цифра).                                             | Телефоны, ИНН, даты.                  |
| `InputPassword` | Поле пароля с переключателем «глаз».                                                   | Регистрация, логин, смена пароля.     |
| `Textarea`      | Многострочное поле с `rows`/`maxLength`.                                               | Комментарии, адрес, длинные описания. |

## Input

### API

```typescript
interface InputProps {
  className?: string;
  value?: string | number | null;
  onChange?: (value: string | number | null) => void;
  onBlur?: () => void;
  type?: 'text' | 'email' | 'number' | 'tel' | 'url' | 'password';
  placeholder?: string;
  disabled?: boolean;
  // плюс все нативные props кроме value/onChange:
  // min, max, step, autoComplete, name, id, aria-*, data-*
}
```

| Prop          | Тип                                         | Default         | Описание                                                                   |
| ------------- | ------------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| `value`       | `string \| number \| null`                  | `''` рендерится | Текущее значение. `null`/`undefined` → пустое поле.                        |
| `onChange`    | `(value: string \| number \| null) => void` | —               | Вызывается при вводе. Пустая строка → `null`. Для `type='number'` — число. |
| `onBlur`      | `() => void`                                | —               | Срабатывает при потере фокуса.                                             |
| `type`        | union                                       | `'text'`        | HTML `type`. Для `'number'` включается числовой парсинг.                   |
| `placeholder` | `string`                                    | —               | Подсказка.                                                                 |
| `disabled`    | `boolean`                                   | `false`         | Блокирует ввод и редактирование.                                           |

### Common Patterns

Базовый ввод (текст):

```tsx
import { Input } from '@reformer/ui-kit';

<Input value={name} onChange={setName} placeholder="Имя" />;
```

Числовое поле (с `min`):

```tsx
<Input type="number" value={age} onChange={setAge} min={0} placeholder="Возраст" />
```

> **Edge case `type='number'`.** Пустой ввод даёт `null` (а не `''`). При `min >= 0`
> любое отрицательное значение принудительно становится `0`. `NaN` не
> прокидывается — `onChange` просто не вызывается. Поэтому в форме поле должно
> иметь тип `number | null`, а не `number`.

Email-валидация на уровне формы (M1: `createModel` → схема с листом
`{ value: model.$.email, component, validators }` → `createForm({ model, schema })`):

```tsx
import { createModel, createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input, FormField } from '@reformer/ui-kit';

const model = createModel<{ email: string }>({ email: '' });
const schema = {
  children: [
    {
      value: model.$.email,
      component: Input,
      componentProps: { type: 'email', label: 'Email', testId: 'email' },
      validators: [required(), email()],
    },
  ],
};
const form = createForm<{ email: string }>({ model, schema });

// Через FormField значение/ошибки подцепляются автоматически:
<FormField control={form.email} testId="email" />;
```

### Anti-patterns

- Передавать `value: number` для `type='text'` — компонент сделает
  `String(value)`, но при следующем `onChange` значение придёт строкой и
  типы в форме разойдутся.
- Опускать `min={0}` и ожидать, что отрицательные числа отсекутся сами — нет,
  без `min` отрицательные значения проходят.
- Перехватывать `onChange={(e) => …}` напрямую (как у нативного `<input>`).
  `Input` отдаёт сразу значение, а не event.

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

- Считать, что `value` хранится без литералов маски. На самом деле `value` — это
  ровно то, что введено пользователем, **с** литералами. Очистку (только цифры)
  нужно делать в behavior `transformValue` или при сабмите.
- Использовать `mask` для сложных правил (валидация диапазонов, контрольные
  суммы) — `InputMask` только направляет ввод, не валидирует. Валидацию вешать
  через массив `validators` листа схемы (`validateFormModel`).

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
interface TextareaProps {
  className?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number; // default: 3
  maxLength?: number;
}
```

| Prop        | Тип      | Default | Описание                                                             |
| ----------- | -------- | ------- | -------------------------------------------------------------------- |
| `rows`      | `number` | `3`     | Видимая высота в строках. Resize по вертикали оставлен (`resize-y`). |
| `maxLength` | `number` | —       | Жёсткое ограничение длины (нативное HTML-поведение).                 |

### Common Patterns

Комментарий с лимитом:

```tsx
import { Textarea } from '@reformer/ui-kit';

<Textarea
  value={comment}
  onChange={setComment}
  rows={5}
  maxLength={500}
  placeholder="Опишите проблему"
/>;
```

Адрес доставки:

```tsx
<Textarea value={address} onChange={setAddress} rows={3} placeholder="Адрес" />
```

### Anti-patterns

- Передавать `rows={1}` — для одной строки используйте `Input`. Textarea не
  имеет логики авто-роста.
- Полагаться на `maxLength` как валидатор: это soft-лимит на ввод; для бизнес-
  правил (например, `длина <= 500 на русском, <= 1000 на английском`) ставить
  `validators` в лист схемы (`{ value: model.$.field, component, validators }`).

## See also

- [03-choice-fields.md](03-choice-fields.md) — Select, Checkbox, RadioGroup.
- [05-form-field-integration.md](05-form-field-integration.md) — как все эти поля автоматически подключаются через `FormField`.
- [06-troubleshooting.md](06-troubleshooting.md) — «number возвращает строку», «mask пропускает символы», «password toggle не появляется».
