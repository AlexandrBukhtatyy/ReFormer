# Lifecycle hooks + form initialization via onInit

## Context

Сейчас формы для multi-form страниц регистрируются в `ComponentRegistry` через `registerForm(name, form)`, а в JSON-схеме используются через string-ref `componentProps.form: 'creditForm'`. Проблемы:

1. **Registry — app-level**, формы — **page-level state** (могут жить в lazy-loaded компоненте). Семантически разные сущности смешаны.
2. **Layout формы в JSON ссылается на инстанс формы** — JSON перестаёт быть "чистым описанием layout-а".
3. **Имена хуков неконсистентны** с жизненным циклом компонента. Текущий `onInit` — это post-mount hook (useEffect), а интуитивно "init" — это **сетап до первого рендера**.

Цель: пересобрать API жизненного цикла ноды в духе компонентного lifecycle (init → mount → unmount), и **инициализировать формы через новый `onInit`** — синхронный build-time hook, возвращающий патч `componentProps` ноды. Формы становятся closure-переменными behavior-а, не попадают в registry, JSON-схема очищается от form-refs.

## Approach

### Новая модель lifecycle (ноды схемы)

| Хук                   | Когда вызывается                                           | Возвращает                         | Текущее имя         |
| --------------------- | ---------------------------------------------------------- | ---------------------------------- | ------------------- |
| `onInit(node, fn)`    | **Синхронно** при применении behavior (до первого рендера) | опциональный патч `componentProps` | — (новый)           |
| `onMount(node, fn)`   | `useEffect` после первого mount ноды                       | опциональный cleanup               | текущий `onInit`    |
| `onUnmount(node, fn)` | при unmount ноды                                           | void                               | текущий `onDestroy` |

`onInit` — единственный хук, способный влиять на **первый рендер** (через patch props). Остальные — реактивные к DOM-lifecycle.

### Инициализация формы

```ts
const renderBehavior = (schema) => {
  let form;

  onInit(schema.node('wizard'), () => {
    form = createCreditApplicationForm();
    return { form }; // попадёт в componentProps wizard-а
  });

  hideWhen(schema.node('mortgage-section'), () => form?.loanType.value.value !== 'mortgage');
  // ... остальной behavior использует form из closure
};
```

- `onInit` вызывается **синхронно** при `renderBehavior(proxy)` — до первого рендера.
- Возвращённый `{ form }` мерджится в `propsOverrides` ноды (тот же механизм, что у `schema.node(...).patchProps()`).
- `RenderNodeComponent` уже умеет читать `propsOverrides` при рендере (существующий код). Wizard получит форму в componentProps при первом рендере.
- Wizard дальше передаёт form в `RenderContextProvider` — дочерние поля резолвят `model:` против формы в runtime. **Compile-time form-scope в конвертере не нужен** — уходит.

### Multi-form на странице

```ts
onInit(schema.node('credit-wizard'), () => ({ form: createCreditForm() }));
onInit(schema.node('contact-wizard'), () => ({ form: createContactForm() }));
```

Каждый wizard получает свою форму. Runtime-resolve через RenderContextProvider гарантирует, что дети смотрят на правильную форму.

### JSON-схема — без form-refs

```json
{
  "selector": "wizard",
  "component": "RendererFormWizard",
  "componentProps": { "className": "..." }
}
```

Никаких `form: 'creditForm'` — форма приходит через onInit-патч.

## Changes

### 1. renderer-react: переименование и новый onInit

[packages/reformer-renderer-react/src/core/render-schema-proxy.ts](packages/reformer-renderer-react/src/core/render-schema-proxy.ts)

- В `NodeLifecycleHooks`: `onInit` → `onMount`, `onDestroy` → `onUnmount`. Добавить `onInit` с новой семантикой (но он НЕ сохраняется в lifecycleRegistry — см. ниже).

[packages/reformer-renderer-react/src/core/render-behavior.ts](packages/reformer-renderer-react/src/core/render-behavior.ts)

- **Переименовать** existing `onInit(node, fn)` → `onMount(node, fn)`. Подпись не меняется.
- **Переименовать** `onDestroy(node, fn)` → `onUnmount(node, fn)`. Подпись не меняется.
- **Добавить новый** `onInit(node, fn)`:
  ```ts
  export function onInit(node: RenderNodeControl, fn: () => Record<string, unknown> | void): void {
    const patch = fn();
    if (patch) node.patchProps(patch);
  }
  ```
  Вызывает fn синхронно, мерджит возвращённое в `propsOverrides` через существующий `patchProps`. Никаких новых override maps, никакого lifecycleRegistry для него.
- В `useNodeLifecycle`: обновить названия (`hooks.onMount`, `hooks.onUnmount`).

### 2. renderer-json: убрать form-type из registry и из конвертера

[packages/reformer-renderer-json/src/registry/types.ts](packages/reformer-renderer-json/src/registry/types.ts), [packages/reformer-renderer-json/src/registry/component-registry.ts](packages/reformer-renderer-json/src/registry/component-registry.ts)

- Удалить `'form'` из `type` union в `ComponentMetadata`.
- Удалить методы `registerForm`, `getForm` из интерфейса и реализации.

[packages/reformer-renderer-json/src/converter/json-to-render-schema.ts](packages/reformer-renderer-json/src/converter/json-to-render-schema.ts)

- Удалить блок form-scope detection в `convertNode` (проверку `componentProps.form === form-type → createFieldPath`).
- Убрать `'form'` из ветки string-ref в `transformPropValue` (останется только `'source'`).
- Убрать импорт `createFieldPath` (больше не нужен).

Form-scope полагается **только на runtime** через `RenderContextProvider` в wizard-компоненте, который уже существует ([RendererFormWizard.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form/components/ui/FormWizzard/RendererFormWizard.tsx) — `<RenderContextProvider value={{ form, path }}>`).

[packages/reformer-renderer-json/src/components/json-form-renderer.tsx](packages/reformer-renderer-json/src/components/json-form-renderer.tsx)

- Убрать любую упоминание form-type registry/formsMap (поскольку решили без них).
- Тип `renderBehavior` остаётся `RenderBehaviorFn<T>` — extension не нужен.

### 3. Миграция вызовов в существующих behavior-файлах

[projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-behavior.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-behavior.ts)

- `onInit(schema.node('wizard'), ...)` → `onMount(schema.node('wizard'), ...)`.
- `onDestroy(schema.node('wizard'), ...)` → `onUnmount(schema.node('wizard'), ...)`.
- Обновить импорты.

### 4. JSON-variant: форма инициализируется в onInit через wrapper-behavior

[projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/RegistrationFormRendererJson.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/RegistrationFormRendererJson.tsx)

- Убрать `.registerForm('creditForm', form)` из `createCreditApplicationRegistry`.
- Форма всё ещё создаётся на уровне компонента (для `useLoadCreditApplication`).
- Обернуть `createCreditApplicationRenderBehavior(form)` в JSON-specific wrapper-behavior, который использует onInit:
  ```ts
  const renderBehavior = useMemo(
    () => (schema) => {
      onInit(schema.node('wizard'), () => ({ form }));
      createCreditApplicationRenderBehavior(form)(schema);
    },
    [form]
  );
  ```

[projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts)

- Убрать `form: 'creditForm'` из `componentProps` wizard-а. `stepValidations`/`fullValidation` остаются как source-refs.

### 5. Пересборка пакетов

```
cd packages/reformer-renderer-react && npm run build:stackblitz
cd packages/reformer-renderer-json && npm run build
```

## Reuse

- **`schema.node(selector).patchProps(obj)`** ([render-schema-proxy.ts](packages/reformer-renderer-react/src/core/render-schema-proxy.ts)) — новый `onInit` тонкая обёртка над ним (вызов `fn()` + `patchProps(result)`). Нет новых override maps.
- **`RenderContextProvider`** в [RendererFormWizard.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form/components/ui/FormWizzard/RendererFormWizard.tsx) — уже провайдит form для дочерних нод в runtime. Нужен form-scope в конвертере отсутствует.
- **Существующий `propsOverrides` mechanism** — объединяет schema-props и override-props при рендере. onInit патч попадает туда.
- **`useNodeLifecycle`** ([render-behavior.ts](packages/reformer-renderer-react/src/core/render-behavior.ts)) — переименование внутренних ключей, логика не меняется.

## Verification

1. **Build:**
   ```bash
   cd packages/reformer-renderer-react && npm run build:stackblitz
   cd packages/reformer-renderer-json && npm run build
   ```
   Обе сборки должны пройти без ошибок.
2. **Smoke-тесты всех 3 вариантов:**
   ```bash
   cd projects/react-playground-e2e
   npx playwright test --grep "@smoke" \
     --project=complex-multy-step-form \
     --project=complex-multy-step-form-renderer \
     --project=complex-multy-step-form-json
   ```
   Ожидание: 15 passed.
3. **Lifecycle-хуки проверяем косвенно:** текущие `onInit`/`onDestroy` в [render-behavior.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-behavior.ts) переименованы в `onMount`/`onUnmount`; console.log-и в них должны появиться в консоли при mount/unmount wizard-а (ручная проверка в браузере).
4. **Form-scope через onInit:** wizard в JSON-варианте получает form через onInit-патч, wizard → RenderContextProvider → дети резолвят `model:` корректно. HP-001..HP-005 smoke passing.
5. **Registry чистый:** `registry.names()` не содержит `'creditForm'`; форма живёт только в closure behavior-а.
