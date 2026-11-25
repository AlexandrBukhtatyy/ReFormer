---
title: 'Поля: обёртка и адаптеры'
sidebar_label: 'Поля и обёртки'
---

# Поля: обёртка и адаптеры

Узел поля связывает компонент с нодой поля: `{ model: model.$.email, component: TextInput }`.
Рендерер сам передаёт компоненту значение и подписывается на его изменения. Эта страница — о том,
как пропсы узла доходят до компонента Angular, что получает контрол, чем его обернуть и как
подключить компонент другой библиотеки.

## Когда это нужно

- Поля рисуются без подписи и текста замечаний — нет обёртки поля, а контрол их не рисует.
- Проп из `componentProps` не дошёл до компонента или лёг атрибутом на хост-элемент.
- Контрол библиотеки работает в другом диалекте: `[(checked)]` вместо `[(value)]`.
- Контрол рисует поле целиком сам и читает ноду: подпись, ошибку, состояние.

## Как пропсы узла доходят до компонента

Ядро отдаёт рендереру один плоский объект пропсов на узел — тот же, что получают рендереры на React
и Vue. У компонента Angular каналов три, и куда уйдёт ключ, решает объявление компонента
(`reflectComponentType`), а не имя ключа:

1. **Вход.** Ключ совпал с объявленным входом — значение уходит в этот вход. Имя — как в шаблоне,
   с учётом псевдонима.
2. **Выход.** Функция под именем объявленного выхода (`valueChange`) или под ключом-обработчиком
   (`onValueChange`) подписывается на этот выход.
3. **Хост.** Всё остальное ложится на хост-элемент: атрибуты (`data-testid`, `aria-*`),
   `className`, `style` и слушатели DOM (`onClick`).

```ts
// Компонент объявил входы `label`, `amount` и выходы `valueChange`, `picked`.
const props = {
  label: 'Имя',
  amount: 2,
  onValueChange: (value: string) => console.log(value),
  picked: (item: unknown) => console.log(item),
  onClick: () => console.log('click'),
  'data-testid': 'input-name',
  class: 'wide',
};
// входы:  label, amount
// выходы: valueChange ← onValueChange, picked ← picked
// хост:   слушатель click, атрибут data-testid, класс wide
```

Компонент получает только то, что объявил, а остальное не теряется. Необъявленный вход Angular
отверг бы ошибкой — поэтому всё, чего компонент не объявил, уходит на хост.

Как ключи ложатся на хост-элемент:

| Ключ                                | На хост-элементе                                                      |
| ----------------------------------- | --------------------------------------------------------------------- |
| `className`, `class`                | классы                                                                |
| `style` объектом                    | инлайн-стили: `{ marginTop: 8 }` → `margin-top: 8px`                  |
| функция `onXxx`                     | слушатель события `xxx`: `onClick` → `click`                          |
| `htmlFor`                           | атрибут `for`                                                         |
| строка, число                       | атрибут                                                               |
| `true` / `false`                    | `aria-*` и `data-*` — словом; остальные — пустой атрибут или никакого |
| `null`, `undefined`, объект, массив | не ставятся                                                           |

- К числу в `style` дописывается `px`, кроме `0`, CSS-переменных и безразмерных свойств
  (`opacity`, `zIndex`, `flexGrow`, `lineHeight`, …).
- Фокус слушается всплывающими событиями: `onBlur` → `focusout`, `onFocus` → `focusin`. Ещё одно
  особое имя — `onDoubleClick` → `dblclick`.
- Обработчик строкой (`onclick: '…'`) атрибутом не становится: обработчики — только функциями.
- Ключ пропал из пропсов узла (например, после `resetProps()`) — вход получает `undefined`,
  атрибут, класс и стиль снимаются.
- Хост компонента — сам нативный элемент (`selector: 'input[appTextInput]'`)? Тогда `data-testid`
  и класс оказываются прямо на `<input>`.
- Атрибут нужен на внутреннем элементе — объявите вход с псевдонимом. Так поля кита kit-taiga
  забирают `data-testid` и ставят его на свой `<input>`:
  `readonly testId = input<string | undefined>(undefined, { alias: 'data-testid' })`.
- Компонент объявил вход `className` (как `Box` и `Section` кита) — класс приходит входом, и
  компонент ставит его сам.

Те же правила действуют для контейнеров, компонентов массива и обёрток поля.

## Что получает контрол поля

По умолчанию контрол связывается как `[(value)]` — это `VALUE_CHANGE_ADAPTER`. Пару входа и выхода
даёт и `model()`.

| Что           | Каким каналом                                                               |
| ------------- | --------------------------------------------------------------------------- |
| значение      | вход `value`; если компонент его не объявил, значение не передаётся         |
| изменение     | выход `valueChange`: рендерер пишет присланное значение в ноду              |
| касание       | выход `blur`, если объявлен; иначе слушатель `focusout` на хосте            |
| `disabled`    | вход `disabled`; не объявлен — атрибут `disabled` на хосте                  |
| `data-testid` | `input-<testId>`, если в пропсах его нет: на хост или во вход с псевдонимом |
| `control`     | нода поля — только по запросу, см. [ниже](#контролу-нужна-сама-нода)        |
| остальное     | `componentProps` узла — по трём каналам выше                                |

`testId` берётся из `componentProps.testId`, а без него — из пути поля: `personalData.lastName`
даёт `personalData-lastName`. У поля строки массива путь живой: после удаления соседней строки
`data-testid` обновляется.

Подпись (`label`), описание (`description`), `required` и `labelTooltip` адресованы обёртке поля
и контролу не уходят: иначе `label` лёг бы атрибутом на хост, а нативный `required` включил бы
проверку браузера. Контрол, который рисует подпись сам, объявляет статику
`reformerLayout = 'inline-label'` и получает `label` и `required`.

Служебные ключи `className`, `testId`, `wrapper` и `fieldWrapper` забирает рендерер: класс
достаётся оболочке поля (обёртке или `div`), а не контролу.

### Касание

Уход фокуса помечает поле тронутым. Без объявленного выхода рендерер слушает всплывающее событие
`focusout` на хосте — оно приходит и от внутреннего `<input>`. Если внутри хоста есть кнопки или
панель списка, фокус уходит и между ними. Тогда объявите выход `blur` и шлите его с настоящего
элемента ввода — рендерер подпишется на выход, а слушатель на хост ставить не будет:

```html
<input [value]="text()" (input)="write($event)" (blur)="blur.emit()" />
```

## Обёртка поля

Обёртка рисует подпись, контрол и текст замечания. Откуда она берётся — по старшинству:

1. `componentProps.fieldWrapper` у самого поля;
2. `settings.fieldWrapper` у `<reformer-form>`;
3. запись `FIELD_WRAPPER` реестра — сборка передаёт её рендереру;
4. без обёртки контрол кладётся в `div`. Тег меняет `componentProps.wrapper`; компонент в
   `wrapper` получает только `className`.

### Своя обёртка

Обёртка — компонент с входами `FieldWrapperInputs`: нода поля `control` и `testId`. Получает она
только те из них, что объявила. `className` поля приходит входом, если обёртка его объявила, иначе
ложится классом на её хост. Контрол уже создан рендерером и приходит содержимым — `<ng-content />`.

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FormControl } from '@reformer/core';
import { fieldError, formControlSignals } from '@reformer/renderer-angular';

@Component({
  selector: 'div[appFieldWrapper]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-testid]': 'testId() ? "field-" + testId() : null' },
  template: `
    @if (label(); as text) {
      <span class="text-xs uppercase text-slate-500">{{ text }}</span>
    }
    <ng-content />
    @if (error(); as text) {
      <p role="alert" class="text-sm text-red-600">{{ text }}</p>
    }
  `,
})
export class FieldWrapper {
  readonly control = input.required<FormControl<unknown>>();
  readonly testId = input<string>();

  private readonly field = formControlSignals(this.control);
  // Подпись — из пропсов ноды поля: контролу она не уходит.
  protected readonly label = computed(
    () => this.field.componentProps()['label'] as string | undefined
  );
  // Текст главного замечания, пока поле его показывает, — из словаря формы или локали.
  protected readonly error = fieldError(this.control);
}
```

```ts
export class ProfileForm {
  // Шаблон: <reformer-form [form]="bundle" [settings]="settings" />
  readonly settings: RendererSettings = { fieldWrapper: FieldWrapper };
}
```

- `<ng-content />` стоит вне `@if`: контрол должен оказаться на месте, когда обёртка создана.
  Иначе контрол не отрисуется, а в dev-режиме будет предупреждение
  `Обёртка "…" не вывела содержимое при создании`.
- Контрол создаётся с инжектором обёртки: провайдеры обёртки ему видны.
- Если контрол рисует подпись сам (`inline-label`), обёртка с подписью её задвоит. Такие контролы
  ставьте без обёртки — так устроен кит kit-taiga.

## Компоненты других библиотек

Контрол без статики `reformerAdapter` связывается как `[(value)]`. Если у компонента библиотеки
другой диалект, рендерер его не угадает:

| Контрол                                                      | Что будет без адаптера                                   |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `[(checked)]`: вход `checked`, выход `checkedChange`         | значение не приходит, изменения не доходят до модели     |
| `[(value)]`, но выход несёт событие, а не значение           | в модель уходит объект события                           |
| работает только через `NgControl` (`formControl`, `ngModel`) | не связывается: `FormControl` Angular рендерер не ставит |

Перевод описывает [адаптер поля](/docs/reference/glossary) — `FieldAdapter` из
`@reformer/core/render`. Для чужих компонентов его возвращает `settings.resolveFieldAdapter`:

```ts
import type { FieldAdapter } from '@reformer/core/render';
import type { RendererSettings } from '@reformer/renderer-angular';
import { LibToggle } from 'some-angular-kit';

// Ключ — сам компонент: рендерер ищет адаптер по ссылке из node.component.
const adapters = new Map<unknown, FieldAdapter>([
  [LibToggle, { valueProp: 'checked', changeProp: 'onCheckedChange', toValue: (v) => v ?? false }],
]);

export class ProfilePage {
  readonly settings: RendererSettings = {
    fieldWrapper: FieldWrapper,
    resolveFieldAdapter: (component) => adapters.get(component),
  };
}
```

Свой компонент объявляет диалект статикой — без настроек рендерера:

```ts
@Component({
  selector: 'button[appToggle]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[disabled]': 'disabled()',
    '[attr.aria-pressed]': 'checked() === true',
    '(click)': 'toggle.emit(checked() !== true)',
  },
})
export class Toggle {
  // Значение — во вход `checked`, изменение — выходом `toggle` (ключ `onToggle`).
  static readonly reformerAdapter = { valueProp: 'checked', changeProp: 'onToggle' };

  readonly checked = input<boolean>();
  readonly disabled = input(false);
  readonly toggle = output<boolean>();
}
```

Порядок поиска: `resolveFieldAdapter` → статика `reformerAdapter` компонента →
`VALUE_CHANGE_ADAPTER`. Вернули `undefined` — рендерер идёт дальше по цепочке.

| Поле адаптера | Что задаёт                                                                | Без адаптера      |
| ------------- | ------------------------------------------------------------------------- | ----------------- |
| `valueProp`   | вход, в который идёт значение; необъявленный вход значение не получит     | `'value'`         |
| `changeProp`  | ключ обработчика изменения: `onXxx` — выход `xxx`, либо имя входа-колбэка | `'onValueChange'` |
| `fromEmit`    | как достать значение из того, что прислал выход                           | как есть          |
| `toValue`     | как привести значение поля ко входу (`null` → `false`)                    | как есть          |
| `bindBlur`    | как подключить уход фокуса, если не через `onBlur`                        | `onBlur`          |
| `strip`       | какие ключи убрать из `componentProps`, чтобы не ушли в контрол           | —                 |
| `passControl` | передавать ли контролу ноду входом `control`                              | `false`           |

Адаптер заменяет диалект по умолчанию целиком. Если в нём не задан `changeProp`, обработчик
называется `onChange` — это вход-колбэк `onChange` или выход `change`, а не `valueChange`. Ключ
`uncontrolled` в этой версии не действует. Поля адаптера и примеры для React — на странице
[Поля и обёртки в React](../renderer-react/fields.md#компоненты-сторонних-библиотек).

Компонент, который работает только через `NgControl`, подключают своим контролом-обёрткой: он
держит `FormControl` Angular — зеркало ноды поля — и отдаёт его виджету. Так устроены `Checkbox`,
`Switch`, `RadioGroup` и `Select` кита kit-taiga.

### Контролу нужна сама нода

Контрол, который рисует поле целиком — подпись, ошибку, состояние, — просит ноду поля. Она придёт
входом `control`. Способов два:

- **`static readonly reformerNeedsControl = true`** — диалект остаётся `[(value)]`. Так сделаны
  поля кита kit-taiga.
- **`static readonly reformerAdapter = { passControl: true }`** — адаптер заменяет диалект по
  умолчанию, и изменение идёт через `onChange`. Чтобы сохранить `[(value)]`, разверните адаптер по
  умолчанию: `{ ...VALUE_CHANGE_ADAPTER, passControl: true }`.

Без одного из них вход `control` значения не получит.

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { FormControl } from '@reformer/core';
import { fieldError, formControlSignals } from '@reformer/renderer-angular';

@Component({
  selector: 'app-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      {{ label() }}
      <input
        [value]="field.value()"
        [disabled]="field.disabled()"
        (input)="valueChange.emit($any($event.target).value)"
        (blur)="blur.emit()"
      />
    </label>
    @if (error(); as text) {
      <p role="alert">{{ text }}</p>
    }
  `,
})
export class TextField {
  static readonly reformerNeedsControl = true; // получить ноду поля входом `control`
  static readonly reformerLayout = 'inline-label'; // получить `label` и `required`

  readonly control = input.required<FormControl<string>>();
  readonly label = input<string>();
  readonly required = input(false);
  readonly valueChange = output<string>();
  readonly blur = output<void>();

  protected readonly field = formControlSignals(this.control); // состояние ноды сигналами Angular
  protected readonly error = fieldError(this.control); // текст замечания, которое поле показывает
}
```

Вход `value` контролу здесь не нужен: значение он читает из ноды. Если вход не объявлен, рендерер
значение и не передаёт.

## Доступность поля

`disabled` приходит из состояния ноды: входом `disabled` или атрибутом на хосте. Рендерер ставит
его после `componentProps`, поэтому `componentProps.disabled` не действует. Рычаги те же, что у
React: `disabled: true` в узле поля, `form.<поле>.disable()` / `enable()`, `disable()` на группе
или на всей форме в `setup` сборки — см.
[Доступность поля в React](../renderer-react/fields.md#доступность-поля). Отключённые поля не
проверяются правилами.

## Подводные камни

- **Поля без подписи и ошибок** — нет обёртки поля, а контрол их не рисует. Задайте
  `settings.fieldWrapper` или возьмите контролы, которые рисуют поле сами.
- **Ввод не доходит до модели** — контрол не объявил выход `valueChange` (или вход и выход своего
  диалекта), а адаптера нет. Либо адаптер `{ passControl: true }` заменил диалект — см.
  [выше](#контролу-нужна-сама-нода).
- **Проп не дошёл до компонента** — компонент не объявил такой вход. Строка и число лягут
  атрибутом на хост, а массив `options` или объект пропадут: атрибутом они не становятся.
- **Контрол не отрисован** — в шаблоне обёртки нет `<ng-content />` или он стоит под `@if`.
- **Поле становится тронутым раньше времени** — фокус ушёл внутри хоста (на кнопку, в панель).
  Объявите выход `blur`.
- **Вход `control` пуст** (у `input.required` — ошибка Angular о незаданном обязательном входе) —
  контрол читает ноду, а передача не включена: `reformerNeedsControl` или `passControl`.

## См. также

- [@reformer/renderer-angular](../renderer-angular.md) — обзор пакета.
- [Поля и обёртки в React](../renderer-react/fields.md) — тот же контракт поля в React.
- [Реестр renderer-json](../renderer-json/registry.md) — компоненты и `FIELD_WRAPPER` в форме из
  JSON.
- [Обзор валидации](/docs/validation/overview) — откуда берутся замечания поля.
