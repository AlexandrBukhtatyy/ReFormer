# Билдер в рамке: встраивание без сборки на стороне приложения

## Context

Встроенный билдер (эпик ReFormer-9tk6, влит в `develop`) работает, но подключать его тяжело.
Он монтируется в дерево React приложения, поэтому сборщик приложения компилирует его исходники,
а плагины приезжают отдельным статическим каталогом. Цена первого запуска:

- псевдонимы исходников в `vite.config` и те же псевдонимы в `paths` у `tsconfig`;
- Tailwind v4 в сборке приложения, React 19, занятый билдером псевдоним `@`;
- `plugins:dist` и сбор каталога в `public/builder-plugins` — заново после каждой правки плагина;
- стили билдера и приложения действуют друг на друга, пока открыт оверлей.

Конфиг уровня запуска (`.ui_builder/config.json`: `preset`, профили, `plugins.enable/disable`,
умолчания) встроенный билдер не читает вовсе: его отдаёт лаунчер, а лаунчера здесь нет.

Что нужно получить:

1. Встроенный режим работает с каталогом `.ui_builder/` так же, как своя вкладка.
2. Приложению не нужно ни компилировать билдер, ни собирать каталог плагинов.
3. Плагины разрабатываются так же, как в своей вкладке.

Решения, принятые с пользователем:

- билдер открывается в рамке (iframe) поверх приложения, с того же адреса;
- раздаёт его dev-сервер приложения через плагин Vite — одна строка в `vite.config`;
- плагины — как у `npx reformer-builder`: стандартные едут с билдером, свои лежат
  в `.ui_builder/plugins` приложения;
- имя каталога остаётся `.ui_builder`, доступ к файлам — File System Access, как сейчас.

## Целевая схема

```
страница приложения (верхний документ, адрес dev-сервера приложения)
 ├─ приложение
 ├─ <ReformerBuilder> — лёгкий компонент: кнопка «Билдер»; в рамке превью — стенд формы
 └─ рамка «reformer-builder-shell»  →  /__reformer-builder/
        тот же вход, что у `npx reformer-builder` (main.tsx)
        └─ панель «Превью»: рамка «reformer-builder-preview» → страница приложения или стенд

dev-сервер приложения + плагин reformerBuilder():
  /__reformer-builder/runtime.json   ← <корень>/.ui_builder/config.json + признак embedded
  /__reformer-builder/plugins/*      ← плагины приложения: живой каталог либо поставка
  /__reformer-builder/*              ← билдер: исходники (монорепозиторий) либо готовая сборка
```

Плагину билдера всё равно, в каком документе работает оболочка: его файлы читаются текстом
и связываются загрузчиком оболочки. Поэтому плагины не меняются.

Подключение со стороны приложения — было и станет:

```ts
// vite.config.ts — было
plugins: [react(), tailwindcss()],
resolve: builderHostResolve(),            // + шесть путей в tsconfig, + public/builder-plugins

// станет
plugins: [react(), reformerBuilder()],
```

```tsx
// main.tsx — проп pluginsUrl исчезает, остальное как было
<AppProviders><ReformerBuilder><App /></ReformerBuilder></AppProviders>
```

| Требование | Чем закрывается |
| --- | --- |
| `.ui_builder/` как в своей вкладке | вход один и тот же; конфиг запуска отдаёт плагин Vite из корня приложения |
| приложение не компилирует билдер | билдер в своём документе: ни псевдонимов, ни Tailwind, ни `paths`, ни React 19 |
| билдер не собирается в монорепозитории | плагин отдаёт его из исходников вложенным dev-сервером, с HMR |
| разработка плагинов | свои — в `.ui_builder/plugins` приложения, тем же кодом, что в своей вкладке; стандартные — живьём из каталога playground |

Предпосылки те же, что у `npm run builder -w reformer-builder-playground`, и они остаются:
`dist` пакетов ядра (`@reformer/core`, `cdk`, `renderer-*`, `ui-kit`, `form-registry`)
и сборка плагинов на месте (`plugins:build`).

## Шаги

После каждого шага зелёными остаются `npm run test -w @reformer/builder`,
`npm run lint -w @reformer/builder` и e2e цели `dev`.

### Ш0. Общий серверный код без побочных действий

Лаунчер запускает сервер при импорте и зовёт `process.exit`, поэтому плагин Vite не может
взять его как есть. Поведение на этом шаге не меняется.

- `projects/reformer-builder/bin/static.mjs` — из `bin/reformer-builder.mjs`: `resolveFsPath`,
  `etagOf`, `matchesEtag`, `sendFile`, раздача каталога.
- `bin/runtime-bundle.mjs` — чтение `.ui_builder/config.json` без `process.exit`.
- `bin/plugins-index.mjs` — `buildPluginsIndex(rootDir, { include, skipDirs })` и раздача
  каталога плагинов.
- Лаунчер и `devRuntimeConfig()` в `vite.config.ts` переходят на эти модули.

Проверка: `src/shell/boot/launcher.test.ts` и новые случаи — список включения, пропуск
`src`/`dist`, несобранный плагин.

### Ш1. Плагин Vite и окружение «рядом с приложением»

Только добавление: старое встраивание продолжает работать.

- **Проба в начале шага.** Вложенный `createServer` в режиме middleware под префиксом
  `/__reformer-builder/`, сокет HMR на http-сервере приложения, свой `cacheDir`. Это выведено
  из исходников Vite 7.2.6, а не проверено запуском. Запасной путь — прокси на отдельно
  запущенный dev-сервер билдера.
- `vite/endpoints.mjs` — чистый обработчик: перенаправление на адрес со слэшем,
  `runtime.json`, индекс и файлы плагинов, делегирование интерфейса.
- `vite/plugin.mjs` и `plugin.d.mts` — `reformerBuilder({ config?, plugins?, ui? })`, только
  для dev-сервера; `exports["./vite"]` в `package.json`.
- Набор плагинов — `application-plugins.embedded.json` (корень и список): раздаётся живой
  каталог playground со сборками на месте. Несобранный плагин — предупреждение в терминале
  с командой сборки, а не молчание.
- Оболочка:
  - `src/shell/boot/runtime-config.ts` читает из ответа признак `embedded`. Его ставит
    сервер: по имени рамки судить нельзя — адрес билдера, открытый вкладкой, получил бы право
    стереть хранилище приложения;
  - `src/shell/embedded/environment.ts` — как у вкладки, но без `purgeStorage` и с
    `AppPreviewCapability` (адрес приложения — `window.parent.location` в рамке, иначе корень
    источника);
  - слежение за сохранениями из `shell/embedded/runtime.tsx` переезжает
    в `shell/embedded/source-writes.ts`;
  - `src/main.tsx` выбирает окружение по признаку.

Проверка: `http://localhost:5175/__reformer-builder/` вкладкой — действует конфиг образца,
плагины идут из каталога playground, работает HMR билдера, нет «Очистить кэш», есть выбор
профиля. Тесты: node-тест обработчика, переписанный `shell/boot/integration/embedded-shell.test.ts`.

### Ш2. Лёгкий клиент с рамкой, образец, e2e

- `src/client/` — импортирует только `react`:
  - `ReformerBuilder.tsx` — кнопка; в рамке превью рисует приложение или стенд формы;
  - `shell-frame.ts` — одна рамка на страницу. Создаётся на `document.body` и при закрытии
    скрывается, а не снимается: перемонтирование приложения не уносит состояние билдера.
    При открытии фокус уходит в рамку, а `focus` верхнего окна пересылается в неё — иначе
    Ctrl+S достанется браузеру, а возврат из IDE не перезагрузит плагин «в разработке»;
  - `addresses.ts` — чистая половина `preview-address.ts` (`isPreviewFrame`, `standRequest`,
    `moduleUrlOf`);
  - `FormStand.tsx`, `mode.ts`, `reload-hold.ts` переносятся как есть.
- `src/index.ts` — реэкспорт клиента; `exports["."]`; зона линтера `src/client/**`
  (`projects/reformer-builder/eslint.config.js`); тест чистоты импортов.
- Образец `projects/reformer-builder-host-example`: `vite.config.ts` без `resolve`,
  `tsconfig.app.json` без `paths`, `main.tsx` без `pluginsUrl`, новый `.ui_builder/config.json`,
  `predev` со сборкой плагинов на месте.
- e2e `projects/reformer-builder-playground-e2e/tests/embedded/`:
  - `tests/shared/builder-app.pom.ts` принимает корень `Page | FrameLocator`;
  - `shared/host-app.pom.ts` — панель и рамка превью внутри рамки оболочки;
  - `shared/host-disk.ts` — зеркало записи пропускает только рамку превью (сейчас оно
    выходит во всех рамках, а писать теперь будет рамка билдера);
  - `shared/serve-host.mjs` — сборка плагинов на месте вместо `plugins:dist` и сбора.
- Новые e2e: конфиг запуска действует; плагин из `.ui_builder/plugins` приложения поднимается
  и перезагружается по пометке «в разработке»; стили приложения и билдера не пересекаются.
- Браузерные тесты клиента переписываются под рамку.

### Ш3. Удаление старого встраивания и документы

- Удаляются `src/embedded-runtime.ts`, `shell/embedded/runtime.tsx`, `document-presence.ts`
  с тестом, `ReformerBuilderFrame.tsx`, `builderHostResolve` и `BUILDER_ENTRY`
  из `vite/source-resolve.mjs`, скрипт `builder:plugins`, каталог `public/builder-plugins`.
- Документы: `projects/reformer-builder/docs/embedding.md`, раздел «Внутри своего приложения»
  в `README.md`, `docs/project-structure.md`, новая запись в `docs/decisions-log.md`, README
  образца и e2e.

### Ш4. Готовая сборка под префиксом

Пакет `@reformer/builder` уже публикуется готовой сборкой с `base: '/'`
(`.github/workflows/release.yml`). Смена базы меняет опубликованный артефакт, поэтому шаг
отдельный.

- `base: './'` для сборки; dev остаётся на `/`, `BUILDER_BASE` — переопределением.
- `scripts/collect-application-plugins.mjs` пишет один каталог и два индекса: обычный
  и встроенный.
- `ui: 'auto'` в плагине: исходники, если рядом есть `src/main.tsx`, иначе `dist`.
- `files` пакета: `vite`, `src/index.ts`, `src/client`, списки плагинов.

Проверка: `test:e2e:dist` и цель `embedded` с готовой сборкой.

### Ш5. Живой слой плагинов приложения

Без этого шага стандартный плагин после пересборки подхватывается перезагрузкой страницы,
как у `--plugins` лаунчера. Шаг даёт то же, что есть в своей вкладке: перезагрузку
по возврату фокуса.

- Живой индекс несёт ревизии каталогов плагинов.
- По фокусу оболочка перечитывает индекс и перезагружает изменившиеся плагины
  (`catalog.refresh()`, затем `reload` включённым и `enable` упавшим).
- Запись в журнале решений: у слоя приложения меняется инвариант «файлы под работающим
  плагином не меняются». Заодно закрывается ReFormer-eeq0.9.

Шаг отделим: требования 1 и 2 закрыты шагами 0–4.

## Что переиспользуется

| Что | Где |
| --- | --- |
| Вход, сборка, слои плагинов, конфиг запуска | `src/main.tsx`, `shell/boot/boot.ts`, `launchFromRuntime` — без изменений по сути |
| Отрисовка | `mountStandaloneShell` (`shell/standalone/mount.tsx`) |
| Слой плагинов по HTTP | `loadApplicationFiles` (`shell/platform/plugin/application/files.ts`) |
| Адреса превью и событие записи | `createAppPreviewService`, `createSourceWriteSignal` (`shell/embedded/preview-address.ts`) |
| Стенд формы, режим, удержание перезагрузки | `FormStand.tsx`, `mode.ts`, `reload-hold.ts` |
| Раздача статики и индекс плагинов | `bin/reformer-builder.mjs`, `bin/plugins-index.mjs` |
| Плагины «в разработке» | `shell/platform/plugin/dev-watch.ts` |
| «Диск» e2e | `tests/shared/playground-disk.ts` |

## Риски

| Риск | Что делается |
| --- | --- |
| Вложенный dev-сервер ведёт себя не так, как следует из исходников Vite | проба в начале Ш1; запасной путь через прокси |
| Долгое первое открытие: холодная оптимизация зависимостей билдера | прогрев входа, увеличенный таймаут первого открытия в e2e |
| Выбор папки из рамки автотест не подтверждает: диалог в нём подменён | ручная проверка (ReFormer-9tk6.9) входит в приёмку Ш2 |
| `tsc` приложения проверяет исходники клиента своими настройками | клиент пишется без зависимостей от окружения; `typecheck` образца в приёмке |
| Перезагрузка верхней страницы уносит рамку | удержание перезагрузки остаётся; режим, проект и вкладки поднимаются сами |
| Относительная база ломает опубликованный билдер | отдельный шаг Ш4 с `test:e2e:dist` |

## Проверка

```bash
npm run test -w @reformer/builder && npm run lint -w @reformer/builder
npm run typecheck -w reformer-builder-host-example
cd projects/reformer-builder-playground-e2e
npx playwright test                                   # цель dev
BUILDER_E2E_TARGET=embedded npx playwright test       # встроенный билдер
BUILDER_E2E_TARGET=dist npx playwright test           # после Ш4
```

Вручную: `npm run dev -w reformer-builder-host-example`, `http://localhost:5175/contact`,
кнопка «Билдер», «Открыть папку…» настоящим диалогом, правка формы и сохранение, превью
в режимах «Форма» и «Приложение», закрытие билдера. Снимки —
в `projects/react-playground-e2e/screenshots/builder-frame/`.

## Порядок работы

- Эпик «Билдер в рамке» и задачи по шагам в beads. ReFormer-t51r сужается: изоляцию стилей
  и псевдонимы закрывает рамка, остаются публикация и пространство имён хранилищ.
  ReFormer-9tk6.9 переходит в приёмку Ш2.
- Ветка `feature/builder-frame` от `develop`.
- Коммитов нет до явной просьбы.

## Не входит

- Публикация встраивания в npm и скомпилированный клиент (ReFormer-t51r).
- Файлы проекта через dev-сервер вместо выбора папки.
- Сборщики, отличные от Vite.
- Компиляция плагинов из исходников на лету.
