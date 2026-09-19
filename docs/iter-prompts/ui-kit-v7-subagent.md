# Sub-agent template — портирование одного shadcn-компонента в @reformer/ui-kit v7

Ты — суб-агент, портирующий **ОДИН** shadcn/ui-компонент в `@reformer/ui-kit` (v7-миграция) полным
вертикальным срезом. Работаешь строго по этому playbook. Эталоны уже в репозитории — равняйся на них.

## Вход (передаёт оркестратор)

- **`<cmp>`** — имя компонента (kebab-case каталог), напр. `checkbox`, `textarea`, `switch`.
- **Классификация**: `F` (form-control — объявляет адаптер формы) / презентационный; adapter-пресет (если F);
  `inline-label` (true для Checkbox/Switch/Toggle — сами рисуют подпись); Dep (тяжёлая зависимость).
- **Обязательные варианты** (мин. `base`; enhanced — если предписан). **Вариант для формы** (`x-exportName`).
- **Список каталогов-зависимостей** (для composite — читать только их `index.ts`).

## Эталоны (ПРОЧИТАЙ перед работой)

- `packages/reformer-ui-kit/src/components/button/**` — минимальный не-F срез (cva, data-slot, тест, structure).
- `packages/reformer-ui-kit/src/components/select/**` — полный F-срез: `variants/base` (compound) + `variants/async`
  (адаптер-статика + `select-async.props.ts` с `x-exportName` + страж `select.props.test.ts`), doc-config.
- `packages/reformer-ui-kit/src/fields/{field-control.ts, adapters.ts, props-schema.ts, seam.props.ts}` — `defineFieldControl`/адаптеры/схемы.
  Связывает поле с контролом обёртка (`FormField.Control` из cdk, рендерер) по статике `reformerAdapter`.
- `packages/reformer-ui-kit/src/components/form-field/form-field.tsx` — как FormField рендерит контрол.
- doc-эталоны: `projects/reformer-doc/src/components/demo/examples/{button,select}.tsx` + `docs/ui-kit/{button,select}.mdx`
  - `demo/types.ts` (ComponentDocConfig) + `demo/{field-demo,harness}.ts` + `demo/controls-from-schema.ts`.

## Инварианты (ЖЁСТКИЕ — verify-агент проверит)

1. **Пишешь ТОЛЬКО в**: `packages/reformer-ui-kit/src/components/<cmp>/**`;
   `projects/reformer-doc/src/components/demo/examples/<cmp>.tsx`; `projects/reformer-doc/docs/ui-kit/<cmp>.mdx`.
2. **НЕ трогаешь** общие файлы: `src/index.ts`, `src/meta.ts`, `package.json`, `vite.config.ts`, `components.json`,
   `src/fields/{adapters,field-control,props-schema,seam.props}.ts`, `src/styles/theme.css`; в reformer-doc —
   `demo/{ComponentDoc,types,field-demo,harness,index,controls-from-schema,...}.*`, `sidebars.ts`, `theme/MDXComponents.tsx`.
   Они генерируются/ведутся оркестратором.
3. **НЕ трогаешь** чужие `src/components/<other>/**` — только читаешь зависимости.
4. **Дословный порт `variants/base/*`**: правки только импорты (`@/lib/utils`, `@/components/<dep>`, unified `radix-ui`),
   `data-slot`, снятие `'use client'`. Никаких «улучшений» shadcn-кода (Риск отрыва от upstream).
5. **`data-testid` — на Root примитива** (Radix → `*Primitive.Root`), НЕ на wrapper и НЕ на скрытый bubble-input.
   RadioGroup: per-option `data-testid="input-<field>-<value>"` на каждом Item.
6. **inline-label**: контрол, рисующий подпись сам (CheckboxWithLabel/SwitchWithLabel), ОБЯЗАН объявить
   `defineFieldControl(C, { adapter, layout: 'inline-label' })`
   (иначе подпись FormField задвоится — form-field.tsx это НЕ энфорсит).
7. Стили — cva/Tailwind внутри реализации (НЕ отдельные под-каталоги «стилевых вариантов»).
8. Нужен новый adapter-пресет — **стоп-условие** (запросить оркестратора, не добавлять в общий adapters.ts).

## Структура каталога

```
src/components/<cmp>/
  variants/base/<cmp>-base.tsx         # чистый shadcn (+ под-части)
  variants/base/<cmp>-base.props.ts    # props-схема (F/DSL-контейнеры) — as const satisfies PropsSchema
  variants/<variant>/...               # доп. функц. варианты (по заданию)
  <cmp>.test.tsx                       # unit
  <cmp>.props.test.ts                  # страж (F): тип-левел A + рантайм properties∩x-runtimeProps=∅
  index.ts                             # barrel: варианты + суб-части + props-схемы (БЕЗ *Field-версий)
```

## Фазы A→K

- **A. Изучение** (read-only): shadcn-исходник `<cmp>` (fetch `https://ui.shadcn.com/r/styles/new-york-v4/<cmp>.json`);
  эталоны button/select; для F — adapters.ts; для composite — `index.ts` зависимостей.
- **B. base**: `variants/base/<cmp>-base.tsx` — дословный порт. Под-части — рядом, именованные экспорты.
- **C. функц. варианты** (если заданы): надстройка над base. Enhanced (number/async) — логику переносить дословно из carry.
- **D. адаптер** (F): на экспорте варианта для формы — `defineFieldControl(<Cmp><V>, { adapter })` (+ `withFieldTooltip`
  для пропа `tooltip`). Отдельных `*.field.tsx` / `*Field`-версий НЕ создавать. Подпись справа — `layout: 'inline-label'`.
- **E. props-схема** (F/DSL): `<cmp>-<v>.props.ts` — `properties` (сериализуемые componentProps) + `x-doc` +
  `x-runtimeProps` (несериализуемое/override), `additionalProperties: false`, `x-registryName` + `x-exportName`
  (если экспорт для формы называется иначе, чем registry-имя).
  Страж `<cmp>.props.test.ts` (тип-левел A + рантайм ∅).
- **F. barrel** `index.ts`: реэкспорт вариантов + суб-частей + props-схем.
- **G. тесты** `<cmp>.test.tsx` (renderToStaticMarkup + regex, по образцу button/select-теста): рендер вариантов;
  для формы — через `Bound` (`@/test-utils/bound`): value→primitive, emit→onChange(value), aria passthrough. Enhanced — перенесённые тесты.
- **H. doc-config** `reformer-doc/demo/examples/<cmp>.tsx` → `<cmp>DocConfig: ComponentDocConfig`:
  `variants[]` (готовые пресеты; F → `makeFieldVariant`), `examples[]` (рецепты), `api`/`props`.
  Для F с api: `controls: controlsFromPropsSchema(mergeFieldPropsSchema(<schema>), { omit })` — **ручной controls[] ЗАПРЕЩЁН**.
- **I. mdx** `reformer-doc/docs/ui-kit/<cmp>.mdx` (по образцу button.mdx): frontmatter + import ComponentDoc + config + `<ComponentDoc config={...}/>`.
- **J. self-check**: `npx tsc --noEmit` (свой каталог; страж падает тут при дрейфе); `npx vitest run src/components/<cmp>`;
  grep-самоаудит тронутых путей.
- **K. dev-report**: созданные файлы; варианты + обоснование не-base; adapter; новые deps; отклонения; что нужно от оркестратора.

## Стоп-условия (эскалация, не решать самому)

Нет подходящего adapter-пресета; зависимость не готова; конфликт имён; тяжёлая dep не в external; неоднозначность вариантов;
seam-контракт не выражается через адаптер.

## Definition of Done

base + заданные варианты + адаптер-статика (F) + props-схема + страж (F) + index + тесты + doc-config + mdx; tsc/vitest зелёные;
тронуты только разрешённые пути.
