# План: Документация для E2E тестов

## Контекст

Необходимо создать README.md для каталога `projects/react-playground-e2e/` с полной документацией по E2E тестам проекта.

## Структура проекта

```
projects/react-playground-e2e/
├── playwright.config.ts          # Конфигурация Playwright
├── package.json                   # Скрипты и зависимости
├── README.md                      # ← Документация (создаём)
└── tests/
    ├── shared/                    # Общие утилиты
    │   ├── base-page.ts           # Базовый Page Object Model
    │   ├── a11y.ts                # Утилиты доступности (axe-core)
    │   ├── performance.ts         # Утилиты производительности
    │   └── test-factory.ts        # Фабрика тестов
    └── pages/                     # Тесты по страницам
        ├── simple-form/           # Простая форма регистрации
        ├── behaviors/             # Примеры поведений
        ├── validation/            # Примеры валидации
        └── complex-multy-step-form/  # Сложная многошаговая форма
```

## Содержание README.md

### 1. Заголовок и описание
- Название проекта
- Краткое описание назначения

### 2. Быстрый старт
- Установка зависимостей
- Команды запуска тестов

### 3. Структура проекта
- Описание директорий
- Назначение каждой папки

### 4. Проекты (Projects)
| Проект | Описание | Браузер |
|--------|----------|---------|
| complex-multy-step-form | Сложная форма | Chrome |
| complex-form:firefox | @critical тесты | Firefox |
| complex-form:webkit | @critical тесты | Safari |
| simple-form | Простая форма | Chrome |
| validation | Валидация | Chrome |
| behaviors | Поведения | Chrome |

### 5. Теги тестов
- `@critical` — критические тесты (кросс-браузерные)
- `@smoke` — дымовые тесты
- `@a11y` — тесты доступности
- `@validation` — тесты валидации
- `@behaviors` — тесты поведений
- `@registration` — тесты регистрации

### 6. Page Object Model
- Описание BasePage
- Селекторы: `field()`, `input()`, `label()`, `error()`
- Отслеживание ошибок: `hasNoErrors()`, `hasNoStackOverflow()`

### 7. Утилиты доступности (a11y.ts)
- `checkA11y()` — проверка через axe-core
- `checkWcag21AA()` — WCAG 2.1 AA
- Ручные проверки: `checkImagesHaveAlt()`, `checkInputsHaveLabels()`

### 8. Конвенции именования тестов
- ID-коды: `REG-001-A`, `BEH-002-B`, `VAL-003-C`
- Русские описания

### 9. Переменные окружения
- `E2E_PORT` — порт dev-сервера (по умолчанию 5173)
- `E2E_BASE_URL` — базовый URL
- `CI` — режим CI

### 10. Полезные команды
- Запуск всех тестов
- Запуск конкретного проекта
- Запуск по тегу
- UI режим
- Отчёт

## Файл для изменения

- [README.md](projects/react-playground-e2e/README.md) — создание документации

## Верификация

После создания:
1. Проверить форматирование markdown
2. Убедиться, что все команды актуальны
