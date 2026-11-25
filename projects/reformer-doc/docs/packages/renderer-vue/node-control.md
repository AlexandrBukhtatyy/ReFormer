---
title: 'Управление узлами и свои контейнеры'
sidebar_label: 'Управление узлами'
---

# Управление узлами и свои контейнеры

Узел с `selector` можно скрыть, поменять ему пропсы, подписаться на событие его компонента. Правила
пишутся в поведении формы — тем же кодом, что для React, — а исполняет их рендерер Vue. Вторая
половина страницы — свои контейнеры: секция, вкладки, визард — всё, что рисует вложенные узлы
по-своему.

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

  // Событие компонента: «Отправить» визарда.
  onComponentEvent(schema.node('wizard'), 'onSubmit', (values: CreditForm) => api.send(values));
});
```

| Оператор                                 | Что делает во Vue                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `hideWhen(node, () => условие)`          | не рисует узел, пока условие истинно                                                       |
| `onComponentEvent(node, 'onX', handler)` | обработчик проп-события компонента узла                                                    |
| `renderEffect(schema, () => …)`          | эффект области: стартует после монтирования, перезапускается по сигналам, гаснет на снятии |
| `onMount(node, fn)`                      | вызывается в `onMounted` узла; может вернуть очистку                                       |
| `onUnmount(node, fn)`                    | вызывается при снятии узла — после очистки из `onMount`                                    |

Поведение подключается к сборке полем `behavior`: `createForm({ schema, behavior })`. `onInit`
рендерер не исполняет — он срабатывает при подключении поведения, до первого рендера, и одинаков для
всех стеков. Как устроено поведение целиком — в [Обзоре поведения](/docs/behaviors/overview).

Особенности `onComponentEvent` во Vue:

- имя события — имя пропа-слушателя Vue: `emit('submit')` компонента или его проп `onSubmit`
  слушаются как `'onSubmit'`;
- у контейнера обработчик заменяет одноимённый проп из `componentProps`;
- у поля и массива он вызывается после записи значения или действия кнопки, а не вместо них. Для
  контрола с `v-model` событие ввода — `'onUpdate:modelValue'`;
- у подформы своего компонента нет — правило не действует, в dev рендерер предупреждает.

### Скрытие не выключает поля

`hideWhen` и `setHidden` только убирают узел с экрана. Поля внутри остаются включёнными: правила их
проверяют, а замечаний не видно. Скрываете узел с полями — выключите их тем же условием
(`enableWhen` в том же поведении).

## Управление снаружи формы

Сборка даёт доступ к узлам корневой области — `bundle.render.node(selector)`:

```ts
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
| `getRef()`            | ref на то, что рисует узел                                                    |

Тот же контроллер узла `schema.node(selector)` доступен в поведении. Перерисовывается только
затронутый узел, а не вся форма.

`getRef()` во Vue — обычный function ref:

- у компонента — экземпляр компонента Vue, у HTML-тега — сам элемент;
- до монтирования и после снятия узла `current` — `null`;
- поле без `selector` адресуется путём модели: `bundle.render.node('phones.0.number').getRef()`.
  Путь живой — после удаления первой строки ref получает новая первая.

## Свой контейнер

Обычный компонент Vue. Вложенные узлы он получает уже отрисованными — слотом `default`. Ниже —
упрощённый `Section` кита Vuetify:

```ts
import { defineComponent, h } from 'vue';

export const Section = defineComponent({
  name: 'Section',
  props: {
    title: { type: String, default: undefined },
    // Объявленный className приходит как есть; без объявления рендерер отдал бы его классом корню.
    className: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h('section', { class: props.className }, [
        props.title ? h('h3', props.title) : null,
        slots.default?.(),
      ]);
  },
});

// В схеме:
{
  component: Section,
  componentProps: { title: 'Дополнительно' },
  children: [{ model: model.$.notes, component: Textarea }],
}
```

Компонент, который объявил проп `selector`, получает `selector` своего узла. Остальным он не
передаётся.

## Компонент сам рисует детей

Иногда контейнеру нужны вложенные узлы как данные: посчитать их, нарисовать вкладки, показать один
активный. Для этого у компонента объявляют статику `__selfManagedChildren = true`. Тогда он получает
пропсы `SelfManagedProps`:

- `children` — узлы скомпилированной схемы (`CompiledNode`: `id`, `selector`, `kind`, `props`);
- `renderNode(node, key?)` — функцию, которая рисует узел.

Оба пропа компонент обязан объявить: необъявленные Vue отдал бы атрибутами корню.

```ts
import { defineComponent, h, shallowRef, type PropType } from 'vue';
import type { CompiledNode } from '@reformer/core';
import type { RenderNodeFn } from '@reformer/renderer-vue';

export const Tabs = Object.assign(
  defineComponent({
    name: 'Tabs',
    props: {
      children: { type: Array as PropType<readonly CompiledNode[]>, default: () => [] },
      renderNode: { type: Function as PropType<RenderNodeFn>, required: true },
    },
    setup(props) {
      const active = shallowRef(0);
      return () => {
        const tabs = props.children;
        const current = tabs[active.value];
        return h('div', [
          h(
            'div',
            { role: 'tablist' },
            tabs.map((tab, i) =>
              h(
                'button',
                { key: tab.selector ?? i, type: 'button', onClick: () => (active.value = i) },
                String((tab.props as { title?: unknown }).title ?? i + 1)
              )
            )
          ),
          current ? props.renderNode(current) : null,
        ]);
      };
    },
  }),
  { __selfManagedChildren: true }
);
```

Текстовые части такому компоненту не передаются — в dev рендерер предупреждает, сколько отброшено.
Оберните текст в узел.

Импортировать `FormRenderer` такому компоненту не нужно. Форму, поток шагов и отправку он берёт из
контекста сборки — `useFormBundleContext()`, состояние шагов — `useFormFlow(flow)`. Так устроен
`FormWizard` из `@reformer/kit-vuetify`: шаги — его дети в схеме, «Далее» — `flow.next()`,
«Отправить» — `bundle.submission.submit(…)` и проп `onSubmit` из поведения.

### Ручная композиция

Компонент `RenderNode` рисует один узел внутри дерева `FormRenderer`:
`h(RenderNode, { key: step.id, node: step })`. Он принимает и узел скомпилированной схемы, и
авторский узел — такой рендерер компилирует сам, один раз. Узел читается при создании компонента:
другому узлу — другой `key`. Внутри компонента с `__selfManagedChildren` удобнее проп `renderNode`.

Проп `fieldWrapper` рисует узел с другой обёрткой поля:
`h(RenderNode, { node, fieldWrapper: CompactField })`. Она главнее `settings.fieldWrapper` и
действует на всё поддерево узла: на поля в контейнерах, строках массивов, подформах и в узлах,
которые рисует вложенный компонент с `__selfManagedChildren`. Обёртка в `componentProps` самого
поля главнее её.

## Подводные камни

- **Правило ничего не делает** — у узла нет `selector`, или селектор с опечаткой. `schema.node('x')`
  тогда не падает, а молча ничего не меняет.
- **Правило на узел строки массива или подформы не срабатывает** — его адресовали из корневого
  поведения. См. [Области схемы](./arrays-and-parts.md#области-схемы).
- **Условие `hideWhen` не пересчитывается** — значение прочитано заранее, вне колбэка. Читайте
  `model.<поле>` внутри условия.
- **Обработчик `onComponentEvent` не вызывается** — имя записано как событие Vue (`'submit'`), а
  нужно имя пропа-слушателя (`'onSubmit'`).
- **Компонент вкладок пустой** — не объявлены пропсы `children` и `renderNode`, или нет статики
  `__selfManagedChildren`.
- **`getRef().current` — `null` в поведении** — узел ещё не смонтирован. Читайте ref в `onMount`
  или `renderEffect`: они исполняются после монтирования.

## См. также

- [Управление узлами в React](../renderer-react/node-control.md) — то же для
  `@reformer/renderer-react`.
- [Обзор поведения](/docs/behaviors/overview) — `defineFormBehavior` и операторы.
- [Массивы и подформы](./arrays-and-parts.md) — области строк и подформ.
- [Многошаговые формы](/docs/guides/multi-step-forms) — поток шагов сборки.
- [@reformer/renderer-vue](../renderer-vue.md) — обзор пакета.
