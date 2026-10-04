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
├── builder.launch.json                  конфиг уровня ЗАПУСКА: состав плагинов, локаль, тема
├── .ui_builder/
│   ├── config.json                      конфиг уровня ПРОЕКТА: заголовок окна
│   ├── settings.json                    настройки проекта: включённые плагины
│   └── plugins/playground-hello/        плагин в разработке (исходники, без сборки)
│       ├── manifest.json
│       ├── src/main.ts
│       └── locales/{ru,en}.json
├── forms/
│   ├── contact/form.schema.json         форма ReFormer
│   └── contact.rjsf.json                форма RJSF (`rjsf-form/1`)
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

## Два конфига, а не один

Билдер читает `.ui_builder/config.json` в двух местах: лаунчер — из каталога запуска, приложение —
из открытого проекта. `preset`, `profiles`, `presetChoices`, `plugins` и `defaults` применяются
только на уровне запуска; встретив их в конфиге проекта, билдер показывает предупреждение при
каждом открытии. Поэтому здесь они разнесены:

| Файл                      | Уровень | Что задаёт                                                    |
| ------------------------- | ------- | ------------------------------------------------------------- |
| `builder.launch.json`     | запуск  | профиль `playground` (ReFormer + RJSF), локаль `ru`, тема     |
| `.ui_builder/config.json` | проект  | заголовок окна — перекрывает заголовок запуска после открытия |

Скрипты `builder` и `builder:dist` называют конфиг запуска явно (`REFORMER_BUILDER_CONFIG` у
dev-сервера, `--config` у лаунчера).

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
  `npm run test:e2e -w reformer-builder-playground-e2e`.
- **Ручная работа меняет файлы.** Открытый руками проект билдер правит на диске: сохранённая
  форма, включённый плагин, подтверждённые права. Перед коммитом — `git status` на этот каталог.
- **`.ui_builder/settings.json` пишет билдер** — при каждом открытии, своим форматом. Файл
  исключён из prettier (`.prettierignore`), иначе открытие проекта давало бы diff.
