# @reformer/builder-stack-plain

Демо-стек ReFormer Builder — доказательство, что билдер принимает стек, который **не** ReFormer.
Пакет приватный и не публикуется: это фикстура архитектуры, а не продукт.

## Что такое стек

Стек — набор плагинов билдера со своим форматом схемы, редактором, превью, кодогеном и
валидатором. Стек ReFormer (`@reformer/builder-stack-reformer`) редактирует схемы
`@reformer/renderer-json`. Этот стек приносит всё своё:

| Что          | Стек ReFormer                                  | Демо-стек                           |
| ------------ | ---------------------------------------------- | ----------------------------------- |
| Формат схемы | дерево узлов с операторами `$model/$component` | плоский список полей `plain-form/1` |
| Отрисовка    | `@reformer/renderer-json` + компоненты кита    | нативные `<input>`, `<select>`      |
| Экспорт      | модуль формы ReFormer (`model.ts`, …)          | один `Form.tsx` на `useState`       |
| Зависимости  | `@reformer/core`, `renderer-json`, `ui-kit`    | только `@reformer/builder-toolkit`  |

## Формат

```json
{
  "$schema": "plain-form/1",
  "title": "Контакт",
  "fields": [
    { "name": "name", "label": "Имя", "type": "text" },
    {
      "name": "channel",
      "label": "Как связаться",
      "type": "select",
      "options": ["email", "телефон"]
    }
  ]
}
```

Виды полей: `text`, `number`, `checkbox`, `select`.

## Что здесь есть

| Модуль       | Зачем                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| `schema`     | типы формата и `PLAIN_SCHEMA_ID`                                                   |
| `parse`      | `looksLikePlainForm` (дешёвая проба), `parsePlainForm` (разбор с причиной), печать |
| `ops`        | правки операциями с обратной: `add-field`, `remove-field`, `rename-field`          |
| `defaults`   | начальные значения и заготовка новой формы                                         |
| `check`      | пустое имя, дубликат имени, выбор без вариантов                                    |
| `print-form` | печать `Form.tsx` через печатник `@reformer/builder-toolkit`                       |

Плагин стека — `projects/reformer-builder/src/plugins/plain/demo` (идентификатор `reformer.plain`),
профиль — `plain.builder` (основа билдера плюс этот плагин).
