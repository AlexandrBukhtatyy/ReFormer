---
sidebar_position: 2
---

# Быстрый старт

Настройка @reformer/mcp занимает меньше 2 минут.

## Требования

- Node.js 18 или выше
- Одна из поддерживаемых IDE

## Установка

### Вариант 1: Глобальная установка

```bash
npm install -g @reformer/mcp
```

### Вариант 2: Через npx (без установки)

Можно использовать напрямую через npx — установка не требуется.

## Настройка IDE

### Claude Code

```bash
claude mcp add --transport stdio reformer -- npx @reformer/mcp
```

Проверка:

```bash
claude mcp list
```

### Cursor

Создайте файл `.cursor/mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["@reformer/mcp"]
    }
  }
}
```

Перезапустите Cursor.

### Windsurf

Добавьте в настройки (`Ctrl+,` → MCP):

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["@reformer/mcp"]
    }
  }
}
```

### Cline (VS Code)

Добавьте в настройки расширения Cline:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["@reformer/mcp"]
    }
  }
}
```

### Набор инструментов вместо умолчания

По умолчанию сервер отдаёт два инструмента, `search` и `execute`: ассистент собирает и меняет форму
по плану сервера. Справка по API, проверка кода, ресурсы и промпты — в наборе инструментов
([поверхности](./overview#поверхности)). Чтобы включить его, задайте переменную окружения:

```bash
claude mcp add --transport stdio reformer -e REFORMER_SURFACE=tools -- npx @reformer/mcp
```

В JSON-конфиге Cursor, Windsurf и Cline — ключ `env`:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["@reformer/mcp"],
      "env": { "REFORMER_SURFACE": "tools" }
    }
  }
}
```

## Первый запрос

После настройки попробуйте попросить AI помочь с ReFormer:

```
Создай форму регистрации с полями email, пароль и подтверждение пароля
```

Ассистент начнёт с `execute` и вызова `reformer.formStart` с текстом запроса. Сервер составит план и
поведёт по нему: ассистент добавит поля и правила конструктором, а сервер соберёт модуль формы —
модель, схему с компонентами, правила валидации и разметку — и проверит типы. Работа закончена, когда
ответ сервера говорит `Done`.

## Проверка работы

Если MCP-сервер настроен правильно, в списке инструментов ассистента есть `search` и `execute`
сервера `reformer` (в Claude Code — команда `/mcp`).

С набором инструментов (`REFORMER_SURFACE=tools`) ассистент отвечает и на вопросы о ReFormer по
актуальной документации. Попробуйте спросить:

```
Как добавить валидацию email в ReFormer?
```

```
Какие поведения есть в ReFormer?
```

```
Как сделать условное отображение полей?
```

## Следующие шаги

- [Инструменты](./tools) — доступные tools
- [Примеры](./examples) — сценарии использования
