# Component Registry

Реестр — это карта от имени в операторе схемы (`$component(Name)` / `$dataSource(NAME)` / `$fn(name)`) на React-компонент, source-значение или функцию; плюс единственный сервис локализации для `$locale(key)`. Без регистрации компонент не отрендерится — будет ошибка вида _Component "X" not found in registry_.

## Key Concepts

- **component** — любой React-компонент, зарегистрированный под именем и доступный в схеме как `component: '$component(name)'`. Один метод `reg.component(name, Component)` регистрирует и компоненты-листья (Input/Select — узел несёт `value: '$model(path)'`), и контейнеры-обёртки (Box/Section/FormField — узел несёт `children`). Роль узла (лист vs контейнер) определяется **структурой узла в схеме** (`value` vs `children`), а не тем, как компонент зарегистрирован.
- **dataSource value** — именованная константа, функция или React-компонент, на которые ссылаются строкой `'$dataSource(NAME)'` из `componentProps`. Регистрируется через `reg.dataSource(name, value)`.
- **fn** — функция (форматтер/компаратор/itemLabel/обработчик), на которую ссылаются строкой `'$fn(name)'` из `componentProps`. Регистрируется через `reg.fn(name, fn)`. Отдельный от `dataSource` вид: `reg.fn` бросает при регистрации не-функции, а `validateFormSchema` ловит перепутанные `$fn`/`$dataSource`. Рантайм передаёт функцию в проп по ссылке (как `$dataSource`-функцию), новизна — в статической проверке.
- **locale service** — сервис локализации для `$locale(key)` (строковый путь) и компонента `I18n` (реактивный путь). Регистрируется через `reg.locale(serviceOrResolver)` (ключ `LOCALE_SERVICE`) и/или подаётся в `LocaleProvider`. Интерфейс `LocaleService`: `resolve(key, params?) => string` (+ опциональный `render(key, params?) => ReactNode` для markdown/JSX, + `keys` для validate-проверки). Фабрики без зависимостей: `createLocaleResolver(catalog)` (плоский каталог), `createLocaleService(table)` (`ключ → (params) => строка` — параметры/склонение без ICU). ICU (`intl-messageformat`) и markdown подключает потребитель своей реализацией сервиса. Полный гид — [08-i18n.md](08-i18n.md).
- **`FIELD_WRAPPER`** — зарезервированное имя (`'$fieldWrapper'`) для контейнера-обёртки полей (label, error, hint). Обычно регистрируется как `FormField` из `@reformer/ui-kit`.

## Builder API

| Method                           | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `reg.component(name, Component)` | Регистрирует компонент (лист или контейнер — роль решает структура узла). |
| `reg.dataSource(name, value)`    | Регистрирует dataSource-значение (константу или функцию). |
| `reg.fn(name, fn)`               | Регистрирует функцию для `$fn(name)` (бросает на не-функцию). |
| `reg.locale(serviceOrResolver)`  | Регистрирует единственный сервис локализации для `$locale(key)`. |

## Examples

Минимальный реестр:

```typescript
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Input, Select, Box, FormField } from '@reformer/ui-kit';

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Select', Select);
  reg.component('Box', Box);
  reg.component(FIELD_WRAPPER, FormField);
});
```

dataSource values для `componentProps` (в схеме — ссылка `'$dataSource(NAME)'`):

```typescript
const registry = defineRegistry((reg) => {
  reg.component('Select', Select);
  reg.dataSource('LOAN_TYPES', [
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]);
});

// В JSON-схеме (лист + операторы):
{
  value: '$model(loanType)',
  component: '$component(Select)',
  componentProps: { options: '$dataSource(LOAN_TYPES)' },
}
```

Функции (`$fn`) и сервис локализации (`$locale`):

```typescript
import { defineRegistry, createLocaleResolver } from '@reformer/renderer-json';

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  // функции — форматтеры, компараторы, itemLabel
  reg.fn('propertyItemLabel', (_control, index) => `Имущество #${index + 1}`);
  reg.fn('formatCurrency', (v: number) => `${v} ₽`);
  // единственный сервис локализации; каталог включает validate-time проверку ключей
  reg.locale(
    createLocaleResolver({
      'fields.email.label': 'Email',
      'fields.email.placeholder': 'you@example.com',
    })
  );
});

// В JSON-схеме:
{
  value: '$model(email)',
  component: '$component(Input)',
  componentProps: {
    label: '$locale(fields.email.label)',   // → строка
    format: '$fn(formatCurrency)',          // → функция по ссылке
  },
}
```

Смена языка — пересобрать сервис на другом каталоге и передать новый ref в `reg.locale` (плюс пересборка дерева); `$locale` резолвится в строку при конвертации, «живого» переключения нет.

## Anti-patterns

- **Забыть зарегистрировать `FIELD_WRAPPER`** — поля будут рендериться без обёртки (нет label/error). В большинстве случаев это ошибка.
- **Регистрировать React-element вместо компонента** — `reg.component('Input', <Input />)` не сработает, нужно передавать сам тип компонента: `reg.component('Input', Input)`.
- **Ожидать наследования между вложенными `JsonRendererProvider`** — реестр сливается через `withParent`, дубли решаются по приоритету (внешний > внутренний).
- **Использовать `$dataSource(NAME)` без регистрации** — без `validate` строка просто прокинется в проп как есть (молчаливый баг); с `validate` даст ошибку `unknown dataSource "NAME"`.
- **Ссылаться на dataSource как на компонент** — `component: '$component(EMPTY_PLACEHOLDER)'`, где `EMPTY_PLACEHOLDER` зарегистрирован через `reg.dataSource`, бросит `Entry "..." is a 'dataSource' and cannot be used as $component(...)`. dataSource — только для значений в `componentProps`.
- **Регистрировать функцию как `dataSource` и ссылаться `$fn`** (или наоборот) — виды раздельны: `$fn(name)` резолвит только `reg.fn`-записи, `$dataSource(NAME)` — только `reg.dataSource`. Перекрёстная ссылка бросит `Entry "..." is a '...' and cannot be used as $fn(...)` и отклонится на `validate`.
- **Регистрировать несколько сервисов локализации** — сервис один (кладётся под `LOCALE_SERVICE`); повторный `reg.locale(...)` перезапишет предыдущий. Разные языки — это разные каталоги, передаваемые в `reg.locale` по одному за раз.

## See also

- [01-overview.md](01-overview.md) — как реестр прокидывается через `JsonRendererProvider`.
- [02-json-schema.md](02-json-schema.md) — где имена появляются в схеме (операторы `$component`/`$dataSource`/`$fn`/`$locale`).
