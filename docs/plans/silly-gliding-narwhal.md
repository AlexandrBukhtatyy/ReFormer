# Шаблоны форм в reformer-builder

## Context

Сейчас генерация формы жёстко зашита в код: [form-templates.ts](../../projects/reformer-builder/src/app/form-templates.ts)
держит семь «рыб» (model / form.json / validation / form-behavior / render-behavior / registry /
index.tsx), а ПКМ в дереве файлов → «Сгенерировать → Каталог с формой…» открывает диалог с
чекбоксами этих семи файлов. Собственный RFC пакета фиксирует это как ограничение: «E8 Шаблоны
генерируемых файлов — код, расширяемо только форком».

На практике у команды складываются свои наборы файлов формы (свои секции, свой registry, свои
хелперы), и повторять их руками при каждой новой форме дорого. Нужно, чтобы шаблон был **данными**:
взял готовую форму в проекте → сохранил как шаблон → создаёшь из него новые формы, при этом имена
внутри файлов подставляются автоматически.

Итог: пункт «Каталог с формой…» превращается в «Выбрать шаблон…», в дереве появляется «Создать
шаблон…» по ПКМ на выделенных файлах, а в левом сайдбаре — третья вкладка «Шаблоны» рядом с
«Файлы» и «Палитра».

## Решения (согласованы)

- **Два хранилища**: проектное `.reformer/templates/<slug>/` (шарится через git, правится в IDE) и
  локальное в IndexedDB (не зависит от открытого проекта). В списке — одним потоком с бейджем
  источника; при создании выбираешь, куда сохранить.
- **Плейсхолдеры в содержимом**: при создании шаблона базовое имя (по умолчанию — имя папки-источника)
  заменяется на токены, при генерации — на новое имя формы в нужном регистре.
- **Встроенные «рыбы» остаются** как шаблон `builtin` «Форма ReFormer», и выбор подмножества файлов
  чекбоксами работает теперь для любого шаблона.

## Модель данных

Новый слой `src/templates/` — чистая логика (тестируется), без React и FS.

```ts
// templates/types.ts
export type TemplateSource = 'builtin' | 'project' | 'local';

/** Файл шаблона: путь относительно корня шаблона (может содержать плейсхолдеры) + текст. */
export interface TemplateFile { path: string; content: string }

export interface FormTemplate {
  id: string;                 // slug; для project — имя папки, для local — ключ в IDB
  name: string;
  description?: string;
  source: TemplateSource;
  files: TemplateFile[];
  createdAt?: string;
}
```

**Плейсхолдеры** (`templates/placeholders.ts`) — применяются и к содержимому, и к путям файлов:

| Токен | Подстановка для формы `user-profile` |
|---|---|
| `__FormName__` | `UserProfile` |
| `__formName__` | `userProfile` |
| `__form-name__` | `user-profile` |
| `__form_name__` | `user_profile` |

- `tokenize(text, baseName)` — заменяет все четыре написания `baseName` на токены (порядок замен: от
  длинных к коротким, чтобы `UserProfileForm` не разъехался).
- `materialize(text, formName)` — обратная подстановка.
- Обе идемпотентны и покрываются юнит-тестами (включая имя файла и случай, когда `baseName` пустой —
  тогда токенизация не выполняется).

## Хранилища

`templates/builtin.ts` — собирает `FormTemplate` из существующих функций `form-templates.ts`
(`modelTsTemplate` и т.д.), уже с токенами вместо имени формы. Правило «`index.tsx` тянет остальные
файлы» (`resolveFormDirFiles`) сохраняется только для builtin.

`io/template-repo.ts` — чтение/запись:
- **project**: обход `<templatesDir>/<slug>/` через FS Access. Каталог по умолчанию
  `.reformer/templates`, переопределяется новым `project.templatesDir` в runtime-config. Метаданные —
  `template.json` (`{version, name, description, baseName, createdAt}`); список файлов выводится
  обходом каталога (кроме `template.json`), чтобы не расходиться с диском.
- **local**: тот же IndexedDB, что и [handle-store.ts](../../projects/reformer-builder/src/io/handle-store.ts),
  версия БД поднимается до 2, добавляется objectStore `templates` (значение — весь `FormTemplate`).
  Хелперы `openDb`/`tx` из handle-store переиспользуются (вынести в общий `io/idb.ts`).

Переиспользуем готовое из [io/fs-ops.ts](../../projects/reformer-builder/src/io/fs-ops.ts):
`createFile`, `createDirectory`, `joinPath`, `uniqueName`, `existsIn`; из
[io/fs-access.ts](../../projects/reformer-builder/src/io/fs-access.ts): `readFile`. Добавить туда две
функции: `createFileDeep(root, dirPath, relPath, content)` (создаёт промежуточные каталоги — шаблон
может содержать подпапки) и `readDirFiles(root, dirPath)` (рекурсивный список файлов с содержимым).

`store/templates-store.ts` — по образцу [project-store.ts](../../projects/reformer-builder/src/store/project-store.ts)
(`createStore` + `useSyncExternalStore`): `{ items: FormTemplate[], loading, error }`, действие
`reloadTemplates()` (builtin + local всегда, project — если проект открыт). Вызывается после скана
проекта в `save-actions.scan()` и после создания/удаления шаблона.

## Действия

`app/template-actions.ts` (мост store↔io↔тосты, по образцу `save-actions.ts`):

- `createTemplateFrom(paths: string[], opts: {name, description, baseName, target: 'project'|'local'})` —
  читает выбранные файлы (папки — рекурсивно), вычисляет общий префикс путей и делает пути
  относительными, токенизирует содержимое и имена, сохраняет в выбранное хранилище, перечитывает
  список, тост.
- `generateFromTemplate(parentPath, formName, template, picked: Set<string>)` — `uniqueName` для папки,
  `createFileDeep` на каждый выбранный файл с `materialize`, затем `rescanProject()`, открыть первый
  файл, распознанный как схема формы (`isFormSchema`), в canvas, тост. Повторяет структуру
  существующей `generateFormDirectory`, которая после этого удаляется (её место занимает builtin-шаблон).
- `deleteTemplate(t)` / `renameTemplate(t, name)`.

## UI

**Левый сайдбар** — новая вкладка:
- `LeftPanel` в [store/types.ts](../../projects/reformer-builder/src/store/types.ts) → `'files' | 'palette' | 'templates' | null`;
  то же в `UiConfig.leftPanel` ([config/types.ts](../../projects/reformer-builder/src/config/types.ts)) и в
  enum `ui.leftPanel` в [runtime-config.schema.json](../../projects/reformer-builder/src/config/runtime-config.schema.json).
- В [EditorLayout.tsx](../../projects/reformer-builder/src/app/EditorLayout.tsx) — третья кнопка рейла
  и ветка заголовка/содержимого панели (сейчас там тернарник `files ? … : …` — переписать на map по
  виду панели, чтобы не плодить вложенные тернарники). Пункт в меню «Вид»
  ([AppMenuBar.tsx](../../projects/reformer-builder/src/app/AppMenuBar.tsx)) — рядом с «Файлы»/«Палитра».
- `panels/TemplatesPanel.tsx` — список шаблонов (бейдж источника: встроенный / проект / локальный),
  раскрытие состава файлов, действия по ПКМ и кнопкой: «Создать форму…», «Переименовать…», «Удалить»
  (последние два — не для builtin). Разметка и `ScrollArea`/`ContextMenu` — как в `FilesPanel`.

**Диалоги** ([panels/FilesDialogs.tsx](../../projects/reformer-builder/src/panels/FilesDialogs.tsx), в
том же `FilesDialog`-union):
- `{ kind: 'template', dirPath }` — «Выбрать шаблон»: список шаблонов (radio) + имя формы + чекбоксы
  файлов выбранного шаблона (для builtin — с текущим правилом зависимостей). Заменяет `formDir`-диалог,
  `FormDirBody` переезжает в этот вид.
- `{ kind: 'newTemplate', paths }` — «Создать шаблон»: имя, описание, базовое имя для токенизации
  (предзаполнено именем общей папки), радио «в проект / локально», превью списка файлов.

**Дерево файлов** ([panels/FilesPanel.tsx](../../projects/reformer-builder/src/panels/FilesPanel.tsx)):
- Мульти-выбор: новое состояние `selectedPaths: Set<string>` рядом с существующим `selectedPath`
  (он остаётся курсором клавиатурной навигации). Обычный клик — как сейчас (открыть + одиночный
  выбор), ⌘/Ctrl+клик — тоггл в наборе без открытия, ⇧+клик — диапазон по уже посчитанному
  `navPaths`. Подсветка набора — тем же `bg-accent`.
- ПКМ: пункт «Создать шаблон…» — если клик по строке из набора, берётся весь набор; иначе набор
  сбрасывается на эту строку (папка → все её файлы рекурсивно).
- В подменю «Сгенерировать» пункт «Каталог с формой…» → «Выбрать шаблон…» (`kind: 'template'`);
  одиночные пункты «Модель», «Схема формы» и т.д. остаются как есть.

## Файлы

Новые: `src/templates/{types,placeholders,builtin,index}.ts`, `src/io/{template-repo,idb}.ts`,
`src/store/templates-store.ts`, `src/app/template-actions.ts`, `src/panels/TemplatesPanel.tsx`.

Изменяемые: `panels/FilesPanel.tsx`, `panels/FilesDialogs.tsx`, `app/EditorLayout.tsx`,
`app/AppMenuBar.tsx`, `app/save-actions.ts` (удалить `generateFormDirectory`, дёрнуть
`reloadTemplates` после скана), `io/fs-ops.ts`, `io/fs-access.ts`, `io/handle-store.ts`,
`store/types.ts`, `config/types.ts`, `config/runtime-config.schema.json`, `README.md` (раздел про
шаблоны), `app/HelpDialogs.tsx` (если добавим шорткат на панель — иначе не трогаем).

## Порядок работы

1. `templates/` + `placeholders` с тестами — фундамент без UI.
2. `io/idb.ts` + `io/template-repo.ts` + `fs-ops` хелперы; `templates-store`.
3. `template-actions` (создание/генерация/удаление), удаление `generateFormDirectory`.
4. Диалоги «Выбрать шаблон» / «Создать шаблон»; переключение пункта ПКМ.
5. Мульти-выбор в дереве.
6. Панель «Шаблоны» + вкладка в рейле/меню/конфиге.

## Верификация

- `cd projects/reformer-builder && npx vitest run` — новые тесты: `placeholders` (все четыре регистра,
  идемпотентность, пустое базовое имя), сборка шаблона из набора путей (общий префикс, вложенные
  папки), `reducers`/`initial-ui` на `leftPanel: 'templates'`, валидность runtime-config с новым enum.
- `npx tsc --noEmit -p tsconfig.json` и `npx eslint src` — чисто.
- Живой прогон (`npx vite --port 5271`, playwright MCP): панель «Шаблоны» открывается из рейла и меню
  «Вид», встроенный шаблон в списке, диалог «Выбрать шаблон» показывает состав файлов и чекбоксы.
- Проверка на реальном проекте — вручную: File System Access требует нативного пикера каталога,
  который автоматизацией не проходится. Сценарий: открыть проект → выделить файлы формы ⌘-кликом →
  ПКМ «Создать шаблон…» (в проект) → убедиться, что появилась `.reformer/templates/<slug>/` с токенами
  внутри → ПКМ на папке → «Сгенерировать → Выбрать шаблон…» → новая форма с подставленными именами
  открывается в canvas. Скриншоты — в `projects/react-playground-e2e/screenshots/builder-templates/`.

## Риски

- **Бинарные файлы** в наборе (картинки, шрифты): читаем как текст. Отсекать на этапе создания
  шаблона по расширению и предупреждать тостом, что такие файлы пропущены.
- **Ложные срабатывания токенизации**: если базовое имя короткое или общеупотребимое (`form`, `data`),
  подстановка испортит содержимое. Базовое имя редактируется в диалоге, плюс предупреждение при длине
  меньше 4 символов; полностью пустое — токенизация выключена.
- **Миграция IndexedDB** до версии 2 выполняется в `onupgradeneeded` и не трогает существующий
  `handles` — сохранённый handle каталога переживает обновление.
