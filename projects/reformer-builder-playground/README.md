# reformer-builder-playground

Проект-образец для [`@reformer/builder`](../reformer-builder): каталог, который билдер открывает
как рабочий. У него две роли:

- **фикстура e2e** — [`reformer-builder-playground-e2e`](../reformer-builder-playground-e2e)
  открывает его в каждом тесте;
- **песочница** — на нём руками пробуют плагины, конфиги и формы, не заводя для этого
  каталог в `.tmp/`.

В npm не публикуется.

## Состав

```text
reformer-builder-playground/
├── .ui_builder/                         всё, что читает билдер
│   ├── config.json                      конфиг: состав плагинов, заголовок, локаль, тема
│   ├── settings.json                    настройки проекта: включённые плагины
│   ├── presets/                         готовые конфиги запуска: движок × кит
│   └── plugins/                         плагины проекта — каждый отдельным npm-пакетом
│       ├── playground-hello/
│       │   ├── package.json             скрипты сборки: build:dev, build:dist
│       │   ├── src/                     исходники: manifest.json, main.ts, locales/
│       │   ├── manifest.json            ┐
│       │   ├── main.js                  ├ сборка для билдера (build:dev) — не в git
│       │   └── locales/                 ┘
│       └── kit-hexa-ui/                 кит HexaUI — так же: src/ и сборка в корне каталога
├── forms/
│   ├── contact/form.schema.json         форма ReFormer
│   └── contact.rjsf.json                форма RJSF (`rjsf-form/1`)
└── package.json                         скрипты: запуск билдера, сборка плагинов
```

## Запуск билдера на этом проекте

```bash
npm run builder -w reformer-builder-playground        # dev-сервер билдера, http://localhost:5184
npm run builder:dist -w reformer-builder-playground   # собранный билдер под лаунчером, тот же порт
```

Дальше в билдере — «Открыть папку…» и выбрать `projects/reformer-builder-playground`. Нужен
Chromium-браузер (File System Access API).

Каждый скрипт запуска сначала собирает плагины проекта (`plugins:build`, см. «Плагины»): билдер
грузит их сборку, а в git она не едет.

`builder:dist` берёт готовый `projects/reformer-builder/dist` — сначала
`npm run build -w @reformer/builder`.

Порт 5184 — общий с e2e: сервер, запущенный здесь заранее, прогон тестов переиспользует.

## Конфиг и настройки

В `.ui_builder/` два файла, и отвечают они на разные вопросы:

| Файл            | Вопрос                   | Кто пишет                                   |
| --------------- | ------------------------ | ------------------------------------------- |
| `config.json`   | каким собрать приложение | человек: состав плагинов, заголовок, локаль |
| `settings.json` | как настроен этот проект | билдер: включённые плагины, выданные права  |

`config.json` билдер читает дважды: лаунчер — до сборки приложения, само приложение — открыв
проект. Здесь это один и тот же файл, раскладка «запустил в корне проекта и его же открыл»:
`builder:dist` запускает лаунчер в этом каталоге, и тот находит конфиг сам; dev-серверу, который
живёт в каталоге билдера, его называет `REFORMER_BUILDER_CONFIG`.

`preset`, `profiles`, `presetChoices`, `plugins` и `defaults` применяются только на уровне запуска.
Пока в проекте они записаны так же, как в конфиге запуска, билдер молчит. Разошлись — например,
билдер запущен готовым конфигом из `presets/` — и при открытии проекта он предупреждает, что эти
поля конфига проекта не сработали.

## Готовые конфиги: движок × кит

В `.ui_builder/presets/` — четыре конфига запуска, по одному на сочетание движка и кита. Формат
тот же, что у `config.json`: `preset` и кит по умолчанию.

| Скрипт                    | Движок   | Кит              |
| ------------------------- | -------- | ---------------- |
| `preset:reformer-ui-kit`  | ReFormer | ReFormer UI Kit  |
| `preset:reformer-hexa-ui` | ReFormer | Kaspersky HexaUI |
| `preset:rjsf-ui-kit`      | RJSF     | ReFormer UI Kit  |
| `preset:rjsf-hexa-ui`     | RJSF     | Kaspersky HexaUI |

```bash
npm run preset:rjsf-hexa-ui -w reformer-builder-playground   # dev-сервер билдера, http://localhost:5174
```

Порт здесь обычный для dev билдера, 5174, а не 5184: на 5184 прогон e2e переиспользует
запущенный сервер, и готовый конфиг подменил бы состав, который ждут тесты.

Открыв под готовым конфигом этот же каталог, вы увидите предупреждение о `preset`, `profiles`
и `defaults`: `config.json` проекта просит состав playground, а запущен другой. Так и задумано.

Файлы с HexaUI называют кит, но не привозят его: кит — плагин проекта, см. «Плагины» ниже.
Подробности о составах — [composition.md](../reformer-builder/docs/composition.md) билдера; что
конфиги собирают именно своё сочетание, проверяет его тест `application/launch-presets.test.ts`.

## Плагины

Плагин, не входящий в состав билдера, — отдельный npm-пакет со своей сборкой. Пакеты плагинов
этого проекта лежат там же, где билдер их ищет, — в `.ui_builder/plugins/<id>/`, — и собираются
на месте. Сборок у пакета две, по скрипту на каждую:

| Скрипт       | Куда                    | Зачем                                           |
| ------------ | ----------------------- | ----------------------------------------------- |
| `build:dev`  | корень каталога плагина | её грузит билдер: `manifest.json`, `main.js`, … |
| `build:dist` | `dist/`                 | поставка: то, что идёт в архив пакета           |

Обе — один и тот же `reformer-plugin build src` с разным `--out`: разбор манифеста, один
`main.js`, «сухая» активация. Исходники вместе с их `manifest.json` лежат в `src/`. Собранное
в git не едет: сборку для билдера исключает `.gitignore` самого плагина.

```bash
npm run plugins:build -w reformer-builder-playground   # build:dev каждого пакета из .ui_builder/plugins
```

Пока плагин не собран, манифеста в корне его каталога нет, и билдер, открыв проект, скажет об этом
уведомлением «в каталоге … нет manifest.json». Скрипты запуска выше собирают плагины сами; если
билдер запущен иначе, после клона репозитория соберите их до того, как открывать каталог.
E2E собирает плагины перед каждым прогоном.

Сборку делает CLI автора плагина, а он работает из своего `dist/`. В свежем клоне его сначала
собирают — вместе с SDK:

```bash
npm run build -w @reformer/builder-plugin-api -w @reformer/builder-plugin-cli
```

### playground-hello

Шаблон `reformer-plugin create`: одна команда, подпись которой берётся из словаря плагина.
Включён настройкой проекта (`workspace.plugins.enabled` в `.ui_builder/settings.json`). Пакет —
workspace монорепозитория, скрипты у него свои:

```bash
npm run build:dev -w playground-hello    # сборка для билдера — в корень каталога плагина
npm run build:dist -w playground-hello   # сборка для поставки — в dist/
npm run dev -w playground-hello          # build:dev на каждое сохранение исходников
npm run validate -w playground-hello     # манифест и файлы — правилами оболочки
npm run typecheck -w playground-hello
npm test -w playground-hello
npm run pack -w playground-hello         # архив пакета для npm
```

Цикл правки: поменять исходник → `build:dev` → в палитре команд (`Ctrl+Shift+P`) «Плагины:
перезагрузить «Playground Hello»». Без ручных шагов — `npm run dev` в пакете и «Плагины:
наблюдать «Playground Hello» — режим разработки» в билдере: первый пересобирает на сохранение,
второй перечитывает плагин при возврате в окно.

### Новый плагин

Проще всего — от образца: скопировать каталог `playground-hello` под именем нового `id` (без
`node_modules` и собранного) и поменять `id` и `name` в `src/manifest.json`, `id` в
`src/main.ts` и `name` в `package.json`. Затем `npm install` в корне репозитория — пакет
подхватится как workspace — и `npm run build:dev -w <имя пакета>`. Включается плагин в списке
плагинов билдера или строкой в `.ui_builder/settings.json`.

### Кит HexaUI

Кит HexaUI — пакет `@reformer/kit-hexa-ui` в
[`.ui_builder/plugins/kit-hexa-ui`](.ui_builder/plugins/kit-hexa-ui): и сам кит (поля, обёртка
поля, провайдер темы, каталог компонентов), и плагин, который вносит его в билдер. Устроен как
`playground-hello` — `src/`, `build:dev`, `build:dist`, — только сборка его весит около 5 МБ:
внутри HexaUI с antd и styled-components.

```bash
npm run build:dev -w @reformer/kit-hexa-ui
```

Плагин включён заранее (`kit-hexa-ui` в `.ui_builder/settings.json`). Кит появляется в ячейке
«движок · кит» строки состояния и меняется на лету; готовые конфиги `*-hexa-ui` открывают его
сразу. Подробности — [README кита](.ui_builder/plugins/kit-hexa-ui/README.md).

## Что помнить

- **Каталог — фикстура.** e2e снимает с него копию перед каждым тестом, поэтому любое изменение
  здесь — изменение входных данных тестов. Поменяли форму, плагин или конфиг — прогоните
  `npm run test:e2e -w reformer-builder-playground-e2e`. В копию идёт то, что видит git,
  и сборка плагинов для билдера; каталог кита HexaUI берёт только тест самого кита.
- **Ручная работа меняет файлы.** Открытый руками проект билдер правит на диске: сохранённая
  форма, включённый плагин, подтверждённые права. Перед коммитом — `git status` на этот каталог.
- **`.ui_builder/settings.json` пишет билдер** — при каждом открытии, своим форматом. Файл
  исключён из prettier (`.prettierignore`), иначе открытие проекта давало бы diff.
- **Сборка плагинов исключена дважды.** `.gitignore` плагина prettier и ESLint не читают,
  поэтому те же файлы названы в корневых `.prettierignore` и `eslint.config.js`. Новый файл
  сборки в корне каталога плагина — строка и там.
