# Словарь классов `className` переезжает из билдера в JSON ui-kit'а

## Context

Список Tailwind-классов для автодополнения поля `className` в инспекторе билдера захардкожен в
[tailwind-classes.ts](projects/reformer-builder/src/lib/tailwind-classes.ts) — 352 строки, единственный
экспорт `TAILWIND_CLASSES: string[]`, единственный потребитель
[ClassNameField.tsx:16](projects/reformer-builder/src/panels/ClassNameField.tsx#L16).

Это неверно по двум причинам:

1. **Знание чужое.** Семантические токены (`bg-muted`, `text-foreground`, `border-border`) объявляет
   дизайн-система в [theme.css](packages/reformer-ui-kit/src/styles/theme.css) — билдер их только
   переписывает от руки и уже разошёлся с источником (см. «Побочная находка»).
2. **Список применяется ко всем китам.** Для `hexa-ui`, у которого `styles.mode: "standalone"`,
   Tailwind-подсказки заведомо неработающие.

Плюс новое требование: нужно ограничивать, **чем разрешено стилизовать конкретный компонент** —
html-тегам любой класс, полям формы только отступы, отдельным компонентам можно запретить вовсе.

Итог: словарь классов поставляет кит в своём catalog-JSON, разбитый на именованные группы; запись
каталога ссылается на id групп. Билдер своего списка не держит вовсе.

## Принятые решения

| Вопрос | Решение |
|---|---|
| Где живёт словарь | `kit.styles.classNames` в catalog-JSON |
| Форма | массив групп `{ id, label, classes[] }` со **стабильным `id`** |
| Ограничение по компоненту | дефолт по роли `kit.styles.classGroupsByRole` + точечный override `classGroups` в записи |
| Что считать «отступами» для полей | только `m-* p-* gap-* space-*` (группа `spacing`) |
| Кит не поставил словарь | подсказок нет, поле — обычный свободный ввод. Fallback'а в билдере НЕТ |
| `classGroups: []` | подсказок нет; поле остаётся редактируемым свободным вводом |
| UX поля | **не меняется**: подсказки только при непустом токене, плоский список, лимит 24 |
| `tailwind-classes.ts` | удаляется целиком |

Следствие последних двух строк: `Inspector.tsx` в части показа/скрытия строки `className` **не
трогаем** — группы влияют только на содержимое выпадашки.

> Замечание к `classGroupsByRole`: тот же результат достижим без расширения контракта — генератор кита
> мог бы проставить `classGroups: ["spacing"]` прямо в 18 field-записей (полей в каталоге всего 18 из
> 168). Декларативный вариант выбран сознательно; он же аккуратнее работает с синтетическими записями
> билдера (см. ниже). Плата — второй механизм в контракте, взаимодействие которого с per-record
> override нужно задокументировать и покрыть тестом.

## Формат в каталоге

```jsonc
// packages/reformer-ui-kit/component-catalog.json
{
  "$schema": "../../projects/reformer-builder/src/catalog/component-catalog.schema.json",
  "version": "2.0",                       // было "1.0": файл теперь использует блок kit
  "kit": {
    "styles": {
      "classNames": [
        { "id": "spacing", "label": "Отступы", "classes": ["gap-2", "p-4", "mt-2", "…"] },
        { "id": "flex", "label": "Флексбокс и выравнивание", "classes": ["flex-col", "…"] }
        // … 11 групп
      ],
      "classGroupsByRole": {
        "field": ["spacing"],   // 18 записей: полю можно править расположение, но не вид
        "container": "*",       // 150 записей: всё
        "array": "*"
      }
    }
  },
  "components": [
    { "name": "Input", "role": "field", "propsSchema": { /* … */ } },
    // точечные исключения (в первом заходе не нужны, механизм заводится сразу):
    { "name": "Slider", "role": "field", "classGroups": ["spacing", "sizing"], "propsSchema": {} }
  ]
}
```

**Правило разрешения** — первое сработавшее:

```
запись.classGroups  →  kit.styles.classGroupsByRole[запись.role]  →  "*" (все группы)
```

`"*"` и отсутствие правила = ограничений нет. Пустой массив = разрешённых групп нет → подсказок нет.
Отсутствие поля ≠ `[]` — это принципиально и закрепляется тестом.

Синтетические записи билдера (`$html(div|span|…)`, `FormArray`, `Wizard`, `Step` из
[synthetic-entries.ts](projects/reformer-builder/src/catalog/synthetic-entries.ts)) добавляются в
`json.components` в [contract.ts:72](projects/reformer-builder/src/catalog/contract.ts#L72) и проходят
через то же правило: их роли — `container`/`array` → `"*"` → все группы. Ровно требуемое поведение для
html-тегов, без исключений в коде.

## Таксономия групп (11)

19 категорий-комментариев в `RAW` слишком дробные для управления доступом (`Gap`/`Padding`/`Margin`/
`Space between` — одно разрешение). Консолидация:

| `id` | `label` | Исходные категории `tailwind-classes.ts` |
|---|---|---|
| `layout` | Раскладка | Display (77–86), Overflow (312–319) |
| `flex` | Флексбокс и выравнивание | Flexbox (88–101), Align/justify (103–123) |
| `grid` | Грид | Grid (125–141) |
| `spacing` | Отступы | Gap, Padding, Margin, Space between (143–168) |
| `sizing` | Размеры | Width, Height, Min/Max sizing (170–214) |
| `position` | Позиционирование | Position (293–310) |
| `typography` | Типографика | Typography (216–259) |
| `borders` | Границы и скругления | Borders/radius (261–273) |
| `effects` | Эффекты | Effects (275–291) |
| `color` | Цвета и токены темы | Semantic color tokens (335–344), Palette subset (345–347) |
| `interactivity` | Интерактивность | Interactivity/misc (320–334) |

Два решения внутри маппинга:

- `Align/justify` → в `flex`, не отдельной группой: разрешать выравнивание отдельно от флекса
  практического смысла не имеет.
- Толщина рамки (`border`, `border-2`, `border-t`) → `borders`, а цвет рамки (`border-border`,
  `border-destructive`) → `color`. «Можно менять толщину, но не палитру» — осмысленное разрешение,
  обратное — нет.

Порядок групп в массиве = порядок подсказок после уплощения.

## Изменения по файлам

### Коммит 1 — контракт (только билдер)

**[component-catalog.schema.json](projects/reformer-builder/src/catalog/component-catalog.schema.json)** —
два места, оба с `additionalProperties: false`:

- в `kit.styles.properties` (сейчас строки 164–178) добавить `classNames` (массив объектов
  `{ id, label, classes }`, все три `required`; `id` с `"pattern": "^[a-z][a-z0-9-]*$"`) и
  `classGroupsByRole` (`additionalProperties` = `oneOf: [{ "const": "*" }, { "type": "array", "items": { "type": "string" } }]`);
- в `properties.components.items.properties` (сейчас строки 20–80) добавить `classGroups`
  (`{ "type": "array", "items": { "type": "string", "minLength": 1 } }`).

В `description` обоих полей явно записать «отсутствие ≠ пустой массив» и «`id` стабилен, переименование —
ломающее изменение».

**[kits/types.ts](projects/reformer-builder/src/kits/types.ts)** — новый `KitClassGroup { id; label; classes }`;
в `KitStyles` (строки 94–104) поля `classNames?`, `classGroupsByRole?`; в `KitRecordExt` (126–135) поле
`classGroups?`; в `KitDescriptor` (163–194) — `styles` с обязательным `classNames` и новое поле:

```ts
/**
 * Имя записи → РАЗРЕШЁННЫЕ группы классов. Отсутствие ключа = ограничений нет (все группы кита),
 * пустое множество = разрешённых групп нет. Та же семантика «отсутствие ≠ пусто», что у
 * {@link previewPolicy}.
 */
classGroupPolicy: ReadonlyMap<string, ReadonlySet<string>>;
```

Реэкспорт `KitClassGroup` в `kits/index.ts`.

**[catalog/types.ts](projects/reformer-builder/src/catalog/types.ts)** — в `CatalogRecord` (строки 68–89)
рядом с `preview`/`leaf` добавить `classGroups?: string[]`. В `CatalogEntry` **не** копируем: панель берёт
политику из дескриптора по имени (побочный плюс — снапшот `catalog-equivalence` не «дрожит»).

**[kits/descriptor.ts](projects/reformer-builder/src/kits/descriptor.ts)** — новая функция рядом с
`buildPreviewPolicy`/`buildLeafComponents` (строки 34–65), по их образцу:

```ts
function buildClassGroupPolicy(
  records: CatalogRecord[],
  styles: KitStyles | undefined
): ReadonlyMap<string, ReadonlySet<string>> {
  const byRole = styles?.classGroupsByRole ?? {};
  const map = new Map<string, ReadonlySet<string>>();
  for (const r of records) {
    const rule = r.classGroups ?? byRole[r.role];
    if (rule === undefined || rule === '*') continue; // ограничений нет — ключ не заводим
    map.set(r.name, new Set(rule));
  }
  return map;
}
```

и в `toDescriptor` (строки 101–116): `classNames: kit.styles?.classNames ?? []` в ветку `styles`,
`classGroupPolicy: buildClassGroupPolicy(records, kit.styles)` рядом с `previewPolicy`.
[legacy-reformer-ui-kit.ts](projects/reformer-builder/src/kits/legacy-reformer-ui-kit.ts) не меняется —
у билдера словаря нет.

Тесты коммита: дополнения к `kits/descriptor.test.ts` и `catalog/contract.test.ts` (см. «Тесты»).
Зелёный, потому что потребителей ещё нет.

### Коммит 2 — словарь и генерация (кит + один ассерт билдера)

**Новый [class-catalog.ts](packages/reformer-ui-kit/src/styles/class-catalog.ts)** — сюда переезжает
содержимое `tailwind-classes.ts`, разложенное по 11 группам. Переиспользуем приёмы оригинала: шкалу
`SPACE` и хелпер `scale(prefix)`, списки `RADII`/`PALETTE`/`SHADES`. Ключевое отличие — цветовые токены
берутся ровно из `@theme inline` [theme.css:17-53](packages/reformer-ui-kit/src/styles/theme.css#L17-L53),
включая 13 сегодня отсутствующих (`chart-1…5`, `sidebar-*`) и без несуществующего
`destructive-foreground`.

```ts
export interface ClassGroup { id: string; label: string; classes: string[] }
export const CLASS_GROUPS: ClassGroup[] = [ /* 11 групп в порядке подсказок */ ];
/** Группы для form-control: расположение поля в форме — да, вид — нет (вид задаёт дизайн-система). */
export const FIELD_CLASS_GROUPS = ['spacing'];
```

Развёртка токенов в готовые строки (`bg-` + токен, `rounded-` + радиус) делается **здесь**, а не в
билдере: на проводе только готовые к вставке классы, билдер остаётся тупым. Префиксы для токенов —
кураторское решение (полный перебор 31 токен × 8 префиксов дал бы мусор вроде `divide-chart-3`).

Файл попадает в npm-тарбол через уже существующий `files: ["src/styles"]`; в `exports` и `dist` не идёт —
его импортируют только генератор и тест.

**[scripts/generate-catalog.ts](packages/reformer-ui-kit/scripts/generate-catalog.ts)** — в хвосте
(строки 263–267) добавить блок `kit` и поднять версию:

```ts
import { CLASS_GROUPS, FIELD_CLASS_GROUPS } from '../src/styles/class-catalog';
// …
const catalog = {
  $schema: SCHEMA_REF,
  version: '2.0', // файл использует блок kit
  kit: {
    styles: {
      classNames: CLASS_GROUPS,
      classGroupsByRole: { field: FIELD_CLASS_GROUPS, container: '*', array: '*' },
    },
  },
  components,
};
```

Per-record `classGroups` генератор не проставляет — политику полностью покрывает `classGroupsByRole`.
Прогнать `npm run generate:catalog`, закоммитить перегенерированный `component-catalog.json`.

Бамп версии безопасен: `SUPPORTED_CATALOG_CONTRACT_VERSIONS` нигде не используется, `contract.test.ts`
проверяет только непустоту строки, фингерпринт снапшота версию не включает.

**Здесь же — правка ассерта** [catalog-equivalence.test.ts:73](projects/reformer-builder/src/kits/catalog-equivalence.test.ts#L73):
`expect(loadCatalogJson().kit).toBeUndefined()` перестаёт быть верным. Переписать так, чтобы стерёг то
же самое точнее: из блока `kit` каталог несёт только `styles`, а идентификация/версия/резолв
по-прежнему приходят из дефолтов билдера (`id === 'reformer-ui-kit'`, `version === 'workspace'`,
`styles.mode === 'tokens'`). Кросс-пакетный коммит здесь неизбежен, иначе билдер краснеет.

Снапшот `src/kits/__snapshots__/catalog-equivalence.test.ts.snap` менять **не** нужно.

### Коммит 3 — потребление в билдере

**Новый [catalog/class-names.ts](projects/reformer-builder/src/catalog/class-names.ts)**:

```ts
/** Классы, которыми кит разрешает стилизовать компонент. Порядок групп сохранён, дубли схлопнуты. */
export function classNamesFor(componentName: string): string[]

/** Подсказки по токену: подстрочный фильтр минус уже использованные. Вынесено ради node-теста. */
export function suggestClasses(
  all: readonly string[], token: string, used: ReadonlySet<string>, limit: number
): string[]

/** Сброс мемо (тесты подменяют активный дескриптор). */
export function resetClassNamesCache(): void
```

`classNamesFor` вызывает `getCatalog()` (мемоизирован — каталог второй раз не строится; тот же приём,
что в `catalog/compound`), затем читает `getActiveDescriptor()`: `classGroupPolicy.get(name)` — если
ключа нет, берём все `styles.classNames`, иначе фильтруем по множеству. Результат мемоизируется по
имени компонента: смена кита идёт через `location.reload()` (инвариант зафиксирован в
[kits/selection.ts:9-12](projects/reformer-builder/src/kits/selection.ts#L9-L12)), поэтому подписка не
нужна. Реэкспорт из `catalog/index.ts` рядом с `compound`.

**[ClassNameField.tsx](projects/reformer-builder/src/panels/ClassNameField.tsx)** — минимальный диф:
убрать импорт `TAILWIND_CLASSES` (строка 16), принять новый проп `classes: string[]`, заменить тело
фильтра (строки 52–57) вызовом `suggestClasses(classes, token, used, MAX_SUGGESTIONS)`. Всё остальное —
`complete`, клавиатура, `showList`, `MAX_SUGGESTIONS = 24`, разметка — без изменений. Переписать докблок
модуля: подсказки приходят из словаря активного кита, кит может ограничить набор групп, словаря нет —
поле работает как обычный свободный ввод.

**[Inspector.tsx](projects/reformer-builder/src/panels/Inspector.tsx)** — `entry` уже вычислен на
строке 346. Рядом с `rawGroups` (353) добавить `const classNames = entry ? classNamesFor(entry.name) : []`,
пробросить в `PropRow` (378) и оттуда в `ClassNameField` (232). Больше ничего: показ/скрытие строки
`className` не меняем.

**Удалить [tailwind-classes.ts](projects/reformer-builder/src/lib/tailwind-classes.ts)** целиком.
Проверено grep'ом: импортёр ровно один, ни docs, ни e2e, ни knip на него не смотрят.

### Коммит 4 — документация

[add-ui-kit.md](projects/reformer-builder/docs/instructions/add-ui-kit.md): в jsonc-справочник блока
`kit` (строки 214–238) добавить `styles.classNames` и `classGroupsByRole`, в таблицу полей записи
(241–248) — строку `classGroups`, плюс короткий раздел «Как ограничить стилизацию компонента» с явным
«отсутствие ≠ `[]`».

## Что произойдёт с остальными китами

| Каталог | После изменения |
|---|---|
| `@reformer/ui-kit` (дефолтный) | Полный словарь; полям — только `spacing` |
| [hexa-ui](packages/ui-kits/reformer-hexa-ui/catalog.json) (`mode: "standalone"`) | Секции нет → подсказок нет. **Это починка**: сегодня ему предлагаются заведомо неработающие Tailwind-классы |
| `reformer-ui-kit-11` (генерируется `scripts/gen-kit-catalog.mjs`) | Секции нет → подсказок нет. Осознанный регресс: словарь из чужого пакета вывести нечем (`@reformer/ui-kit@11` не экспортирует ни `./catalog`, ни токены). Путь расширения — флаг `--class-catalog <file>`, вне этой задачи |
| Клиентский `--catalog` | Секции нет → подсказок нет; клиент может добавить свою — контракт для этого и расширяется |

## Тесты

**Дополнить существующие:**

- `kits/descriptor.test.ts` — «неявный кит»: `styles.classNames === []`, `classGroupPolicy.size === 0`;
  кит со словарём отдаёт его как есть; `classGroups: ['spacing']` → множество в карте;
  **`classGroups: []` → ключ ЕСТЬ, множество пустое** (главный ассерт фичи); запись без `classGroups`
  и без правила роли → ключа нет; `classGroupsByRole.field` применяется к field-записям; per-record
  `classGroups` побеждает правило роли; `"*"` в правиле роли ключа не создаёт.
- `catalog/contract.test.ts` — AJV: валидный `classNames`/`classGroupsByRole`/`classGroups` проходят;
  `additionalProperties: false` ловит мусор в элементе группы и в `kit.styles`; группа без
  `id`/`label`/`classes` отклоняется; `id` с заглавной буквой отклоняется по `pattern`.
- `kits/registry.test.ts` — кросс-ссылочный guard, которого AJV не даёт: каждый id в `classGroups` и в
  `classGroupsByRole` любого кита существует в его словаре. Плюс: вшитый ui-kit поставляет непустой
  словарь (если генератор перестанет писать секцию, автодополнение молча исчезнет).

**Новые:**

- `catalog/class-names.test.ts` — без ограничений = весь словарь; `['spacing']` = одна группа в порядке
  кита; `[]` → пустой список; **пустой словарь кита ≠ ограничение**; неизвестный id просто не находится;
  уплощение сохраняет порядок групп и схлопывает дубли; `suggestClasses` — пустой токен → `[]`,
  подстрочный матч, исключение использованных, сам токен не исключается, лимит. Управление состоянием —
  `setActiveDescriptor`/`resetActiveDescriptor` + `resetClassNamesCache()`.
- `packages/reformer-ui-kit/src/styles/class-catalog.test.ts` — guard дрейфа темы: парсим `@theme inline`
  из `theme.css` и проверяем, что (а) в словаре нет цветовых классов под несуществующие токены,
  (б) новые токены темы не забыты; id групп уникальны и в kebab-case; классы не дублируются между
  группами; `FIELD_CLASS_GROUPS` ссылается на существующие группы.

Парсинг CSS живёт именно в тесте, а не в генераторе: сбой регулярки там дал бы молча испорченный
артефакт, здесь — красный тест.

**Чего не делаем:** React-тестов `ClassNameField`. У билдера `vitest.config.ts` — `environment: 'node'`,
`include: ['src/**/*.test.ts']` (`.tsx` не подхватывается), testing-library не установлен. Поэтому
логика вынесена в `suggestClasses`/`classNamesFor` и покрыта node-тестами — это первое покрытие
поведения поля, которого сегодня нет вовсе.

## Verification

```bash
# 1. Кит: словарь и его согласованность с темой
cd packages/reformer-ui-kit
npm run generate:catalog
npm test -- class-catalog

# 2. Каталог валиден по контракту, дескриптор собирается, политика верна
cd ../../projects/reformer-builder
npx vitest run src/catalog src/kits

# 3. Полный прогон + типы + сборка
npm test && npx tsc --noEmit && npm run build
```

Ручная проверка в билдере (`npm run dev` в `projects/reformer-builder`):

1. Положить на canvas `Box`, выбрать, в инспекторе набрать `ga` в `Class Name` → предлагаются `gap-*`;
   набрать `bg-` → предлагаются `bg-muted`, `bg-primary`, `bg-chart-1` (новые токены).
2. Выбрать `Input` → `ga` предлагает `gap-*`, но `bg-` **не предлагает ничего**, `text-sm` тоже:
   полю разрешена только группа `spacing`.
3. Положить `$html(div)` → доступны все группы (проверить `bg-` и `grid-cols-`).
4. Переключить кит на `hexa-ui` (страница перезагрузится) → поле `className` работает как свободный
   ввод, выпадашка не появляется.

Проверка размера: словарь добавляет ~20 КБ к `component-catalog.json` (~+12 %), в gzip ~+2,6 КБ.
`.size-limit.json` каталог не гейтит, но стоит сверить вывод `npm run build`.

## Побочная находка (чинить отдельно, не в этой задаче)

`bg-destructive-foreground` и `text-destructive-foreground` из сегодняшнего `SEMANTIC`
([tailwind-classes.ts:50](projects/reformer-builder/src/lib/tailwind-classes.ts#L50)) — **мёртвые
классы**: токена `--color-destructive-foreground` в `@theme inline` нет, Tailwind v4 такую утилиту не
сгенерирует. При этом `text-destructive-foreground` используется в самом ките —
[form-array.tsx:52](packages/reformer-ui-kit/src/components/form-array/variants/base/form-array.tsx#L52)
и [form-array-section.tsx:267](packages/reformer-ui-kit/src/components/form-array/variants/base/form-array-section.tsx#L267),
то есть текст кнопки удаления там не перекрашивается. Guard-тест из коммита 2 это вскроет. Чинить одним
из двух способов — добавить токен в `theme.css` либо заменить класс в компонентах — отдельным коммитом,
чтобы не мешать фичу с починкой темы.
