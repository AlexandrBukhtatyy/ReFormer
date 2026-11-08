# @reformer/builder-plugin-cli

`reformer-plugin` — командная строка автора плагина ReFormer Builder: создать плагин из шаблона,
проверить и собрать его **теми же правилами, которыми его проверит оболочка**, разрабатывать прямо
в открытом проекте, упаковать для npm, а киту — собрать каталог компонентов из его
TypeScript-типов.

## Установка

```bash
npm install --save-dev @reformer/builder-plugin-cli   # или npx без установки
```

Нужен Node 20 или новее. `typescript` — необязательная peer-зависимость, нужна только команде
`catalog`.

## Быстрый старт

```bash
npx @reformer/builder-plugin-cli create acme-forms --name "Acme Forms"
cd acme-forms && npm install
npx reformer-plugin validate
npx reformer-plugin dev --project ../my-builder-project
npx reformer-plugin pack
```

`create` кладёт `manifest.json`, `src/main.ts` (плагин с одной командой), тест на совпадение `id`
кода и манифеста, словари `locales/ru.json` и `en.json`, `package.json` и `tsconfig.json`.
Созданный плагин можно положить в `.ui_builder/plugins/<id>/` проекта как есть — оболочка сама
транспилирует `src/main.ts`.

## Команды

| Команда                                                       | Что делает                                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `create <каталог> [--id <id>] [--name <имя>]`                 | плагин из шаблона в пустой каталог; `id` по умолчанию — имя каталога                                     |
| `validate [каталог]`                                          | манифест разбором оболочки, файлы из манифеста, версия `package.json`; код выхода `1` — оболочка откажет |
| `build [каталог] [--out <каталог>] [--minify] [--bundle-css]` | сборка, которую оболочка грузит как есть (по умолчанию `dist/`), и «сухая» активация `main.js`           |
| `dev [каталог] --project <проект>` · `--out <каталог>`        | сборка в `<проект>/.ui_builder/plugins/<id>/` и пересборка на каждое изменение                           |
| `pack [каталог] [--out <каталог>]`                            | `npm pack` собранного: в архиве только сборка и `package.json`                                           |
| `catalog [каталог] [--config <файл>] [--check]`               | `catalog.json` кита из типов его входа; `--check` — только сверка, для CI                                |

Что важно знать о сборке:

- код — CommonJS; `import()` своего модуля уезжает в `chunks/` и читается оболочкой при первом
  обращении; модули, которые подставляет оболочка (`PLUGIN_RUNTIME_MODULES`: React, `@reformer/*`,
  сам контракт), остаются внешними — прочий `@reformer/*` даёт отказ `module-unavailable`;
- стили объявляются полем `styles` манифеста; импорт CSS из кода — отказ `css-from-code`, его
  снимает `--bundle-css`;
- `?worker` и `?raw` работают как у Vite; ассеты из CSS вкладываются data-URL;
- в каталоге вывода сборка удаляет только своё; чужой непустой каталог — отказ `output-not-ours`.

Коды отказов — коды оболочки (`manifest-invalid`, `api-version`, `entry-missing`, …) плюс свои:
`package-version`, `build-failed`, `module-unavailable`, `css-from-code`, `output-not-ours`,
`output-is-source`, `pack-failed`, коды кита (`kit-no-id`, `kit-invalid-catalog`, `kit-mismatch`) и
генератора каталога (`catalog-config-invalid`, `catalog-symbol-missing`, `catalog-drift`,
`typescript-missing`).

## Каталог кита

Конфиг — `catalog.config.mjs` (или `.js`, `.json`) в каталоге кита либо файл из `--config`. Набор
пропсов выводится из типов, конфиг решает только то, чего типы не знают:

```js
// @ts-check
import { defineKitCatalog, optionsProp } from '@reformer/builder-plugin-cli/catalog-config';

export default defineKitCatalog({
  entry: './src/index.ts',
  kit: { id: 'acme', label: 'Acme DS', package: '@acme/ds', infra: { fieldWrapper: 'FormField' } },
  fields: {
    Input: { value: 'string | null' },
    DatePicker: { exportName: 'DateField', value: 'Date | null' },
  },
  categories: { 'Поля ввода': ['Input', 'DatePicker'] },
  service: ['FormField'],
  props: { override: { Select: { options: optionsProp() } } },
});
```

## Входы пакета

| Импорт                                        | Что внутри                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `@reformer/builder-plugin-cli`                | `createPlugin`, `validatePlugin`, `buildPlugin`, `startDev`, `packPlugin`, `runCatalog` |
| `@reformer/builder-plugin-cli/catalog`        | `generateKitCatalog`, `checkKitCatalog` — генератор каталога (нужен `typescript`)       |
| `@reformer/builder-plugin-cli/catalog-config` | `defineKitCatalog`, `optionsProp` — для файла конфига                                   |

```ts
import { buildPlugin } from '@reformer/builder-plugin-cli';

const result = await buildPlugin({ dir: './acme-forms', outDir: './out' });
if (!result.ok) console.log(result.findings);
```

## Ссылки

- Документация: [первый плагин](https://alexandrbukhtatyy.github.io/ReFormer/docs/builder/plugins/first-plugin),
  [сборка и стили](https://alexandrbukhtatyy.github.io/ReFormer/docs/builder/plugins/build-and-styles),
  [билдер](https://alexandrbukhtatyy.github.io/ReFormer/docs/builder/overview)
- Контракт плагина: [`@reformer/builder-plugin-api`](../reformer-builder-plugin-api/README.md)

## Лицензия

MIT
