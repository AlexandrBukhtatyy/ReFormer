# @reformer/kit-hexa-ui

Кит ReFormer поверх дизайн-системы Kaspersky HexaUI: поля с адаптерами формы, обёртка и рамка
поля на HexaUI `Field`, провайдер темы, каталог компонентов — и плагин ReFormer Builder, который
ставит этот кит в билдер.

Пакет приватный: он живёт в монорепо как пример кита, внесённого плагином, — в каталоге плагинов
проекта-образца (`projects/reformer-builder-playground/.ui_builder/plugins/kit-hexa-ui`), там же,
где билдер его и находит. Билдер о HexaUI не знает ничего — ни в зависимостях, ни в составе.

## Кит в приложении

```ts
import { FormField, FormWizard, Input, Select, KitProvider } from '@reformer/kit-hexa-ui';
import catalog from '@reformer/kit-hexa-ui/catalog';
```

Вход пакета подключает готовый CSS дизайн-системы (`@kaspersky/hexa-ui/.../styles.css`). Форму
оборачивают в `KitProvider` — это `ConfigProvider` HexaUI с темой, следующей классу `dark` на
`<html>`, и с языком активной локали ReFormer (`useI18n().code` → `ru-ru`, `pt-br`, …;
`src/locale.ts`): в билдере это язык его интерфейса, в приложении — язык формы. Страницу формы,
напечатанную кодогеном билдера, оборачивать не нужно: провайдер кита (`kit.adapters.provider`
каталога) она ставит вокруг формы сама.

### Стили — только внутри `KitProvider`

CSS HexaUI глобален: ресет antd на `html`, `body`, `*` и голые теги, вне каскадных слоёв, —
в приложении на Tailwind он перебьёт и `@layer base`, и утилиты, а однажды загруженный со
страницы уже не уйдёт. Шесть CSS-модулей компонентов (`Button`, `Dropdown`, …) вдобавок вставляют
при импорте голое `h3 { … }`. Ограничивает это Vite-плагин кита:

```ts
// vite.config.ts приложения
import { hexaUiStyles } from '@reformer/kit-hexa-ui/vite';
export default defineConfig({ plugins: [react(), hexaUiStyles()] });
```

- Селекторы без классов и идентификаторов (`html`/`body`/`:root`, `*`, теги, `[hidden]`,
  `::selection`) уходят под контейнер `[data-hexa-root]`, который ставит `KitProvider`
  (`display: contents`): `html`/`body` заменяются контейнером, остальные — его потомки.
- Префикс — `:where(…)`, нулевой специфичности: каскад внутри провайдера тот же, что у HexaUI без
  изоляции.
- Классы дизайн-системы (`.ant-*`, хеши CSS-модулей) остаются глобальными: в приложении их нет,
  а оверлеи antd (`Modal`, `Drawer`, самостоятельный `Tooltip`) рисуются в `document.body`.
- То же правило — для таблиц `style-inject` в CSS-модулях: в сборке хуком `transform`, в dev —
  плагином esbuild предсборки зависимостей.
- Почему не `@scope`, каскадные слои или Shadow DOM — в шапке `vite/scope-css.mjs`. Сторож —
  `vite/scope-css.test.ts`: после ограничения в настоящих таблицах HexaUI не остаётся ни одного
  селектора мимо контейнера (обновление HexaUI с новым голым селектором его уронит).

Без плагина кит работает, но CSS глобален. Внутри провайдера утилиты Tailwind уступают ресету
antd на тех же свойствах — свёрстанное утилитами (шапку страницы) держите снаружи провайдера.
Переменные палитры и шрифты HexaUI (`GlobalStyle`, `@kaspersky/hexa-ui-core`) остаются на
`:root`: имена с токенами Tailwind и ui-kit не пересекаются.

Вход экспортирует всё, что каталог называет компонентом, — под именем экспорта записи
(`exportName` либо имя записи). По этим именам кодоген билдера печатает импорт в
`schema/registry.ts` формы. Состав входа:

- `src/fields/` — поля: имена записей ui-kit (`Input`, `Select`, `DatePicker`, `FileUpload`, …) либо
  их `exportName` (`CheckboxWithLabel`, `SwitchWithLabel`, `ToggleButton`) и свои у HexaUI
  (`TimeInput`, `TimeRange`, `WeeklySchedule`, `ToggleButtonGroup`, `InputSearch`, `CodeEditor`).
  Адаптеры — чистые данные (`adapters.ts`), преобразования значений — чистые функции
  (`convert.ts`);
- `src/wizard.tsx` — `FormWizard` на HexaUI `Wizard` по протоколу визарда каталога `3.0`;
- `src/components.ts` — компоненты HexaUI как есть, явным списком (не `export *`); палитра из
  них (`src/palette.ts`) — то, что берёт и пространство имён билдера;
- `src/compound.ts` — плоские имена статик (`TabPane`, `ButtonGroup`, `TagGroup`, …);
- `src/heavy.ts` — тяжёлое (`CodeViewer`, `CodeCompare`, `Terminal`, `FieldSet`, `LicenseCard`):
  только во входе.

Пространство имён билдера (`src/namespace.ts`) — то, что превью рисует вживую: без тяжёлого, без
записей `limited` (оверлеи, навигация, таблицы) и без служебных (`Field`, `Upload`,
`PopupConfigProvider`…). Расхождение каталога с namespace и входом ловит тест пакета.

### Поля

Имена записей — как у `@reformer/ui-kit`: на них держатся одна схема формы на два кита, вид
значения поля в билдере и затравки шаблонов. «Пусто» у любого поля — `null` (пустая строка, пустой
выбор, неполный период, `NaN`), его ловит `required()`.

| Запись                              | HexaUI                                 | Значение модели                               | Особенность                                   |
| ----------------------------------- | -------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `Input`, `InputPassword`            | `Textbox`, `Textbox.Password`          | `string \| null`                              |                                               |
| `Textarea`                          | `Textbox.Textarea`                     | `string \| null`                              |                                               |
| `InputMask`                         | `Textbox.Masked`                       | `string \| null`                              | `mask` ui-kit → `maskOptions`                 |
| `InputSearch`                       | `Search`                               | `string \| null`                              |                                               |
| `InputNumber`                       | `Textbox.Number`                       | `number \| null`                              | `''`/`NaN` → `null`                           |
| `Select`, `SelectMulti`             | `Select` (`multiple`)                  | `string \| null` / `string[] \| null`         | `null` → `undefined` ради placeholder         |
| `Combobox`, `ComboboxMulti`         | `Select` с `showSearch`                | `string \| null` / `string[] \| null`         |                                               |
| `ComboboxTree`, `ComboboxTreeMulti` | `TreeSelect`                           | `string \| null` / `string[] \| null`         | `nodes` ui-kit → `treeData`                   |
| `RadioGroup`                        | `Radio`                                | `string \| null`                              | значение из antd-события                      |
| `CheckboxGroup`                     | `CheckboxGroup`                        | `string[] \| null`                            | `options` — `{ label, value }`                |
| `Checkbox` → `CheckboxWithLabel`    | `Checkbox`                             | `boolean`                                     | подпись рядом с контролом                     |
| `Switch` → `SwitchWithLabel`        | `Toggle`                               | `boolean`                                     | `onChange(checked, e)`                        |
| `Toggle` → `ToggleButton`           | `ToggleButton`                         | `boolean`                                     | `selected` ↔ значение                         |
| `ToggleGroup`, `ToggleGroupMulti`   | `SegmentedButton` (`radio`/`checkbox`) | `string \| null` / `string[] \| null`         | `options` ui-kit → `items`                    |
| `ToggleButtonGroup`                 | `ToggleButtonGroup`                    | `string[] \| null`                            |                                               |
| `DatePicker`                        | `Calendar`                             | `Date \| null`                                | `dateFormat` (date-fns) → `format`; лениво    |
| `DatePickerRange`                   | `RangePicker`                          | `[Date, Date] \| null`                        | неполный период → `null`; лениво              |
| `TimeInput`, `TimeRange`            | `TimeInput`, `RangeTimeInput`          | `string \| null` / `[string, string] \| null` |                                               |
| `FileUpload`, `FileUploadDropzone`  | `Uploader` (`manual`)                  | `File[] \| null`                              | без сети: `File` ↔ `UploadFile`               |
| `WeeklySchedule`                    | `WeeklySchedule`                       | `Record<string, number[]> \| null`            | неуправляемый — пересоздаётся по `key`        |
| `RichTextEditor`                    | `RichTextEditor`                       | `unknown[] \| null`                           | документ slate; лениво, пересоздание по `key` |
| `CodeEditor`                        | `CodeViewer`                           | `string \| null`                              | лениво, пересоздание по `key`                 |

`validationStatus`/`invalid` у полей нет: состояние ошибки ставит обёртка поля. Пропсы, которые
пишут схемы ui-kit (`placeholder`, `rows`, `step`, `accept`, `clearable`, `emptyText`), обёртки
понимают — и каталог их перечисляет.

### Визард

`FormWizard` (`src/wizard.tsx`) — визард по протоколу каталога `3.0` (`kit.adapters.wizard`): шаги
HexaUI `Wizard` (`view="page"`) строятся из детей-шагов, переход делает поток формы (`bundle.flow`,
иначе позиционный), а не HexaUI: `onNext` зовёт `flow.next()`, на последнем шаге —
`submission.submit(onSubmit)`. Тело шага — `Step` из `@reformer/cdk/form-wizard`. Подписи кнопок —
`submitLabel`/`nextLabel`/`backLabel`; без них — словарь HexaUI на языке провайдера кита
(«Далее» под русской локалью). Сырой `Wizard` в каталог не входит: имя занято синтетикой
билдера.

## Каталог компонентов

`catalog.json` (контракт `3.0`) не пишется руками — его генерирует `reformer-plugin catalog` из
TypeScript-типов входа пакета (`src/index.ts`) по конфигу `catalog.config.mjs`. Пропсы записи —
пропсы того символа, который импортирует кодоген и рисует превью; свои у HexaUI
(`@kaspersky/hexa-ui`, `hexa-ui-core`) и у обёрток кита идут в `properties`, HTML-атрибуты и пропсы
antd/rc-\* — в `x-inherits`. Конфиг решает только то, чего типы не знают: тип значения полей,
роли записей (палитра, `limited`, служебные), разделы палитры, переименования (`Separator` →
`Divider`, `Spinner` → `Loader`, `Progress` → `ProgressBar`), части составных компонентов, решения
по статикам (`Tabs.TabPane` → плоский `TabPane`, пункты `Dropdown`/`Toolbar` — `ignore`). Формат
конфига — README `@reformer/builder-plugin-cli`, раздел `catalog`.

```bash
npm run catalog -w @reformer/kit-hexa-ui         # перегенерировать catalog.json
npm run catalog:check -w @reformer/kit-hexa-ui   # сверить файл с типами, ничего не записывая
```

Тест `src/catalog.test.ts` делает то же, что `catalog:check`: обновили HexaUI, TypeScript или
обёртку поля — тест падает с диффом, каталог перегенерируют осознанно. Компонент HexaUI без роли в
конфиге — отказ генерации (`unclassified: 'refuse'`), а не тихая служебная запись.

В каталоге все компоненты входа: поля, палитра (контейнеры, отображение, действия), `limited`
(оверлеи, навигация, табы и аккордеон, таблицы и деревья, тяжёлое — превью рисует их подписанной
заглушкой, кодоген печатает импорт), служебные (`palette: false`: инфраструктура кита, `Field`,
`Upload`, `PopupConfigProvider`, `Locale`, `IconResolver`). Функции, хуки и константы HexaUI в
каталог не входят.

## Кит в билдере — внешним плагином

Плагин — тот же пакет: манифест `src/manifest.json` (id `kit-hexa-ui`), точка входа
`src/builder-plugin.ts`, стили `src/builder-plugin.css`. Он вносит кит в точку
`reformer.kit.source` и требует от оболочки службу китов `reformer.kit.catalog ^2`.

```bash
npm run validate -w @reformer/kit-hexa-ui     # пропустит ли оболочка
npm run build:dev -w @reformer/kit-hexa-ui    # сборка для билдера — в корень этого каталога
npm run build:dist -w @reformer/kit-hexa-ui   # сборка для поставки — в dist/
npm run dev -w @reformer/kit-hexa-ui          # build:dev на каждое сохранение исходников
```

`build:dev` кладёт `manifest.json`, `main.js` и `styles.css` рядом с `src/` — в каталог плагина
проекта-образца, откуда билдер их и грузит; в git они не едут (`.gitignore` пакета). В образце
плагин уже включён: открыть `projects/reformer-builder-playground` и выбрать кит «Kaspersky
HexaUI». В другой проект кладётся содержимое `dist/` — как `.ui_builder/plugins/kit-hexa-ui/`, —
и плагин включается в списке плагинов.

Что грузится когда:

- **шапка кита** (`id`, `label`, `package`) — значением: по ней кит виден в выборе;
- **каталог** — динамическим импортом, когда кит выбран (сборка кладёт JSON отдельным файлом
  `chunks/catalog.js`: полный каталог — полторы сотни записей, ~0,5 МБ JSON);
- **тяжёлое** (`CodeViewer`, `CodeCompare`, `Terminal`, `FieldSet`, `LicenseCard`) в пространство
  имён не входит вовсе: в каталоге это `limited`, превью рисует заглушку. Движки полей-редакторов
  и календарей поля грузят сами, `import()` с подпутей HexaUI, — при первой отрисовке такого поля;
- **пространство имён** (HexaUI с antd и styled-components, ~4 МБ) — динамическим импортом, когда
  кит выбран и форма рисуется. `src/builder-plugin.ts` его статически не импортирует;
- **стили** — полем `styles` манифеста. Оболочка ставит их с изоляцией `scoped`: каждый селектор —
  под `[data-rb-plugin="kit-hexa-ui"]`, а этот атрибут вешает рамка кита вокруг формы в превью.
  Ресет antd (`html`, `body`, `*`) поэтому действует на форму, а не на билдер.

Сборка (`reformer-plugin build`) проверяет то же, что оболочка: разбор манифеста, «сухую»
активацию и каталог кита — той же проверкой контракта, что у реестра китов.

## Ограничения

- `@kaspersky/hexa-ui` объявляет `react: 16.x || 17.x || 18.x` (так и записано в
  `kit.peerRanges` каталога), билдер работает на React 19. Внутри HexaUI живут antd@4 и
  styled-components@5. Спайк под React 19 чистый: браузерный прогон монтирует все поля и визард —
  падений нет, только предупреждения в консоли, поэтому записей «несовместим с React 19» в каталоге
  нет. `defaultProps` функций React 19 не применяет (`Uploader.size`) — обёртки кита задают такие
  пропсы явно.
- `GlobalStyle` HexaUI и `@kaspersky/hexa-ui-core` кладут CSS-переменные палитры, типографику и
  шрифты прямо в `<head>` — мимо изоляции стилей плагина. Пересечений с токенами билдера у них нет,
  но это глобальный эффект, и он появляется, когда кит впервые рисует форму.
- styled-components вложен в сборку плагина. Повторное включение плагина в той же вкладке
  линкует `main.js` заново, и styled-components предупреждает в консоли о втором экземпляре;
  перезагрузка вкладки его убирает.
- Всплывающие окна полей (списки, дерево, календари) `KitProvider` оставляет внутри своего
  поддерева — в контейнере `[data-hexa-popup-root]` в его конце: обёртки полей передают его в
  `getPopupContainer`. В `document.body` они ушли бы за пределы скоупа стилей.
  `PopupConfigProvider` HexaUI кит не ставит — вместо него свой контейнер: провайдер есть только у
  главного входа HexaUI, а главный вход в графе пространства имён раздувает его ленивыми
  редакторами и календарями (см. `src/palette.ts`). Мимо рамки поэтому уходят только подсказки
  самостоятельного `Tooltip` HexaUI — они открываются в `document.body`, вне скоупа стилей кита.
- Экспорты с `@deprecated` у HexaUI (`Icon`, `KeyValue`, `KeyWithIcon`, `Tree`, `Anchor`,
  `AnchorLink`) остаются в каталоге ради старых схем, но в палитру не попадают (`service`,
  `palette: false`). Исключение — `Label`: запись прежнего ручного каталога, схемы на неё
  ссылаются, поэтому она в палитре, и генератор предупреждает о ней при каждом прогоне.
- Пропсы `LockGroup` и `Markdown` выведены частично: часть пересечения в их типах не разрешается
  (`styled-components` 5 без типов).
- Пространство имён билдера берёт значения HexaUI только с подпутей
  (`@kaspersky/hexa-ui/button`); это закрепляет тест пакета. Сейчас с ним сразу грузится
  ≈4,1 МБ (`build:dev`) / ≈2,3 МБ (`build:dist`); редакторы, календари и шрифты — отдельными
  файлами по требованию.

## Проверки

```bash
npm run typecheck -w @reformer/kit-hexa-ui
npm test -w @reformer/kit-hexa-ui
npm run test:browser -w @reformer/kit-hexa-ui
npm run catalog:check -w @reformer/kit-hexa-ui
```

Тесты в node HexaUI не исполняют (кроме сторожа стилей — он читает таблицы HexaUI текстом): адаптеры полей — на `bindFieldProps` с настоящими формами
эмитов, логика визарда — на настоящем потоке шагов, каталог — сверкой с типами (`catalog:check`),
а также идентификатор и версия совпадают с манифестом, вклад в точку китов, ленивые каталог и
пространство имён, шапка кита, каталог по контракту SDK, каждый символ каталога, который превью
рисует вживую (не `limited` и не служебный), есть в пространстве имён, и каждый — среди экспортов
входа пакета. Экспорты входа перечисляет компилятор TypeScript — так, как их увидит приложение:
значение под нужным именем, а не тип и не реэкспорт несуществующего символа.

Браузерные тесты (`*.browser.test.tsx`, Chromium, React 19) рисуют поля и визард тем же путём, что
билдер: `createForm` → `FormRenderer` → `FormField` кита. Прогон подключён к `hexaUiStyles()`, как
приложение, и `styles-boundary.browser.test.tsx` проверяет границу рядом с Tailwind: шрифт,
ссылки и `h3` вне провайдера не меняются.
