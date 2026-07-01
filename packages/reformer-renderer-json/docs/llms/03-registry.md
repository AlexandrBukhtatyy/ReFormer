# Component Registry

Реестр — это карта от имени в операторе схемы (`$component(Name)` / `$dataSource(NAME)`) на React-компонент или source-значение. Без регистрации компонент не отрендерится — будет ошибка вида _Component "X" not found in registry_.

## Key Concepts

- **field component** — компонент, который привязывается к полю формы (лист `value: '$model(path)'`). Регистрируется через `reg.field(name, Component)`, в схеме — `component: '$component(name)'`.
- **container component** — компонент-обёртка, рендерит `children`. Регистрируется через `reg.container(name, Component)`.
- **dataSource value** — именованная константа, функция или React-компонент, на которые ссылаются строкой `'$dataSource(NAME)'` из `componentProps`. Регистрируется через `reg.dataSource(name, value)`.
- **`FIELD_WRAPPER`** — зарезервированное имя (`'$fieldWrapper'`) для контейнера-обёртки полей (label, error, hint). Обычно регистрируется как `FormField` из `@reformer/ui-kit`.

## Builder API

| Method                           | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `reg.field(name, Component)`     | Регистрирует field-компонент.                         |
| `reg.container(name, Component)` | Регистрирует container-компонент.                     |
| `reg.dataSource(name, value)`    | Регистрирует dataSource-значение (константу или функцию). |

## Examples

Минимальный реестр:

```typescript
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Input, Select, Box, FormField } from '@reformer/ui-kit';

const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.field('Select', Select);
  reg.container('Box', Box);
  reg.container(FIELD_WRAPPER, FormField);
});
```

dataSource values для `componentProps` (в схеме — ссылка `'$dataSource(NAME)'`):

```typescript
const registry = defineRegistry((reg) => {
  reg.field('Select', Select);
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

## Anti-patterns

- **Забыть зарегистрировать `FIELD_WRAPPER`** — поля будут рендериться без обёртки (нет label/error). В большинстве случаев это ошибка.
- **Регистрировать React-element вместо компонента** — `reg.field('Input', <Input />)` не сработает, нужно передавать сам тип компонента: `reg.field('Input', Input)`.
- **Ожидать наследования между вложенными `JsonRendererProvider`** — реестр сливается через `withParent`, дубли решаются по приоритету (внешний > внутренний).
- **Использовать `$dataSource(NAME)` без регистрации** — без `validate` строка просто прокинется в проп как есть (молчаливый баг); с `validate` даст ошибку `unknown dataSource "NAME"`.
- **Ссылаться на dataSource как на компонент** — `component: '$component(LoadingState)'`, где `LoadingState` зарегистрирован через `reg.dataSource`, бросит `Entry "..." is a 'dataSource' and cannot be used as $component(...)`. dataSource — только для значений в `componentProps`.

## See also

- [01-overview.md](01-overview.md) — как реестр прокидывается через `JsonRendererProvider`.
- [02-json-schema.md](02-json-schema.md) — где имена компонентов появляются в схеме (операторы `$component`/`$dataSource`).
- Эталонный реестр: `registry.ts` (monorepo example).
