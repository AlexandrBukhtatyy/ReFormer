# План: гибкая система локализации renderer-json (параметры + markdown + реактивный Trans)

> Базовые маркеры `$fn` и статический `$locale(key)` уже реализованы и проверены в прошлой сессии
> (см. историю рабочего дерева). Этот план — **расширение** локализации поверх них.

## Context

Текущий `$locale(key)` резолвится в **плоскую строку на этапе конвертации** и годится только для строковых пропов (`label`/`placeholder`). Нужны три возможности, которых он не покрывает:

1. **Параметры + плюрализация** — `"Минимум {count} символов"`, склонение по CLDR-правилам (`{count, plural, one {…} other {…}}`).
2. **Markdown/rich** — строка `"Visit our [site](url)"` должна рендериться как JSX.
3. **Реактивность** — при смене языка и при изменении model-параметра (`$model(userCount)`) текст обновляется вживую.

**Утверждённый объём — C (всё три)**, **форматтер pluggable без новых зависимостей**: пакет определяет только интерфейс `LocaleService` + фабрики-замыкания; ICU ([`intl-messageformat`](https://formatjs.io/docs/intl-messageformat/)) и markdown (`react-markdown`/`marked`) подключает потребитель через свою реализацию сервиса. Стандарт для параметров/склонения — **ICU MessageFormat**, но библиотека остаётся formatter-agnostic.

### Два несущих факта (проверены по коду)

1. **Два приёмника значения.** Строковые пропы требуют `string` (ReactNode/signal их роняет). Контентные слоты (`children`) принимают `ReactNode` и могут быть реактивными. → markdown и реактивный текст живут только в **компоненте**, не в строковом `$locale`.
2. **Конвертер статичен и не видит контекста.** `transformPropValue(value, scope, registry)` получает только `registry`, гоняется один раз в `useMemo` ([json-form-renderer.tsx](../../packages/reformer-renderer-json/src/components/json-form-renderer.tsx)). → live-переключение языка невозможно через `$locale`; оно идёт через React-context, читаемый на этапе рендера (паттерн CDK [`ValidationMessagesProvider`](../../packages/reformer-cdk/src/validation/error-resolver.tsx#L94)) + `useSyncExternalStore`+`effect`-мост для сигналов ([render-node.tsx `useFieldValueAndDisabled`](../../packages/reformer-renderer-react/src/core/render-node.tsx#L57)).

Всё greenfield: ни ICU, ни markdown, ни `Intl.*` в form-пакетах нет. Переиспользуемые **паттерны** — closure-резолверы CDK (`createMessageResolver`, `ValidationMessagesProvider`, `useValidationErrorResolver`) и мой `createLocaleResolver`. Сигналы — `@preact/signals-core` (без React-интеграции; `effect`/`Signal` из `@reformer/core/signals`).

## Дизайн — три слоя, один pluggable-сервис

Единый интерфейс, backend-агностичный:

```ts
// locale-service.ts — расширение существующего
export type LocaleResolver = (key: string, params?: Record<string, unknown>) => string; // + params (обратно совм.)
export interface LocaleService {
  resolve(key: string, params?: Record<string, unknown>): string;      // строка (label/placeholder/Trans-fallback)
  render?(key: string, params?: Record<string, unknown>): ReactNode;   // NEW: rich/markdown (Trans/RichText)
  keys?: readonly string[];                                            // validate-time проверка ключей
}
```

Существующие `resolve(key)`-замыкания остаются валидными (второй параметр опционален). `createLocaleResolver(catalog)` не меняется.

### Слой A — параметры в строковых пропах (статично)

Новая **структурная форма** `$locale` в `componentProps` (объект, не строка-оператор — избегаем хрупкого парсера аргументов):

```jsonc
"label": { "$locale": "fields.min", "params": { "count": 3 } }   // → resolve("fields.min", {count:3}) → "Минимум 3 символов"
```

- В [`transformPropValue`](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts#L82) распознаём объект с ключом `$locale` **до** общей рекурсии по объектам → `resolveLocale(key, registry, params)`.
- `resolveLocale(key, registry, params?)` → `registry.getLocale?.()?.resolve(key, params) ?? key`.
- Параметры здесь — **литералы** (статичный путь). `$model(...)` в params для строкового пропа не поддерживаем (результат всё равно заморожен) — реактивные model-параметры идут в `Trans` (слой C). Задокументировать.
- Строковый `$locale(key)` (без params) продолжает работать как есть.

Фабрика-замыкание (0-dep, стиль CDK) — для параметров/склонения без ICU:
```ts
export function createLocaleService(
  table: Record<string, (params?: Record<string, unknown>) => string>
): LocaleService; // { resolve:(k,p)=>table[k]?.(p) ?? k, keys:Object.keys(table) }
```
ICU-adapter — потребитель (документируем, не зависимость пакета):
```ts
reg.locale({ resolve: (k, p) => new IntlMessageFormat(catalog[k], lng).format(p) as string, keys: Object.keys(catalog) });
```

### Слой B — markdown/rich через компонент (декуплинг)

**Изменений ядра не требует** — уже композируется: `$locale(key)` отдаёт markdown-строку, а зарегистрированный компонент её рендерит. Благословляем паттерн в доках/примере:
```jsonc
{ "component": "$component(RichText)", "componentProps": { "source": "$locale(page.intro)" } }
```
```ts
reg.component('RichText', ({ source }) => <ReactMarkdown>{source}</ReactMarkdown>); // рендерер — у потребителя
```
Дополнительно `LocaleService.render?()` даёт интегрированный путь: `Trans`/`RichText` вызывают `render` когда он есть.

### Слой C — реактивный `Trans` + `LocaleProvider` (NEW, в пакете)

Машинерия i18n (dependency-free — вызывает pluggable-сервис; React + signals уже в зависимостях):

- **`LocaleProvider`** — React-context с текущим `LocaleService` (зеркало `ValidationMessagesProvider`). Смена языка = новое значение контекста → все `Trans` перерендериваются. `useLocale()` — хук чтения. Файл `src/locale/locale-context.tsx`.
- **`Trans`** — компонент, регистрируется как `$component(Trans)` (container-узел → получает **сырые сигналы** в пропах, ср. [render-node.tsx](../../packages/reformer-renderer-react/src/core/render-node.tsx#L480)):
  ```jsonc
  { "component": "$component(Trans)",
    "componentProps": { "id": "users.count", "values": { "count": "$model(userCount)" } } }
  ```
  - `values.count` приходит сигналом (`$model` → `signalAt`); `Trans` подписывается на все сигналы в `values` через `useSyncExternalStore`+`effect`-мост (переиспользуем паттерн `useFieldValueAndDisabled`; вынести в `src/locale/use-signal-value.ts`, `Signal`/`effect` из `@reformer/core/signals`).
  - Рендерит `service.render?.(id, vals) ?? service.resolve(id, vals)` — markdown/rich если у сервиса есть `render`, иначе строка. `as`-проп не нужен: формат решает сервис.
  - Реактивность: перерендер при смене сигнала (мост) и при смене языка (контекст). Файл `src/locale/trans.tsx`.

### Валидация

- [`walkOperatorNames`](../../packages/reformer-renderer-json/src/validate.ts#L39): добавить распознавание структурной формы `{ $locale: key, params? }` (значение `key` — голая строка, не оператор, поэтому текущий обход её не ловит) → проверять `key` против `localeKeys`, как для строкового `$locale`. `getLocaleKeys` не меняется.

### Экспорты / доки

- `src/index.ts`: `LocaleProvider`, `useLocale`, `Trans`, `createLocaleService`, обновлённые типы `LocaleService`/`LocaleResolver`.
- Доки: [02-json-schema.md](../../packages/reformer-renderer-json/docs/llms/02-json-schema.md) (структурная форма `$locale` + `Trans`), [03-registry.md](../../packages/reformer-renderer-json/docs/llms/03-registry.md) (`render`, `createLocaleService`, `LocaleProvider`/`Trans`, ICU/markdown adapters), новый рецепт `docs/llms/07-i18n.md` (полный гид: строковый path vs Trans, ICU-adapter, markdown-adapter). MCP-шаблон [to-renderer-json.md](../../packages/reformer-mcp/src/prompts/templates/to-renderer-json.md) — упомянуть структурный `$locale` и `Trans`.

## Файлы

| Слой | Файлы |
|---|---|
| A | `src/locale/locale-service.ts` (расширить `LocaleService`/`LocaleResolver`, `createLocaleService`), `src/converter/json-to-render-schema.ts` (`resolveLocale` + структурная ветка в `transformPropValue`), `src/validate.ts` (walk) |
| B | доки/пример (ядро не меняется) + опциональный `render` в сервисе |
| C | `src/locale/locale-context.tsx` (**new**), `src/locale/trans.tsx` (**new**), `src/locale/use-signal-value.ts` (**new**), `src/index.ts` |
| tests | `locale-service.test.ts`, converter/validate тесты на структурную форму, `trans.test.tsx` (реактивность через смену сигнала + смену контекста) |

## Verification

1. **Unit (vitest):** `resolve(key, params)` через `createLocaleService`-замыкание (интерполяция/склонение); структурная `{ $locale, params }` → строка в конвертере; `walkOperatorNames` ловит опечатку ключа в структурной форме; `Trans` — рендерит `render`→ReactNode и `resolve`→строку, перерендер при изменении сигнала `values.count` и при смене `LocaleProvider`.
2. **Typecheck:** `npm run typecheck` (обратная совместимость `resolve` — существующие `(key)=>string`-замыкания компилируются).
3. **MCP `validate_json_schema`:** структурная `$locale`-форма с известным/неизвестным ключом (перезапуск MCP-сервера для свежего `dist`).
4. **End-to-end (playground + playwright):** пример с ICU-adapter (потребитель подключает `intl-messageformat`) и markdown-adapter (`react-markdown`): `$component(RichText)` рендерит ссылку из markdown; `$component(Trans)` с `values.count` из `$model` — меняем count в форме, текст склоняется вживую; переключатель языка через `LocaleProvider` — лейблы `Trans` обновляются без пересборки. Скриншоты в `projects/react-playground-e2e/screenshots/i18n/`.

Работу вести по слоям A→B→C (каждый самостоятельно проверяем). Трекер `bd` в окружении сломан (нужен `bd init`/Dolt) — прогресс в todo, если не починим.
