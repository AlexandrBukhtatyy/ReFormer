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
│   └── plugins/
│       ├── playground-hello/            плагин в разработке (исходники, без сборки)
│       │   ├── manifest.json
│       │   ├── src/main.ts
│       │   └── locales/{ru,en}.json
│       └── kit-hexa-ui/                 сборка плагина кита HexaUI — не в git, см. «Кит HexaUI»
├── forms/
│   ├── contact/form.schema.json         форма ReFormer
│   └── contact.rjsf.json                форма RJSF (`rjsf-form/1`)
├── scripts/hexa-kit.mjs                 сборка плагина кита HexaUI в этот проект
├── package.json                         скрипты и зависимости для разработки плагинов
└── tsconfig.json                        проверка типов исходников плагинов
```

## Запуск билдера на этом проекте

```bash
npm run builder -w reformer-builder-playground        # dev-сервер билдера, http://localhost:5184
npm run builder:dist -w reformer-builder-playground   # собранный билдер под лаунчером, тот же порт
```

Дальше в билдере — «Открыть папку…» и выбрать `projects/reformer-builder-playground`. Нужен
Chromium-браузер (File System Access API).

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

Файлы с HexaUI называют кит, но не привозят его: кит — плагин проекта, см. «Кит HexaUI» ниже.
Подробности о составах — [composition.md](../reformer-builder/docs/composition.md) билдера; что
конфиги собирают именно своё сочетание, проверяет его тест `application/launch-presets.test.ts`.

## Кит HexaUI

Кит HexaUI ([`packages/ui-kits/reformer-hexa-ui`](../../packages/ui-kits/reformer-hexa-ui)) —
внешний плагин: в составе билдера его нет, он лежит в проекте и включается его настройкой. Здесь
он включён заранее (`kit-hexa-ui` в `.ui_builder/settings.json`), не хватает только сборки:

```bash
npm run plugins:hexa-ui -w reformer-builder-playground   # .ui_builder/plugins/kit-hexa-ui/
```

Сборка весит около 5 МБ и в git не едет (корневой `.gitignore`); после правки кита скрипт
запускают заново. Пока её нет, билдер рисует формы встроенным китом и ни о чём не предупреждает.

С собранным плагином кит появляется в ячейке «движок · кит» строки состояния и меняется на лету;
готовые конфиги `*-hexa-ui` открывают его сразу. Для работы над самим китом удобнее наблюдение —
пересборка на каждое сохранение:

```bash
npm run plugin:dev -w @reformer/kit-hexa-ui -- --project ../../../projects/reformer-builder-playground
```

## Плагины

`playground-hello` — шаблон `reformer-plugin create`: одна команда, подпись которой берётся из
словаря плагина. Лежит исходниками: оболочка сама транспилирует `src/main.ts`. Включён настройкой
проекта (`workspace.plugins.enabled` в `.ui_builder/settings.json`).

Цикл правки: поменять исходник → в палитре команд (`Ctrl+Shift+P`) «Плагины: перезагрузить
«Playground Hello»». Чтобы оболочка перечитывала плагин сама при возврате в окно — «Плагины:
наблюдать «Playground Hello» — режим разработки».

Новый плагин:

```bash
cd projects/reformer-builder-playground
npx reformer-plugin create .ui_builder/plugins/<id> --name "<Имя>"
```

Из созданного шаблоном нужны `manifest.json`, `src/` и `locales/`; вложенные `package.json`,
`tsconfig.json`, `.gitignore` и `src/main.test.ts` можно удалить — зависимости и проверку типов
даёт этот пакет. Включается плагин в списке плагинов билдера или строкой в
`.ui_builder/settings.json`.

Проверки:

```bash
npm run plugins:validate -w reformer-builder-playground   # манифест и файлы — правилами оболочки
npm run typecheck -w reformer-builder-playground          # типы исходников плагинов
```

Обе берут собранные `@reformer/builder-plugin-api` и `@reformer/builder-plugin-cli`
(`npm run build -w <пакет>`, сначала контракт).

## Что помнить

- **Каталог — фикстура.** e2e снимает с него копию перед каждым тестом, поэтому любое изменение
  здесь — изменение входных данных тестов. Поменяли форму, плагин или конфиг — прогоните
  `npm run test:e2e -w reformer-builder-playground-e2e`. В копию идёт то, что видит git:
  игнорируемое (сборка кита HexaUI) в неё не попадает, и берёт её только тест самого кита.
- **Ручная работа меняет файлы.** Открытый руками проект билдер правит на диске: сохранённая
  форма, включённый плагин, подтверждённые права. Перед коммитом — `git status` на этот каталог.
- **`.ui_builder/settings.json` пишет билдер** — при каждом открытии, своим форматом. Файл
  исключён из prettier (`.prettierignore`), иначе открытие проекта давало бы diff.
