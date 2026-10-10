# Render Behavior

Правила узлов схемы — скрытие, обработчики событий компонентов, реактивные эффекты, lifecycle — пишутся в **поведении формы**: `defineFormBehavior(({ model, form, schema, flow }) => …)` из `@reformer/core/behaviors`. Операторы записывают правило, а исполняет его рендерер. Первым аргументом оператор принимает узел `schema.node('selector')` (`SchemaNodeControl`) либо саму область схемы (`renderEffect`).

Условия реактивны через сигналы, прочитанные внутри колбэка: значения модели (`model.loanType`), сигналы нод формы (`form.loanType.disabled.value`), поток шагов (`flow.current.value`).

## Helpers

| Helper                                      | Первый аргумент     | Назначение                                                              |
| ------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `hideWhen(node, conditionFn)`               | `schema.node(sel)`  | Скрывает узел, пока `conditionFn()` истинна (реактивно по сигналам).    |
| `renderEffect(schema, effectFn)`            | `schema`            | Реактивный side-effect (Preact `effect()`); может вернуть cleanup.      |
| `onComponentEvent(node, event, handler)`    | `schema.node(sel)`  | Регистрирует колбэк на проп-событие компонента (`onSubmit`, ...).       |
| `onInit(node, fn)`                          | `schema.node(sel)`  | Синхронный build-time hook: вызывается сразу при применении поведения. |
| `onMount(node, fn)`                         | `schema.node(sel)`  | После mount узла (`useEffect`); может вернуть cleanup.                  |
| `onUnmount(node, fn)`                       | `schema.node(sel)`  | При unmount узла.                                                       |

Те же операторы реэкспортирует `@reformer/renderer-react` — для низкоуровневого рендера по `createRenderSchema`.

Область поведения:

- `model` — модель (значения читаются точкой: `model.loanType`);
- `form` — корневая `FormGroup`;
- `schema` — узлы **своей** области: в корневом поведении — корневое дерево, в поведении строки массива (`applyEach`) и подформы (`apply`) — их поддерево;
- `flow` — поток шагов сборки (`createForm({ flow })`), без потока — `undefined`.

## Examples

Скрыть «mortgage-section», пока `loanType !== 'mortgage'`. Условие реактивно — пересчитывается при изменении значения модели:

```tsx
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, schema }) => {
  hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');
});
```

Реактивный эффект принимает **область схемы**, а не узел. Эффекты живут на уровне рендера дерева и автоматически диспозятся при unmount `FormRenderer`. Навигация визарда — методами потока шагов, а не через ref компонента:

```tsx
import { renderEffect } from '@reformer/core/behaviors';

// внутри defineFormBehavior(({ model, schema, flow }) => { … })
renderEffect(schema, () => {
  if (model.loanType === 'mortgage') flow?.goTo('loan'); // id шага = selector его узла
});
```

`flow.goTo(id)` возвращает `FlowTransition`: `{ status: 'moved', from, to }` либо `{ status: 'stayed', step, reason }` (`reason: 'locked'` — шаг ещё недоступен: не пройден предыдущий). Неизвестный `id` — исключение.

Проп-событие компонента — `onComponentEvent` получает ровно те же аргументы, что и оригинальный проп:

```tsx
import { onComponentEvent } from '@reformer/core/behaviors';

onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CreditForm) => {
  // Внутри сборки кнопка отправки визарда зовёт обработчик через `bundle.submit`: только после
  // успешной проверки всей формы, а при замечаниях поля помечаются touched. Проверять здесь руками
  // не нужно; `values` — значения формы.
  await submitCreditApplication(values);
});
```

Lifecycle (несколько операторов на одном узле — просто вызываем подряд). `onMount` может вернуть cleanup, который выполнится до `onUnmount`:

```tsx
import { onMount, onUnmount } from '@reformer/core/behaviors';

const boundary = schema.node('data-boundary');
onMount(boundary, () => {
  void loadApplication(); // напр. загрузить данные и boundary.patchProps({ status: 'ready' })
  return () => console.log('cleanup');
});
onUnmount(schema.node('wizard'), () => console.log('wizard unmounted'));
```

Поведение подключается к сборке полем `behavior`:

```tsx
const bundle = useFormBundle(() =>
  createForm<CreditForm>({ model: createCreditModel(), schema: creditSchema, behavior: creditBehavior })
);
```

## Прежний путь: `renderBehavior`

В сборке `createReactForm` (и при рендере `createRenderSchema` без бандла) правила узлов пишет отдельная функция `RenderBehaviorFn<T> = (schema: RenderSchemaProxy<T>) => void`. Фабрика из конфига `createReactForm` получает собранные форму, модель и **уровень формы** третьим аргументом — `submit`, `validate`, `flow`:

```tsx
import { hideWhen, renderEffect, type RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormGroup, FormLevel, FormModel } from '@reformer/core';

const makeCreditRenderBehavior =
  (form: FormGroup<CreditForm>, model: FormModel<CreditForm>, level: FormLevel<CreditForm>) =>
  ((schema) => {
    hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');
    renderEffect(schema, () => {
      if (model.loanType === 'mortgage') level.flow?.goTo('loan');
    });
  }) satisfies RenderBehaviorFn<CreditForm>;

createReactForm<CreditForm>({ model, schema, flow, renderBehavior: makeCreditRenderBehavior });
```

Этот путь рендерит функцию-схему, а не бандл, но `FormRenderer` с бандлом `createReactForm` (`form={bundle}` или `render={bundle.render}`) ставит контекст сборки: визард берёт из него форму и поток и отправляет через проверку (`bundle.submit`). Новому коду этот путь не нужен.

## Anti-patterns

- **Предикат `hideWhen`, не читающий сигналы реактивно** — узел не будет переоцениваться. Читай значение внутри предиката (`model.loanType`), не сохраняй его заранее в переменную.
- **`renderEffect(node, ...)` вместо `renderEffect(schema, ...)`** — первый аргумент `renderEffect` это область схемы, а не узел (в отличие от остальных операторов).
- **Навигация визарда через ref** — `getRef<FormWizardHandle>()` и `goToStep(n)` больше нет. Переход — `flow.goTo('loan')` из поведения либо `bundle.flow?.goTo('loan')` снаружи.
- **Адресовать из корневого поведения узел строки массива или подформы** — у них свои области: правило не сработает, в dev об этом предупредят сборка и рендерер. Поведение строки подключается `applyEach(model.$.items, rowBehavior)`, подформы — `apply(model.$.group, groupBehavior)`.
- **Подписываться на форму напрямую внутри React-компонента вместо `renderEffect`** — теряется автоматический dispose при unmount.
- **Бросать исключения из `onInit`** — он синхронный и вызывается при построении схемы (до первого рендера); исключение сломает mount. Логируй и обрабатывай ошибки внутри.

## See also

- [02-render-schema.md](02-render-schema.md) — узлы схемы и `selector`.
- [05-cookbook.md](05-cookbook.md) — совмещение нескольких правил на одном узле.
- [07-form-wizard.md](07-form-wizard.md) — поток шагов, отправка визарда.
- [08-form-bundle.md](08-form-bundle.md) — области схемы строк и подформ.
- [04-troubleshooting.md](04-troubleshooting.md).
