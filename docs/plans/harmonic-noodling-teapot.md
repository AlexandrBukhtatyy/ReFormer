# Перенос AsyncBoundary из renderer-react в ui-kit

## Context

Первая итерация уже реализована: `AsyncBoundary` в [packages/reformer-renderer-react/src/core/async-boundary.tsx](packages/reformer-renderer-react/src/core/async-boundary.tsx), слоты принимают `ReactNode | RenderNode-like` и разворачиваются через `RenderNodeComponent`. Оба экрана ([CreditApplicationFormRenderer.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/CreditApplicationFormRenderer.tsx), [CreditApplicationFormRendererJson.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson.tsx)) работают.

Проблема: семантически `AsyncBoundary` — это UI-примитив, а живёт в `renderer-react` только потому, что через `RenderNodeComponent` умеет рендерить `RenderNode`-слоты. Это делает ui-kit неполным (базовый UI-кирпич не в UI-пакете) и оставляет неявную зависимость на рендерер.

Цель — перенести `AsyncBoundary` в `@reformer/ui-kit`, сделав его чистым ui-компонентом без знания о `RenderNode` / рендерерах. Контракт слотов меняется на `ComponentType` (не `ReactNode` и не `RenderNode`).

## Архитектура

### Контракт AsyncBoundary

```tsx
// packages/reformer-ui-kit/src/components/ui/async-boundary.tsx
import type { ComponentType, ReactNode } from 'react';

export type AsyncStatus = 'loading' | 'error' | 'ready';

export interface AsyncBoundaryProps {
  status: AsyncStatus;
  LoadingComponent?: ComponentType;
  ErrorComponent?: ComponentType;
  children?: ReactNode;
}

export function AsyncBoundary({
  status,
  LoadingComponent,
  ErrorComponent,
  children,
}: AsyncBoundaryProps): ReactNode {
  if (status === 'loading') return LoadingComponent ? <LoadingComponent /> : null;
  if (status === 'error') return ErrorComponent ? <ErrorComponent /> : null;
  return <>{children}</>;
}
```

Без зависимостей сверх React. Слоты — фабрики компонентов; AsyncBoundary сам создаёт элемент.

### TS-variant

[render-schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts):

```ts
import { AsyncBoundary } from '@reformer/ui-kit';  // было: '@reformer/renderer-react'
// ...
{
  selector: 'data-boundary',
  component: AsyncBoundary,
  componentProps: {
    status: 'loading',
    LoadingComponent: LoadingState,   // было: loadingSlot: { component: LoadingState }
    ErrorComponent: ErrorStateDefault,
  },
  children: [{ selector: 'wizard', component: RendererFormWizard, /* ... */ }],
}
```

Кастомный текст ошибки — через тонкую обёртку:

```ts
const ErrorStateDefault = () => <ErrorState error="Не удалось загрузить заявку" />;
```

(локально в `render-schema.ts`; если обёрток станет много — вынести).

### JSON-variant

`LoadingState` / `ErrorState` перерегистрируются из `container` в **`source`** (ComponentType как значение, не как React-компонент в реестре компонентов). Этого достаточно: `transformPropValue` в [json-to-render-schema.ts:115-131](packages/reformer-renderer-json/src/converter/json-to-render-schema.ts#L115-L131) при встрече строки в `componentProps` ищет её в registry и возвращает `meta.component` как есть — т.е. сам компонент попадёт в props.

[registry.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts):

```ts
.registerSource('LoadingState', LoadingState)
.registerSource('ErrorStateDefault', () => <ErrorState error="Не удалось загрузить заявку" />)
```

[json-schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts):

```json
{
  "selector": "data-boundary",
  "component": "AsyncBoundary",
  "componentProps": {
    "status": "loading",
    "LoadingComponent": "LoadingState",
    "ErrorComponent": "ErrorStateDefault"
  },
  "children": [
    {
      /* wizard */
    }
  ]
}
```

### Реестр по-умолчанию renderer-json

[default-registry.ts](packages/reformer-renderer-json/src/registry/default-registry.ts): импорт `AsyncBoundary` меняется с `@reformer/renderer-react` на `@reformer/ui-kit`; регистрация остаётся как `container`.

### Поведение (render-behavior)

Без изменений. `patchProps({ status: 'loading' | 'ready' | 'error' })` продолжает работать — меняется только имя props со `status` останется, а `loadingSlot`/`errorSlot` больше не патчатся behavior'ом (они статически определены в схеме).

## Файлы к изменению

Новые:

- `packages/reformer-ui-kit/src/components/ui/async-boundary.tsx`

Изменяемые:

- [packages/reformer-ui-kit/src/index.ts](packages/reformer-ui-kit/src/index.ts) — экспорт `AsyncBoundary`, `AsyncBoundaryProps`, `AsyncStatus`
- [packages/reformer-renderer-react/src/index.ts](packages/reformer-renderer-react/src/index.ts) — удалить экспорты `AsyncBoundary*`
- [packages/reformer-renderer-json/src/registry/default-registry.ts](packages/reformer-renderer-json/src/registry/default-registry.ts) — импорт `AsyncBoundary` из ui-kit вместо renderer-react
- [projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts) — импорт из ui-kit, `LoadingComponent`/`ErrorComponent` вместо `loadingSlot`/`errorSlot`
- [projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts) — строковые имена source в `LoadingComponent`/`ErrorComponent`
- [projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts) — `registerSource` для `LoadingState` и `ErrorStateDefault` (вместо `register`)

Удаляемые:

- `packages/reformer-renderer-react/src/core/async-boundary.tsx`

## Переиспользуемые сущности

- `transformPropValue` в [json-to-render-schema.ts:107-131](packages/reformer-renderer-json/src/converter/json-to-render-schema.ts#L107-L131) — уже резолвит строки как source-ссылки, ничего менять не нужно.
- `patchProps` из [render-schema-proxy.ts:174-178](packages/reformer-renderer-react/src/core/render-schema-proxy.ts#L174-L178) — триггерит rerender ноды при смене `status`.
- `LoadingState` / `ErrorState` в `complex-multy-step-form/components/ui/` — остаются как есть.

## Верификация

1. Сборка: `npm run build:stackblitz` в `reformer-ui-kit`, `reformer-renderer-react`, `reformer-renderer-json`.
2. `npx tsc --noEmit` в [projects/react-playground](projects/react-playground/) — чисто.
3. Дев-сервер, в браузере:
   - `/examples/complex-renderer` — loadAmount заполнен = 500000 (ready).
   - Временно заменить `'1'` на `'999999'` в [render-behavior.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-behavior.ts) → виден `ErrorState` с текстом «Не удалось загрузить заявку». Откатить.
   - `/examples/json-renderer` — то же поведение.
4. Проверить отсутствие импортов `AsyncBoundary from '@reformer/renderer-react'` после рефакторинга: `grep -r "AsyncBoundary" --include='*.ts' --include='*.tsx'`.
