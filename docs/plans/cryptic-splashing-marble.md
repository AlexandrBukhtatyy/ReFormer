# Анализ пакетов ReFormer и рекомендации по улучшению

## Контекст

ReFormer — монорепозиторий для реактивного управления формами на базе Preact Signals. Содержит 6 библиотечных пакетов и 4 проекта. Ниже — анализ каждого пакета, оценка общей архитектуры и конкретные рекомендации.

---

## 1. Анализ пакетов по отдельности

### 1.1 `@reformer/core` (v1.1.0) — Ядро

**Сильные стороны:**
- Зрелая архитектура: FormNode → FieldNode / GroupNode / ArrayNode (Template Method паттерн)
- Signals-based реактивность с fine-grained обновлениями
- Глубокая типизация: FormSchema автоматически выводит типы из интерфейса данных
- Отличный tree-shaking: 14 точек входа для валидаторов, 8 для behaviors
- `sideEffects: false`, ESM-only — идеально для бандлеров
- 72 файла тестов (~19k строк) — хорошее покрытие

**Проблемы:**
- **peer dependency на react/react-dom** — core заявлен как framework-agnostic, но в `peerDependencies` указан React. Хуки (`useFormControl`, `useFormControlValue`) живут прямо в core, привязывая его к React
- **Модуль resources.ts не используется** — 123 строки кода со статусом `NOT_IMPLEMENTED`, экспортируется но не интегрирован ни в одну ноду
- **Нет coverage-метрик** — vitest настроен, но coverage не отслеживается в CI

**Рекомендации:**
1. **Вынести React-хуки в отдельный пакет** (`@reformer/react`) или хотя бы в отдельный entry point `@reformer/core/react`. Это позволит использовать core в не-React окружениях (Vue, Solid, Node.js) без лишних peerDependencies
2. **Удалить или доделать resources.ts** — мёртвый код создаёт ложное впечатление функциональности. Если фича планируется — вынести в отдельную ветку, а из main убрать
3. **Добавить coverage в vitest.config** и установить порог (например, 80%)

---

### 1.2 `@reformer/cdk` (v1.0.0-beta.2) — Headless-компоненты

**Сильные стороны:**
- Headless-first подход: FormArray, FormWizard, FormField без стилей
- Compound Components паттерн
- Гранулярные entry points (form-array, form-wizard, form-field)

**Проблемы:**
- **Описание идентично ui-kit**: оба пакета имеют `"description": "Headless UI components for @reformer/core"` — это путает пользователей
- **keywords идентичны ui-kit** — оба содержат "headless-ui", хотя ui-kit стилизованный
- **Нет собственных тестов в CI** — в ci.yml собирается, но тесты не прогоняются

**Рекомендации:**
1. **Исправить description и keywords в ui-kit** — ui-kit не headless, он стилизованный. Описание должно отражать это: `"Styled form components with Tailwind CSS for @reformer ecosystem"`
2. **Добавить запуск тестов cdk в CI** — сейчас только build

---

### 1.3 `@reformer/ui-kit` (v1.0.0-beta.2) — Стилизованные компоненты

**Сильные стороны:**
- Использует CVA (class-variance-authority) для вариантов компонентов
- Основан на Radix UI — доступность из коробки
- Tailwind CSS для стилизации

**Проблемы:**
- **Слишком много peerDependencies (10 штук)** — @radix-ui/react-select, @radix-ui/react-slot, clsx, cva, lucide-react, tailwind-merge, react, react-dom, @reformer/cdk, @reformer/core. Это усложняет установку для пользователей
- **Тот же набор exports что и cdk** (form-array, form-wizard, form-field) — неясна граница ответственности для потребителя
- **Описание копипаст с cdk** (см. выше)

**Рекомендации:**
1. **Перенести часть peerDependencies в dependencies** — `clsx`, `tailwind-merge`, `class-variance-authority` — это внутренние утилиты пакета, пользователю не нужно знать о них. Они должны быть обычными dependencies
2. **Добавить уникальные entry points** — например, `@reformer/ui-kit/input`, `@reformer/ui-kit/select` для гранулярного импорта UI-компонентов
3. **Чётко разграничить с cdk в документации** — cdk = логика без UI, ui-kit = готовые styled-компоненты

---

### 1.4 `@reformer/renderer-react` (v1.0.0-beta.2) — React-рендерер

**Сильные стороны:**
- Чистое разделение ModelSchema / RenderSchema / ValidationSchema / BehaviorSchema
- RenderSchemaProxy для программного управления (hideWhen, onMount, onUnmount)
- Декларативные render behaviors
- Поддержка fieldWrapper на глобальном и per-field уровне

**Проблемы:**
- **peer dependency на @preact/signals-core** — это деталь реализации core, рендереру не нужно знать о ней напрямую
- **Нет тестов в CI**

**Рекомендации:**
1. **Убрать @preact/signals-core из peerDependencies рендерера** — эта зависимость должна быть транзитивной через @reformer/core
2. **Добавить тесты рендерера в CI pipeline**

---

### 1.5 `@reformer/renderer-json` (v1.0.0-beta.0) — JSON-рендерер

**Сильные стороны:**
- Позволяет описывать формы через JSON — полезно для low-code сценариев и серверного рендеринга форм
- Component Registry паттерн с `defineRegistry()`
- Конвертер JSON → RenderSchema

**Проблемы:**
- **Жёсткая связь с @reformer/ui-kit** — в peerDependencies обязательный `@reformer/ui-kit`. Это значит JSON-рендерер нельзя использовать с кастомными компонентами без установки ui-kit
- **Самый ранний beta (0)** — минимальный набор функций
- **Только один entry point** — нет гранулярных экспортов

**Рекомендации:**
1. **Сделать @reformer/ui-kit опциональным peerDependency** — JSON-рендерер должен работать с любым набором компонентов через registry, а ui-kit — дефолтный preset
2. **Добавить entry point для registry** — `@reformer/renderer-json/registry` чтобы пользователи могли регистрировать компоненты без импорта всего пакета

---

### 1.6 `@reformer/mcp` (v1.0.0-beta.1) — MCP-сервер

**Сильные стороны:**
- Уникальная фича — интеграция с AI-ассистентами через Model Context Protocol
- Собственные промпты и инструменты для разработки форм
- LLMs.txt файлы для контекста AI

**Проблемы:**
- **Использует tsc вместо Vite** — единственный пакет с другой системой сборки, что усложняет единообразие
- **@reformer/core в optional peerDependencies** — непонятно, какая функциональность доступна без core

**Рекомендации:**
1. **Документировать поведение без @reformer/core** — что MCP-сервер может делать standalone vs с установленным core

---

## 2. Общий анализ монорепозитория

### 2.1 Граф зависимостей

```
@reformer/core (base, v1.1.0)
    ├── @reformer/cdk (headless, v1.0.0-beta.2)
    │       └── @reformer/ui-kit (styled, v1.0.0-beta.2)
    ├── @reformer/renderer-react (v1.0.0-beta.2)
    │       └── @reformer/renderer-json (v1.0.0-beta.0)
    │               └── @reformer/ui-kit (жёсткая связь!)
    └── @reformer/mcp (v1.0.0-beta.1)
```

**Проблема:** renderer-json зависит от ui-kit напрямую, создавая "diamond dependency" — и через cdk, и напрямую.

### 2.2 CI/CD

**Критическая проблема: линтинг отключён в CI** ([ci.yml](.github/workflows/ci.yml))
- Строки 26-31: lint и format:check закомментированы
- Это значит код может деградировать по качеству незаметно

**Проблема: `rm package-lock.json` в CI** (строка 24)
- Удаление lockfile в CI означает недетерминированные установки
- Каждый прогон может получить разные версии зависимостей

**CI собирает и тестирует только core и cdk** — остальные 4 пакета не проверяются.

### 2.3 Версионирование

- core на v1.1.0, все остальные на beta — это нормально для текущей стадии
- Semantic release настроен раздельно для core, cdk, mcp — хороший подход
- **Нет release workflow для renderer-react, renderer-json, ui-kit**

### 2.4 Документация

- 272+ markdown файлов — отличное покрытие
- LLMs.txt для AI-интеграции — инновационный подход
- Docusaurus для сайта документации

---

## 3. Приоритизированные рекомендации

### Критические (влияют на корректность и надёжность)

| # | Рекомендация | Пакет | Файлы |
|---|---|---|---|
| 1 | **Вернуть lint и format:check в CI** | root | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| 2 | **Убрать `rm package-lock.json` из CI** — использовать `npm ci` вместо `npm install` | root | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| 3 | **Добавить тесты всех пакетов в CI** — не только core и cdk | root | [.github/workflows/ci.yml](.github/workflows/ci.yml) |

### Высокий приоритет (улучшение архитектуры)

| # | Рекомендация | Пакет | Обоснование |
|---|---|---|---|
| 4 | **Вынести React-хуки из core** в отдельный entry point `@reformer/core/react` | core | Заявленная framework-agnosticity не соответствует peerDependencies |
| 5 | **Сделать ui-kit опциональным в renderer-json** | renderer-json | Убрать жёсткую связь, дать свободу выбора компонентов |
| 6 | **Перенести clsx/cva/tailwind-merge из peer в dependencies у ui-kit** | ui-kit | Это внутренние утилиты, не API-контракт |
| 7 | **Убрать @preact/signals-core из peerDeps renderer-react** | renderer-react | Деталь реализации core, не нужна потребителям рендерера |

### Средний приоритет (качество кода)

| # | Рекомендация | Пакет |
|---|---|---|
| 8 | **Добавить coverage-отчёты** (vitest coverage + порог 80%) | core, cdk |
| 9 | **Исправить description и keywords в ui-kit** — он не headless | ui-kit |
| 10 | **Удалить или доделать resources.ts** — мёртвый код | core |
| 11 | **Добавить release workflows** для renderer-react, renderer-json, ui-kit | root |
| 12 | **Добавить bundle size monitoring** (size-limit в CI) | все пакеты |

### Низкий приоритет (nice to have)

| # | Рекомендация | Пакет |
|---|---|---|
| 13 | Добавить гранулярные exports в ui-kit (`/input`, `/select`) | ui-kit |
| 14 | Исправить FIXME с email-валидатором в E2E | core |
| 15 | Унифицировать сборку mcp (перейти на Vite) | mcp |
| 16 | Добавить changesets вместо отдельных release workflows | root |

---

## 4. Общая оценка

| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| Архитектура | **9/10** | Отличное разделение на слои: schema → validation → behavior → render |
| Типизация | **9/10** | Deep inference, FormProxy, FieldPath — top-level TS |
| Tree-shaking | **9/10** | Гранулярные exports, sideEffects: false, ESM-only |
| Тестирование | **7/10** | Хорошие тесты core, но нет coverage и CI для остальных пакетов |
| CI/CD | **5/10** | Lint отключён, lockfile удаляется, тестируются не все пакеты |
| Документация | **9/10** | 272+ файлов, LLMs.txt, Docusaurus — отлично |
| DX (Developer Experience) | **7/10** | ui-kit с 10 peerDeps усложняет onboarding |
| Версионирование | **7/10** | Semantic release есть, но не для всех пакетов |

**Итого: проект с сильной архитектурой и типизацией, но с пробелами в CI/CD и dependency management.**
