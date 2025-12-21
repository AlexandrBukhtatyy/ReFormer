---
sidebar_position: 3
---

# Инструменты (Tools)

MCP-сервер предоставляет инструменты, которые AI может вызывать для выполнения задач.

## report_issue

Отправка отчёта об ошибке и её решении для сбора обратной связи.

**Параметры:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `error` | string | Да | Описание ошибки или проблемы |
| `solution` | string | Да | Решение или исправление |
| `tags` | string[] | Нет | Теги для категоризации и аналитики |
| `context` | object | Нет | Дополнительный контекст (см. ниже) |

**Структура `context`:**

| Поле | Тип | Описание |
|------|-----|----------|
| `examples` | array | Примеры кода с описанием |
| `examples[].description` | string | Описание примера |
| `examples[].code` | string | Код примера |
| `relatedFiles` | string[] | Пути к связанным файлам |
| `notes` | string | Дополнительные заметки |

**Рекомендуемые теги:**

| Формат | Пример | Описание |
|--------|--------|----------|
| `category:<type>` | `category:behavior`, `category:validation` | Категория: schema, validation, behavior, react, types, other |
| `agent:<name>` | `agent:claude`, `agent:cursor` | Имя AI-агента |
| `severity:<level>` | `severity:critical`, `severity:minor` | Критичность проблемы |

**Что возвращает:**

Подтверждение успешной записи отчёта.

**Как это работает:**

1. AI находит ошибку при работе с ReFormer
2. AI решает проблему
3. AI вызывает `report_issue` с описанием ошибки и решения
4. Данные сохраняются локально в `~/.reformer/issues.jsonl`

**Пример использования AI:**

```
AI обнаружил ошибку: "Cycle detected in computeFrom"
AI определил причину: effect зависит от target поля
AI вызывает report_issue:
  - error: "Infinite loop in computeFrom when effect depends on target"
  - solution: "Use peek() instead of .value to read target without dependency"
  - tags: ["category:behavior", "agent:claude", "severity:critical"]
  - context:
      examples:
        - description: "Неправильно - создаёт зависимость"
          code: "const current = targetNode.value.value;"
        - description: "Правильно - без зависимости"
          code: "const current = targetNode.value.peek();"
      relatedFiles: ["packages/reformer/src/core/behavior/behaviors/compute-from.ts"]
```

**Формат хранения (JSONL):**

```json
{"timestamp":"2025-01-15T10:30:00Z","error":"...","solution":"...","tags":["category:behavior"],"context":{"examples":[...],"notes":"..."}}
```

Каждая строка — отдельный JSON-объект. Это позволяет легко дописывать новые записи и анализировать данные.

## Зачем нужен сбор обратной связи?

Отчёты об ошибках помогают:

- Выявлять типичные проблемы пользователей
- Улучшать документацию
- Находить баги в библиотеке
- Понимать, какие паттерны вызывают затруднения

Все данные хранятся **локально** на вашем компьютере.
