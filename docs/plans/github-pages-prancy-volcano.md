# Публикация reformer-builder на GitHub Pages рядом с reformer-doc

## Context

Сейчас на GitHub Pages публикуется только **reformer-doc** (Docusaurus) на
`https://alexandrbukhtatyy.github.io/ReFormer/`. Деплой идёт через официальный
artifact-flow (`upload-pages-artifact` → `deploy-pages@v4`), а не через ветку `gh-pages`
([.github/workflows/deploy-docs.yml](../../.github/workflows/deploy-docs.yml)).

Нужно опубликовать второй проект — **reformer-builder** (Vite-SPA). Ключевое ограничение
GitHub Pages: **у одного репозитория ровно один сайт Pages и один активный deployment** —
нельзя завести два независимых `deploy-pages`, публикующих в корень одного репо, второй
затрёт первый. Поэтому «2 проекта» реализуются как **один сайт с двумя подкаталогами**:

- `/ReFormer/` → docs (как сейчас)
- `/ReFormer/builder/` → builder

Следствие (подтверждено пользователем): артефакт единый и содержит оба проекта, поэтому
**каждый прогон workflow собирает docs и builder вместе** — что бы ни триггернуло сборку.
Иначе частичное обновление артефакта затрёт вторую половину сайта.

### Решения (согласованы с пользователем)

- Размещение: подкаталог того же сайта.
- URL builder: `https://alexandrbukhtatyy.github.io/ReFormer/builder/`.
- Триггер: вместе с docs, по push в `develop` (+ ручной `workflow_dispatch`).
- В шапке reformer-doc — ссылка на builder с бэйджем «dev» (проект ещё в разработке).

## Изменения

### 1. `base` для prod-сборки builder — env-driven

Файл: [projects/reformer-builder/vite.config.ts](../../projects/reformer-builder/vite.config.ts)

Сейчас `base` не задан (default `/`), поэтому собранный `dist/index.html` ссылается на
ассеты по абсолютным `/assets/...` — в подкаталоге Pages это 404. Добавить одну строку в
`defineConfig`, управляемую переменной окружения, чтобы **dev не менялся** (`/`), а
prod-сборка для Pages получала нужный префикс:

```ts
export default defineConfig({
  base: process.env.BUILDER_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  // ...остальное без изменений
});
```

Почему env, а не хардкод: `npm run dev` и `vite preview` должны работать на `/`, а базовый
путь Pages нужен только в CI. Monaco-воркеры (`?worker`, резолвятся через `import.meta.url`
относительно `base`) при корректном `base` заработают в подкаталоге автоматически —
отдельной настройки не требуют.

### 2. Workflow: собирать оба проекта в единый артефакт

Файл: [.github/workflows/deploy-docs.yml](../../.github/workflows/deploy-docs.yml)

- **Триггер `paths`**: добавить `projects/reformer-builder/**` (изменения builder тоже
  запускают деплой). Строки для `reformer-doc/**`, `packages/reformer/src/**` и самого
  workflow — оставить.
- **`name:`** (косметика): обновить на `Deploy Pages (docs + builder)`.
- **Build job**, после существующего шага «Build documentation» добавить шаг сборки builder
  с базовым путём через env:

  ```yaml
  - name: Build builder
    env:
      BUILDER_BASE: /ReFormer/builder/
    run: npm run build -w reformer-builder
  ```

  Пакеты `@reformer/*` уже собираются выше (core → cdk → renderer-json → renderer-react →
  ui-kit) — builder потребляет их из `dist/`, отдельная сборка пакетов не нужна.

- **Собрать staging-папку и её грузить** вместо прямой отдачи `reformer-doc/build`:

  ```yaml
  - name: Assemble site (docs at root, builder under /builder)
    run: |
      rm -rf _site
      mkdir -p _site
      cp -r projects/reformer-doc/build/. _site/
      mkdir -p _site/builder
      cp -r projects/reformer-builder/dist/. _site/builder/

  - name: Upload artifact
    uses: actions/upload-pages-artifact@v3
    with:
      path: _site
  ```

  `.nojekyll` из docs-сборки попадает в корень `_site` и отключает Jekyll для всего сайта,
  включая `/builder/`. Job `deploy` не меняется.

### 3. Ссылка на builder в шапке reformer-doc + бэйдж «dev»

Файлы:
[projects/reformer-doc/docusaurus.config.ts](../../projects/reformer-doc/docusaurus.config.ts),
[projects/reformer-doc/src/css/custom.css](../../projects/reformer-doc/src/css/custom.css)

В `themeConfig.navbar.items` (рядом с пунктом `Playground`, `position: 'left'`) добавить:

```ts
{
  href: 'pathname:///builder/',
  label: 'Builder',
  position: 'left',
  className: 'navbar-builder-dev',
},
```

- `pathname:///builder/` — префикс `pathname://` говорит роутеру Docusaurus не обрабатывать
  ссылку как внутренний SPA-роут и **сам подставляет `baseUrl`** → итоговый href
  `/ReFormer/builder/`. Это baseUrl-safe и не ломается при смене `baseUrl`.
- `href` (а не `to`) обязателен: при `onBrokenLinks: 'throw'` ссылка `to:` на несуществующий
  Docusaurus-роут уронила бы сборку; `href`/`pathname://` не проверяется как broken link.

Бэйдж «dev» — через CSS-псевдоэлемент на `className`, в конец
[custom.css](../../projects/reformer-doc/src/css/custom.css):

```css
.navbar-builder-dev::after {
  content: 'dev';
  margin-left: 0.35rem;
  padding: 0.05rem 0.35rem;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.4;
  text-transform: uppercase;
  border-radius: 0.35rem;
  background-color: #fef3c7; /* согласовано с announcementBar */
  color: #92400e;
  vertical-align: middle;
}
```

## Затронутые файлы

- [projects/reformer-builder/vite.config.ts](../../projects/reformer-builder/vite.config.ts) — env-driven `base`.
- [.github/workflows/deploy-docs.yml](../../.github/workflows/deploy-docs.yml) — path-фильтр, шаг сборки builder, staging, upload.
- [projects/reformer-doc/docusaurus.config.ts](../../projects/reformer-doc/docusaurus.config.ts) — navbar item на builder.
- [projects/reformer-doc/src/css/custom.css](../../projects/reformer-doc/src/css/custom.css) — стиль бэйджа «dev».

Спеки (`docs/specs/`, `projects/reformer-builder/docs/specs/`) не трогаем — read-only.

## Верификация

**Локально — builder в подкаталоге:**
```bash
BUILDER_BASE=/ReFormer/builder/ npm run build -w reformer-builder
grep -o '/ReFormer/builder/assets[^"]*' projects/reformer-builder/dist/index.html   # пути должны быть с префиксом
npm run preview -w reformer-builder   # vite preview учитывает base → откроет на /ReFormer/builder/, Monaco-редактор грузится
```

**Локально — docs собирается и ссылка отрисована:**
```bash
npm run build -w reformer-doc   # не должен упасть (onBrokenLinks: throw) — значит ссылка на builder валидна
npm run serve -w reformer-doc   # в шапке пункт «Builder» с бэйджем «dev»
```

**Локально — единый артефакт (эмуляция CI staging), опционально:**
```bash
rm -rf _site && mkdir -p _site && cp -r projects/reformer-doc/build/. _site/
mkdir -p _site/builder && cp -r projects/reformer-builder/dist/. _site/builder/
# Полная проверка путей /ReFormer/... — на реальном Pages после деплоя (локальный http.server отдаёт с корня /).
```

**На GitHub Pages (после push в `develop`):**
- Actions → workflow «Deploy Pages (docs + builder)» проходит, job `deploy` зелёный.
- `https://alexandrbukhtatyy.github.io/ReFormer/` — docs, в шапке «Builder» + бэйдж «dev».
- `https://alexandrbukhtatyy.github.io/ReFormer/builder/` — builder работает, Monaco-редактор
  и его воркеры грузятся без 404 (проверить Network в devtools).

## Прочее

- Перед реализацией завести bd-задачу (в plan mode запись недоступна) согласно правилам
  CLAUDE.md (`bd`, не TodoWrite).
- Git commit/push — **только по явному запросу пользователя** (правило CLAUDE.md); по
  умолчанию изменения остаются в рабочем дереве.
