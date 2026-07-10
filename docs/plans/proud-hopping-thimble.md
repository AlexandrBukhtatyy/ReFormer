# Fix StackBlitz startup: wrong package build order

## Context

На StackBlitz при старте выполняется `startCommand` → `npm run stackblitz:start`
([package.json:9](../../package.json#L9), [:32](../../package.json#L32)). Он последовательно
собирает все пакеты (`build:stackblitz` = `vite build`) и затем поднимает playground.
На чистом клоне StackBlitz это падает; локально «работает», потому что `dist/` всех
пакетов уже собран прошлыми билдами и маскирует баг.

## Root cause — неверный порядок сборки

Текущий порядок в `stackblitz:start`:

```
core → cdk → ui-kit → renderer-react → renderer-json → playground
```

`@reformer/ui-kit` **импортирует значение** из `@reformer/renderer-react`
(`RenderNodeComponent` — [form-wizard.tsx:37](../../packages/reformer-ui-kit/src/components/form-wizard/form-wizard.tsx#L37);
плюс type-импорты `FieldWrapperProps`, `RenderNode`), а `renderer-react` в цепочке
собирается **после** `ui-kit`.

- В tsconfig ui-kit нет `paths`-алиасов на исходники (`@reformer/*` резолвится только
  через node_modules → `packages/reformer-renderer-react/dist/index.d.ts`).
- На чистом StackBlitz на момент сборки ui-kit каталога `renderer-react/dist/` ещё нет →
  `vite-plugin-dts` не может зарезолвить `@reformer/renderer-react` → билд ui-kit падает
  → из-за `&&` вся цепочка обрывается, playground не стартует.
- Локально `renderer-react/dist/index.d.ts` уже существует от прошлых сборок → ошибки нет
  (объясняет «работает у меня, падает на StackBlitz»).

## Fix — одна строка

Переставить `renderer-react` перед `ui-kit` (топологически корректный порядок
core → cdk → **renderer-react → ui-kit** → renderer-json → playground) в
[package.json:32](../../package.json#L32):

```json
"stackblitz:start": "npm run stackblitz:core && npm run stackblitz:cdk && npm run stackblitz:renderer-react && npm run stackblitz:ui-kit && npm run stackblitz:renderer-react-json && npm run stackblitz:playground"
```

Остальные зависимости уже удовлетворены этим порядком (cdk←core, renderer-react←core,
ui-kit←core+cdk+renderer-react, renderer-json←core+renderer-react+ui-kit).

## Verification

1. Симуляция чистого StackBlitz локально: удалить все `packages/*/dist` и прогнать
   `npm run stackblitz:start` — должно дойти до playground без падения на ui-kit.
2. Открыть dev-сервер, убедиться что примеры (`renderer-react`, `renderer-json`,
   form-wizard/form-array) рендерятся.

## Примечание (вне этой правки)

Если после переупорядочивания на StackBlitz останется другая ошибка — это, скорее всего,
отдельная тема нативных бинарников в WebContainer (tailwind v4 / lightningcss / oxide /
rollup → WASM-fallback). Под неё уже добавлены `napi-wasm`, `@emnapi/*`,
`@napi-rs/wasm-runtime` в корневые deps. Диагностировать отдельно по фактическому тексту
ошибки.
