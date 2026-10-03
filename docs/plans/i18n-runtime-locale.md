# Локализация компонентов ReFormer с переключением языка на лету

## Context

У встроенных подписей компонентов нет механизма локализации. В ui-kit около 80 сообщений в 113
местах, 56 из них зашиты без пропа, языки перемешаны. В cdk русский зашит в file-upload
(aria-подписи, сообщения для скринридера, «КБ/МБ»). Валидаторы ядра не несут человеческого текста:
без своей таблицы пользователь видит буквальное `required` или `invalid`. DatePicker всегда
форматирует дату по en-US.

Рядом есть три несвязанных механизма: `LocaleService` в renderer-json (авторский текст, `$locale`
запекается при конвертации), `ValidationMessagesProvider` в cdk и `I18nService` билдера. Ни один не
покрывает подписи кита.

Нужен один механизм: язык задаётся провайдером, подгружается динамически, переключается на лету,
состояние формы при этом не теряется.

## Принятые решения

1. **Провайдер грузит локаль сам.** Ему дают код языка и загрузчик: `<I18nProvider lang load>`.
   Готовый объект (`locale`) он тоже принимает — для SSR и тестов. Без провайдера компоненты говорят
   по-английски (язык умолчаний, ReFormer-fld4).
2. **Источник словарей — функция-загрузчик** `(code) => Promise<локаль>`. Кит поставляет загрузчик
   встроенных языков (чанк на язык) и те же словари JSON-файлами; приложение может заменить или
   дополнить его загрузкой по сети. Набор языков и тексты не зашиты в сборку приложения.
3. **Словарь** — плоский JSON со строками ICU (`{name}`, `plural`, `select`), как в билдере.
4. **Объём** — подписи ui-kit и cdk, тексты ошибок валидации, форматы дат, чисел и размеров файлов,
   авторские подписи в схеме формы (без пересборки формы), билдер.
5. **Оба языка поставляются в пакетах.** Недостающие русские и английские формулировки пишутся в
   этой работе.
6. Под `ru` размер файла пишется с запятой («1,5 МБ»); эталонные скриншоты перегенерируются.
7. Строки `rjsf-kit-theme` — вне объёма.

План поглощает задачу ReFormer-7aew.

## Архитектура

### 1. Общий рантайм — подпуть `@reformer/core/i18n`

Ядро — единственная общая зависимость cdk, ui-kit и обоих рендереров. Новый пакет дал бы то же
ценой ещё одной peer-зависимости у пяти пакетов и отдельного релиза; cdk не подходит, потому что
renderer-react от него не зависит.

```ts
interface FormLocale {                 // чистые данные — локаль можно отдать JSON-файлом
  code: string;                        // BCP 47: 'en', 'ru' — для Intl и plural
  messages: Record<string, string>;    // ключ → ICU-сообщение
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  dateLocale?: unknown;                // необязательное переопределение: локаль react-day-picker
  dateFormat?: string;                 // токены date-fns; без него дата идёт через Intl
}
extendLocale(base, patch): FormLocale  // новый объект, словари сливаются

createLocaleLoader(sources): LocaleLoader   // (code) => Promise<FormLocale>, плюс peek(code), preload(code)
fetchMessages((code) => url)                // источник: JSON по сети

I18nProvider({ lang, load, fallback?, onError?, children })   // грузит сам
I18nProvider({ locale, children })                            // готовый объект
useI18n(): { code, locale, pending, error, t(), has(), number(), date(), fileSize() }
useMessages(builtinEn)                 // переводчик пакета: локаль провайдера → встроенный английский

msg(key, values?, defaultMessage?)     // описатель авторского текста, см. §6
defineMessages(appEn)                  // msg с типизированными ключами
resolveLocalized(value, i18n), useLocalizedProps(props)
resolveValidationError(error, i18n), useValidationMessage()
```

Имена `LocaleProvider`, `useLocale`, `useTranslate` заняты в renderer-json и builder-plugin-api,
`Locale` конфликтует с типом date-fns — поэтому `I18nProvider`, `useI18n`, `FormLocale`.

**Загрузчик.** `createLocaleLoader` сливает источники по порядку (поздний перекрывает ранний),
кэширует результат по коду языка и не дублирует запрос, который уже идёт. Источник отдаёт локаль
целиком или только словарь. Отказ любого источника — отказ загрузки; терпимость к промаху
(`.catch(() => ({}))`) приложение задаёт у своего источника само.

**Поведение провайдера с `lang` и `load`:**

- при переключении на экране остаётся прежний язык, пока новый не загрузится; `pending` — для
  индикатора;
- при быстром переключении применяется только последний запрос;
- ошибка загрузки язык не меняет, попадает в `useI18n().error` и `onError`;
- до первой загрузки рисуется `fallback` (по умолчанию ничего), чтобы не мелькал английский; если
  локаль уже в кэше (`preload` до монтирования), первый рендер синхронный.

Логика загрузки живёт в хранилище без React и проверяется юнит-тестами; провайдер — тонкая привязка
через `useSyncExternalStore`.

**Раскладка в `packages/reformer/`:**

- `src/i18n/` — слой без React: форматтер (`message-format.ts` переезжает из билдера без правок
  вместе с тестами), локаль, загрузчик, переводчик, описатель, резолв ошибок, форматы, `en.json`,
  `ru.json`;
- `src/platforms/react/i18n/` — контекст и хуки. Провайдер пишется через `createElement`: в ядре
  сегодня нет JSX, и `react/jsx-runtime` не вынесен во внешние зависимости;
- `src/i18n.ts` — бочка подпутя; `src/locale/{en,ru}.ts` — входы локалей;
- новые ключи `./i18n`, `./locale/en`, `./locale/ru` в `package.json#exports` и `vite.config.ts#entry`;
  к ним — записи в `knip.json`, `.size-limit.json`, границы слоёв в `eslint.config.js`
  (иначе упадёт `scripts/check-exports-dist.mjs`).

**Один контекст на все пакеты.** У renderer-react внешние зависимости перечислены списком, и новый
подпуть попал бы в его сборку второй копией контекста. Список в
[vite.config.ts](../../packages/reformer-renderer-react/vite.config.ts) заменяется на правило
`/^@reformer\//`, как в cdk, ui-kit и renderer-json. Новый страж `scripts/check-i18n-singleton.mjs`
проверяет, что маркер контекста есть ровно в одной сборке — у ядра.

**Без провайдера** значение контекста — `{ code: 'en', messages: {} }`. Каждый пакет вызывает
`useMessages(своя_английская_таблица)`: сначала словарь провайдера, потом встроенный английский
пакета. Встроенный английский всегда в сборке — это запасной вариант; нижнему пакету не нужно знать
ключи верхнего. Разбор сообщений ленивый, кэш — `WeakMap` по объекту локали.

| Ключ | Нет в локали | Ошибка синтаксиса в локали |
| --- | --- | --- |
| пакета (`kit.*`, `cdk.*`, `validation.*`) | встроенный английский | встроенный английский, `console.error` в dev |
| приложения | `defaultMessage`, затем сам ключ; предупреждение в dev | то же, `console.error` в dev |

Маркер `⟦key⟧`, как в билдере, здесь не годится: форма стоит перед конечным пользователем, а
неполный словарь, загруженный с сервера, — законный сценарий.

### 2. Словари и их поставка

| Пакет | Ключи | Исходники |
| --- | --- | --- |
| core | `validation.<code>`, `format.fileSize.*` | `src/i18n/{en,ru}.json` |
| cdk | `cdk.<компонент>.<имя>` | `src/i18n/{en,ru}.json` |
| ui-kit | `kit.<компонент>.<имя>` | `src/i18n/{en,ru}.json` |

Каждый пакет отдаёт локаль накопительно (ui-kit = ядро + cdk + кит) в трёх видах:

| Вид | Подпуть | Для чего |
| --- | --- | --- |
| загрузчик | `@reformer/ui-kit/locale` → `loadKitLocale` | основной путь: чанк нужного языка по запросу |
| JSON-файл | `@reformer/ui-kit/locale/ru.json` | выложить на свой сервер, править без пересборки; образец для нового языка |
| синхронный модуль | `@reformer/ui-kit/locale/ru` | SSR, тесты; его же импортирует загрузчик |

У cdk и ядра — такие же три вида для тех, кто работает без кита. JSON-файлы собирает сборка пакета.
Исходные словари лежат в `src/i18n/`, а не рядом с модулями локалей в `src/locale/`: иначе сборка
кладёт декларацию плоского словаря (`ru.json.d.ts`) в `dist/locale/` рядом с накопительным
`ru.json` другой формы, и импорт JSON-файла из пакета получает неверный тип.
Язык, которого нет среди встроенных, `loadKitLocale` отдаёт пустым словарём: подписи кита остаются
английскими, пока приложение не даст их своим источником.

Тип ключей — `keyof typeof enJson` (в tsconfig ядра, cdk и ui-kit включается `resolveJsonModule`).
Полноту поставляемого `ru` проверяет компилятор (`const ru: Record<KitMessageKey, string> = ruJson`),
разбор и совпадение имён аргументов — тест. У словаря, пришедшего по сети, таких гарантий нет —
его страхует политика промаха из §1; для CI есть `validateLocale(locale, reference)`.

### 3. Как компоненты берут текст

Приоритет: **явный проп → локаль провайдера → встроенный английский**.

```tsx
const t = useKitMessages();
<span>{placeholder ?? t('kit.selectMulti.placeholder')}</span>
<span>{t('kit.selectMulti.selected', { count: selected.length })}</span>
```

- Умолчания из деструктуризации и зашитые литералы уходят в словарь. Существующие пропы-подписи
  остаются переопределением для одного экземпляра; новых пропов не добавляется — глобальную правку
  даёт словарь.
- **Один источник английского умолчания — `en.json`.** В `*.props.ts` литерал заменяется хелпером
  `messageDefault('kit.x.y')` → `{ default: en[key], 'x-messageKey': key }`. У компонентов без
  `props.ts` проп получает JSDoc-тег `@defaultMessage kit.x.y`, его читает
  `scripts/introspect-props.ts`. `generate-catalog.ts` падает на неизвестном ключе.
- Попутно выравниваются формулировки между вариантами (`No options found.` и `No options available`,
  `Create “x”` и `Create: x`) и чинится испорченный `default` FileUpload в каталоге.
- **Строки cdk идут через тот же контекст,** а не через пропы от кита: сообщения для скринридера
  рождаются внутри `useFileUpload`, а cdk используют и без ui-kit.

### 4. Ошибки валидации

Порядок без `ValidationMessagesProvider`:

1. `error.messageKey` — если ключ есть в локали;
2. непустое `error.message` автора правила;
3. `validation.<code>` из локали;
4. встроенная английская таблица;
5. `error.code`.

- Смонтированный `ValidationMessagesProvider` остаётся полным переопределением;
  `createMessageResolver` и `defaultErrorResolver` не меняются. Меняется только значение контекста по
  умолчанию в [error-resolver.tsx](../../packages/reformer-cdk/src/validation/error-resolver.tsx).
- Все 26 правил ядра и `makeFileError` в cdk ставят `message: ''` (сейчас у большинства `'invalid'`,
  хотя JSDoc уже обещает `''`); ошибку собирает общий хелпер. Резолвер дополнительно считает
  `'invalid'` пустым — совместимость со старым ядром.
- Новое необязательное поле `messageKey` в `ValidateOptions` и `ValidationError`:
  `required({ messageKey: 'profile.name.required' })`. Тип `message: string` не трогается.
- Параметры готовятся до подстановки: `Date` — `Intl.DateTimeFormat`, массив — `Intl.ListFormat`,
  байты — размер файла; числа остаются числами, чтобы работал `plural`.

### 5. Форматы

Всё выводится из `code` и словаря, чтобы локаль оставалась данными.

- **Числа** — `Intl` по `code`; заменяет `toLocaleString('default')` в Calendar и Chart.
- **Размер файла** — число через `Intl.NumberFormat`, единица из словаря (`format.fileSize.kb`:
  `{value} КБ`). `formatFileSize(bytes)` в cdk сохраняет сигнатуру и отдаёт английские единицы;
  `FileUpload.ItemSize` берёт `useI18n().fileSize`.
- **Даты** — через `Intl` по `code`, без объекта локали date-fns (это код, по сети его не получить):
  - DatePicker без явного `dateFormat` — `Intl.DateTimeFormat(code, { dateStyle: 'long' })`;
  - Calendar — форматтеры месяца и дней недели на `Intl`, подписи навигации из словаря
    (`kit.calendar.*`), первый день недели из `locale.weekStartsOn`;
  - `dateLocale` и `dateFormat` в локали — необязательное переопределение; `date-fns` и
    `react-day-picker` остаются необязательными peer-зависимостями, модули локалей их не импортируют.

### 6. Авторские подписи с переключением на лету

Автор пишет вместо строки описатель; текст получается при рендере. Ноды формы не пересоздаются,
ключи и типы React-элементов прежние — значения, `touched`, ошибки и шаг мастера переживают смену
языка, а тексты ошибок переводятся без повторной валидации.

```ts
componentProps: { label: msg('profile.email.label') }
```

- Описатель — объект с брендом `Symbol.for('reformer.i18n.message')` без ключей `value`, `array`,
  `item`, `component`: обход схемы в `createForm` не примет его за узел. `componentProps` в ядре и
  рендерерах уже `Record<string, unknown>`; расширяются только типы `ArrayRenderNode.componentProps`
  и текстовых детей.
- `resolveLocalized` обходит массивы и простые объекты (подписи опций, заголовки шагов), пропуская
  сигналы, React-элементы, функции и узлы формы; поддеревья без описателей сохраняют ссылку,
  результат кэшируется по объекту пропсов.

| Где раскрывается | Что делается |
| --- | --- |
| renderer-react: контейнер, лист, массив, текст ([render-node.tsx](../../packages/reformer-renderer-react/src/core/render-node.tsx)) | `useLocalizedProps` после `useSignalProps`; у листа — до `bindFieldProps`; текстовые дети понимают описатель |
| cdk `FormFieldRoot`, `useFormField` | `label` и `componentProps` в контексте поля — уже строки |
| ui-kit `form-field.tsx` | `description` и `labelTooltip` раскрываются вместо разового `.peek()` |
| renderer-json конвертер | `$locale(key)` и `{ $locale, params }` дают описатель; `$model` в `params` становится реактивным |

Обратная совместимость renderer-json: при заданном `reg.locale(service)` остаётся прежняя
статическая строка; `useLocale()` без своего `LocaleProvider` читает общий контекст, поэтому
компонент `I18n` тоже переключается.

### 7. Билдер

- Форматтер берётся из ядра; `I18nService` и его контракт не меняются.
- `<I18nProvider lang={язык билдера} load={loadKitLocale}>` монтируется в двух местах, потому что
  превью живёт в отдельных React-корнях: в оболочке
  ([Shell.tsx](../../projects/reformer-builder/src/shell/platform/ui/Shell.tsx)) и в рамке кита
  ([frame.tsx](../../projects/reformer-builder/src/plugins/kits/registry/frame.tsx)), которая
  подписывается на смену языка. Кэш загрузчика общий.
- Превью резолвит импорты по точному списку: новые подпути регистрируются в
  `shell/boot/plugin-modules.ts` и `kit-modules.ts`.
- Инспектор показывает умолчание пропа из активной локали по `x-messageKey`.

## Пример для автора приложения

```tsx
// i18n.ts
import { createLocaleLoader, defineMessages, fetchMessages } from '@reformer/core/i18n';
import { loadKitLocale } from '@reformer/ui-kit/locale';

export const loadLocale = createLocaleLoader([
  loadKitLocale,                                     // подписи кита, cdk, ошибки — чанк языка
  fetchMessages((code) => `/locales/${code}.json`),  // ключи приложения и правки — с сервера
]);
export const { msg } = defineMessages(appEn);        // типизированные ключи авторских подписей

// form.ts
{ value: model.$.email, component: Input, componentProps: { label: msg('profile.email.label') } }
validate(model.$.email, [required(), minLength(5, { messageKey: 'profile.email.tooShort' })]);

// App.tsx
const [lang, setLang] = useState('ru');
<I18nProvider lang={lang} load={loadLocale}>
  <LangSwitch value={lang} onChange={setLang} />
  <FormRenderer form={form} />
</I18nProvider>
```

В JSON то же: `"label": "$locale(profile.email.label)"`.

## Этапы

Каждый этап оставляет репозиторий зелёным и коммитится отдельно (коммит и push — только по
отдельной просьбе). В `bd` — эпик и по задаче на этап.

| № | Этап | Области | Объём |
| --- | --- | --- | --- |
| 0 | Рантайм в ядре: перенос форматтера с тестами, локаль, загрузчик, провайдер (оба режима), хуки, описатели, локали ядра; правило внешних зависимостей renderer-react и страж; билдер переходит на форматтер из ядра. Видимых изменений нет | core, renderer-react, builder | большой |
| 1 | Валидация: `''` и `messageKey` в правилах, резолвер по локали в cdk; playground монтирует провайдер с `ru` в `App.tsx` | core, cdk, playground | средний |
| 2 | Строки cdk, размер файла, локали cdk в трёх видах | cdk | малый |
| 3а | Кит: `en.json`, `ru.json`, хук, `loadKitLocale`, JSON-файлы, `messageDefault`, `@defaultMessage`, страж литералов со списком исключений; компоненты форм — form-field, мастер, form-array, file-upload, async-boundary, select, combobox | ui-kit, e2e | большой |
| 3б | Остальной кит (table, tree, pagination, dialog, sheet, spinner, carousel, breadcrumb, sidebar, command, message-scroller, info-hint, radio-group, example-card, input-password); исключения стража — до нуля. Закрывает ReFormer-7aew | ui-kit | средний |
| 4 | Даты: DatePicker и Calendar через `Intl` и словарь | ui-kit | малый |
| 5 | Авторские подписи: раскрытие в renderer-react, cdk, ките; живой `$locale`; демо-страница `/demo/i18n` и e2e | renderer-react, cdk, renderer-json, ui-kit, playground, e2e | большой |
| 6 | Билдер: провайдер в оболочке и рамке кита, реестр модулей, инспектор | builder | средний |
| 7 | Шаблоны MCP (перестают предписывать русские подписи мастера вручную) и сайт документации. llms-разделы правятся в своих этапах | mcp, docs | средний |

Докстринг форматтера обещает дифференциальный тест против `intl-messageformat`, которого нет
(пакет не установлен). На этапе 0 он добавляется в devDependencies ядра вместе с самим тестом.

## Что меняется для потребителей библиотеки

- Русские умолчания кита и cdk становятся английскими; русский — через провайдер.
- Валидатор без своего сообщения показывает английскую фразу вместо `invalid` или кода;
  `error.message` по умолчанию — `''`.
- `formatFileSize` без провайдера отдаёт английские единицы; под `ru` — десятичная запятая.
- DatePicker без `dateFormat` пишет дату через `Intl`: «January 15, 2024» вместо «January 15th, 2024».
- `$locale` в JSON без `reg.locale` раскрывается при рендере; дерево узлов несёт описатели.
- Нижняя граница peer-версии ядра у cdk, ui-kit и рендереров поднимается при релизе.

Ядро сейчас в поезде 7.0 — ломающие правки в него укладываются.

## Критичные файлы

- новые `packages/reformer/src/i18n/`, `src/platforms/react/i18n/`; `packages/reformer/{vite.config.ts,package.json}`;
- `packages/reformer/src/form/validators/*.ts`, `src/form/types/contracts.ts`;
- `packages/reformer-renderer-react/{vite.config.ts,src/core/render-node.tsx}`;
- `packages/reformer-cdk/src/validation/error-resolver.tsx`,
  `src/components/file-upload/{useFileUpload.ts,file-upload-core.ts}`, `src/components/form-field/`;
- `packages/reformer-ui-kit/src/locale/`, `scripts/{generate-exports.mjs,introspect-props.ts,generate-catalog.ts}`,
  `src/package-exports.test.ts`, `vite.config.ts`, компоненты и `*.props.ts`;
- `packages/reformer-renderer-json/src/converter/json-to-render-schema.ts`, `src/locale/locale-context.tsx`;
- `projects/reformer-builder/src/shell/platform/services/i18n/`, `shell/platform/ui/Shell.tsx`,
  `plugins/kits/registry/frame.tsx`, `shell/boot/plugin-modules.ts`;
- `projects/react-playground/src/App.tsx`, `public/locales/`, новая страница `pages/demo/i18n/`.

## Verification

Команды — из каталога пакета (корневой `tsc -b` запрещён). После правки пакета — его сборка, иначе
зависимые пакеты проверяются на старом `dist`.

```bash
npm test && npx tsc --noEmit -p tsconfig.json     # в каждом затронутом пакете
npm run build -w @reformer/core                   # затем cdk, ui-kit, рендереры
npm run generate:llms && npm run check:catalog    # ui-kit
node scripts/check-exports-dist.mjs && node scripts/check-i18n-singleton.mjs
```

- **Форматтер** — переехавшие тесты и новый дифференциальный.
- **Загрузка** — юнит-тесты хранилища: прежний язык держится до прихода нового, устаревший ответ
  отбрасывается, ошибка не меняет язык, повторный запрос берётся из кэша, `preload` делает первый
  рендер синхронным.
- **Словари** — тест на пакет: одинаковые ключи, разбор каждого сообщения, совпадение аргументов
  en/ru, у каждого кода валидатора есть `validation.<code>`; JSON-файл совпадает с синхронным модулем.
- **Страж литералов** в ui-kit и cdk (на TypeScript API): кириллица в строках рантайм-кода, буквенный
  JSX-текст, литералы в `aria-label`/`title`/`placeholder`/`alt`.
- **ui-kit** — существующие тесты переходят на английские умолчания; на каждую группу компонентов
  добавляется случай под `<I18nProvider locale={ru}>`.
- **e2e** — playground под `ru`, строки `ru.json` посимвольно совпадают с нынешними русскими
  умолчаниями, поэтому русские локаторы кредитной формы не меняются. Правятся спеки, завязанные на
  английские умолчания (`Selected: 3`, `Clear selection`).
- **Переключение на лету** — новый спек `tests/pages/i18n/`:
  - заполнить поля, вызвать ошибку, переключить язык: подписи кита, ошибка, дата и авторские label
    сменились; значения, `touched` и шаг мастера остались; сохранённый `elementHandle` поля
    по-прежнему `isConnected` (перемонтирования нет); ошибок в консоли нет;
  - при переключении уходит запрос за словарём, до ответа на экране прежний язык;
  - третий язык, которого нет в сборке, отдаётся неполным JSON из `public/locales/`: его ключи
    применились, остальные подписи — английские.

  Скриншоты — в `projects/react-playground-e2e/screenshots/i18n/`.
- **Билдер** — `npm test`, `npm run test:browser`; вручную: смена языка в настройках меняет «Close»
  в диалогах и подписи в превью формы.

Эталонные снимки `visual.spec.ts` (`*-win32.png`) перегенерируются локально: под `ru` изменятся
строки семейства select/combobox, размеры с запятой и дата в DatePicker.

## Вне объёма

- Слот локалей в контракте каталога для внешних китов (HexaUI): внешний кит получает базу cdk.
- Отдельная настройка языка превью в билдере; направление письма (RTL); аргументы ICU
  `number`/`date`/`selectordinal`.
- Правка `docs/iter-prompts/sub-agent.template.md` (русские подписи мастера) — только между циклами.
