# «Очистить кэш» во встроенном билдере: пространство имён хранилищ

## Контекст

Команда «Очистить кэш» (меню «Файл», `host.storage.purge`) есть только у билдера в своей вкладке.
Во встроенном режиме (билдер раздаёт vite-плагин приложения под `/__reformer-builder/`, origin
общий с приложением) окружение `createEmbeddedEnvironment` намеренно не даёт `purgeStorage`,
и ни команда, ни пункт меню не появляются. Причина: текущая очистка `purgeOriginStorage` сносит
**весь origin** — все записи корня OPFS, все базы IndexedDB, Cache Storage и `*Storage.clear()`.
На общем origin это стёрло бы данные приложения (например, `reformer-forms/v1` в OPFS и базу
`reformer-forms_v1` у приложения с `@reformer/form-registry/storage`).

Пользователю кнопка нужна и во встроенном режиме. Единого сервиса хранилищ, куда можно было бы
«добавить очистку», нет: плагины браузерные хранилища не трогают вовсе (всё идёт через
`SettingsService` внутри базы билдера и через рабочую область в OPFS), а `ctx.storage` плагинов
в бою пока in-memory. Заводить сервис ради одной кнопки — лишнее.

**Решение:** у билдера появляется своё пространство имён на источнике, а очистка во встроенном
режиме сносит «всё, что под пространством имён» — без списка, который протухает. Во вкладке
очистка остаётся origin-wide (там origin свой, и сметать чужие кэши движков — правильно).

Что уже в пространстве имён: базы `reformer-builder.workspace`, `reformer-builder.handles`, ключ
`sessionStorage['reformer-builder.mode']`. Что нет: три каталога OPFS `ws/`, `build/`, `plugins/`
лежат в корне origin сиблингами с общими именами и создаются тремя копиями `defaultDirectory()`.
Журнал решений уже называет «пространство имён хранилищ» открытым вопросом
(`docs/decisions-log.md:4909-4911`, `docs/embedding.md:357-358`).

**Принято пользователем:** существующие данные старой раскладки переносятся одноразовой
миграцией при старте (`ws/` и `plugins/` копируются под новый корень, `build/` удаляется как кэш).

## Шаги

### 1. Модуль пространства имён — `src/shell/platform/workspace/storage/namespace.ts` (новый)

Единственное место, где сказано, что билдер считает своим на источнике:

- `STORAGE_NAMESPACE = 'reformer-builder'`; `STORAGE_NAME_PREFIX = 'reformer-builder.'`
  (базы IndexedDB, ключи web-storage, ключи Cache Storage); `OPFS_ROOT_DIR = 'reformer-builder'`.
- `builderStorageScope: PurgeScope` — предикат «запись наша»: для `opfs` — `name === OPFS_ROOT_DIR`,
  для остальных областей — `name.startsWith(STORAGE_NAME_PREFIX)`.
- `opfsSupported()` переезжает сюда из `opfs.ts:182`; `opfs.ts` его реэкспортирует
  (`export { opfsSupported } from './namespace'`), чтобы импорты не менялись.
- `createBuilderDirectoryProvider(origin: OpfsDirectoryProvider): OpfsDirectoryProvider` —
  фабрика провайдера, который резолвит корень origin → `getDirectoryHandle(OPFS_ROOT_DIR, { create: true })`,
  перед первым ответом один раз зовёт `adoptLegacyLayout` (шаг 2), результат мемоизирует, при отказе
  мемо сбрасывает (тот же приём, что у `rootPromise` в `build-cache.ts:150`). Все три хранилища
  ждут один и тот же промис, поэтому миграция внутри одной страницы не гоняется сама с собой.
- `builderDirectory: OpfsDirectoryProvider` — боевой экземпляр над `navigator.storage.getDirectory()`;
  без OPFS бросает `StorageError('opfs-unavailable', …)` из `./errors` (как `opfs.ts:199-205`).

Импорты: `import type { OpfsDirectoryHandle, OpfsDirectoryProvider } from './opfs'`, `StorageError`
из `./errors`, `PurgeScope`/`PurgeArea` из `./purge`. Цикла по значениям нет: `opfs.ts` импортирует
значение из `namespace.ts`, обратно идут только типы.

Шапка модуля — соглашение: всё, что билдер (и будущий IndexedDB-бэкенд `plugin/storage.ts`, Э2)
кладёт на источник, живёт под этим пространством имён — именно это делает очистку безсписочной.

### 2. Миграция старой раскладки — `storage/legacy-layout.ts` (новый)

`adoptLegacyLayout(origin: OpfsDirectoryHandle, target: OpfsDirectoryHandle): Promise<void>` —
идемпотентно, не бросает (отказ → `console.warn('[storage] …')`, старое остаётся до следующего старта):

- `ws/` → `target/ws/`: переносятся только дети, в которых есть каталог `files` или `base`
  (наша раскладка `layout.ts`); копирование «файл за файлом, пропускать существующие» — безопасно
  при обрыве и при двух вкладках одновременно; после полного копирования `origin.removeEntry('ws', { recursive: true })`.
- `plugins/` → `target/plugins/`: только если в корне есть `installed.json`
  (`INSTALLED_STATE_FILE`, `plugin/installed/store.ts:39`); иначе каталог чужой, не трогать.
- `build/`: удалить, если каждый дочерний каталог содержит `v1` (`BUILD_CACHE_VERSION`,
  `build-cache.ts:58`); иначе оставить и предупредить.
- Копия файла: `getFile()` → `arrayBuffer()` → `getFileHandle(name, { create: true })` →
  `createWritable()` → `write` → `close`. `createWritable` в структурном типе необязателен
  (`opfs.ts:80-86`): его нет — предупредить и оставить старое на месте.
- OPFS без циклов, лимит обхода не нужен; `NotFoundError` при `removeEntry` (вторая вкладка
  успела раньше) — норма, не отказ.

### 3. Три хранилища — через общий корень

Заменить три копии `defaultDirectory()` на `builderDirectory` из шага 1; константы подкаталогов
(`ws`, `build`, `plugins`) не меняются — они теперь относительны `reformer-builder/`:

- `storage/opfs.ts:199-205` (`createWorkspaceFileStore`, `listStoredWorkspaces:490`).
- `storage/build-cache.ts:132-135` (`createBuildCacheStore`).
- `plugin/installed/store.ts:100-105` (`createInstalledPluginStore`).

Боевые вызовы (`boot.ts:677`, `boot.ts:740`, `boot/project/project.ts:205`) опций не передают
и подхватывают новый дефолт сами. Тесты хранилищ передают `directory` явно (`createMemoryOpfs`)
и не зависят от дефолта — проверить `opfs.test.ts`, `build-cache.test.ts`, `installed/store.test.ts`.

### 4. Очистка по области видимости — `storage/purge.ts`

- Новые типы: `PurgeScope = (area: PurgeArea, name: string) => boolean`.
- `purgeOriginStorage(env, scope: PurgeScope | null = null)`: `null` — весь origin (поведение
  и тесты как сейчас); предикат — трогаются только записи, где он `true`:
  - `purgeOpfs` (L138-169): фильтр `names` по `scope('opfs', name)`;
  - `purgeIndexedDb`/`databaseNames` (L172-215): фильтр и ответа `databases()`, и `knownDatabases`
    (Safari без перечисления → удаляются только известные базы с префиксом);
  - `purgeCaches` (L249-268): фильтр ключей;
  - `purgeWebStorage` (L277-286): `PurgeWebStorage` получает `keys(): readonly string[]` и
    `removeItem(key): void`; при `scope === null` — `clear()` как сейчас, иначе — `removeItem`
    по подходящим ключам (`removed` считает по ключам). `browserPurgeEnvironment` (L303-345)
    наполняет новые методы из `Storage.length/key(i)/removeItem`.
- Шапка модуля: к разделу «почему сносится всё, а не перечисленное» добавить «пространство имён —
  не список»: во встроенном режиме origin чужой, и граница проходит по соглашению из `namespace.ts`,
  которое держит один провайдер корня, а не перечень имён.

### 5. Встроенное окружение — `src/shell/embedded/environment.ts`

```ts
purgeStorage: (known) =>
  purgeOriginStorage(
    browserPurgeEnvironment({ knownDatabases: known.databases }),
    builderStorageScope
  ),
```

Шапка (L11-14): пункт «очистки хранилища нет» → «очистка только своего пространства имён:
источник общий с приложением, чужое не трогается». `reload` уже есть (`tab.reload`), поэтому
`boot.ts:1352-1365` соберёт порт `storage` без правок, а `Shell.tsx:880-904, 965-982`
зарегистрирует команду и пункт «Файл → Очистить кэш» сам. UI и i18n не меняются: текст
подтверждения (`shell.storage.purge.confirm.description`) перечисляет рабочие копии, кэш сборки,
настройки, вкладки и плагины — ровно то, что снесёт и scoped-очистка.

Документация к `purgeStorage` в `boot/environment.ts:72-78` и `docs/embedding.md:232-233`: «метод
есть только у оболочки со своим источником» → «что именно сносится — весь origin или своё
пространство имён — решает окружение».

### 6. Осознанные следствия (в журнал решений и шапки)

- `sessionStorage['reformer-builder.mode']` (`src/client/mode.ts:24`) попадает под префикс и
  стирается: билдер в рамке перезагрузит свой документ и останется виден, но после перезагрузки
  страницы приложения оверлей будет выключен, пока его не включат снова. Исключение для одного
  ключа — тот самый список, которого избегаем; принимаем. В `mode.ts` — комментарий о соглашении
  (клиент не импортирует оболочку, константу не тянем).
- `reformer-forms*` (превью приложением) и любые ключи приложения во встроенном режиме не трогаются.
- Во вкладке очистка остаётся origin-wide: старые каталоги, не подхваченные миграцией, она тоже снесёт.

## Тесты

| Файл | Что проверить |
| --- | --- |
| `storage/namespace.test.ts` (новый) | провайдер отдаёт `reformer-builder/` внутри корня; мемоизация; отказ сбрасывает мемо; `opfsSupported` |
| `storage/legacy-layout.test.ts` (новый, на `createMemoryOpfs`) | `ws/w1/files/*` и `plugins/installed.json` переезжают, старое удалено; `build/x/v1` удалён; повторный запуск — no-op; частичная копия доделывается без перезаписи; чужие `ws/foo` без `files|base`, `plugins/` без `installed.json`, `build/` без `v1` остаются; нет `createWritable` → старое на месте |
| `storage/purge.test.ts` | scoped: из OPFS уходит только `reformer-builder`, `reformer-forms` остаётся; базы — только с префиксом, в т. ч. при `databases()` отсутствующем (`knownDatabases` фильтруется); ключи кэша фильтруются; web-storage — `removeItem` по своим ключам, чужие целы, `clear` не зовётся; `scope = null` — существующие кейсы без изменений (фейкам `PurgeWebStorage` L156-169 добавить `keys`/`removeItem`) |
| `boot/integration/embedded-shell.test.ts:150-155` | кейс «очистки хранилища нет» → «очистка есть и трогает только своё»: `started.storage` определён; `stubBrowser` расширить `navigator.storage.getDirectory` (память с `reformer-builder/` и `reformer-forms/`), `sessionStorage`-двойником (`reformer-builder.mode`, `host.key`) и `databases`/`deleteDatabase` поверх `createMemoryIndexedDb().factory` (у двойника их нет — `testing.ts:579-610`); после `purge()` чужое на месте. Шапка теста (L9-11) — поправить |
| `ui/dialogs/StoragePurge.browser.test.tsx`, `ui/dialogs/storage-purge.test.ts` | без изменений, прогнать |

## Документация и учёт

- `docs/embedding.md:244` — строка таблицы: «есть: только своё пространство имён `reformer-builder`»;
  `:357-358` — пункт «не сделано: своего пространства имён» убрать; к `:232-233` — новый комментарий.
- `docs/core-contracts.md:319-331` — схема раскладки: `OPFS └── reformer-builder/ ├── ws/{id}/ ├── build/{id}/v1/ └── plugins/`,
  у баз IndexedDB — префикс `reformer-builder.`.
- `docs/decisions-log.md` — новая запись в стиле соседних (`## Заголовок`, абзацы с 🔀/⚠️):
  почему пространство имён, а не список и не сервис; миграция с маркерами; следствие для `mode`.
- Задача: `bd create "Очистка кэша во встроенном билдере: пространство имён хранилищ" -d "…"`,
  затем `bd update <id> --claim`; id — в запись журнала. Коммит/push — только по явной просьбе.

## Проверка

```bash
cd projects/reformer-builder
npx tsc -b            # только из каталога пакета
npm test              # unit (node): purge, namespace, legacy-layout, embedded-shell
npm run test:browser  # StoragePurge.browser и браузерные тесты хранилищ
npm run lint
```

Вручную:

1. **Встроенный режим.** До обновления открыть билдер в `reformer-builder-host-example`
   (`npm run dev`, порт 5175), создать правку в рабочей копии, в DevTools → Application → Storage
   запомнить `ws/`, `build/`, `plugins/` в корне OPFS. После обновления: при старте появился
   `reformer-builder/{ws,plugins}`, старые каталоги исчезли, правка на месте. В меню «Файл» есть
   «Очистить кэш»; после подтверждения билдер перезагрузился, `reformer-builder/` и базы
   `reformer-builder.*` пусты, а `reformer-forms*` и ключи приложения целы.
2. **Вкладка.** `npm run builder` в `reformer-builder-playground` (порт 5184): очистка по-прежнему
   сносит всё на origin.
3. Скриншоты playwright MCP — в `projects/react-playground-e2e/screenshots/storage-purge-embedded/`.
