# Иконка-подсказка (i): `labelTooltip` у FormField и `tooltip` у полей ui-kit

## Context

Сейчас у поля формы есть только текстовая подсказка под полем (`componentProps.description`).
Нужна подсказка в виде иконки (i) с тултипом в двух местах:

1. **На уровне FormField** — иконка после label.
2. **На уровне самого компонента ui-kit** — в «своём» месте: у Input/Select внутри поля справа
   (с учётом крестика, глаза, шеврона), у Checkbox/Radio — после текста.

### Решения пользователя (зафиксированы)

- **API — два независимых prop'а** в `componentProps`: `labelTooltip` (рисует FormField) и `tooltip`
  (рисует компонент). Можно задать оба. `description` не меняется. Имя `hint` занято у FileUpload.
- **Порядок в правой зоне**, слева направо: `[крестик очистки] → [(i)] → [родные элементы: шеврон, глаз, скрепка]`.
  Нет других элементов — (i) у правого края.
- **Охват — все 24 field-компонента.** Где нет естественного места внутри — иконка справа от контрола.
- **Поведение** — Radix Tooltip (hover + фокус) плюс открытие по клику/тапу. Контент — текст.

### Что выяснило исследование

- `variants/base/*-base.tsx` — дословные порты shadcn, менять нельзя (playbook, инвариант 4).
  Декорация живёт в `*.field.tsx`, как уже сделано у `CheckboxWithLabel` / `SwitchControl` / `RadioGroupOptions`.
- Все field-версии идут через `withFormControl` (26 вызовов), кроме `InputNumberField`.
- В обоих путях (CDK авто-рендер и renderer-react `render-node.tsx:170-249`) весь `componentProps`
  долетает до компонента → camelCase-проп `labelTooltip` надо срезать, иначе React-warning в DOM.
- `FormFieldControl.tsx:105-110` спредит `accessibleProps`, потом `props` — переданный снаружи
  `aria-describedby` затирает вычисленный. Связать контрол с текстом подсказки без правки CDK нельзя.
- renderer-json, renderer-react, reformer-builder (инспектор из `component-catalog.json`), reformer-mcp —
  data-driven, правок кода не требуют, только перегенерация.
- Попутная находка: `pr-14` на Button-триггерах (Combobox×4, SelectMulti) — мёртвый CSS, его перебивает
  `has-[>svg]:px-3` из `button-base.tsx:25`. Текст уже сегодня может заезжать под крестик.

## Архитектура

| Слой | Что добавляется |
|---|---|
| `@reformer/cdk` | name-agnostic: `ids.hintId`, `hasHint` у Root, слот `FormField.Hint`, `useFormField().hintProps`; Control включает `hintId` в `aria-describedby` |
| ui-kit, новый компонент | `InfoHint` — кнопка (i) + Radix Tooltip со своим `TooltipProvider` + скрытый дубль текста для `aria-describedby` |
| ui-kit, FormField | `labelTooltip` в `fieldWrapperPropsSchema`; ряд `[Label][InfoHint]`, иконка снаружи `<label>` |
| ui-kit, поля | `tooltip` объявлен один раз в общей схеме; размещение — HOC `withFieldTooltip` (inside/outside) или сам компонент (self) |

**Инвариант:** без `labelTooltip`/`tooltip` (и при пустой строке) DOM побайтно прежний — существующие
SSR-тесты и 54 визуальных снапшота не меняются.

## Этап 1. CDK — `packages/reformer-cdk/src/components/form-field/`

- `types.ts`: `FormFieldIds.hintId`; `FormFieldContextValue.hasHint`; `FormFieldRootProps.hasHint?`
  (JSDoc-зеркало `hasDescription`); новый `FormFieldHintProps`.
- `FormFieldRoot.tsx`: `hintId: \`hint-${baseId}\``, проп `hasHint = false`, в контекст и deps мемо.
- `FormFieldControl.tsx:54-60`: порядок id — `hint`, `description`, `error` (как визуально: ряд label → описание → ошибка).
- `FormFieldHint.tsx` (новый, по образцу `FormFieldDescription.tsx`): `<span id={ids.hintId}>`, `asChild` через Slot.
- `FormField.tsx`, `index.ts`: слот `Hint` и экспорты типов. `useFormField.ts`: `hintId` + `hintProps`.
- Тесты: дополнить `makeCtx` в `FormFieldControl.test.tsx` и `FormFieldError.test.tsx` (иначе tsc упадёт);
  новый describe на `aria-describedby` (нет флагов / `hasHint` / все три, в обеих ветках рендера); новый `FormFieldHint.test.tsx`.
- Доки: `docs/llms/04-form-field.md` — строка `FormField.Hint`, `hasHint`, пример, anti-pattern «забыли `hasHint`».
- **Собрать:** `npm run build -w @reformer/cdk` — ui-kit видит cdk через `dist` (алиаса нет), без сборки tsc ui-kit не увидит новые типы.

## Этап 2. ui-kit — компонент `InfoHint`

Новый каталог `packages/reformer-ui-kit/src/components/info-hint/`: `index.ts`,
`variants/base/info-hint-base.tsx`, `variants/base/info-hint-toggle.ts`, тесты.

- API: `content: string`, `descriptionId?`, `aria-label?` (дефолт `'Подсказка'`), `side?` (`'top'`),
  `delayDuration?` (150 — дефолт кита 0 даёт мигание при проезде курсора), `className`, остальное в кнопку.
- Разметка: `TooltipProvider` (свой — глобального в формах нет; прецедент `EditorActions.tsx:165-172`) →
  `Tooltip open/onOpenChange` → `TooltipTrigger` с **`type="button"`** (иначе submit формы) → `InfoIcon size-4`
  (именованный импорт из `lucide-react`) → `TooltipContent className="max-w-xs"`.
  Рядом `{descriptionId && <span id={descriptionId} hidden>{content}</span>}` — `hidden`, а не `sr-only`:
  элемент по ссылке `aria-describedby` участвует в описании, но не читается повторно и не влияет на раскладку.
- Кнопка 16px, зона тапа 24px через `after:-inset-1` (кнопка 24px раздула бы ряд label). Сброс `border/bg/p`
  обязателен (docs грузит Tailwind без Preflight). `disabled` кнопке не передаётся никогда.
- **Клик/тап поверх Radix.** `TooltipTrigger` закрывает тултип на pointerdown и на click; наш обработчик
  идёт первым, `preventDefault` на click отключает радиксовский `onClose`:
  ```ts
  // info-hint-toggle.ts — чистая функция, тестируется матрицей
  export const nextOpenOnClick = (detail: number, open: boolean, wasOpenOnPointerDown: boolean) =>
    !(detail === 0 ? open : wasOpenOnPointerDown); // detail 0 = клик с клавиатуры
  ```
  `onPointerDown` запоминает `open` в ref (без `preventDefault`), `onClick` — `preventDefault` + toggle.
  `stopPropagation` не ставить (сломает закрытие чужих поповеров). Escape / клик вне / blur — штатные.
- Без `*.props.ts`; в `scripts/generate-catalog.ts:69-80` добавить `'info-hint'` в `NON_PALETTE_DIRS` —
  компонент попадает в каталог с `palette: false`, правок билдера не нужно.

## Этап 3. ui-kit — `labelTooltip` у FormField

- `components/form-field/form-field.props.ts`: `labelTooltip` (string, группа `Textfield`) после `description`.
- `components/form-field/form-field.tsx`:
  - строка 114: читать `labelTooltip` тем же `peek()` (пустая строка → `undefined`); строка 117: `hasHint={Boolean(labelTooltip)}`.
    Статично, как `description` — иначе иконка и aria разойдутся.
  - обычное поле: `<div data-slot="field-label-row" className="flex items-center gap-1.5">{Label}{InfoHint}</div>`;
    inline-label (Checkbox/Switch): `<div data-slot="field-control-row" …>{Control}{InfoHint}</div>`.
    Обёртки — только когда `labelTooltip` задан.
  - InfoHint: `descriptionId={ids.hintId}`, `aria-label="Подсказка: <label>"`, `data-testid="label-tooltip-<id>"`.
- `fields/with-form-control.tsx:60` (`bindField`): срезать `labelTooltip`. `input-number.field.tsx:23` — срезать вручную.

## Этап 4. ui-kit — `tooltip` у 24 полей

**Схема — одно объявление.** Новый React-free `src/fields/field-common.props.ts` (`tooltip`: string, `Textfield`),
подмешать в `props-schema.ts:80` между wrapper- и variant-свойствами. Работает, потому что каталог, docs и MCP
идут через `mergeFieldPropsSchema`, а стражи `*.props.test.ts` проверяют только «ключи схемы ⊆ тип» и общий блок
не видят. `check-catalog-drift.ts` падает только на `missingExports` (строка 89).
RadioGroup дополнительно: `RadioOption.tooltip?` + `items.properties.tooltip` в `radio-group-base.props.ts`.

**Механизм — `src/fields/field-tooltip.tsx`** (экспорт из `fields/index.ts`):
- `mergeIds(...)`; `useFieldTooltip(tooltip, { id, describedBy, testId })` → `{ describedBy, node }` — для self-компонентов;
- `withFieldTooltip(Primitive, placement)` — без текста возвращает голый примитив (без хуков и обёртки),
  с текстом рендерит shell; пробрасывает `ref` (FieldHandle цел), сохраняет `displayName`, сливает id в `aria-describedby`.
- Опцию в публичный `withFormControl` не добавляем: чужие примитивы со своим `tooltip` должны получать его насквозь.
- Классы — литеральными константами (сканер Tailwind): иконка 16px, шаг 24px, отступ от края 12px.
  На Button-триггерах резерв только через `has-[>svg]:pr-*` или margin — обычный `pr-*` мёртв.
- `data-testid` иконки: `<testid контрола>-tooltip`; у radio-опции `input-<field>-<value>-tooltip`.

| Поле | Файл (`src/components/…`) | Режим | Геометрия |
|---|---|---|---|
| Input, InputMask | `input-base.field.tsx` (экспорт `InputWithTooltip`), `input-number.field.tsx`, `input-mask-base.field.tsx` | inside | обёртка `relative w-full`, (i) `right-3`, контролу `pr-9` |
| Textarea | `textarea-base.field.tsx` | inside | (i) `top-2.5 right-3`, `pr-9` |
| NativeSelect | `native-select-base.field.tsx` | inside | обёртка **`w-fit`** (как у примитива), (i) `right-10` левее шеврона, `pr-16` |
| DatePicker | `date-picker-base.field.tsx` | inside | резерв `has-[>svg]:pr-9` |
| InputPassword | `input-password-base.tsx` | self | (i) `right-9` при видимом глазе, иначе `right-3`; резерв `pr-9` / `pr-10` / `pr-15` |
| Select (async) | `select/variants/async/select-async.tsx` | self | кластер `[X][(i)]` на `right-9`, шеврон у края; резерв `*:data-[slot=select-value]:mr-6` / `mr-12` через className триггера (`select-base.tsx` не трогаем) |
| SelectMulti, Combobox ×4 | `select-multi.tsx`, `combobox-{base,multi,tree,tree-multi}.tsx` | self | убрать мёртвый `pr-14`; кластер на `right-9`; резерв — margin шеврона `ml-2` / `ml-8` / `ml-14` |
| FileUpload input | `file-upload-input.tsx` | self | кластер `[X][(i)][скрепка]`, зона `pr-23` |
| FileUpload button / dropzone / Avatar | `file-upload-base.tsx`, `file-upload-dropzone.tsx`, `file-upload-avatar.tsx` | self | button: `[Button][(i)][hint]`; dropzone: (i) `absolute top-2 right-2` соседом зоны (не потомок `role=button`); avatar: внешний flex-ряд |
| Checkbox | `checkbox-base.field.tsx` | self | при подсказке обёртка `div.flex`, иконка **снаружи** `<label>` |
| Switch | `switch-base.field.tsx` | self | третий ребёнок существующего flex-div |
| RadioGroup | `radio-group-base.field.tsx` | hybrid | опция: иконка после `<label>`, id `${itemId}-tooltip`, `aria-describedby` на Item; группа: outside |
| Slider, Calendar, InputOTP, Toggle, ToggleGroup(+Multi), NativeSelectMulti | соответствующие `*.field.tsx` | outside | flex-ряд `[контрол][(i)]` (`items-center` / `items-start`) |

## Этап 5. Перегенерация и гейты

После сборки cdk, из `packages/reformer-ui-kit`:
`generate:meta` → `generate:exports` (появится `./info-hint`) → `generate:catalog` → `check:catalog` → `generate:llms`
→ `npm run build -w @reformer/ui-kit` (playground видит ui-kit через `dist`).
Затем `packages/reformer-builder-stack-reformer`: `npx vitest run src/kits/catalog-equivalence.test.ts -u`
(24 отпечатка полей + размер каталога) и прогон тестов `@reformer/builder`.
Коммитятся сгенерированные: `src/index.ts`, `package.json#exports`, `component-catalog.json`, `llms.txt`, `llms-index.json`.
`npm run size:check` — `date-picker.js` сейчас 924 из 1000 B; лимит поднимать только при реальном превышении.

## Этап 6. Hexa-кит (паритет только по `labelTooltip`)

`packages/ui-kits/reformer-hexa-ui`: `src/form-field.tsx` — `tooltip={props.labelTooltip || undefined}` в HexaUI `Field`
(проп у него есть); `src/fields.tsx:34` — срезать `labelTooltip` и `tooltip`; `catalog.json` — `labelTooltip` в записи полей.

## Этап 7. Демо и e2e

- `projects/react-playground/src/pages/demo/field-tooltips/FieldTooltipsDemo.tsx` (по шаблону `MultiSelectDemo`):
  Input, InputPassword, Select/Combobox с `clearable`, Textarea, Checkbox, Switch, RadioGroup с `options[].tooltip`,
  Slider; `labelTooltip` + `description` + `tooltip` одновременно; секция renderer-react (`fieldWrapper: FormField`).
  `App.tsx` — 4 правки: импорт, union (~45), nav (~177), Route (~401).
- `projects/react-playground-e2e`: project `field-tooltips` в `playwright.config.ts` (рядом с `multi-select`),
  `tests/pages/field-tooltips/{field-tooltips-page.pom.ts, field-tooltips.spec.ts}`.
- Скриншоты — `projects/react-playground-e2e/screenshots/field-tooltips/<scenario>.png`, всегда явный абсолютный путь.

## Этап 8. Документация

`packages/reformer-ui-kit/docs/llms/{02-text-fields,03-choice-fields,05-form-field-integration}.md`;
`projects/reformer-doc`: `docs/ui-kit/info-hint.mdx`, `demo/examples/info-hint.tsx` (эталон — `tooltip.tsx`), `sidebars.ts`,
`examples/form-field.tsx:161-195` (ручной `props[]`), `examples/cdk-form-field.tsx`, `examples/radio-group.tsx`,
`ApiExplorer.tsx` — `key` на FormField от `labelTooltip + description` (обе ручки статичны из-за `peek()`, сейчас `description` — мёртвая ручка).

## Осознанные визуальные изменения и допущения

1. **`clearable`-поля без подсказок тоже меняются:** у SelectAsync порядок становится `[крестик][шеврон]`
   (сейчас наоборот — иначе крестик прыгал бы между полями одной формы); у Combobox/SelectMulti крестик сдвигается на 4px;
   у всех исчезает наложение текста на крестик. Визуальные снапшоты не задеты: `clearable` есть только в
   TreeDemo / ImperativeHandles / MultiSelectDemo.
2. **Input `type=number|date`:** нативные спиннер и индикатор календаря окажутся левее (i) — они живут в content-box
   и сдвигаются резервом `pr-9`. Зато (i) на одной вертикали у всех инпутов и ничего не накладывается.
3. **InputPassword:** (i) сдвигается на 24px при появлении глаза (первый символ) — буквальное следствие правила порядка.
4. **Checkbox/Switch с обоими prop'ами** покажут две иконки — следствие независимости prop'ов, документируется.
5. **`labelTooltip` статичен** (как `description`): смена через `updateComponentProps` не подхватывается.
6. **`aria-label` — `'Подсказка'`** (строки кита и так смешаны RU/EN; i18n дефолтных строк — отдельная задача).
7. Каждая (i) — остановка Tab (иначе не работает фокус). RadioGroup — единственный с per-option подсказками.
8. InfoHint не узел палитры билдера; сторонние компоненты без `withFormControl` должны сами срезать `labelTooltip`.

## Verification

- **CDK:** из `packages/reformer-cdk` — `npx tsc --noEmit -p tsconfig.json`, `npm run test -w @reformer/cdk`
  (сравнить базовый уровень tsc-ошибок до и после). **Никогда `tsc -b` из корня.**
- **ui-kit** (SSR + regex; текст в Portal не виден, виден скрытый span):
  `info-hint.test.tsx`, `info-hint-toggle.test.ts` (матрица), `fields/field-tooltip.test.tsx` (без `tooltip` и с `''` разметка
  `toBe` разметке голого примитива; inside/outside; слияние `aria-describedby`; `displayName`),
  `with-form-control.test.tsx` (`labelTooltip` не в DOM), `fields/props-schema.test.ts` (страж общей схемы),
  **`fields/field-tooltip.coverage.test.tsx`** — табличный тест по всем 24 `*Field`, список равен `defaultPropSchemas`
  (новое поле без подсказки уронит тест), `form-field.test.tsx` (иконка вне `<label>`, порядок id `hint desc`, без prop'а нет ряда),
  дополнения в тестах select / combobox×4 / select-multi / input-password / native-select / date-picker / file-upload / checkbox / switch / radio-group.
- **Гейты:** `check:catalog`, `check:packaging`, `package-exports.test.ts`, `npm run size:check`, снапшот builder-stack.
- **E2E `field-tooltips`:** hover / Tab+Escape / клик мышью; тач (`hasTouch`, `tap()`): открыл — держит — повторный тап закрыл — тап мимо закрыл;
  изоляция (клик по (i) не меняет `aria-checked`, не открывает listbox, нет `filechooser`); порядок по bounding box
  `X.x < info.x < шеврон.x`; длинное значение не заходит под кластер; `disable()` — иконка активна; `checkAriaValidity` + axe; renderer-путь.
- Полный прогон существующих e2e — 54 визуальных снапшота должны остаться без изменений.

## Трекинг и коммиты

- До кода: эпик + задачи по этапам в beads (`bd create`, `--parent`), в конце `bd close` и `bd export -o .beads/issues.jsonl`.
- Коммиты — **только по явной просьбе**. Релиз path-based, поэтому раздельно по пакетам:
  `feat(reformer-cdk)` → `feat(reformer-ui-kit)` → `test(...)` снапшот builder-stack → hexa → `feat(react-playground)` + e2e → `docs(docs)`.
  Сообщение через файл → `npx --no commitlint` → `git commit -F`.

## Critical files

- `packages/reformer-cdk/src/components/form-field/{types.ts,FormFieldRoot.tsx,FormFieldControl.tsx,useFormField.ts}`
- `packages/reformer-ui-kit/src/components/form-field/{form-field.tsx,form-field.props.ts}`
- `packages/reformer-ui-kit/src/fields/{with-form-control.tsx,props-schema.ts}` + новые `field-tooltip.tsx`, `field-common.props.ts`
- `packages/reformer-ui-kit/src/components/info-hint/**` (новый)
- `packages/reformer-ui-kit/src/components/select/variants/async/select-async.tsx`, `combobox/variants/*/`, `input-password/…/input-password-base.tsx`
- `packages/reformer-ui-kit/scripts/generate-catalog.ts`
