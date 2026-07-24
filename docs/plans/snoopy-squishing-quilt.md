# План: новый проект `projects/reformer-builder`

## Context

Нужен новый React-проект `reformer-builder` в монорепо ReFormer — по образу существующего
`react-playground`, но как **минимальный рабочий скелет-заготовка**, который дальше будем
наполнять отдельно. Название намекает на будущий конструктор форм, но на этом этапе задача —
только каркас: Vite + React 19 + Tailwind v4 + пакеты `@reformer/*`, роутинг и одна стартовая
страница. Инфраструктуру `react-playground`, не относящуюся к базовому запуску (MSW-моки,
swagger, `scripts/gen-*`, StackBlitz-режим), **не переносим**.

Монорепо на **npm workspaces** (`workspaces: ["packages/*", "projects/*"]`, нет turbo/nx), поэтому
новая папка `projects/reformer-builder` с валидным `package.json` автоматически станет workspace
после `npm install`. Пакеты `@reformer/*` резолвятся симлинками из `packages/`.

Решения пользователя: (1) пустой скелет-заготовка; (2) только базовая инфраструктура (без MSW/
swagger/gen-скриптов); (3) прописать проект в корневые npm-скрипты (`dev`/`typecheck`).

## Что создаём — `projects/reformer-builder/`

Копируем набор конфигов `react-playground`, убирая всё, что связано с MSW/swagger/StackBlitz.

### Конфиги

- **`package.json`** — на базе [projects/react-playground/package.json](projects/react-playground/package.json):
  - `name: "reformer-builder"`, `private: true`, `version: "0.0.0"`, `type: "module"`.
  - Скрипты — упрощённые: `dev: "vite"`, `build: "tsc -b && vite build"`, `lint: "eslint ."`,
    `preview: "vite preview"`. Убрать `dev:stackblitz`, `generate:mocks`, `gen:form-schema`.
  - `dependencies`: оставить `@reformer/{core,cdk,renderer-json,renderer-react,ui-kit}` (версии `"*"`),
    `react`, `react-dom`, `react-router-dom`, `@preact/signals-core`, `@radix-ui/react-select`,
    `@radix-ui/react-slot`, `tailwindcss` + `@tailwindcss/vite`, `class-variance-authority`, `clsx`,
    `tailwind-merge`, `lucide-react`. Убрать `axios` (не нужен без API).
  - `devDependencies`: оставить `@eslint/js`, `@types/node`, `@types/react`, `@types/react-dom`,
    `@vitejs/plugin-react`, `eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`,
    `globals`, `tw-animate-css`, `typescript`, `typescript-eslint`, `vite`. Убрать всё про MSW/express/
    swagger/cors/tsx/cross-env (`msw`, `@mswjs/http-middleware`, `express`, `cors`, `@types/cors`,
    `@types/express`, `swagger-jsdoc`, `swagger-ui-dist`, `@types/swagger-jsdoc`, `tsx`, `cross-env`).
  - Убрать блок `"msw": { ... }`.

- **`index.html`** — копия playground, `<title>reformer-builder</title>`. `favicon` — `/vite.svg`
  (положить `public/vite.svg`).

- **`vite.config.ts`** — на базе [projects/react-playground/vite.config.ts](projects/react-playground/vite.config.ts),
  **без** импортов и вызовов `mockServerPlugin`/`swaggerUIPlugin` и без StackBlitz-ветки. Оставить
  `react()`, `tailwindcss()`, критичный блок `resolve.dedupe` (react, react-dom, оба radix,
  `@preact/signals-core`) и alias `@ → ./src`.

- **`tsconfig.json`** / **`tsconfig.app.json`** / **`tsconfig.node.json`** — копии из playground с правками:
  - `tsconfig.json` — как есть (наследует `../../tsconfig.json`, references на app+node, `paths @/*`).
  - `tsconfig.app.json` — как в playground, но `include: ["src", "../../packages/reformer-ui-kit/src/lib"]`
    и **убрать** `exclude: ["src/mocks/_generated"]` (моков нет).
  - `tsconfig.node.json` — как есть (`include: ["vite.config.ts"]`).

- **`eslint.config.js`** — копия playground, но `globalIgnores(['dist'])` без `src/mocks/_generated`.

- **`.gitignore`** — копия из [projects/react-playground/.gitignore](projects/react-playground/.gitignore).

### Исходники `src/`

- **`src/index.css`** — точная копия [projects/react-playground/src/index.css](projects/react-playground/src/index.css)
  (`@import 'tailwindcss'`, `@import '@reformer/ui-kit/styles'`, `@source` на ui-kit, `@layer base`).

- **`src/main.tsx`** — упрощённый: без `enableMocking()`. Просто
  `createRoot(...).render(<StrictMode><App/></StrictMode>)` + `import './index.css'`.

- **`src/App.tsx`** — минимальный каркас, повторяющий структуру playground, но с одной стартовой
  страницей: `BrowserRouter` → простой `Layout` (шапка «reformer-builder» + `<main>`) → `Routes`
  с маршрутом `/` на компонент-заглушку `HomePage` и `*` → `<Navigate to="/" replace />`.
  Оставляем задел для будущего роутинга, но без сайдбара/групп примеров.

- **`src/pages/HomePage.tsx`** — страница-заглушка: заголовок + короткий текст-плейсхолдер
  («Стартовая страница reformer-builder»). Служит проверкой, что Tailwind и рендер работают.

- **`public/vite.svg`** — копия из [projects/react-playground/public/vite.svg](projects/react-playground/public/vite.svg).

## Правки корневого `package.json`

В [package.json](package.json):

- Добавить скрипт для запуска из корня, рядом с `dev`:
  `"dev:builder": "npm run dev --workspace reformer-builder"`.
- Расширить `typecheck`, дописав в конец цепочки:
  `&& tsc --noEmit -p projects/reformer-builder/tsconfig.app.json`.

(Остальные корневые конфиги правки не требуют: `knip.json` игнорирует `projects/*`, `release.yml`
матчит только `packages/**`, `build --workspaces` подхватит проект сам.)

## Порядок реализации

1. Создать дерево файлов `projects/reformer-builder/` (конфиги → `src/` → `public/`).
2. Отредактировать корневой `package.json` (`dev:builder` + `typecheck`).
3. `npm install` в корне — линковка нового workspace и его зависимостей.

## Verification

```bash
# из корня монорепо
npm install                       # новый workspace слинкован, symlinks на @reformer/*
npm run dev:builder               # Vite поднимается, открыть http://localhost:5173 —
                                  # видна HomePage со стилями Tailwind, без ошибок в консоли
npm run typecheck                 # проходит, включая projects/reformer-builder/tsconfig.app.json
npm run lint                      # eslint без ошибок
npm run build --workspace reformer-builder   # tsc -b + vite build успешны, есть dist/
```

Критерий готовности: `npm run dev:builder` рендерит стартовую страницу со стилями; `typecheck`,
`lint` и `build` проекта проходят чисто.
