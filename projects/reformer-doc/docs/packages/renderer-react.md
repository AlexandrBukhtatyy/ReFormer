---
id: renderer-react
title: '@reformer/renderer-react'
sidebar_label: 'renderer-react'
---

# @reformer/renderer-react

> Рендерер: сборка `createForm` с деревом схемы → React-дерево формы.

`@reformer/renderer-react` рисует форму по её **схеме** — тому же дереву узлов, по которому
`createForm` строит ноды. Каждый узел-поле привязан к сигналу модели (`model.$.<field>`) и к своему
компоненту, а состояние поля (значение, замечания, доступность) доходит до компонента без ручного
проброса `value` / `onChange`.

В отличие от разметки руками с `<FormField control={form.x} />`, где каждое поле пишут в JSX, здесь
форма описывается **как данные**: одно дерево задаёт и вёрстку, и конфиг полей. Сборка общая для
всех способов реализации — `createForm` из `@reformer/core`; рендерер получает готовый бандл и
исполняет записанные поведением правила узлов (`hideWhen`, `onComponentEvent`, …).

## Установка

```bash
npm install @reformer/renderer-react @reformer/core
```

## Быстрый пример

```tsx
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField, Input } from '@reformer/ui-kit';

interface MyForm {
  email: string;
}

// Дерево схемы: узлы-поля привязаны к сигналам модели (`model.$.<field>`).
const buildSchema = (model: FormModel<MyForm>): FormSchemaNode => ({
  children: [{ model: model.$.email, component: Input, componentProps: { label: 'Email' } }],
});

export function MyFormPage() {
  // Модель, форма и дерево — одной сборкой. useFormBundle зовёт фабрику ровно один раз.
  const myForm = useFormBundle(() =>
    createForm<MyForm>({ initial: { email: '' }, schema: buildSchema })
  );

  return <FormRenderer form={myForm} settings={{ fieldWrapper: FormField }} />;
}
```

Билдер схемы `(model) => узел` сборка вызывает один раз и компилирует дерево (`bundle.render.tree`);
ноды формы и рендерер читают одно и то же скомпилированное дерево. Форма рендереру в схеме не нужна:
визард и другие компоненты, которым нужна сборка, берут её из контекста `FormBundleContext`, который
ставит `FormRenderer`.

## Что внутри

- **FormRenderer** — главный компонент. Принимает бандл `createForm` пропом `form` плюс `settings`,
  обходит скомпилированное дерево и рисует форму, связывая каждое поле с его нодой.
- **settings.fieldWrapper** — обёртка вокруг каждого поля (label + control + ошибка), обычно
  `FormField` из `@reformer/ui-kit`. У JSON-варианта обёртку кладёт в бандл реестр.
- **settings.resolveFieldAdapter** — диалект «чужого» контрола (`checked` вместо `value`, событие
  вместо значения), на который нельзя повесить статику `reformerAdapter`.
- **Правила узлов** — пишутся в поведении формы (`defineFormBehavior` из `@reformer/core/behaviors`)
  над узлами своей области `schema.node(selector)`: `hideWhen` (условное скрытие), `renderEffect`
  (реактивный эффект, пока форма отрисована), `onComponentEvent` (событие компонента узла),
  `onInit` / `onMount` / `onUnmount` (жизненный цикл узла). Исполняет их рендерер.
- **Управление снаружи** — `bundle.render.node(selector)`: `setHidden` / `resetHidden`,
  `patchProps` / `resetProps`, `getRef` для узлов корневой области.
- **RenderNodeComponent** — отрисовка отдельного узла; его получают компоненты с
  `__selfManagedChildren` (визард, табы) вместе с узлами-детьми.

```typescript
import { defineFormBehavior, hideWhen, onComponentEvent } from '@reformer/core/behaviors';

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, schema }) => {
  hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');
  onComponentEvent(schema.node('wizard'), 'onSubmit', (values: CreditForm) => api.send(values));
});
```

:::info Прежний путь сборки
`createReactForm` / `useReactForm` и проп `render` с функцией-схемой (`createRenderSchema`,
`RenderSchemaFn`) остались для форм, написанных по прежнему контракту, — `FormRenderer` принимает и
такой бандл. Новые формы собираются `createForm` + `useFormBundle`, а правила узлов пишутся в
`behavior` сборки вместо отдельного `renderBehavior`.
:::

## Дальше

- [@reformer/renderer-json](./renderer-json) — та же форма из JSON
- [Core API Reference](../api)
