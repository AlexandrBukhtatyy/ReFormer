# Render Behavior

`RenderBehaviorFn<T>` — функция `(schema: RenderSchemaProxy<T>) => void`, навешивающая декларативное поведение на готовый `RenderSchemaProxy`. Хелперы — standalone-функции: первым аргументом принимают либо `RenderNodeControl` (узел `schema.node('selector')`), либо саму схему (`renderEffect`).

Форма не передаётся хелперам напрямую — условия реактивны через Preact-сигналы, читаемые внутри callback (сигналы формы через замыкание или через ref wizard-компонента: `schema.node('wizard').getRef().current?.form`).

## Helpers

| Helper                                      | Первый аргумент       | Назначение                                                              |
| ------------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| `hideWhen(node, conditionFn)`               | `RenderNodeControl`   | Скрывает узел, пока `conditionFn()` истинна (реактивно по сигналам).    |
| `renderEffect(schema, effectFn)`            | `RenderSchemaProxy`   | Реактивный side-effect (Preact `effect()`); может вернуть cleanup.      |
| `onComponentEvent(node, event, handler)`    | `RenderNodeControl`   | Регистрирует колбэк на проп-событие компонента (`onSubmit`, ...).       |
| `onInit(node, fn)`                          | `RenderNodeControl`   | Синхронный build-time hook: вызывается сразу при применении behavior.   |
| `onMount(node, fn)`                         | `RenderNodeControl`   | После mount узла (`useEffect`); может вернуть cleanup.                  |
| `onUnmount(node, fn)`                       | `RenderNodeControl`   | При unmount узла.                                                       |

## Examples

Скрыть «mortgage-section», пока `loanType !== 'mortgage'`. Условие реактивно — пересчитывается при изменении сигнала формы:

```tsx
import { hideWhen, type RenderBehaviorFn } from '@reformer/renderer-react';

// form захвачен в замыкание фабрики поведения.
const behavior: RenderBehaviorFn<CreditForm> = (schema) => {
  hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
};
```

Реактивный эффект — принимает **схему**, а не узел. Эффекты живут на уровне рендера всего дерева и автоматически диспозятся при unmount `FormRenderer`:

```tsx
import { renderEffect } from '@reformer/renderer-react';

const wizardRef = schema.node('wizard').getRef<FormWizardHandle<CreditForm>>();
renderEffect(schema, () => {
  if (form.loanType.value.value === 'mortgage') {
    wizardRef.current?.goToStep(1);
  }
});
```

Проп-событие компонента — `onComponentEvent` получает ровно те же аргументы, что и оригинальный проп:

```tsx
import { onComponentEvent } from '@reformer/renderer-react';

onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CreditForm) => {
  await submitCreditApplication(values);
});
```

Lifecycle (несколько хелперов на одном узле — просто вызываем подряд). `onMount` может вернуть cleanup, который выполнится до `onUnmount`:

```tsx
import { onMount, onUnmount } from '@reformer/renderer-react';

const boundary = schema.node('data-boundary');
onMount(boundary, () => {
  void loadApplication(); // напр. загрузить данные и boundary.patchProps({ status: 'ready' })
  return () => console.log('cleanup');
});
onUnmount(schema.node('wizard'), () => console.log('wizard unmounted'));
```

## Anti-patterns

- **Предикат `hideWhen`, не читающий сигналы реактивно** — узел не будет переоцениваться. Читай сигнал целиком (`form.x.value.value`), не сохраняй значение заранее в переменную.
- **`renderEffect(node, ...)` вместо `renderEffect(schema, ...)`** — первый аргумент `renderEffect` это схема, а не узел (в отличие от остальных хелперов). Node-аргумент не даст эффекта.
- **Подписываться на `form` напрямую внутри React-компонента вместо `renderEffect`** — теряется автоматический dispose при unmount.
- **Бросать исключения из `onInit`** — он синхронный и вызывается при построении схемы (до первого рендера); исключение сломает mount. Логируй и обрабатывай ошибки внутри.

## See also

- [02-render-schema.md](02-render-schema.md) — что такое `RenderSchemaProxy` и `schema.node(selector)`.
- [05-cookbook.md](05-cookbook.md) — совмещение нескольких behavior на одном узле.
- [04-troubleshooting.md](04-troubleshooting.md).
