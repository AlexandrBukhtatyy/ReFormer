# Component Registry

Реестр — это карта от строкового имени `component` в JSON-схеме на React-компонент. Без регистрации компонент не отрендерится — будет ошибка вида _Component "X" not found in registry_.

## Key Concepts

- **field component** — компонент, который привязывается к полю формы (через `model`). Регистрируется через `reg.field(name, Component)`.
- **container component** — компонент-обёртка, рендерит `children`. Регистрируется через `reg.container(name, Component)`.
- **dataSource value** — именованная константа или функция, на которую можно ссылаться строкой из `componentProps`. Регистрируется через `reg.dataSource(name, value)`.
- **`FIELD_WRAPPER`** — зарезервированное имя для контейнера-обёртки полей (label, error, hint). Обычно регистрируется как `FormField` из `@reformer/ui-kit`.

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
import { Input, Select, FormField } from '@reformer/ui-kit';

const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.field('Select', Select);
  reg.container(FIELD_WRAPPER, FormField);
  reg.container('Box', ({ children }) => <div>{children}</div>);
});
```

dataSource values для `componentProps`:

```typescript
const registry = defineRegistry((reg) => {
  reg.field('Select', Select);
  reg.dataSource('LOAN_TYPES', [
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]);
});

// В JSON-схеме:
{ model: 'loanType', component: 'Select', componentProps: { options: 'LOAN_TYPES' } }
```

## Anti-patterns

- **Забыть зарегистрировать `FIELD_WRAPPER`** — поля будут рендериться без обёртки (нет label/error). В большинстве случаев это ошибка.
- **Регистрировать React-element вместо компонента** — `reg.field('Input', <Input />)` не сработает, нужно передавать сам тип компонента: `reg.field('Input', Input)`.
- **Ожидать наследования между вложенными `JsonRendererProvider`** — реестр сливается через `withParent`, дубли решаются по приоритету (внешний > внутренний).
- **Использовать dataSource-ссылку в `componentProps` без регистрации** — строка просто прокинется в проп как есть.

## See also

- [01-overview.md](01-overview.md) — как реестр прокидывается через `JsonRendererProvider`.
- [02-json-schema.md](02-json-schema.md) — где имена компонентов появляются в схеме.
- Эталонный реестр: `registry.ts` (monorepo example).
