# Правила визуального оформления форм в `@reformer/ui-kit`

## Context

В репозитории нет документа, описывающего, как раскладывать форму: какие отступы,
как группировать поля, чем задавать сетку. Из-за этого сложилось **два несогласованных
источника истины**, и оба уезжают агентам:

| Аспект | MCP-скелет (`project-detector.ts` → промпт агенту) | Живой эталон (`complex-multy-step-form`) |
| --- | --- | --- |
| Сетка полей | `grid grid-cols-1 md:grid-cols-2 gap-4` | `grid grid-cols-2 gap-4` (без брейкпоинтов) |
| Секция | card wrap `bg-white border rounded-xl shadow-sm p-6` | голый `div.space-y-4` |
| Цвета | `bg-white`, `text-gray-900` (палитра) | `bg-card`, `text-card-foreground` (токены) |
| Футер | `flex justify-between gap-3 pt-4 border-t` | `flex gap-4` + распорка `flex-1` |

При этом в коде уже есть **кодифицированное** правило, которому противоречит MCP-скелет —
[class-catalog.ts:492-497](packages/reformer-ui-kit/src/styles/class-catalog.ts#L492-L497):

> «Чем разрешено стилизовать form-control: класс правит РАСПОЛОЖЕНИЕ поля в форме, но не его
> вид — вид задаёт дизайн-система, иначе билдером можно собрать форму, не похожую на кит.»

Дополнительно `Box`, `Section` и `Collapsible` числятся в таблице компонентов
[01-overview.md](packages/reformer-ui-kit/docs/llms/01-overview.md), но задокументированы
отсылкой «см. рендерер» — в самом ui-kit по ним нет ничего.

**Результат:** новый нормативный документ в `docs/llms` ui-kit + приведение MCP-промптов
в соответствие с ним, чтобы агент получал из промпта и из доки одно и то же.

## Принятый канон

**Общие UI-design правила раскладки. Никакой кастомной стилизации.**

Разрешено писать руками в `className` — только группы классов из
[class-catalog.ts](packages/reformer-ui-kit/src/styles/class-catalog.ts):
`layout`, `flex`, `grid`, `spacing`, `responsive`, `sizing`.
Единственное исключение — фиксированная пара для веса заголовков, **без цвета**:
`text-xl font-bold` (заголовок шага) и `text-lg font-semibold` (заголовок группы).

Запрещено руками: `bg-*`, `text-<цвет>-<оттенок>`, `border-<цвет>`, `shadow-*`, `rounded-*`.
Вид даёт компонент кита:

| Нужен вид | Компонент | Не писать руками |
| --- | --- | --- |
| Карточка | `Card` / `CardHeader` / `CardTitle` / `CardContent` | `bg-white border rounded-xl shadow-sm p-6` |
| Плашка, предупреждение | `Alert` / `AlertTitle` / `AlertDescription` | `p-4 bg-blue-50 border border-blue-200 rounded-md` |
| Разделитель | `Separator` | `border-t` |
| Секция с заголовком | `Section` (`title`, `titleAs`) | ручной `<h3>` с цветом |

Полю (`FormField` и контролы) — **только группа `spacing`**; это уже кодифицировано
`FIELD_CLASS_GROUPS` и уходит в `classGroupsByRole.field` каталога.

### Шкала вертикального ритма (три уровня)

| Уровень | Класс | Подтверждение |
| --- | --- | --- |
| Шаг / корень страницы | `space-y-6` | 15 употреблений |
| Логическая группа полей | `space-y-4` | 91 употребление |
| Элемент массива (`FormArray` item) | `space-y-3` | 27 употреблений; дефолт `FormArraySection` |
| Внутри поля | **ничего** | `Field` даёт `gap-3`, `FieldContent` — `gap-1.5` |

### Сетка полей

- Пара связанных полей — `grid grid-cols-1 md:grid-cols-2 gap-4`.
- Тройка (ФИО; серия/номер/дата) — `grid grid-cols-1 md:grid-cols-3 gap-4`.
- Full-width поле — **вне** grid, прямо в `space-y-*`. `col-span-*` в формах не используем.
- Gap сетки полей — всегда `gap-4` (внутри элемента массива допустим `gap-3`).
- Брейкпоинты — только `sm:` / `md:` / `lg:` из курируемого списка. `xl:` / `2xl:` не
  используем ([обосновано в class-catalog.ts:230-232](packages/reformer-ui-kit/src/styles/class-catalog.ts#L230-L232)).
- Ширину формы задаёт шелл (`container mx-auto`); если нужна своя — `max-w-2xl` /
  `max-w-screen-md`. **`max-w-4xl` в курируемом каталоге отсутствует** и в билдере не
  попадёт в safelist — сейчас MCP рекомендует именно его.

## Что делаем

### 1. Новый документ `packages/reformer-ui-kit/docs/llms/11-form-layout.md`

Ограничения, продиктованные инфраструктурой (проверены по коду):

- Имя строго `11-<kebab>.md` — генератор сортирует каталог `readdirSync().sort()`.
- Без frontmatter, ровно один `#` H1; первый абзац становится `topics[].purpose`.
- **Каждый `##`-заголовок обязан содержать латиницу.** `slugify` в
  [search-docs.ts](packages/reformer-mcp/src/tools/search-docs.ts) вырезает не-ASCII;
  чисто кириллический заголовок даёт пустой слаг, и секция выпадает из `search_docs`,
  из `resources/list` и из `llms-index.json` (так уже потерялась «Базовое использование»
  в `07-form-wizard.md`).
- Бюджет: файл ≤ ~10 000 символов (`RECIPE_MAX_CHARS` режет `find_recipe`), каждая
  `##`-секция ≤ ~6 000 (`INLINE_SECTION_LIMIT`).
- Не начинать строки внутри код-фенсов с `## ` — генератор `llms.txt` фенсы не отслеживает.

Структура (`##`-секции — единицы индексации MCP):

| Секция | Содержание |
| --- | --- |
| `# Form layout — отступы, сетка и группировка полей` + абзац-purpose | что документ нормирует |
| `## Key Concepts` | правила буллетами — уезжают в `get_context → Key rules` |
| `## Spacing scale` | таблица трёх уровней ритма; почему внутри поля ничего не пишем |
| `## Field grid` | сетка, full-width, адаптив, разрешённые брейкпоинты |
| `## Grouping and sections` | `Section`, `Card`, `Alert`, `FormArraySection`; заголовок + действие справа |
| `## Layout across targets` | таблица соответствия TSX ↔ RenderSchema ↔ JSON |
| `## Common Patterns` | один сквозной пример шага формы |
| `## Anti-patterns` | фенс с `// ❌` / `// ✅` — парсится в структурные `antiPatterns` |
| `## See also` | ссылки на 04, 05, 07, 08 и на доки рендереров |

Таблица соответствия трёх flow (изоморфизм подтверждён тем, что
`complex-multy-step-form-renderer` и `-renderer-json` — дословные порты TSX-версии):

| TSX | RenderSchema | JSON |
| --- | --- | --- |
| `<div className="space-y-6">` | `{ component: Box, componentProps: { className: 'space-y-6' } }` | `{ "component": "$component(Box)", "componentProps": { "className": "space-y-6" } }` |
| `<h3>` + группа | `{ component: Section, componentProps: { title, titleAs, titleClassName, className } }` | `$component(Section)` + те же props |
| `<div className="grid …">` | `Box` + тот же `className` | `$component(Box)` + тот же `className` |
| `<Card>` | `component: Card` | `$component(Card)` — **требует `reg.component('Card', Card)`** |

Последняя строка — важное практическое ограничение: в
[registry.ts](projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v20/registry.ts)
сейчас регистрируются только `Box`, `Section`, `FormArray`, `Wizard`, `Step`.

Переиспользуем (не переписываем): `Box`, `Section`, `Card`, `Alert`, `Separator`,
`FormField`, `FormArraySection` — все экспортируются из корня `@reformer/ui-kit`
и имеют подмодульные точки входа.

**Две неточности в соседних доках не переносить** (найдены при разведке, чинятся отдельно):
`03-choice-fields.md:108` утверждает про RadioGroup `flex flex-col gap-2`, в коде —
`grid gap-3`; `05-form-field-integration.md:16-27` показывает плоский `<div>` вместо
`Field` → `FieldContent`.

### 2. Реестры в `01-overview.md`

Две ручные точки входа, которые ничем не форсятся:

- таблица `## Components` — строку `Box`, `Section`, `Collapsible` перевести с
  «см. рендерер» на новый файл;
- список `## See also` — добавить пункт.

### 3. Синхронизация MCP-промптов

Убрать кастомную стилизацию в трёх местах, заменив её компонентами кита:

- [project-detector.ts](packages/reformer-mcp/src/utils/project-detector.ts) —
  `renderLayoutSkeletonBlock` (card wrap → `Card`; `text-gray-900`/`text-gray-300`/
  `text-gray-500` убрать; `max-w-4xl` → `max-w-2xl`; футер `pt-4 border-t` → `Separator` +
  `flex gap-4`) и блок Tailwind-рекомендаций (строка `Typography: … text-gray-900` и
  `Состояния полей: focus:ring-2 focus:ring-blue-500` — состояния даёт сам контрол).
- [add-wizard.md:237-238](packages/reformer-mcp/src/prompts/templates/add-wizard.md#L237-L238)
  «Visual baseline» — заменить строки про card wrap и page container. Требования про
  иконки, en-dashes, progress-text и `testId` — **оставить**: это UX-контент, не стилизация.
  Пункт чек-листа на строке 272 переформулировать под новый канон.
- [create-form.ts:119](packages/reformer-mcp/src/prompts/create-form.ts#L119) — fallback-строка.

Добавить в новый документ ссылку-якорь из промптов, чтобы источник истины был один.

### 4. Алиасы поиска (опционально, дёшево)

`RECIPE_ALIASES` в [find-recipe.ts](packages/reformer-mcp/src/tools/find-recipe.ts):
`spacing`, `styling`, `visual`, `grouping`, `отступы` → `form-layout`. Без этого
`find_recipe('form-layout')` уже даёт точное совпадение (100), но `find_recipe('layout')`
уйдёт в `04-layout-and-buttons` (равный счёт 75, побеждает меньший `NN`).

### 5. Регенерация артефактов

```bash
npm run generate:llms -w @reformer/ui-kit
```

Пишет `llms.txt` **и** `llms-index.json`. Повторный запуск обязан дать пустой diff.
Если изменится JSDoc в MCP — прогнать генерацию и для `@reformer/mcp`.

## Verification

1. **Идемпотентность генератора**
   `npm run generate:llms -w @reformer/ui-kit` дважды → `git diff` пуст после второго прогона.
2. **CI-гейт локально**
   `git diff --exit-code -- 'packages/*/llms.txt'` после коммита артефактов (в
   [.github/workflows/test.yml](.github/workflows/test.yml) это жёсткий шаг).
3. **Слаги секций не пустые** — критичная проверка, ради неё и требование латиницы:
   ```bash
   node -e "const i=require('./packages/reformer-ui-kit/llms-index.json');
     const t=i.topics.find(t=>t.id==='form-layout');
     console.log(t.sections.map(s=>s.heading+' -> '+s.slug).join('\n'))"
   ```
   Ни один `slug` не должен быть пустым; секций должно быть 8.
4. **Находимость через MCP** (после сборки пакета):
   - `find_recipe({ topic: 'form-layout', package: 'ui-kit' })` → отдаёт новый файл целиком
     и **без пометки об усечении** (иначе файл перерос `RECIPE_MAX_CHARS` — резать);
   - `search_docs({ query: 'отступы между полями группировка сетка' })` → новый документ
     в топе;
   - `get_context({ task: 'свёрстать многошаговую форму' })` → правила из `## Key Concepts`
     видны в разделе `Key rules`, а `❌/✅`-пары — в `Anti-patterns`.
5. **Тесты MCP** — `npm test -w @reformer/mcp` (важны `index-artifacts`, `find-recipe`,
   `search-docs`, `prompt-imports`, `resources-catalog`) и
   `node packages/reformer-mcp/scripts/check-packaging.mjs`.
6. **Промпты рендерятся после правки** — `node packages/reformer-mcp/scripts/check-mcp-render.mjs`
   и снапшот `node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/baseline`,
   глазами сверить `create-form` и `add-wizard` на отсутствие `bg-white` / `text-gray-`.
7. **Классы из канона реально существуют в каталоге**
   ```bash
   node -e "const c=require('./packages/reformer-ui-kit/component-catalog.json');
     const all=new Set(Object.values(c.kit.styles.classNames).flat());
     ['space-y-6','space-y-4','space-y-3','gap-4','grid-cols-1','md:grid-cols-2',
      'md:grid-cols-3','max-w-2xl','text-xl','font-bold','text-lg','font-semibold']
       .forEach(k=>console.log(k, all.has(k)))"
   ```
   Все — `true`. (Именно так выяснилось, что `max-w-4xl` отсутствует.)
8. **Спеки не тронуты** — `git status docs/specs/` пуст (правило репозитория).

## Заметки по процессу

- Артефакты `llms.txt` / `llms-index.json` руками не редактируются — только генератором.
- Файлы `docs/llms/**` в `.prettierignore`: переносы строк (~85–90 колонок) ставятся вручную.
- Завести bd-задачу на работу (`bd create`), по завершении — `bd close`; экспорт
  `bd export -o .beads/issues.jsonl` перед коммитом.
- **Коммит не делаю** — изменения остаются в рабочем дереве, пока не будет явной просьбы.
- Отдельной задачей (вне этого плана) стоит починить две неточности в
  `03-choice-fields.md` и `05-form-field-integration.md`.
