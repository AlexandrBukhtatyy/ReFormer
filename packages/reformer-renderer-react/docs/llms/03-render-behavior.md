# Render Behavior

`RenderBehaviorFn<T>` — функция, навешивающая декларативное поведение на готовый `RenderSchemaProxy`. Применяется через `createRenderSchema(...).behavior(fn)` или передаётся в обвязку (`@reformer/renderer-json`).

## Helpers

| Helper                     | Назначение                                                          |
| -------------------------- | ------------------------------------------------------------------- |
| `hideWhen(predicate)`      | Прячет узел, если предикат истинен.                                 |
| `renderEffect(fn)`         | Реактивный эффект: запускается при изменении подписанных сигналов.  |
| `onComponentEvent(name, fn)` | Подписка на DOM/React-событие узла (`onClick`, `onChange`, ...). |
| `onInit(fn)`               | Один раз при инициализации схемы.                                   |
| `onMount(fn)`              | При монтировании узла в DOM.                                        |
| `onUnmount(fn)`            | При размонтировании.                                                |

## Examples

Скрыть «mortgage-section» когда `loanType !== 'mortgage'`:

```tsx
import { hideWhen, type RenderBehaviorFn } from '@reformer/renderer-react';

const behavior: RenderBehaviorFn<CreditForm> = (proxy) => {
  proxy.node('mortgage-section').apply(
    hideWhen((form) => form.loanType.value !== 'mortgage'),
  );
};
```

Реактивный эффект:

```tsx
import { renderEffect } from '@reformer/renderer-react';

proxy.node('summary').apply(
  renderEffect((form) => {
    console.log('total changed:', form.total.value);
  }),
);
```

Lifecycle:

```tsx
import { onInit, onMount } from '@reformer/renderer-react';

proxy.node('wizard').apply(
  onInit((form) => analytics.track('wizard:init', { step: form.currentStep.value })),
  onMount(() => focusFirstInvalidField()),
);
```

## Anti-patterns

- **Подписываться на `form` напрямую внутри React-компонента вместо `renderEffect`** — теряется автоматический dispose при unmount.
- **Использовать `hideWhen` с предикатом, который не читает сигналы реактивно** — узел не будет переоцениваться.
- **Бросать исключения из `onInit`** — это сломает построение схемы при первом рендере. Логируй и обрабатывай ошибки внутри.

## See also

- [02-render-schema.md](02-render-schema.md) — что такое `RenderSchemaProxy`.
- [04-troubleshooting.md](04-troubleshooting.md).
