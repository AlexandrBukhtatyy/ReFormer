---
title: 'Управление узлами и свои контейнеры'
sidebar_label: 'Управление узлами'
---

# Управление узлами и свои контейнеры

Узел с `selector` можно скрыть, поменять ему пропсы, подписаться на событие его компонента. Правила
пишутся в поведении формы, а исполняет их рендерер. Вторая половина страницы — свои контейнеры:
сворачиваемая секция, вкладки, всё, что рисует вложенные узлы по-своему.

## Когда это нужно

- Секция видна только при определённом значении поля.
- Кнопке или визарду нужен обработчик события, которое нельзя записать в схеме данными.
- Узел нужно скрыть или поменять ему заголовок снаружи формы — по кнопке, после загрузки данных.
- Нужен контейнер с логикой: сворачивается, показывает одну вкладку из нескольких.

## Правила узлов в поведении

Поведение формы одно на все рендереры: узел адресуется по `selector` — `schema.node('mortgage')`,
операторы берутся из `@reformer/core/behaviors`.

```ts
import { defineFormBehavior, hideWhen, onComponentEvent } from '@reformer/core/behaviors';

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, schema }) => {
  // Секция видна только для ипотеки; условие пересчитывается при изменении модели.
  hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');

  // Событие компонента: кнопка «Отправить» визарда.
  onComponentEvent(schema.node('wizard'), 'onSubmit', (values: CreditForm) => api.send(values));
});
```

Операторы — `hideWhen`, `onComponentEvent`, `renderEffect`, `onInit`, `onMount` и `onUnmount`;
что делает каждый — в таблице
[Правила узлов в поведении](../renderer-react/node-control.md#правила-узлов-в-поведении) страницы
React. Поведение подключается к сборке полем `behavior`: `createForm({ schema, behavior })`.

Что в Angular своё:

- **Обработчик `onComponentEvent` приходит каналом компонента.** Компонент объявляет вход-колбэк
  (`onSubmit = input<(values: unknown) => void>()` — так сделан `FormWizard` кита kit-taiga) или
  выход (`submit = output<unknown>()` — ключ `onSubmit` подпишется на него). Не объявил —
  функция станет слушателем DOM-события на хосте.
- У контейнера обработчик заменяет одноимённый проп из `componentProps`; у поля и массива он
  вызывается после записи значения или действия кнопки, а не вместо них.
- **Скрытый узел снимается.** `hideWhen` и `setHidden` уничтожают компоненты внутри узла, показ
  создаёт их заново. Значения остаются в модели, а состояние самих компонентов — нет.
- `renderEffect` стартует, когда область схемы отрисована, и гаснет, когда она уходит с экрана.

### Скрытие не выключает поля

`hideWhen` и `setHidden` только убирают узел с экрана. Поля внутри остаются включёнными: правила их
проверяют, а замечаний не видно. Скрываете узел с полями — выключите их тем же условием
(`enableWhen` в том же поведении). Выключенные поля не проверяются.

## Управление снаружи формы

Сборка даёт доступ к узлам корневой области — `bundle.render.node(selector)`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createForm } from '@reformer/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';

@Component({
  selector: 'app-credit',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <reformer-form [form]="credit" />
    <button type="button" (click)="showProperty()">Недвижимость</button>
  `,
})
export class CreditPage {
  readonly credit = ownFormBundle(() =>
    createForm<CreditForm>({ initial, schema: creditSchema, behavior: creditBehavior })
  );

  protected showProperty(): void {
    const section = this.credit.render.node('mortgage');
    section.setHidden(false).patchProps({ title: 'Недвижимость' }); // методы цепляются
  }
}
```

| Метод                 | Что делает                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| `setHidden(value)`    | скрыть или показать узел; главнее условия `hideWhen`                          |
| `resetHidden()`       | снова действует `hideWhen`                                                    |
| `patchProps(partial)` | подмешать пропсы к `componentProps`; повторный вызов добавляет, а не заменяет |
| `resetProps()`        | убрать подмешанные пропсы                                                     |
| `getRef()`            | ref узла: `{ current }`                                                       |

Перерисовывается только затронутый узел, а не вся форма. Тот же контроллер узла
`schema.node(selector)` доступен в поведении: из `onMount` удобно подмешать пропсы после загрузки
данных.

`getRef().current` в Angular — это:

- у компонента — его экземпляр, `ref` принимать не нужно;
- у поля — экземпляр контрола, а не обёртки;
- у HTML-тега — сам DOM-элемент;
- `null`, пока узла нет на экране.

Ref поля без `selector` ищется по пути модели: `render.node('registration.city').getRef()`. У поля
строки массива путь живой — `rows.0.name` после удаления первой строки указывает на новую первую.

## Свой контейнер

Обычный standalone-компонент. Вложенные узлы он получает содержимым — в `<ng-content />`. Проекция
ставится один раз, при создании компонента, поэтому `<ng-content />` не кладут под `@if`: детей
прячут атрибутом `[hidden]` или классом.

```ts
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Textarea } from '@reformer/kit-taiga';

@Component({
  selector: 'section[appCollapsible]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="open.set(!open())">{{ title() }}</button>
    <!-- Содержимое всегда в шаблоне: прячется атрибутом, а не @if. -->
    <div class="mt-2 space-y-3" [hidden]="!open()">
      <ng-content />
    </div>
  `,
})
export class Collapsible {
  readonly title = input<string>();
  protected readonly open = signal(true);
}

type Profile = { notes: string };

// В схеме:
export const extraNode = (model: FormModel<Profile>): FormSchemaNode => ({
  component: Collapsible,
  componentProps: { title: 'Дополнительно' },
  children: [{ model: model.$.notes, component: Textarea, componentProps: { label: 'Заметки' } }],
});
```

Дети создаются после контейнера и с его инжектором, поэтому провайдеры контейнера им видны.

## Компонент сам рисует детей

Иногда контейнеру нужны вложенные узлы как данные: посчитать их, нарисовать вкладки, показать один
активный. Для этого у компонента объявляют статику `__selfManagedChildren = true`. Тогда он
получает вход `children` — узлы скомпилированной схемы (`CompiledNode`: `id`, `selector`, `props`,
…), — а рисует их директивой `reformerNode`. Функции `renderNode`, как в React, нет: её место
занимает директива.

```ts
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { CompiledNode } from '@reformer/core';
import { ReformerNode } from '@reformer/renderer-angular';

@Component({
  selector: 'app-tabs',
  imports: [ReformerNode],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="tablist">
      @for (tab of children(); track tab.id; let i = $index) {
        <button type="button" (click)="active.set(i)">{{ titleOf(tab, i) }}</button>
      }
    </div>
    @if (children()[active()]; as tab) {
      <ng-container [reformerNode]="tab" />
    }
  `,
})
export class Tabs {
  static readonly __selfManagedChildren = true;

  readonly children = input<readonly CompiledNode[]>([]);
  protected readonly active = signal(0);

  protected titleOf(tab: CompiledNode, index: number): string {
    const title = (tab.props as { title?: unknown } | undefined)?.title;
    return typeof title === 'string' ? title : String(index + 1);
  }
}
```

- Входы такого компонента описывает тип `SelfManagedInputs`. Директиву `ReformerNode` компонент
  импортирует сам — в `imports`.
- Текстовые части детей такому компоненту не передаются, в dev-режиме — предупреждение. Оберните
  текст в узел.
- Узлы приходят, только если у узла задан ключ `children`. Иначе вход не трогается: дети могли
  прийти через `componentProps`.
- Узел, который ушёл из шаблона (неактивная вкладка), снимается: значения его полей остаются в
  модели.
- Вход `reformerNodeFieldWrapper` рисует узел с другой обёрткой поля:
  `<ng-container [reformerNode]="tab" [reformerNodeFieldWrapper]="compactField" />`. Она главнее
  `settings.fieldWrapper` и действует на всё поддерево узла: на поля в контейнерах, строках
  массивов, подформах и в узлах, которые рисует вложенный компонент с `__selfManagedChildren`.
  Обёртка в `componentProps` самого поля главнее её.

Импортировать рендерер целиком такому компоненту не нужно. Форму, поток шагов и отправку он берёт
из контекста сборки: `injectFormBundle()` и `formFlowSignals()` — см.
[Реактивность](../renderer-angular.md#реактивность). Так устроен `FormWizard` кита kit-taiga:

- шаги — его дети в схеме; шаг потока — узел с тем же `selector`, что и `id` шага;
- порядок и правила шагов — поток сборки `createForm({ flow })`; без потока визард бросает
  `FormWizard: у сборки нет потока шагов`;
- «Далее» — `flow.next()`: при замечаниях шаг не меняется; «Назад» — `flow.previous()`;
- «Отправить» на последнем шаге проверяет форму через `bundle.submission` и зовёт `onSubmit` — его
  ставит поведение: `onComponentEvent(schema.node('wizard'), 'onSubmit', …)`.

Порядок и правила шагов — в [Многошаговых формах](/docs/guides/multi-step-forms).

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
- **Обработчик `onComponentEvent` не вызывается** — компонент не объявил ни входа `onX`, ни выхода
  `x`.
- **Дети контейнера не отрисованы** — `<ng-content />` под `@if` или его нет; в dev —
  предупреждение `не вывел содержимое при создании`.
- **`Can't bind to 'reformerNode'`** — компонент рисует узлы, а `ReformerNode` не добавлен в его
  `imports`.

## Низкоуровневого пути нет

`createRenderSchema` и вход `render` у `<reformer-form>` в этой версии не поддерживаются.
Рендерер рисует только сборку `createForm` — с областями строк и подформ и правилами узлов.

## См. также

- [Обзор поведения](/docs/behaviors/overview) — `defineFormBehavior` и операторы.
- [Массивы и подформы](./arrays-and-parts.md) — области строк и подформ.
- [Управление узлами в React](../renderer-react/node-control.md) — те же правила в рендерере на
  React.
- [@reformer/renderer-angular](../renderer-angular.md) — обзор пакета.
