---
id: renderer-angular
title: '@reformer/renderer-angular'
sidebar_label: 'renderer-angular'
---

# @reformer/renderer-angular

:::caution Экспериментальный пакет
`@reformer/renderer-angular` в npm не опубликован: пакет `private`, версия `0.0.0`, подключается
только внутри монорепозитория ReFormer. API может меняться без отдельного уведомления.
:::

`@reformer/renderer-angular` рисует форму в Angular по её [схеме формы](/docs/reference/glossary) —
тому же скомпилированному дереву узлов, которое рисует
[@reformer/renderer-react](./renderer-react.md). Разметку полей писать не нужно: рендерер обходит
дерево и сам связывает каждый компонент с нодой поля — значением, замечаниями и доступностью.
Компоненты — обычные standalone-компоненты Angular: пропсы узла приходят им входами и выходами,
дети — содержимым (`<ng-content />`).

## Когда нужен

- Приложение на Angular, а форма описана схемой ReFormer: модель, правила, поведение и поток шагов
  пишутся так же, как для React.
- Одна форма рисуется в нескольких стеках. JSON-документ, правила и API общие, а реестр кита и
  рендерер у каждого стека свои — так устроены страницы кросс-проверки `angular-playground`.
- Разметкой нужно управлять из поведения формы: `hideWhen`, `onComponentEvent`, `patchProps`.

**Когда не нужен.** Полей немного, а вёрстка своя — рендерер не обязателен: компонент получает ноду
поля `bundle.form.<поле>` входом и читает её состояние через
[`formControlSignals`](#реактивность). Форма уходит в прод вне монорепозитория — пакет пока не
опубликован.

## Установка

Пакет не опубликован в npm. Внутри монорепозитория его подключают зависимостью workspace — так
сделано в `projects/angular-playground`:

```json
{
  "dependencies": {
    "@angular/common": "^21.2.0",
    "@angular/core": "^21.2.0",
    "@reformer/core": "*",
    "@reformer/renderer-angular": "*"
  }
}
```

Пиры: `@reformer/core`, `@angular/core` и `@angular/common` 21. Вход один —
`@reformer/renderer-angular`. Поле `exports` пакета указывает в `dist/`, поэтому перед
использованием его собирают: `npm run build -w @reformer/renderer-angular`.

Всё standalone и работает без `zone.js`: приложение запускают с
`provideZonelessChangeDetection()`. Компоненты полей приходят из приложения: свои тонкие адаптеры
над библиотекой компонентов или кит [@reformer/kit-taiga](#кит-kit-taiga).

## Минимальный пример

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { createForm, type FormModel } from '@reformer/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';

// Контрол диалекта [(value)]: значение — входом `value`, изменение — выходом `valueChange`.
// Хост — сам <input>: атрибуты, которых контрол не объявил, рендерер ставит прямо на него.
@Component({
  selector: 'input[appTextInput]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[value]': 'text()', '[disabled]': 'disabled()', '(input)': 'emit($event)' },
})
export class TextInput {
  readonly value = input<unknown>();
  readonly disabled = input(false);
  readonly valueChange = output<string>();
  protected readonly text = computed(() => String(this.value() ?? ''));

  protected emit(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}

type SignUp = { email: string };

// Схема: дерево узлов. Поле привязано к сигналу модели model.$.<поле>.
const schema = (model: FormModel<SignUp>) => ({
  component: 'form',
  children: [
    { model: model.$.email, component: TextInput, componentProps: { placeholder: 'Email' } },
  ],
});

@Component({
  selector: 'app-sign-up',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<reformer-form [form]="bundle" />`,
})
export class SignUpForm {
  // Сборка — одна на компонент: живая проверка стартует после первой отрисовки,
  // сборка снимается вместе с компонентом.
  readonly bundle = ownFormBundle(() => createForm<SignUp>({ initial: { email: '' }, schema }));
}
```

Что здесь происходит:

1. Схема — функция `(model) => узел`. [Сборка формы](/docs/reference/glossary) (`createForm`)
   вызывает её один раз и компилирует дерево.
2. `ownFormBundle` создаёт сборку в инициализаторе поля компонента. Живую проверку он запускает в
   `afterNextRender`, а при снятии компонента останавливает её и снимает сборку (`DestroyRef`).
3. `<reformer-form>` получает сборку входом `form` и рисует дерево прямо в своём хост-элементе:
   своих элементов он не добавляет.
4. Вход `placeholder` контрол не объявил — рендерер ставит его атрибутом на хост, то есть на сам
   `<input>`. Как пропсы узла раскладываются по входам, выходам и хосту — на странице
   [Поля](./renderer-angular/fields.md#как-пропсы-узла-доходят-до-компонента).

Подписи и текста замечания здесь нет: их рисует обёртка поля или сам контрол — см.
[Поля: обёртка и адаптеры](./renderer-angular/fields.md). Правила проверки в узлы не пишутся:
это отдельная схема над моделью, она уходит в сборку полем `validation`. См.
[Обзор валидации](/docs/validation/overview).

### Входы `<reformer-form>`

| Вход       | Что задаёт                                                                |
| ---------- | ------------------------------------------------------------------------- |
| `form`     | сборка `createForm` со схемой; обязательный                               |
| `settings` | `fieldWrapper` — обёртка поля, `resolveFieldAdapter` — диалекты контролов |
| `messages` | словарь формы: тексты замечаний по коду, поверх словаря предка и локали   |

Компонент — `OnPush`, входы на сигналах. Смена любого входа рисует форму заново: значения живут в
модели и остаются, а компоненты создаются снова.

## Форма из JSON-документа

Основной вход `@reformer/renderer-json` привязан к React. Angular берёт вход без слоя
представления — `@reformer/renderer-json/neutral`: типы документа, реестр, операторы, локализация
`$locale`. Пиры React у `@reformer/renderer-json` необязательные.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createForm } from '@reformer/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';
import { defineRegistry, type JsonFormSchema } from '@reformer/renderer-json/neutral';
import rawDocument from './sign-up.form.json';
import { TextInput } from './text-input';

type SignUp = { email: string };

// Документ, пришедший данными, приводят к типу формы.
const signUpDocument = rawDocument as unknown as JsonFormSchema<SignUp>;

const registry = defineRegistry((reg) => reg.component('TextInput', TextInput));

@Component({
  selector: 'app-sign-up',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<reformer-form [form]="bundle" />`,
})
export class SignUpForm {
  readonly bundle = ownFormBundle(() =>
    createForm<SignUp>({ schema: signUpDocument, registry, initial: { email: '' } })
  );
}
```

```json title="sign-up.form.json"
{
  "format": 2,
  "root": {
    "component": "$html(div)",
    "children": [
      {
        "model": "$model(email)",
        "component": "$component(TextInput)",
        "componentProps": { "placeholder": "Email" }
      }
    ]
  }
}
```

- Формат документа, операторы и реестр — те же, что у React:
  [Формат документа](./renderer-json/document-format.md), [Реестр](./renderer-json/registry.md).
- Обёртка поля из записи реестра `FIELD_WRAPPER` доходит до рендерера через сборку;
  `settings.fieldWrapper` перекрывает её.
- Во входе `/neutral` нет того, что привязано к React: панели и границы ошибок схемы,
  `LocaleProvider`, `useLocale`, `I18n`, `useSignalValues`.

## Кит kit-taiga

`@reformer/kit-taiga` — кит на Taiga UI 5: standalone-компоненты под именами каталога
`@reformer/ui-kit` (`Input`, `Select`, `FieldArray`, `FormWizard`, …). Поэтому один документ
формы рисуется любым из двух китов. Кит тоже экспериментальный и не опубликован.

Пиры кита: `@angular/core`, `@angular/common` и `@angular/forms` 21, `@taiga-ui/core` и
`@taiga-ui/kit` 5.34+, `@reformer/core`, `@reformer/renderer-angular`.

Провайдеры приложения ставятся один раз:

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideKitTaiga } from '@reformer/kit-taiga';

bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection(), provideKitTaiga()],
});
```

Реестр — из входа `/neutral`:

```ts
import { defineRegistry } from '@reformer/renderer-json/neutral';
import { FormWizard, Input, Section, Select, Step } from '@reformer/kit-taiga';

export const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Select', Select);
  reg.component('Section', Section);
  reg.component('FormWizard', FormWizard);
  reg.component('Step', Step);
});
```

Форма стоит внутри `<tui-root>`: в нём контейнер всплывающих панелей списка.

```html
<tui-root>
  <reformer-form [form]="bundle" [messages]="messages" />
</tui-root>
```

- **Стили** — `@taiga-ui/styles/taiga-ui-theme.css` и `@reformer/kit-taiga/styles.css` в `styles`
  сборки (`angular.json`). Иконки виджетов кит встроил строками: запись `assets` с путём в
  `node_modules` не нужна.
- **`@angular/forms` обязателен.** `Checkbox`, `Switch`, `RadioGroup` и `Select` работают на
  зеркале поля в `FormControl` Angular: виджеты Taiga без `NgControl` не работают. Состояние поля
  при этом остаётся в ядре.
- **Обёртки поля нет.** Контрол кита — самодостаточное поле: подпись и ошибку рисует сам. Запись
  `FIELD_WRAPPER` в реестре не нужна.
- **`provideKitTaiga({ animations: false })`** — анимации длительностью 0 мс: панель списка и текст
  ошибки появляются в той же перерисовке. Нужно тестам и автоматизации.

| Группа      | Компоненты                                                                     |
| ----------- | ------------------------------------------------------------------------------ |
| поля ввода  | `Input`, `InputPassword`, `InputMask`, `InputNumber`, `Textarea`, `DatePicker` |
| поля выбора | `Checkbox`, `Switch`, `RadioGroup`, `Select`                                   |
| контейнеры  | `Box`, `Card`, `Section`                                                       |
| массив      | `FieldArray`                                                                   |
| мастер      | `FormWizard`, `Step`                                                           |

Селекторы у компонентов кита атрибутные (`div[kitInput]`, `section[kitSection]`), у мастера —
элементные (`kit-form-wizard`, `kit-step`). Значения полей: текст — строка (`''`, когда пусто),
число — `number | null`, дата — строка `YYYY-MM-DD`, флажок и переключатель — `boolean`. Подписи
кнопок — русские строки по умолчанию: «Добавить» и «Удалить» у `FieldArray` меняют входы
`addButtonLabel` и `removeButtonLabel`, «Отправить» у `FormWizard` — `submitLabel`.

## Реактивность

Состояние формы живёт в сигналах `@reformer/core`, а шаблоны Angular на них не подписываются. Мост
`fromCoreSignal(read)` отдаёт значение сигналом Angular: шаблон подписывается на него как обычно, а
смена сигнала ядра сама планирует перерисовку — зона для этого не нужна. Мост ленивый: подписка
заводится при первом чтении, и компонент перерисовывается только на то, что прочитал.

```ts
import { Component, input } from '@angular/core';
import type { FormControl } from '@reformer/core';
import { fromCoreSignal } from '@reformer/renderer-angular';

@Component({
  selector: 'app-field-state',
  template: '@if (shown()) { <b>!</b> }',
})
export class FieldState {
  readonly control = input.required<FormControl<unknown>>();
  // Читает и вход Angular, и сигнал ядра: смена любого пересчитывает значение.
  readonly shown = fromCoreSignal(() => this.control().shouldShowError.value);
}
```

На мосту построены готовые помощники. Нода и поток передаются функцией — обычно самим входом
компонента, тогда сигналы следуют и за сменой ноды.

| Функция                       | Что отдаёт                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `formControlSignals(control)` | состояние поля сигналами Angular: `value`, `disabled`, `touched`, `issues`, …       |
| `fieldError(control)`         | текст замечания, которое поле показывает сейчас, либо `undefined`                   |
| `formFlowSignals(flow)`       | состояние потока шагов: `current`, `index`, `isFirst`, `isLast`, …                  |
| `injectFormBundle()`          | сборка, внутри которой отрисован компонент, либо `null` вне рендерера               |
| `injectIssueMessage()`        | резолвер текста замечания: словарь формы → локаль → встроенный английский → сам код |

У `formControlSignals` сигналы `value`, `disabled`, `touched`, `pending`, `issues`,
`shouldShowError`, `shouldShowIssues`, `path` и `componentProps`; у `formFlowSignals` — `current`,
`index`, `activeSteps`, `completed`, `isFirst`, `isLast` и `validating`.

Все они вызываются при создании компонента — в инициализаторе поля или в конструкторе: подписки
снимаются вместе с компонентом. Вне контекста внедрения владельца передают явно:
`fromCoreSignal(read, destroyRef)`.

Кнопка мастера берёт поток из сборки, переходы — методы самого потока:

```ts
import { Component } from '@angular/core';
import { formFlowSignals, injectFormBundle } from '@reformer/renderer-angular';

@Component({
  selector: 'app-wizard-next',
  template: `<button [disabled]="steps.isLast()" (click)="flow.next()">
    {{ steps.current() }}
  </button>`,
})
export class WizardNext {
  protected readonly flow = injectFormBundle()!.flow!;
  protected readonly steps = formFlowSignals(() => this.flow);
}
```

**Локаль и словарь формы** — провайдеры Angular. Локаль для приложения или поддерева —
`provideReformerI18n(createI18n(ru))` (`createI18n` — из `@reformer/core/i18n`, `ru` — из
`@reformer/core/locale/ru`); без провайдера тексты замечаний — встроенные английские. Словарь
формы — вход `messages` у `<reformer-form>` или `provideIssueMessages(messages)`: записи
накладываются поверх словаря предка. Подробно о словарях — в
[Локализации](/docs/guides/localization).

## Что делает рендерер

- Рисует узел по его виду: поле, массив под-форм, подформа, контейнер, HTML-тег, текст. Виды узлов
  описаны на странице [Схема формы](/docs/core-concepts/schemas/form-schema).
- Связывает поле с нодой. Контрол получает значение входом `value`, сообщает об изменении выходом
  `valueChange`; уход фокуса помечает поле тронутым; `disabled` и `data-testid` рендерер ставит сам.
- Раскладывает плоские пропсы узла по каналам компонента: объявленные входы, выходы, остальное — на
  хост-элемент.
- Исполняет правила узлов из поведения формы: `hideWhen`, `patchProps`, `onComponentEvent`,
  `renderEffect`, `onMount` и другие.
- Ставит контекст сборки — токен `FORM_BUNDLE`: из него компонент берёт форму, поток шагов и
  отправку через `injectFormBundle()`.
- Лишних элементов не добавляет: от узла в DOM остаётся только комментарий-якорь, HTML-тег узла —
  сам элемент.

## Разделы

| Страница                                                          | О чём                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Поля: обёртка и адаптеры](./renderer-angular/fields.md)          | три канала пропсов, контракт контрола, своя обёртка, компоненты других библиотек |
| [Вёрстка: контейнеры, HTML и текст](./renderer-angular/layout.md) | контейнеры и проекция детей, HTML-теги в схеме, живой текст из сигналов          |
| [Массивы и подформы](./renderer-angular/arrays-and-parts.md)      | узел массива, `FieldArray` кита, свой компонент списка, повторяемые части схемы  |
| [Управление узлами](./renderer-angular/node-control.md)           | правила узлов, управление снаружи, свои контейнеры и компоненты с детьми-данными |

## Главное в пакете

| Экспорт                                                     | Зачем                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `FormRenderer`                                              | `<reformer-form>`: входы `form`, `settings`, `messages`     |
| `ownFormBundle`, `FormBundleLike`                           | сборка, которой владеет компонент                           |
| `injectFormBundle`, `FORM_BUNDLE`                           | сборка, внутри которой отрисован компонент                  |
| `ReformerNode`, `ReformerArrayItem`                         | директивы: узел схемы и строка массива в шаблоне компонента |
| `VALUE_CHANGE_ADAPTER`                                      | адаптер по умолчанию: вход `value` и выход `valueChange`    |
| `fromCoreSignal`                                            | сигнал ядра как сигнал Angular                              |
| `formControlSignals`, `FormControlSignals`                  | состояние поля сигналами Angular                            |
| `fieldError`, `injectIssueMessage`                          | текст показанного замечания, резолвер текста по коду        |
| `formFlowSignals`, `FormFlowSignals`                        | состояние потока шагов                                      |
| `provideReformerI18n`, `REFORMER_I18N`                      | локаль приложения или поддерева                             |
| `provideIssueMessages`, `ISSUE_MESSAGES`                    | словарь формы: тексты замечаний по коду                     |
| `RendererSettings`, `FieldWrapperInputs`                    | настройки рендерера, входы обёртки поля                     |
| `ArrayComponentInputs`, `ArrayItemSlot`, `ArrayItemContent` | входы компонента массива и строка массива                   |
| `SelfManagedInputs`                                         | входы компонента, который ведёт детей сам                   |

Полный список — в README пакета.

## Чего нет в этой версии

- **Неуправляемой привязки поля.** Ключ `uncontrolled` адаптера не действует: значение всегда
  приходит входом.
- **Низкоуровневого пути `render` + `createRenderSchema`.** У `<reformer-form>` нет входа `render`
  — передавайте сборку `createForm`.
- **Реактивной смены локали.** Локаль читается при создании компонента.
- **Границы ошибок вокруг компонентов реестра.**
- **Условной проекции содержимого.** Компонент, у которого `<ng-content />` стоит под `@if`, детей
  своего узла не получает.

## Подводные камни

- **`FormRenderer: в сборке нет дерева`** — у сборки не задана `schema`. Без схемы форму рисуют
  сами, по нодам `bundle.form`.
- **Поле отрисовано как пустое место**, а в консоли `No form node for signal` — дерево рисуется не
  той сборкой или поле привязано к сигналу другой модели. Берите `model.$.<поле>` из аргумента
  функции-схемы.
- **Сборку создавайте через `ownFormBundle`.** `createForm` прямо в поле класса не запустит живую
  проверку и не снимет сборку вместе с компонентом: поведение и подписки нод переживут его.
- **`ownFormBundle` вне контекста внедрения** — ошибка Angular про `inject()`. Вызывайте его в
  инициализаторе поля или в конструкторе.
- **Начальные значения приходят асинхронно** — сборка создаётся один раз и с ними. Рисуйте
  компонент формы под `@if` после загрузки, как страницы `angular-playground`:
  `@if (initial()) { <app-registration-form /> }`.
- **Форма пересоздаётся при каждой смене входа.** Держите `settings` и `messages` в полях класса,
  а не собирайте новый объект на каждую перерисовку: компоненты формы потеряют фокус и своё
  состояние.
- **`children` контейнера — на самом узле**, а не в `componentProps`.

## См. также

- [Рендереры](/docs/packages/renderers) — обзор и сравнение рендереров.
- [@reformer/renderer-react](./renderer-react.md) — рендерер на React.
- [@reformer/renderer-vue](./renderer-vue.md) — рендерер на Vue.
- [@reformer/renderer-json](./renderer-json.mdx) — та же форма из JSON-документа.
- [Схема формы](/docs/core-concepts/schemas/form-schema) — виды узлов и `selector`.
- [Обзор поведения](/docs/behaviors/overview) — где пишутся правила узлов.
