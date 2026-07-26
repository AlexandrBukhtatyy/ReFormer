# reformer-builder — MVP (визуальный конструктор форм)

## Основная информация

**Статус документа:** 🟡 Черновик (сведён из брейншторма)
**Продукт:** `reformer-builder` — браузерный визуальный редактор JSON-схем форм ReFormer
**Версия документа:** 0.1
**Дата создания:** 2026-07-25
**Автор:** Claude Code
**Источник решений:** [docs/brainstorms/reformer-builder.md](../brainstorms/reformer-builder.md) (раунды 0–12, вопросы Q1–Q40)
**Скелет проекта:** [projects/reformer-builder/](../../)

> Рационал и альтернативы по каждому решению — в брейншторме. Здесь — нормативная спека MVP.
> Номера `Qn` в скобках указывают на соответствующий вопрос брейншторма.

---

## 1. Обзор и цель

`reformer-builder` — **браузерный визуальный редактор JSON-схем форм**, **не зависящий от технологии
и ui-kit**. Ядро оперирует каталогом компонентов и правит единственный сериализуемый артефакт —
`JsonFormSchema` (`@reformer/renderer-json`). Вход и выход одинаково **JSON-native**.

Главный сценарий — **dev-инструмент**: разработчик открывает свой проект, билдер находит его
JSON-схемы форм, разработчик визуально их правит и сохраняет обратно в исходные файлы; dev-сервер
проекта подхватывает изменения (HMR) и показывает результат. Дополнительно — лёгкий standalone-режим
«собрать форму с нуля → экспорт JSON».

---

## 2. Пользователи и режимы

**Аудитории (обе, Q1):** разработчики (первично) и no-code/аналитики.

- **Режим B — Проектно-связанный редактор (первичный, Q3):** открыть каталог проекта → найти
  JSON-схемы → визуально править → сохранить в файл → HMR dev-сервера проекта.
- **Режим A — Standalone-дизайнер (минимальный, Q15):** «новая схема» → экспорт/скачать JSON. Тот же
  редактор-ядро, отличается только I/O.

---

## 3. Цели и не-цели (scope MVP)

**В MVP:**

- Режим B: открыть проект, обнаружить схемы, редактировать, сохранять с round-trip-точностью, HMR.
- Режим A: новая схема, экспорт JSON.
- Редактор: гибрид дерево+canvas, палитра из каталога, инспектор из props-схем, split-view raw-JSON.
- Preview: **схематичный** + **runtime** (оба внутри билдера).
- Каталог компонентов по контракту (JSON), валидация каталога.
- Валидация выходной схемы (гейт перед сохранением).

**НЕ в MVP** (см. §12): генерация TS-заготовок (validation/behavior), AI/MCP, полный `.tsx` codegen,
мост postMessage / встроенный live-iframe, кроссбраузерность, другие рендереры/дизайн-системы,
переключатель версий.

---

## 4. Архитектура (обзор)

- **Браузерное приложение без бэкенда** (Q2). Доступ к ФС — **File System Access API**.
- **Chromium-only** (Chrome/Edge) для MVP (Q12); Firefox/Safari — вне охвата.
- **Доставка:** hosted статическая страница (заходишь на URL, ноль установки) + локальный запуск в
  монорепо для разработки самого билдера (Q9).
- **Ядро agnostic (JSON↔JSON):** вход — каталог-JSON по контракту; выход — `JsonFormSchema`. Ядро не
  знает React, конкретные компоненты, ui-kit, model/validation/behavior.

```
   ВХОД (JSON)                 РЕДАКТОР (agnostic)              ВЫХОД (JSON)
 каталог-JSON  ─────────▶  дерево + canvas + инспектор  ─────▶  JsonFormSchema
 (по контракту)              палитра / preview                  (round-trip в файл)
                                    │
                                    ▼
                 preview: схематичный · runtime (в билдере)
                 живой результат: dev-сервер разработчика (save→HMR, внешне)
```

---

## 5. Контракт каталога компонентов (вход)

Направление — **контракт-first** (Q23–Q25):

1. **UI-Builder владеет контрактом** — это **JSON Schema** (`component-catalog.schema.json`),
   описывающая структуру «каталога компонентов». Контракт **версионирован** (поле версии).
2. **UI-kit (любая дизайн-система) формирует каталог-JSON** по контракту. ReFormer ui-kit генерирует
   его из `defaultPropSchemas` (адаптер `*.props.ts → каталог.json`).
3. **Билдер валидирует** каталог против контракта и даёт рекомендации.

**Запись каталога (нормативно):**

- `name` — имя компонента (`$component(name)`).
- `propsSchema` — JSON Schema редактируемых пропсов + метки виджетов (`x-doc.kind`:
  `boolean|text|number|enum|readonly`); `x-runtimeProps` (`value/onChange/onBlur/disabled`) **скрыты**
  в инспекторе.
- **`role`** — `field | container | array` (**явное поле**, Q24) — определяет размещение узла.
- `category?` — группировка в палитре.

Опора в коде: `@reformer/ui-kit/meta` → `defaultPropSchemas`, `packages/reformer-ui-kit/src/fields/props-schema.ts`,
`mergeFieldPropsSchema` (враппер+вариант для field-узла). Файлы `*.props.ts` — React-free.

---

## 6. Формат схемы формы (выход) и round-trip

**Артефакт:** `JsonFormSchema` = `{ version, $schema?, root: JsonNode }`; узлы `field`
(`value: '$model(path)'`), `array` (`{ array, item: { $template } }`), `container`
(`{ component, children }`); операторы `$model / $component / $dataSource / $html / $fn / $locale`.

**Round-trip-сериализация — Стратегия A (Q20):**

- Парс JSON → типизированная модель, **сохраняющая порядок ключей** и **passthrough неизвестных**
  ключей/операторов (Q22, нетронутыми — форвард-совместимость, ноль потери данных).
- Вывод — через `prettier/standalone` с **конфигом проекта** (`.prettierrc`/`.editorconfig`, читается
  через FS Access API) (Q21) → вывод байт-в-байт как записал бы сам проект.
- **Идемпотентность (MUST):** open→save без правок = файл не изменился. Гейт-тест
  «open→save = identity» на реальных схемах.
- Принтер модель→JSON в библиотеке отсутствует — реализуется в билдере.

**Валидация выхода:** перед сохранением — `validate_json_schema` / `validateFormSchema` (валидация, не AI).

---

## 7. Режим B: интеграция с проектом

### 7.1. Доступ к ФС (FS Access API)

- Выбор папки: `showDirectoryPicker({ mode: 'readwrite' })` — **readwrite upfront** (Q30), один промпт.
- **Persist handle в IndexedDB** (Q29); на след. визите — кнопка «Переоткрыть <папка>»
  (`requestPermission` одним кликом, без повторного пикера).
- Инвалидный handle (папку удалили/переместили) → graceful, предложить re-pick.

### 7.2. Обнаружение схем

- **Скоуп:** конфигурируемые globs (Q26) с разумным дефолтом (напр. `**/*.schema.json` + `src/**/*.json`),
  игнор `node_modules/dist/build/.git/_generated`.
- **Критерий (оба, с бейджами уверенности, Q27):** строгий (`$schema` → `form-schema.schema.json`) =
  высокая уверенность; эвристика по shape (`{version, root:<узел>}` + операторы) = средняя; ловит и
  файлы без `$schema`.
- **Дискриминатор мета vs форма (MUST):** `json.root` — объект-узел (`component`/`value`/`children`).
  Это отсекает саму `form-schema.schema.json` (draft-07 JSON Schema) и прочие JSON Schema.
- **Применимый каталог для схемы (Q28):** по `$schema`-ссылке формы → мета-схема проекта → точный enum
  компонентов → каталог; нет `$schema` → fallback на bundled/проектный каталог.

### 7.3. Сохранение

- **Явный save (Cmd+S) + diff-preview** (Q10): показать diff (наш принтер vs исходный текст) → запись.
- **Детект внешних изменений (Q31):** хранить `File.lastModified`; перед записью re-read + сравнить;
  конфликт → предупредить (перечитать/смёржить/перезаписать). Затирание чужих правок **недопустимо**.
- Запись реального файла на диск → **dev-сервер проекта (Vite) сам делает HMR** (собственный watch не нужен).

---

## 8. Редактор (UX)

- **Раскладка:** слева — навигатор файлов/схем (режим B) + палитра компонентов из каталога; центр —
  canvas; справа — инспектор.
- **Canvas — гибрид (Q5):** дерево структуры + drag-drop по **схематичному** preview.
- **Инспектор свойств:** поля из props-схемы, виджет по `x-doc.kind`; секция **«привязки»** на фокусе
  узла — `$model`-путь и `$dataSource`-имя (Q37).
- **Split-view «визуальный ⇄ raw-JSON» (Monaco)** (Q11) — escape hatch, двусторонний.

---

## 9. Preview

**Два режима в билдере (переключатель, Q4/Q18/раунд 12):**

- **Схематичный** — L2 wireframe (Q35): скелет формы (контейнеры-рамки, вертикальный стек,
  wizard-табы), **generic box** на узел (label + имя, без пер-виджетных глифов, Q36). Agnostic,
  всегда доступен, non-interactive; это же — drag-drop холст.
- **Runtime** — реальный рендер внутри билдера: `convertJsonToM1Tree(json, registry, model)` +
  `<JsonFormRenderer>`. Registry — **renderer-plugin, дефолт `@reformer/ui-kit`** (Q17); ядро остаётся
  agnostic. `$dataSource`/`$fn`/`$locale` → мок-заглушки; модель — пустые сигналы из `$model`-путей.

**«Живой результат» — вне билдера:** dev-сервер разработчика (отдельная вкладка) через `save→HMR`.
Встроенного iframe и **моста postMessage нет** (отклонено, раунд 12). Для точного совпадения с реальной
формой — dev-сервер разработчика.

---

## 10. Режим A: standalone

- «Новая схема» → тот же редактор → **экспорт/скачать JSON**. Preview — схематичный (+ runtime, если
  подключён каталог). FS-проект не требуется.

---

## 11. Платформа и доставка

- Chromium-only, браузерное приложение без бэкенда, hosted статическая страница + локальный запуск в
  монорепо. Каталог persist в IndexedDB.
- **Поле версии контракта** в каталоге закладывается сразу (переключатель версий — v2).

---

## 12. Вне MVP (v2 / v3)

- **v2:** генерация TS-заготовок validation/behavior (**отдельный `*.builder.ts` + композиция** через
  `apply()`/`defineFormBehavior`, декларатив + TODO-стабы, Q32–Q34); drag-drop реордер в wizard/array;
  AI-генерация (MCP `create-form`); read-only просмотр валидаторов/behaviors; переключатель версий;
  полный `.tsx` codegen (если понадобится).
- **v3:** кроссбраузерность (Node-бэкенд-fallback); другие каталоги/дизайн-системы; другие рендереры (не-React).
- **Отклонено:** мост postMessage + встроенный live-iframe (раунд 12).

---

## 13. Риски и митигации

1. **Round-trip fidelity** (главный) — Стратегия A (форматтер+конфиг проекта, порядок ключей,
   passthrough); гейт-тест «open→save = identity».
2. **Обнаружение схем** — дискриминатор `json.root`-узел + бейджи уверенности; конфигурируемые globs.
3. **FS Access API UX** — persist handle + «Переоткрыть», readwrite upfront, детект внешних изменений.
4. **Схематичный preview readability** — L2 wireframe + label; проверить на реальных формах.
5. **Runtime-registry drift** — bundled ui-kit может расходиться с проектом; точность — на dev-сервере.

---

## 14. Критерии приёмки MVP

- ✅ Открыть каталог проекта (Chromium, FS Access API, readwrite upfront); handle persist, «Переоткрыть» работает.
- ✅ Обнаружение находит реальные схемы репо (`json-schema.json`, `renderer.schema.json`) и **не** метит
  `form-schema.schema.json`/`package.json`; бейджи уверенности проставлены.
- ✅ Открыть схему → дерево + палитра + инспектор + схематичный preview; переключение на runtime рендерит форму.
- ✅ Правка поля (напр. label/тип) → **diff-preview** → save → файл изменился локально и **минимально**;
  **open→save без правок = нулевой diff** (идемпотентность).
- ✅ Внешнее изменение файла до save → предупреждение о конфликте (нет тихого затирания).
- ✅ dev-сервер проекта (Vite) показывает обновлённую форму после save (HMR).
- ✅ Режим A: новая схема → экспорт валидного `JsonFormSchema`.
- ✅ Неизвестные ключи/операторы в исходной схеме сохраняются нетронутыми после round-trip.
- ✅ Каталог-JSON валидируется против контракта; неизвестный компонент → generic box в схематичном preview.

---

## 15. Открытые вопросы / follow-ups (до реализации)

- Точная JSON Schema контракта каталога (`component-catalog.schema.json`) — поля, версия, формат `propsSchema`.
- Дефолтные globs обнаружения и формат конфигурации скана.
- Ergonomics diff-preview (построчный diff, подтверждение).
- Мок-стратегия `$dataSource`/`$fn`/`$locale` в runtime-preview (пустые options / плейсхолдеры).
- Адаптер `defaultPropSchemas → каталог.json` и проставление `role` в props-компаньонах ui-kit.

---

## 16. Ссылки

- Брейншторм (полный процесс, рационал): [docs/brainstorms/reformer-builder.md](../brainstorms/reformer-builder.md)
- Скелет проекта: [projects/reformer-builder/](../../)
- Эталон JSON-формы: [projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/](../../../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/)
- Каталог/props-схемы: `packages/reformer-ui-kit/src/meta.ts`, `packages/reformer-ui-kit/src/fields/props-schema.ts`
- Конвертер JSON→форма: `packages/reformer-renderer-json/src/converter/json-to-render-schema.ts`
