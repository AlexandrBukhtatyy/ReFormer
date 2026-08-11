# Markdown-предпросмотр в reformer-builder (в стиле VSCode)

## Контекст

В `reformer-builder` панель «Файлы» открывает любой не-схемный файл проекта code-вкладкой в Monaco
— [CodeArea.tsx](../../projects/reformer-builder/src/canvas/CodeArea.tsx) сейчас это просто редактор на
всю рабочую область, без тулбара. Для `.md`/`.mdx` это значит, что README (в том числе
сгенерированные [emit-readme.ts](../../projects/reformer-builder/src/codegen/emit-readme.ts)), инструкции
и планы читаются только исходником: таблицы, чек-листы и блоки кода приходится разбирать разметкой.

Задача — рендер-предпросмотр как в VSCode: переключатель **Код / Предпросмотр / Рядом**, GFM,
подсветка синтаксиса в fenced-блоках, синхроскролл в split-режиме, якоря у заголовков.

Существующая инфраструктура, на которую опираемся:

- `.md`/`.mdx` уже получают `tab.language === 'markdown'` через `languageOf()` в
  [save-actions.ts:210-241](../../projects/reformer-builder/src/app/save-actions.ts#L210-L241) — отдельный
  признак «это markdown» заводить не нужно.
- Сплиты — `react-resizable-panels` v4 + `@reformer/ui-kit/resizable` с persist раскладки через
  `useDefaultLayout({id, storage: localStorage, panelIds})`, образец —
  [CanvasArea.tsx:38-43](../../projects/reformer-builder/src/canvas/CanvasArea.tsx#L38-L43).
- Сегментированные переключатели в проекте делают вручную (`div` + `button` + `cn()`), образец —
  [FloatingActions.tsx:69-132](../../projects/reformer-builder/src/canvas/FloatingActions.tsx#L69-L132).
- Хоткеи и их подписи — [lib/shortcuts.ts](../../projects/reformer-builder/src/lib/shortcuts.ts)
  (`formatShortcut('Mod+Alt+V')`), общий обработчик — в
  [EditorLayout.tsx:208-364](../../projects/reformer-builder/src/app/EditorLayout.tsx#L208-L364).
- Файловые операции — [io/fs-ops.ts](../../projects/reformer-builder/src/io/fs-ops.ts) (`splitPath`,
  `joinPath`, внутренний `resolveDir`), корневой handle проекта — `projectStore.dirHandle` в
  [store/project-store.ts](../../projects/reformer-builder/src/store/project-store.ts).

## Технические решения

### Рендерер — `react-markdown`

Добавляем в `devDependencies` (в builder'е там лежит всё — это бандлимая SPA):
`react-markdown@^10`, `remark-gfm@^4`, `rehype-raw@^7`, `rehype-sanitize@^6`, `rehype-slug@^6`,
`@tailwindcss/typography@^0.5`. Из них `remark-gfm@4.0.1` и `rehype-raw@7.0.0` уже лежат в корневом
`node_modules` транзитивно от Docusaurus, но объявить их явно обязательно.

Почему не `marked`/`markdown-it` + DOMPurify: там весь рендер идёт одним `innerHTML`, а нам нужны
кастомные компоненты для трёх вещей сразу — подсветка блоков кода, резолв относительных картинок
через File System Access API и перехват кликов по ссылкам. С `react-markdown` это `components={{…}}`,
без пост-обработки DOM.

Порядок плагинов важен и неочевиден:

```
remarkPlugins={[remarkGfm]}
rehypePlugins={[rehypeRaw, rehypeSourceLine, rehypeSlug, [rehypeSanitize, schema]]}
```

`rehypeSourceLine` (наш, см. ниже) обязан идти **до** `rehypeSanitize`, потому что sanitize строит
новое дерево и `node.position` за ним не сохраняется. Соответственно схему санитайзера расширяем:
`data-line` на всех узлах (`attributes['*'] += ['dataLine']`), `id` на заголовках (для `rehype-slug`),
плюс `details`/`summary`/`kbd` в `tagNames` — их часто пишут в README.

Весь предпросмотр грузится через `React.lazy`, как уже сделано для Monaco в `CodeArea.tsx`, — на
стартовый чанк это не влияет.

### Подсветка кода — переиспользуем Monaco

Никакой новой зависимости: `monaco.editor.colorize(text, languageId, options): Promise<string>`
(подтверждено в `monaco-editor@0.56`, `editor.api.d.ts:1111`) отдаёт готовый HTML с токенами, а
грамматики (включая markdown) уже догружаются в
[monaco-languages.ts](../../projects/reformer-builder/src/canvas/monaco-languages.ts). Плюс — цвета блоков
кода точно совпадают с редактором в split-режиме.

Детали: вызов асинхронный → компонент `CodeBlock` с `useState` и отменой на unmount; до готовности
и для незнакомого языка — обычный `<pre>`. Перед colorize выставляем тему
(`monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'light')`) — в режиме «Предпросмотр»
редактор не смонтирован и глобальная тема monaco может быть дефолтной. HTML от colorize вставляется
через `dangerouslySetInnerHTML`: это токенайзер поверх уже экранированного текста, не HTML-парсер.

Info-строку fence (```` ```ts ````, ```` ```bash ````) в monaco languageId переводит чистая функция
`fenceLanguage()` — отдельно от `languageOf()`, та работает по расширению файла.

### Синхроскролл

1. Свой rehype-плагин `rehypeSourceLine` проставляет блочным узлам верхнего уровня
   `properties.dataLine = node.position.start.line` (позиции доходят до hast: `mdast-util-to-hast`
   переносит `position`). В DOM это `data-line`.
2. Из preview собираем якоря: `[{line, top}]` по `[data-line]` элементам (пересчёт на resize и смену
   текста).
3. Редактор → предпросмотр: `editor.onDidScrollChange` → верхняя видимая строка
   (`editor.getVisibleRanges()[0].startLineNumber`) → линейная интерполяция между соседними якорями →
   `container.scrollTop`.
4. Предпросмотр → редактор: `onScroll` контейнера → обратная интерполяция → `editor.setScrollTop()`
   (по вычисленной строке через `editor.getTopForLineNumber`).
5. Защита от эха: ref `{source: 'editor'|'preview', at: number}` — события противоположной стороны
   игнорируются ~120 мс.

Сама математика — чистые функции `lineToOffset(anchors, line)` / `offsetToLine(anchors, top)` в
`markdown/scroll-sync.ts`, покрываются юнит-тестами.

### Состояние режима — per-tab

В `TabState` добавляем `mdView?: 'code' | 'preview' | 'split'`. Существующее поле
`TabState.preview: boolean` **не трогаем** — оно уже значит «временная вкладка VSCode» (курсив в
таб-баре), это другой смысл.

- Редьюсер `setMdView(state, id, view)` рядом с `setTabText`
  ([reducers.ts:239](../../projects/reformer-builder/src/store/reducers.ts#L239)), экшен в
  `editor-store.ts`.
- Дефолт для новой md-вкладки — `'code'` (текущее поведение не меняется), но выбор пользователя
  «липкий»: сохраняем в `localStorage['rb.md.view']` и берём оттуда при открытии следующей
  md-вкладки. Дефолт-константа в одном месте, менять её потом дёшево.
- `store/drafts.ts` code-вкладки не персистит — там ничего делать не надо.

### Стилизация

`@tailwindcss/typography`, в Tailwind v4 подключается директивой в
[src/index.css](../../projects/reformer-builder/src/index.css): `@plugin "@tailwindcss/typography";`
рядом с существующими `@import`. Классы контейнера — `prose prose-sm max-w-none dark:prose-invert`,
плюс подгонка `--tw-prose-*` под токены кита (`--color-foreground`, `--color-muted-foreground`,
`--color-border`), чтобы предпросмотр не выбивался из темы оболочки.

### Относительные ресурсы (этап 5)

- Картинки: компонент `img` резолвит `src` — `http(s):`/`data:` как есть; относительный путь
  считается от каталога md-файла (`splitPath(tab.source.path).dirPath`, нормализация `./`/`../`,
  выход за корень проекта → отказ) и читается через новый экспорт `resolveFileHandle(root, path)` в
  `io/fs-ops.ts` (обёртка над уже существующим приватным `resolveDir`) → `URL.createObjectURL(file)`.
  Blob-URL кэшируются в `Map` на вкладку и освобождаются `URL.revokeObjectURL` при unmount.
- Ссылки: `#anchor` → `scrollIntoView` внутри контейнера предпросмотра; относительная `.md` →
  открыть файл через `openTreeEntry`/`openCodeFile`
  ([save-actions.ts:244-269](../../projects/reformer-builder/src/app/save-actions.ts#L244-L269));
  внешние — `target="_blank" rel="noreferrer"`.

## Файлы

**Новые** (все под `projects/reformer-builder/src/canvas/`):

| Файл | Содержимое |
|---|---|
| `MarkdownPreview.tsx` | Ленивый компонент предпросмотра: `react-markdown` + плагины + `components` + скролл-контейнер с `ref` (обычный `div` с `overflow-auto`, **не** Radix `ScrollArea` — у неё скролл живёт во внутреннем viewport, синхронизацию это только усложняет) |
| `markdown/rehype-source-line.ts` | rehype-плагин `data-line` |
| `markdown/scroll-sync.ts` | `lineToOffset` / `offsetToLine` / сбор якорей |
| `markdown/fence-language.ts` | info-строка fence → monaco languageId |
| `markdown/CodeBlock.tsx` | Блок кода через `monaco.editor.colorize` |
| `markdown/sanitize-schema.ts` | Схема для `rehype-sanitize` |
| `markdown/resolve-asset.ts` | Нормализация относительных путей + blob-URL кэш |
| `markdown/is-markdown.ts` | `isMarkdownTab(tab)` по `language`/расширению |

**Правим**:

- [canvas/CodeArea.tsx](../../projects/reformer-builder/src/canvas/CodeArea.tsx) — тулбар (сегмент
  Код / Предпросмотр / Рядом, показывается только для markdown-вкладок) + ветвление режимов + split
  через `ResizablePanelGroup` с `useDefaultLayout({id: 'rb.layout.md', panelIds: ['editor','preview']})`.
- [canvas/CodeEditor.tsx](../../projects/reformer-builder/src/canvas/CodeEditor.tsx) — проброс
  необязательного `onMount(editor)`: без инстанса редактора синхроскролл не подключить
  (`onDidScrollChange`, `getVisibleRanges`, `getTopForLineNumber`, `setScrollTop` — все
  подтверждены в `monaco-editor@0.56`).
- [store/types.ts](../../projects/reformer-builder/src/store/types.ts),
  [store/reducers.ts](../../projects/reformer-builder/src/store/reducers.ts),
  [store/editor-store.ts](../../projects/reformer-builder/src/store/editor-store.ts) — поле `mdView`,
  редьюсер, экшен.
- [app/EditorLayout.tsx](../../projects/reformer-builder/src/app/EditorLayout.tsx) — хоткеи. Важно: ветки
  надо разместить в глобальной секции (рядом с `⌘⌥V`, строки ~242-265), **до** раннего выхода
  `if (activeTab(st)?.kind === 'code') return;` на строке ~280, иначе на code-вкладке они не
  сработают. `⇧⌘V` — Код ⇄ Предпросмотр; `⌘K V` — «Рядом» (аккорд; в проекте аккордов пока нет —
  реализуем ref-буфером с таймаутом ~1.5 с).
- [app/AppMenuBar.tsx](../../projects/reformer-builder/src/app/AppMenuBar.tsx) — в меню «Вид» секция
  «Markdown» (`MenubarRadioGroup` Код/Предпросмотр/Рядом, disabled когда активная вкладка не md).
- [app/HelpDialogs.tsx](../../projects/reformer-builder/src/app/HelpDialogs.tsx) — новые строки в списке
  горячих клавиш.
- [io/fs-ops.ts](../../projects/reformer-builder/src/io/fs-ops.ts) — экспорт `resolveFileHandle`.
- [panels/FilesPanel.tsx](../../projects/reformer-builder/src/panels/FilesPanel.tsx) — пункт контекстного
  меню «Открыть предпросмотр» для `.md` (этап 5).
- [index.css](../../projects/reformer-builder/src/index.css) — `@plugin "@tailwindcss/typography";` +
  привязка `--tw-prose-*` к токенам кита.
- `package.json` — зависимости.

## Этапы

1. **Каркас**: зависимости + `MarkdownPreview` (GFM, typography, sanitize) + `mdView` в сторе +
   тулбар «Код / Предпросмотр». Проверка: открыть `README.md` проекта → рендер с таблицами и
   чек-листами.
2. **Split + команды**: режим «Рядом» на `ResizablePanelGroup`, хоткеи `⇧⌘V` / `⌘K V`, пункты меню
   «Вид», строки в справке.
3. **Подсветка кода** через `monaco.editor.colorize` + `fenceLanguage()`.
4. **Синхроскролл**: `rehypeSourceLine`, якоря, двусторонняя синхронизация с защитой от эха.
5. **Якоря и ресурсы**: `rehype-slug`, клики по `#anchor` и по соседним `.md`, картинки по
   относительным путям, пункт «Открыть предпросмотр» в контекстном меню файлов.

## Верификация

Юнит-тесты (vitest, окружение `node` — jsdom и testing-library в проекте нет, поэтому только чистые
функции; файлы кладём рядом с исходниками как `*.test.ts`):

- `fence-language.test.ts` — `ts`/`tsx`/`bash`/`sh`/`json`/пустая info-строка/неизвестный язык.
- `scroll-sync.test.ts` — интерполяция в обе стороны, границы (до первого якоря, после последнего),
  пустой список якорей, один якорь.
- `resolve-asset.test.ts` — `./x.png`, `../a/b.png`, `/abs`, выход за корень, `http(s)`/`data:`.
- `is-markdown.test.ts` — `.md`, `.mdx`, `.markdown`, не-md.
- `reducers.test.ts` — `setMdView` меняет только целевую вкладку и не сбрасывает `preview: boolean`.

Команды (из `projects/reformer-builder`): `npm test`, `npm run lint`, `npm run build`
(`tsc -b && vite build` — ловит типы и то, что новые зависимости бандлятся).

Ручная проверка (File System Access API работает только в Chromium и требует пользовательского
жеста, e2e для builder'а в репозитории нет): `npm run dev` → открыть каталог репозитория → в панели
«Файлы» открыть `projects/reformer-builder/README.md` и любой файл из `docs/plans/` →

- переключение Код / Предпросмотр / Рядом мышью и хоткеями, режим запоминается для следующей
  md-вкладки;
- таблицы, чек-боксы, цитаты, зачёркивание рендерятся; тёмная и светлая темы читаемы;
- блоки кода подсвечены и совпадают по цветам с редактором слева;
- скролл редактора ведёт предпросмотр и наоборот, без дёрганья;
- клик по ссылке из оглавления прокручивает к заголовку; относительная ссылка на соседний `.md`
  открывает его вкладкой; картинки по относительным путям отображаются;
- правка текста слева сразу видна справа, `⌘S` по-прежнему сохраняет файл.

## Ограничения

- `.mdx` рендерится как обычный markdown: JSX-вставки не исполняются (показываются как текст либо
  вырезаются санитайзером). Для builder'а этого достаточно — исполнять чужой JSX в оболочке нельзя.
- Mermaid-диаграммы не рендерятся (блок кода с подсветкой). Отдельная зависимость, вне объёма.
- В режиме «Предпросмотр» Monaco размонтируется, поэтому его внутренний undo-стек и позиция курсора
  сбрасываются при возврате в «Код». Текст при этом не теряется — источник истины `tab.text` в сторе.
  Если это окажется неудобным, лечится позже удержанием редактора в DOM.
