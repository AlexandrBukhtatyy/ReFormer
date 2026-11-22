---
title: 'Управление узлами и свои контейнеры'
sidebar_label: 'Управление узлами'
---

# Управление узлами и свои контейнеры

Узел с `selector` можно скрыть, поменять ему пропсы, подписаться на событие его компонента. Правила
пишутся в поведении формы, а исполняет их рендерер. Вторая половина страницы — свои контейнеры:
сворачиваемая секция, табы, всё, что рисует вложенные узлы по-своему.

## Когда это нужно

- Секция видна только при определённом значении поля.
- Кнопке или визарду нужен обработчик события, которое нельзя записать в схеме данными.
- Узел нужно скрыть или поменять ему заголовок снаружи формы — по кнопке, после загрузки данных.
- Нужен контейнер с логикой: сворачивается, показывает один таб из нескольких.

## Правила узлов в поведении

Узел адресуется по `selector`: `schema.node('mortgage')`. Операторы берутся из
`@reformer/core/behaviors`:

```ts
import { defineFormBehavior, hideWhen, onComponentEvent } from '@reformer/core/behaviors';

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, schema }) => {
  // Секция видна только для ипотеки; условие пересчитывается при изменении модели.
  hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');

  // Событие компонента: кнопка «Отправить» визарда.
  onComponentEvent(schema.node('wizard'), 'onSubmit', (values: CreditForm) => api.send(values));
});
```

| Оператор                                    | Что делает                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `hideWhen(node, () => условие)`             | не рисует узел, пока условие истинно                                                        |
| `onComponentEvent(node, 'onX', handler)`    | обработчик проп-события компонента узла                                                     |
| `renderEffect(schema, () => …)`             | эффект, который живёт, пока форма отрисована; первый аргумент — область `schema`, а не узел |
| `onInit(node, fn)`                          | вызывается сразу при подключении поведения, до первого рендера                              |
| `onMount(node, fn)` / `onUnmount(node, fn)` | монтирование и размонтирование узла; `onMount` может вернуть очистку                        |

Поведение подключается к сборке полем `behavior`: `createForm({ schema, behavior })`. Как устроено
поведение целиком — в [Обзоре поведения](/docs/behaviors/overview).

Особенности `onComponentEvent`:

- у контейнера обработчик заменяет одноимённый проп из `componentProps`;
- у поля и массива он вызывается после записи значения или действия кнопки, а не вместо них.

### Скрытие не выключает поля

`hideWhen` и `setHidden` только убирают узел с экрана. Поля внутри остаются включёнными: правила их
проверяют, а замечаний не видно. Скрываете узел с полями — выключите их тем же условием
(`enableWhen` в том же поведении). Выключенные поля не проверяются.

## Управление снаружи формы

Сборка даёт доступ к узлам корневой области — `bundle.render.node(selector)`:

```tsx
const section = credit.render.node('mortgage');

section.setHidden(true); // скрыть, перекрывая hideWhen
section.patchProps({ title: 'Недвижимость' }); // подмешать пропсы
section.resetHidden().resetProps(); // вернуть как было; методы цепляются
```

| Метод                 | Что делает                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| `setHidden(value)`    | скрыть или показать узел; главнее условия `hideWhen`                          |
| `resetHidden()`       | снова действует `hideWhen`                                                    |
| `patchProps(partial)` | подмешать пропсы к `componentProps`; повторный вызов добавляет, а не заменяет |
| `resetProps()`        | убрать подмешанные пропсы                                                     |
| `getRef()`            | ref на компонент узла; компонент должен принимать `ref`                       |

Тот же контроллер узла `schema.node(selector)` доступен в поведении: из `onMount` удобно подмешать
пропсы после загрузки данных.

Перерисовывается только затронутый узел, а не вся форма.

## Свой контейнер

Обычный React-компонент. Вложенные узлы он получает уже отрисованными в `children`:

```tsx
import { useState, type ReactNode } from 'react';
import type { ContainerComponentProps } from '@reformer/renderer-react';

interface CollapsibleProps extends ContainerComponentProps {
  title: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

export function Collapsible({ title, defaultOpen = true, className, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={className}>
      <button type="button" onClick={() => setOpen((v) => !v)}>
        {title}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </section>
  );
}

// В схеме:
{
  component: Collapsible,
  componentProps: { title: 'Дополнительно', defaultOpen: false },
  children: [{ model: model.$.notes, component: Textarea }],
}
```

## Компонент сам рисует детей

Иногда контейнеру нужны вложенные узлы как данные: посчитать их, нарисовать вкладки, показать один
активный. Для этого у компонента объявляют статику `__selfManagedChildren = true`. Тогда он получает:

- `children` — узлы скомпилированной схемы (`CompiledNode`: `selector`, `props`, `children`);
- `renderNode` — функцию, которая рисует узел.

```tsx
import { useState } from 'react';
import type { CompiledNode } from '@reformer/core';
import type { RenderNodeFn } from '@reformer/renderer-react';

function Tabs({ children, renderNode }: { children: CompiledNode[]; renderNode: RenderNodeFn }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div role="tablist">
        {children.map((tab, i) => (
          <button key={tab.selector ?? i} type="button" onClick={() => setActive(i)}>
            {String(tab.props.title ?? i + 1)}
          </button>
        ))}
      </div>
      {renderNode(children[active])}
    </div>
  );
}
Tabs.__selfManagedChildren = true;
```

Импортировать рендерер такому компоненту не нужно. Форму, поток шагов и отправку он берёт из
контекста сборки — хуком `useFormBundleContext()` из `@reformer/core/react`. Так устроен
`FormWizard` из `@reformer/ui-kit`: шаги — его дети в схеме, порядок и правила — поток шагов
сборки. См. [FormWizard (CDK)](/docs/cdk/form-wizard).

## Подводные камни

- **Правило ничего не делает** — у узла нет `selector`, или селектор с опечаткой. `schema.node('x')`
  тогда не падает, а молча ничего не меняет; в dev сборка предупреждает о селекторах, которых нет
  в дереве.
- **Правило на узел строки массива или подформы не срабатывает** — его адресовали из корневого
  поведения. См. [Области схемы](./arrays-and-parts.md#области-схемы).
- **Условие `hideWhen` не пересчитывается** — значение прочитано заранее, вне колбэка. Читайте
  `model.<поле>` внутри условия.
- **Повторный `hideWhen` на том же узле** заменяет прежнее условие — побеждает последнее.
- **Исключение в `onInit`** ломает построение формы: он вызывается синхронно до первого рендера.

## Низкоуровневый путь

`createRenderSchema(fn)` превращает функцию-схему без сборки в объект с тем же `.node(selector)`.
Его рисует `<FormRenderer render={schema} />`, а нодам формы нужна отдельная
`createFormFromModel({ model, schema })`. Областей строк и подформ у такой схемы нет. Формы
собирайте `createForm` — этот путь оставлен для особых случаев.

## См. также

- [Обзор поведения](/docs/behaviors/overview) — `defineFormBehavior` и операторы.
- [Массивы и подформы](./arrays-and-parts.md) — области строк и подформ.
- [FormWizard (CDK)](/docs/cdk/form-wizard) — мастер на узлах схемы.
- [@reformer/renderer-react](../renderer-react.md) — обзор пакета.
