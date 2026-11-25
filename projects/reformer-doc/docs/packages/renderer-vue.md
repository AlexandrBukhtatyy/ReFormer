---
id: renderer-vue
title: '@reformer/renderer-vue'
sidebar_label: 'renderer-vue'
---

# @reformer/renderer-vue

:::caution Экспериментальный пакет
`@reformer/renderer-vue` в npm не опубликован: пакет `private`, версия `0.0.0`, подключается только
внутри монорепозитория ReFormer. API может меняться.
:::

`@reformer/renderer-vue` рисует форму во Vue 3 по её [схеме формы](/docs/reference/glossary) — тому
же скомпилированному дереву узлов, которое рисует [@reformer/renderer-react](./renderer-react.md).
Разметку полей писать не нужно: рендерер обходит дерево и сам связывает каждый компонент с нодой
поля — значением, замечаниями и доступностью.

## Когда нужен

- Приложение на Vue 3, а форма описана схемой ReFormer: модель, правила, поведение и поток шагов
  пишутся так же, как для React.
- Одна форма рисуется в нескольких стеках. JSON-документ, правила и API общие, а реестр кита и
  рендерер у каждого стека свои — так устроены страницы кросс-проверки `vue-playground`.
- Разметкой нужно управлять из поведения формы: `hideWhen`, `onComponentEvent`, `patchProps`.

**Когда не нужен.** Приложение на React — берите [@reformer/renderer-react](./renderer-react.md).
Форма уходит в прод вне монорепозитория — пакет пока не опубликован.

## Установка

Пакет не опубликован в npm. Внутри монорепозитория его подключают зависимостью workspace — так
сделано в `projects/vue-playground`:

```json
{
  "dependencies": {
    "@reformer/core": "*",
    "@reformer/renderer-vue": "*",
    "vue": "^3.5.13"
  }
}
```

Пиры: `@reformer/core` и `vue` 3.5+. Вход один — `@reformer/renderer-vue`. Компоненты полей
приходят из приложения: свои тонкие адаптеры над библиотекой компонентов или кит
[@reformer/kit-vuetify](#кит-kit-vuetify).

## Минимальный пример

```ts
import { defineComponent, h } from 'vue';
import { createForm, type FormModel } from '@reformer/core';
import { FormRenderer, useFormBundle } from '@reformer/renderer-vue';
import { TextInput } from './kit';

type SignUp = { email: string };

const schema = (model: FormModel<SignUp>) => ({
  component: 'form',
  children: [{ model: model.$.email, component: TextInput, componentProps: { label: 'Email' } }],
});

export const SignUpForm = defineComponent({
  setup() {
    // Сборка — одна на компонент: живая проверка стартует на монтировании, снятие — вместе с ним.
    const bundle = useFormBundle(() => createForm<SignUp>({ initial: { email: '' }, schema }));
    return () => h(FormRenderer, { form: bundle });
  },
});
```

`TextInput` — обычный компонент Vue с `v-model`:

```ts
import { defineComponent, h } from 'vue';

export const TextInput = defineComponent({
  name: 'TextInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs, // `data-testid` от рендерера
        value: props.modelValue,
        disabled: props.disabled,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
        onBlur: () => emit('blur'),
      });
  },
});
```

Что здесь происходит:

1. Схема — функция `(model) => узел`. [Сборка формы](/docs/reference/glossary) (`createForm`)
   вызывает её один раз и компилирует дерево.
2. `useFormBundle` вызывает фабрику один раз в `setup` и владеет сборкой: на `onMounted` запускает
   живую проверку, при снятии компонента останавливает её и зовёт `bundle.dispose()`.
3. `FormRenderer` получает сборку пропом `form`. Значение поля идёт в `modelValue`, ввод — событием
   `update:modelValue`, потеря фокуса — событием `blur`.
4. Обёртки поля здесь нет: контрол стоит в `div`, а `label` из `componentProps` никто не рисует.
   Подпись и замечания рисует обёртка поля или сам контрол — см. [Поля](./renderer-vue/fields.md).

Правила проверки в узлы не пишутся: они уходят в сборку полем `validation`. См.
[Обзор валидации](/docs/validation/overview).

## Форма из JSON-документа

Документ формы собирает вход `@reformer/renderer-json/neutral` — тот же документ, что рисует React,
без привязки к слою представления:

```ts
import { defineComponent, h } from 'vue';
import { createForm } from '@reformer/core';
import { defineRegistry } from '@reformer/renderer-json/neutral';
import { FormRenderer, useFormBundle } from '@reformer/renderer-vue';

const registry = defineRegistry((reg) => reg.component('TextInput', TextInput));

export const JsonForm = defineComponent({
  setup() {
    const bundle = useFormBundle(() => createForm({ schema: document, registry, initial }));
    return () => h(FormRenderer, { form: bundle });
  },
});
```

- Документ ссылается на компоненты по имени (`$component(TextInput)`). Реестр Vue регистрирует под
  этими именами компоненты Vue, поэтому один документ рисуется любым стеком.
- **Обёртка поля** — запись `FIELD_WRAPPER` реестра (константа есть в `/neutral`). Сборка отдаёт её
  рендереру; `settings.fieldWrapper` у `FormRenderer` главнее неё.
- **Граница ошибок** по умолчанию не подставляется: её передают параметром —
  `defineRegistry(fn, { errorBoundary })`. `FormRenderer` оборачивает ей всю форму.
- В `/neutral` нет React-частей основного входа: панели ошибок схемы, `LocaleProvider`, `I18n`.

Формат документа, операторы и реестр — в разделе [@reformer/renderer-json](./renderer-json.mdx).

## Кит kit-vuetify

`@reformer/kit-vuetify` — компоненты на Vuetify 4 под именами каталога китов: `Box`, `Card`,
`Checkbox`, `DatePicker`, `FieldArray`, `FormWizard`, `Input`, `InputMask`, `InputNumber`,
`InputPassword`, `RadioGroup`, `Section`, `Select`, `Step`, `Switch`, `Textarea`. Имена совпадают с
каталогом `@reformer/ui-kit`, поэтому один JSON-документ рисуется любым из двух китов. Кит тоже
экспериментальный: `private`, в npm не опубликован. Пиры — `@reformer/core`,
`@reformer/renderer-vue`, `vue` 3.5+ и `vuetify` 4.3+.

Vuetify подключается китом один раз, вместе со стилями:

```ts
import { createApp } from 'vue';
import 'vuetify/styles';
import '@reformer/kit-vuetify/styles.css';
import { createKitVuetify } from '@reformer/kit-vuetify';

createApp(App).use(createKitVuetify()).mount('#app');
```

`createKitVuetify({ animations: false })` выключает анимации Vuetify: рябь на кнопках и переход
панели списка. Это нужно тестам и автоматизации — закрытой панели нет в DOM сразу.

Компоненты регистрируются в реестре `defineRegistry` из `@reformer/renderer-json/neutral`:

```ts
import { defineRegistry } from '@reformer/renderer-json/neutral';
import { FormWizard, Input, Section, Select, Step } from '@reformer/kit-vuetify';

export const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Select', Select);
  reg.component('Section', Section);
  reg.component('FormWizard', FormWizard);
  reg.component('Step', Step);
});
```

- **Обёртки поля у кита нет.** Каждый контрол — готовое поле: подпись и текст ошибки рисует сам
  компонент Vuetify. Запись `FIELD_WRAPPER` и `settings.fieldWrapper` не нужны.
- **Роли DOM — как у `@reformer/ui-kit`:** `field-`, `label-`, `input-` и `error-{testId}`. Пока
  ошибки нет, элемента `error-` в разметке нет.
- **Страница — внутри `VApp`.** Так монтируют форму плейграунд и тесты кита:

```ts
import { VApp } from 'vuetify/components/VApp';

const Page = defineComponent({
  setup() {
    const bundle = useFormBundle(() => createForm({ schema: document, registry, initial }));
    return () => h(VApp, null, { default: () => h(FormRenderer, { form: bundle }) });
  },
});
```

Живой пример — `projects/vue-playground/src/cross/`: форма регистрации и кредитная заявка на ките
Vuetify с документом и правилами, общими с React- и Angular-страницами.

## Реактивность

Состояние формы живёт в сигналах `@reformer/core`. Vue о них не знает: сигнал, прочитанный в
рендер-функции, компонент на перерисовку не подписывает. Мост — хуки пакета, они кладут значение в
`shallowRef`:

| Хук                       | Что даёт                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| `useSignalValue(read)`    | результат `read` как `shallowRef`; пересчёт при смене прочитанных сигналов |
| `useFormControl(control)` | состояние ноды поля ссылками: `value`, `disabled`, `touched`, `issues`, …  |
| `useFieldError(control)`  | текст замечания, которое поле показывает сейчас, или `undefined`           |
| `useFormFlow(flow)`       | поток шагов ссылками: `current`, `index`, `isFirst`, `isLast`, …           |

Полный список ключей — в типах `FormControlRefs` (ещё `pending`, `shouldShowError`,
`shouldShowIssues`, `path`, `componentProps`) и `FormFlowRefs` (ещё `activeSteps`, `completed`,
`validating`).

```ts
import { defineComponent, h } from 'vue';
import { useFormBundleContext, useFormFlow } from '@reformer/renderer-vue';

// Свой компонент внутри FormRenderer: поток шагов — из контекста сборки.
export const NextStep = defineComponent({
  setup() {
    const flow = useFormBundleContext()!.flow!;
    const { current, isLast } = useFormFlow(flow);
    return () =>
      h('button', { disabled: isLast.value, onClick: () => void flow.next() }, current.value);
  },
});
```

Значение одной ноды без `useFormControl` — прямо мостом:
`const value = useSignalValue(() => props.control.value.value)`.

- Хуки вызываются в `setup`: подписки живут в его области и снимаются вместе с компонентом.
- `useFormControl` и `useFormFlow` подписываются лениво — при первом чтении ключа. Компонент,
  который не читает `pending`, на асинхронную проверку не перерисовывается.
- **Сборка и ноды помечены `markRaw`.** Ядро сопоставляет ноды и ручки модели по ссылке, а прокси
  Vue вместо ноды молча отвязал бы поле от формы. Не оборачивайте их в `reactive()` сами.

## Что делает рендерер

- Рисует узел по его виду: поле, массив под-форм, подформа, контейнер, текст. Виды узлов описаны
  на странице [Схема формы](/docs/core-concepts/schemas/form-schema).
- Связывает поле с нодой: контрол получает `modelValue`, `disabled` и `data-testid`, а рендерер
  слушает его события `update:modelValue` и `blur`. Обёртка поля получает саму ноду (`control`).
- Исполняет правила узлов из поведения формы — `hideWhen`, `onComponentEvent`, `renderEffect`,
  `onMount`, `onUnmount` — и управление узлом снаружи: `setHidden`, `patchProps`, `getRef`.
- Ставит контекст сборки: свой компонент читает его через `useFormBundleContext()` — форму, поток
  шагов и отправку (`bundle.submission.submit(handler)`).
- Даёт строкам массивов и подформам свои области схемы.

## Разделы

| Страница                                                      | О чём                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Поля: обёртка и адаптеры](./renderer-vue/fields.md)          | что получает контрол, своя обёртка, контрол-поле, диалекты чужих компонентов    |
| [Вёрстка: контейнеры, HTML и текст](./renderer-vue/layout.md) | контейнеры со слотом, HTML-теги в схеме, живой текст из сигналов                |
| [Массивы и подформы](./renderer-vue/arrays-and-parts.md)      | узел массива, `FieldArray` кита, свой компонент списка, части схемы             |
| [Управление узлами](./renderer-vue/node-control.md)           | правила узлов, управление снаружи, свои контейнеры и компоненты с детьми-узлами |

## Главное в пакете

| Экспорт                                                   | Зачем                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `FormRenderer`                                            | рисует сборку формы: пропы `form`, `settings`, `messages`            |
| `RenderNode`                                              | компонент одного узла — для ручной композиции; это не тип узла схемы |
| `MODEL_VALUE_ADAPTER`                                     | диалект контрола по умолчанию: `modelValue` + `update:modelValue`    |
| `useFormBundle`, `useFormBundleContext`, `FormBundleLike` | владение сборкой в компоненте и доступ к ней из дерева рендерера     |
| `useFormControl`, `FormControlRefs`, `useFieldError`      | состояние ноды поля и текст замечания ссылками Vue                   |
| `useIssueMessage`, `provideIssueMessages`, `provideI18n`  | тексты замечаний: резолвер, словарь формы, локаль поддерева          |
| `useFormFlow`, `FormFlowRefs`                             | поток шагов ссылками Vue                                             |
| `useSignalValue`                                          | мост сигналов ядра в `shallowRef`                                    |
| `RendererSettings`, `FieldWrapperProps`                   | настройки рендерера, пропы обёртки поля                              |
| `ArrayComponentProps`, `ArrayItemSlot`                    | пропы компонента, который рисует массив                              |
| `RenderNodeFn`, `SelfManagedProps`                        | пропы компонента, который рисует детей-узлы сам                      |

Тип узла схемы — `FormSchemaNode` из `@reformer/core`: своих типов узлов с компонентами Vue у пакета
нет. Адаптер контрола — тип `FieldAdapter` из `@reformer/core/render`.

## Чего нет в этой версии

- **Неуправляемой привязки поля.** Ключ `uncontrolled` адаптера не действует: это оптимизация
  перерисовок React, во Vue значение всегда приходит пропом.
- **Низкоуровневого пути `render` + `createRenderSchema`.** `FormRenderer` принимает только сборку
  `createForm`.
- **Смены локали на лету.** Локаль и словарь замечаний читаются при создании компонента.

## Подводные камни

- **`FormRenderer: в сборке нет дерева`** — у `createForm` не задана `schema`. Без схемы рисовать
  нечего.
- **Подменили сборку в пропе `form`, а на экране старая форма.** Сборка читается один раз при
  создании `FormRenderer`. Другой сборке нужен другой `key`.
- **Компонент не перерисовывается при вводе** — он читает сигнал прямо в рендер-функции. Читайте
  через `useSignalValue`, `useFormControl` или `useFormFlow`.
- **Поле отрисовано как пустое место**, а в консоли `No form node for signal` — дерево рисуется не
  той сборкой или поле привязано к сигналу другой модели. Берите `model.$.<поле>` из аргумента
  функции-схемы.
- **Поля без подписи и ошибок** — нет ни обёртки поля, ни контрола, который рисует поле сам.
- **Служебные пропсы оказались атрибутами в DOM.** Необъявленный проп Vue отдаёт атрибутом корню
  компонента. Объявляйте то, что компонент принимает: `modelValue`, `control`, `items`, `children`,
  `renderNode`.

## См. также

- [Рендереры](/docs/packages/renderers) — обзор рендереров ReFormer.
- [@reformer/renderer-react](./renderer-react.md) — рендерер для React.
- [@reformer/renderer-angular](./renderer-angular.md) — рендерер для Angular.
- [@reformer/renderer-json](./renderer-json.mdx) — та же форма из JSON-документа.
- [Схема формы](/docs/core-concepts/schemas/form-schema) — виды узлов и `selector`.
- [Обзор поведения](/docs/behaviors/overview) — где пишутся правила узлов.
