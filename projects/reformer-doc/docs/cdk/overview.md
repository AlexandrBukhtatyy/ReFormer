---
sidebar_position: 1
---

# Обзор

`@reformer/cdk` — набор headless-примитивов поверх `@reformer/core`. Компоненты не несут ни
разметки-обёрток, ни стилей: вы получаете состояние и поведение через compound-компоненты,
render-props (children как функция) и хуки, а внешний вид полностью пишете сами. Состояние
разделяется через React Context, всё типизировано и поддерживает tree-shaking.

Такой подход даёт полную свободу дизайна и доступность (a11y) из коробки. Если готовые
стилизованные версии нужны сразу — используйте [@reformer/ui-kit](../ui-kit/overview), который
построен поверх cdk.

## Установка

```bash
npm install @reformer/cdk @reformer/core
```

Peer-зависимости: `@reformer/core`, `react`, `react-dom` — npm 7+ установит их автоматически.
Собственных стилей у пакета нет, подключать CSS не требуется.

## Компоненты

- [**FieldArray**](./field-array) — динамические add/remove/reorder массивы. Части: `FieldArray`,
  `FieldArrayList`, `FieldArrayAddButton`, `FieldArrayRemoveButton`, `FieldArrayEmpty`,
  `FieldArrayCount`, `FieldArrayItemIndex`; хук `useFieldArray`.
- [**FormWizard**](./form-wizard) — многошаговый визард с пошаговой валидацией. Части:
  `FormWizard`, `FormWizardStep`, `FormWizardIndicator`, `FormWizardActions`,
  `FormWizardProgress`; хук `useFormWizard`.
- [**FormField**](./form-field) — доступная анатомия поля (label/control/error/description с
  проброшенными `id` и `aria`). Части: `FormField.Root`, `FormField.Label`, `FormField.Control`,
  `FormField.Error`, `FormField.Description`; хук `useFormField`.
- [**AsyncBoundary**](./async-boundary) — состояния загрузки данных (`loading` / `error` /
  `ready`) для async-UI вокруг формы.
- **FileUpload** — выбор и загрузка файлов. Части: `FileUpload.Root`, `FileUpload.Trigger`,
  `FileUpload.Dropzone`, `FileUpload.Item*` (preview, name, size, progress, delete).
- **Валидация/i18n** — `ValidationMessagesProvider` (словарь формы `messages` поверх локали
  либо полный `resolver`), `useIssueMessageResolver`.

### Импорт

```typescript
// Всё сразу
import { FieldArray, FormField, FormWizard } from '@reformer/cdk';

// Tree-shaking (рекомендуется)
import { FieldArray, useFieldArray } from '@reformer/cdk/field-array';
import { FormField, useFormField } from '@reformer/cdk/form-field';
import { FormWizard, useFormWizard } from '@reformer/cdk/form-wizard';
import { AsyncBoundary } from '@reformer/cdk/async-boundary';
import { FileUpload } from '@reformer/cdk/file-upload';
```

## Быстрый пример

Форма и модель создаются через M1 API `@reformer/core`, а cdk отвечает только за поведение и
анатомию:

```tsx
import { createModel, createFormFromModel } from '@reformer/core';
import { FieldArray } from '@reformer/cdk/field-array';

const model = createModel({
  items: [{ name: '' }],
});

const form = createFormFromModel({ model, schema });

<FieldArray.Root control={form.items}>
  <FieldArray.Empty>
    <p>Пока нет элементов</p>
  </FieldArray.Empty>

  <FieldArray.List>
    {({ control, index, remove }) => (
      <div>
        <span>Элемент #{index + 1}</span>
        <ItemForm control={control} />
        <button onClick={remove}>Удалить</button>
      </div>
    )}
  </FieldArray.List>

  <FieldArray.AddButton>Добавить</FieldArray.AddButton>
</FieldArray.Root>;
```

Каждый элемент разметки — ваш: cdk не навязывает ни тегов, ни классов, только прокидывает
состояние и обработчики через render-props.

## Дальше

- [@reformer/ui-kit](../ui-kit/overview) — стилизованные версии поверх cdk
- [Core API Reference](../api)
