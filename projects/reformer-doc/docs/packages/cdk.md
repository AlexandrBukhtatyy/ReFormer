---
id: cdk
title: '@reformer/cdk'
sidebar_label: 'cdk'
---

# @reformer/cdk

> Headless-компоненты для @reformer/core — динамические массивы, мастера-визарды, анатомия поля.

`@reformer/cdk` — это набор headless-примитивов поверх `@reformer/core`. Компоненты не несут ни разметки-обёрток, ни стилей: вы получаете состояние и поведение через compound-компоненты, render-props (children как функция) и хуки, а внешний вид полностью пишете сами. Состояние разделяется через React Context, всё типизировано и поддерживает tree-shaking.

Такой подход даёт полную свободу дизайна и доступность (a11y) из коробки. Если готовые стилизованные версии нужны сразу — используйте [@reformer/ui-kit](./ui-kit), который построен поверх cdk.

## Установка

```bash
npm install @reformer/cdk @reformer/core
```

## Компоненты

- **FormArray** — динамические add/remove/reorder массивы. Части: FormArray, FormArrayList, FormArrayAddButton, FormArrayRemoveButton, FormArrayEmpty, FormArrayCount, FormArrayItemIndex; хук useFormArray.
- **FormWizard** — многошаговый визард с пошаговой валидацией. Части: FormWizard, FormWizardStep, FormWizardIndicator, FormWizardActions, FormWizardProgress; хук useFormWizard.
- **FormField** — доступная анатомия поля (label/control/error/description с проброшенными id и aria). Части: FormField.Root, FormField.Label, FormField.Control, FormField.Error, FormField.Description; хук useFormField.
- **Валидация/i18n** — ValidationMessagesProvider, createMessageResolver, defaultErrorResolver.

### Импорт

```typescript
// Всё сразу
import { FormArray, FormField, FormWizard } from '@reformer/cdk';

// Tree-shaking (рекомендуется)
import { FormArray, useFormArray } from '@reformer/cdk/form-array';
import { FormField, useFormField } from '@reformer/cdk/form-field';
import { FormWizard, useFormWizard } from '@reformer/cdk/form-wizard';
```

## Быстрый пример

Форма и модель создаются через M1 API `@reformer/core`, а cdk отвечает только за поведение и анатомию:

```tsx
import { createModel, createForm } from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';

const model = createModel({
  items: [{ name: '' }],
});

const form = createForm({ model, schema });

<FormArray.Root control={form.items}>
  <FormArray.Empty>
    <p>Пока нет элементов</p>
  </FormArray.Empty>

  <FormArray.List>
    {({ control, index, remove }) => (
      <div>
        <span>Элемент #{index + 1}</span>
        <ItemForm control={control} />
        <button onClick={remove}>Удалить</button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Добавить</FormArray.AddButton>
</FormArray.Root>;
```

Каждый элемент разметки — ваш: cdk не навязывает ни тегов, ни классов, только прокидывает состояние и обработчики через render-props.

## Дальше

- [@reformer/ui-kit](./ui-kit) — стилизованные версии поверх cdk
- [Core API Reference](../api)
