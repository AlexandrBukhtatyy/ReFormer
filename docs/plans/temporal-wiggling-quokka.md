# Перенос form-array-context.tsx в @reformer/core

## Context

В `reformer-renderer-react` находятся два файла:

- `form-array.tsx` — маркерный компонент для RenderSchema системы
- `form-array-context.tsx` — React-контексты `FormArrayContext` / `FormArrayItemContext`

Проблема: контексты нужны **обоим** пакетам:

- `reformer-renderer-react` — заполняет контекст данными в `ArrayRenderer`
- `reformer-ui` — компаунд-компоненты (`FormArray.List`, `FormArrayAddButton` и т.д.) читают контекст

При этом `reformer-ui/src/components/form-array/FormArrayContext.tsx` **уже** импортирует из `@reformer/core`:

```ts
import { FormArrayContext, ... } from '@reformer/core';
```

Но `@reformer/core` ещё не экспортирует эти контексты — импорт сломан. Комментарий в файле: _«Контекст определён в @reformer/core»_ — это было намерением, которое не было реализовано.

**Правильная архитектура:**

- `@reformer/core` → форм-состояние + общие React-хуки и контексты
- `reformer-renderer-react` → RenderSchema-движок, маркеры типов (`FormArray.__isFormArray`)
- `reformer-ui` → headless compound-компоненты, потребляющие контексты

## Что НЕ переносить

`form-array.tsx` — остаётся в `reformer-renderer-react`. Это маркерный компонент (`__isFormArray = true`) используемый исключительно для TypeScript-дискриминации `ArrayRenderNode` в RenderSchema union-типе.

## Что сделать

### 1. Создать файл в core

Переместить содержимое:

```
packages/reformer-renderer-react/src/components/form-array-context.tsx
→ packages/reformer/src/react/form-array-context.tsx
```

Содержимое идентично, кроме шапки модуля (`@module reformer/core/...`).

Зависимости файла: только `react` + `@reformer/core` внутренние типы (`ArrayNode`, `FormProxy`, `FormFields`) — всё уже есть в core.

### 2. Экспортировать из @reformer/core

В [packages/reformer/src/index.ts](packages/reformer/src/index.ts) добавить:

```ts
// FormArray React contexts (shared between reformer-renderer-react and reformer-ui)
export {
  FormArrayContext,
  FormArrayItemContext,
  useFormArrayContext,
  useFormArrayItemContext,
  type FormArrayContextValue,
  type FormArrayItemContextValue,
  type FormArrayItem,
} from './react/form-array-context';
```

### 3. Обновить импорты в reformer-renderer-react

В [packages/reformer-renderer-react/src/core/render-node.tsx](packages/reformer-renderer-react/src/core/render-node.tsx) заменить импорт:

```ts
// было
import { FormArrayContext, FormArrayItemContext } from '../components/form-array-context';
// стало
import { FormArrayContext, FormArrayItemContext } from '@reformer/core';
```

В [packages/reformer-renderer-react/src/index.ts](packages/reformer-renderer-react/src/index.ts) изменить источник ре-экспорта контекстов:

```ts
// было
export { FormArrayContext, ... } from './components/form-array-context';
// стало
export { FormArrayContext, ... } from '@reformer/core';
```

### 4. Удалить старый файл

Удалить `packages/reformer-renderer-react/src/components/form-array-context.tsx`.

## Файлы, затронутые изменением

| Файл                                                                     | Действие                                   |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| `packages/reformer/src/react/form-array-context.tsx`                     | Создать (перенести)                        |
| `packages/reformer/src/index.ts`                                         | Добавить экспорт                           |
| `packages/reformer-renderer-react/src/components/form-array-context.tsx` | Удалить                                    |
| `packages/reformer-renderer-react/src/core/render-node.tsx`              | Обновить импорт                            |
| `packages/reformer-renderer-react/src/index.ts`                          | Обновить источник ре-экспорта              |
| `packages/reformer-ui/src/components/form-array/FormArrayContext.tsx`    | Уже корректен (импорт из `@reformer/core`) |

## Итог

После изменения:

- `form-array-context.tsx` → `@reformer/core` (единый источник истины для обоих пакетов)
- `form-array.tsx` → `reformer-renderer-react` (маркер RenderSchema, там и место)
- Сломанный импорт в `reformer-ui/FormArrayContext.tsx` автоматически заработает

## Верификация

1. `npm run build` в `packages/reformer` — убедиться что контексты попадают в dist
2. `npm run build` в `packages/reformer-renderer-react` — должен использовать контексты из core
3. `npm run build` в `packages/reformer-ui` — сломанный импорт должен заработать
4. Проверить playground: `projects/react-playground` — FormArray должен работать как в RenderSchema, так и как standalone compound-компонент
