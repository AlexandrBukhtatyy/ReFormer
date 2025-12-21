---
sidebar_position: 1
---

# Обзор

`@reformer/ui` — библиотека headless UI компонентов для работы с формами `@reformer/core`.

## Ключевые концепции

- **Headless** — компоненты без UI, вы строите интерфейс сами
- **Compound Components** — композируемый декларативный API
- **Render Props** — children как функция для полного контроля
- **Context-based** — состояние передаётся через React Context

## Компоненты

| Компонент | Назначение |
|-----------|------------|
| [`FormArray`](./form-array) | Управление динамическими массивами форм |
| [`FormNavigation`](./form-navigation) | Multi-step wizard для форм |

## Установка

```bash
npm install @reformer/ui @reformer/core
```

## Импорты

```typescript
// Все компоненты
import { FormArray, FormNavigation } from '@reformer/ui';

// Tree-shaking (рекомендуется)
import { FormArray, useFormArray } from '@reformer/ui/form-array';
import { FormNavigation, useFormNavigation } from '@reformer/ui/form-navigation';
```

## Почему Headless?

Headless компоненты дают полную свободу в построении UI:

- **Любой дизайн** — используйте Tailwind, CSS-in-JS, или свои стили
- **Любые компоненты** — интегрируйте с Radix UI, Shadcn, Material UI
- **Полный контроль** — никаких ограничений от библиотеки
- **Маленький размер** — только логика, без стилей

```tsx
// Вы контролируете весь UI
<FormArray.Root control={form.items}>
  <FormArray.List>
    {({ control, remove }) => (
      <YourCustomCard onDelete={remove}>
        <YourCustomForm control={control} />
      </YourCustomCard>
    )}
  </FormArray.List>
  <YourCustomButton onClick={() => /* add */}>
    Добавить
  </YourCustomButton>
</FormArray.Root>
```
