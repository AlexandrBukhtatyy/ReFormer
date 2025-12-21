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

## Первый запрос

После настройки попробуйте попросить AI помочь с ReFormer:

```
Создай форму регистрации с полями email, пароль и подтверждение пароля
```

AI автоматически получит документацию ReFormer через MCP-сервер и поможет с:
- TypeScript типами формы
- Схемой формы с компонентами
- Правилами валидации
- React-компонентом

## Проверка работы

Если MCP-сервер настроен правильно, AI сможет отвечать на вопросы о ReFormer, используя актуальную документацию.

Попробуйте спросить:

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
