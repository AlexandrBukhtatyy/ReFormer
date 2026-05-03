# Дизайн: привязка полей формы к модели данных в JSON-схеме

## Контекст

JSON-схема рендерера описывает _как_ рисовать форму. Сейчас в схеме есть механизм `{ $model: 'fieldPath' }` в `componentProps` — шаблонная ссылка на FieldPath. Используется только для компонентов типа FormArray, которым нужно передать ссылку на поле-массив.

**Проблема:** Термин `$model` путает — он похож по имени на поле `model` ноды, но означает другое. Кроме того, `model` как термин не соответствует основной терминологии кодовой базы, где поле формы называется **control**.

---

## Где используется `$model`

[`json-schema.ts`](../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts) строки 933, 1009, 1124 — только в `componentProps` для **FormArray**:

```ts
{
  component: 'FormArray',
  componentProps: {
    array: { $model: 'properties' },  // → FieldPathNode в пропс
  }
}
```

Конвертер ([`json-to-render-schema.ts:76-82`](../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts)) видит `{ $model: '...' }` и заменяет на `FieldPathNode`. Для обычных полей `$model` не используется — они привязываются через `selector` (автоматически) или `model` (явно).

---

## Семантическое разделение (текущее и целевое)

| Конструкция                                 | Смысл                                          |
| ------------------------------------------- | ---------------------------------------------- |
| `model: 'loanType'` на ноде                 | Эта нода **является** полем 'loanType'         |
| `{ $model: 'properties' }` в componentProps | Этот проп получает ссылку на поле 'properties' |

Проблема в том, что оба используют слово `model`, но выражают принципиально разные концепции.

**После переименования `$model` → `$control`:**

| Конструкция                  | Смысл                                                 |
| ---------------------------- | ----------------------------------------------------- |
| `model: 'loanType'`          | Эта нода **является** полем 'loanType'                |
| `{ $control: 'properties' }` | Этот проп получает **ссылку на контрол** 'properties' |

Разделение становится очевидным. `$control` согласуется с тем, что компоненты в кодовой базе получают пропс `control: FieldNode` — `$control` в схеме буквально говорит "сюда пойдёт control".

---

## Решение: заменить `{ $model: 'path' }` на `control: 'path'`

Пропс называется `control` в компонентах — схема использует то же имя. Никакого специального синтаксиса с `$`.

```ts
// Было
{
  component: 'FormArray',
  componentProps: {
    array: { $model: 'properties' },
  }
}

// Стало
{
  component: 'FormArray',
  componentProps: {
    control: 'properties',
  }
}
```

### Конвенция разрешения

Конвертер проверяет имя ключа в `componentProps`: если ключ — `control` (или оканчивается на `Control`), строковое значение резолвится как FieldPath:

```ts
// Было: отдельная функция isModelRef для проверки { $model: '...' }
function isModelRef(value: unknown): value is { $model: string } { ... }

// Стало: проверка по имени ключа
function transformProp(key: string, value: unknown, path: FieldPath) {
  if ((key === 'control' || key.endsWith('Control')) && typeof value === 'string') {
    return getFieldPathNode(path, value);  // резолв как FieldPath
  }
  // ... остальная логика
}
```

Это убирает специальный синтаксис объекта из схемы полностью.

---

---

## Бонус: Form-компонент для простых форм

По аналогии с `RendererFormWizard` добавить `RendererForm` — обёртку для одношаговых форм.

**Паттерн идентичен Wizard:** форма инжектируется через `onInit` + `patchProps` в behavior, JSON-схема не знает про `FormProxy`.

```ts
// json-schema.ts
{
  selector: 'my-form',
  component: 'RendererForm',
  children: [
    { model: 'email', component: 'Input' },
    { component: 'Form.Submit', componentProps: { label: 'Отправить' } }
  ]
}

// render-behavior.ts
onInit(schema.node('my-form'), () => {
  schema.node('my-form').patchProps({ form, validation });
});
```

Это же решает проблему нескольких форм в одной схеме — каждый `RendererForm` получает свой `form` через свой `onInit`.

Минимальный состав: `Form` (контекст + submit), `Form.Submit`, `Form.Actions`.

---

## Затронутые файлы

- [`packages/reformer-renderer-json/src/types/json-schema.ts`](../packages/reformer-renderer-json/src/types/json-schema.ts) — обновить JSDoc (убрать упоминания `$model`)
- [`packages/reformer-renderer-json/src/converter/json-to-render-schema.ts`](../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts) — убрать `isModelRef`, добавить проверку по имени ключа (`control` / `*Control`) в `transformProp`
- [`projects/react-playground/.../json-schema.ts`](../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts) — заменить `{ $model: '...' }` на `control: '...'` в 3 местах (строки 933, 1009, 1124)
