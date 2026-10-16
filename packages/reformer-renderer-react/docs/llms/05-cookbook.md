# Cookbook

Продвинутые рецепты для `@reformer/renderer-react`. Каждый рецепт — конкретный сценарий, описанный без воды: проблема, решение, ограничения.

## Custom fieldWrapper

**Problem.** Нужна собственная обёртка вокруг каждого поля (label, error, hint, аналитика, нестандартный layout) вместо стандартного `FormField` из `@reformer/ui-kit`.

**Solution.** `RenderSchema` использует `fieldWrapper` через `settings`. Кастомный wrapper получает `control` (FormControl), `children` (отрендеренный input), `className`, `testId` — и сам строит обвязку с помощью compound-API из `@reformer/cdk/form-field`.

```tsx
import { FormField as CdkFormField } from '@reformer/cdk/form-field';
import { FormRenderer, type FieldWrapperProps } from '@reformer/renderer-react';

function MyFieldWrapper({ control, className, children, testId }: FieldWrapperProps) {
  // Hint можно тащить из componentProps через useFormFieldContext.
  return (
    <CdkFormField.Root control={control}>
      <div className={className} data-testid={`field-${testId ?? 'unknown'}`}>
        <CdkFormField.Label className="text-xs uppercase text-slate-500" />
        <div className="rounded border bg-white p-2">
          {children ? (
            <CdkFormField.Control asChild>{children}</CdkFormField.Control>
          ) : (
            <CdkFormField.Control />
          )}
        </div>
        {/* Текст первого замечания — по коду из словаря формы / локали (ValidationMessagesProvider). */}
        <CdkFormField.Error className="text-red-600 text-sm" />
      </div>
    </CdkFormField.Root>
  );
}

<FormRenderer form={bundle} settings={{ fieldWrapper: MyFieldWrapper }} />;
```

**Notes.**

- Замечание поля (`ValidationIssue`) текста не несёт — только `code` и `params`. Строку даёт резолвер: `FormField.Error` берёт её сам, а свой рендер замечаний — через `useIssueMessageResolver()` из `@reformer/cdk` и `issues` из `useFormControl(control)`.
- Wrapper вызывается на каждое поле (`ModelFieldRenderNode`). Если поле — Checkbox, обычно label рендерится внутри input (см. ветку `isCheckbox` в `@reformer/ui-kit/FormField`); своему wrapper'у проверку нужно добавить вручную, иначе будет двойной label.
- Для конкретного поля можно перекрыть глобальный wrapper через `componentProps.fieldWrapper` (поле типа `ComponentType<FieldWrapperProps>` в `ModelFieldRenderNode.componentProps`).
- Не оборачивай wrapper в `React.memo` без сравнения по `control` и `children` — иначе DOM будет «застревать» на старом инпуте.

## Programmatic node manipulation

**Problem.** Нужно динамически прятать/показывать секцию или менять props ноды снаружи schema (например, по событию из `useEffect`, по кнопке debug-панели, или после загрузки данных).

**Solution.** Бандл `createForm` даёт API `bundle.render.node(selector)` (узлы корневой области) с методами `setHidden`, `resetHidden`, `patchProps`, `resetProps`. Это императивные мутации, реактивные через сигналы — перерисовывается только затронутая нода.

```tsx
import { useEffect } from 'react';
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField, Section, InputNumber } from '@reformer/ui-kit';

const creditSchema = (model: FormModel<CreditForm>) => ({
  selector: 'mortgage-section',
  component: Section,
  children: [{ model: model.$.propertyValue, component: InputNumber }],
});

function CreditApplicationPage() {
  const bundle = useFormBundle(() =>
    createForm<CreditForm>({ model: createCreditModel(), schema: creditSchema })
  );

  useEffect(() => {
    const section = bundle.render.node('mortgage-section');
    // Скрыть секцию по внешнему сигналу.
    section.setHidden(true);
    // Точечно обновить пропс (мерджится с предыдущими patchProps).
    section.patchProps({ title: 'Недвижимость (скрыта)' });
    return () => {
      section.resetHidden();
      section.resetProps();
    };
  }, [bundle]);

  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}
```

**Notes.**

- Методы `setHidden/patchProps/resetHidden/resetProps` чейнятся (`return this`).
- `patchProps` именно мерджит — повторный вызов с `{ disabled: true }` не сбросит ранее заданный `title`. Для полной очистки используй `resetProps`.
- `setHidden(true)` перекрывает реактивное условие из `hideWhen`. Чтобы вернуть автоматику — `resetHidden()`.
- Селектор должен быть указан в `selector` узла. Без него `node('x')` вернёт контроллер с пустыми переопределениями (никаких ошибок не будет, но эффекта тоже не будет).
- `bundle.render.node` адресует корневую область. Узлы строк массивов и подформ управляются из их поведения (`applyEach` / `apply`).
- Низкоуровневый путь без бандла — тот же API у `createRenderSchema(fn)`: `proxy.node(selector)` и `<FormRenderer render={proxy} />`.

## Custom container with collapsible children

**Problem.** Нужен контейнер с собственной логикой рендеринга `children` (например, `Section` с заголовком, который можно свернуть, или wizard с табами).

**Solution.** Обычный React-компонент, принимающий `children: ReactNode`. Реестр child-узлов уже отрендерен `FormRenderer` к моменту, когда твой контейнер получит `children` — внутри их можно свободно оборачивать, фильтровать, группировать.

```tsx
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ContainerComponentProps } from '@reformer/renderer-react';

interface CollapsibleSectionProps extends ContainerComponentProps {
  title: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={className}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full gap-2">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <h3 className="font-semibold">{title}</h3>
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </section>
  );
}

// В схеме (children — top-level; листья на ручках модели):
{
  selector: 'extras',
  component: CollapsibleSection,
  componentProps: { title: 'Дополнительно', defaultOpen: false },
  children: [
    { model: model.$.notes, component: Textarea },
    { model: model.$.tags, component: Input },
  ],
}
```

**Notes.**

- `children` всегда `ReactNode` — обходить как массив узлов нельзя: к этому моменту они уже превращены в React-элементы.
- Если контейнеру нужны узлы как данные (вычислить количество, отрисовать таб-бар, показать один активный) — объяви у компонента статику `__selfManagedChildren = true`. Тогда рендерер передаёт ему `children` узлами скомпилированной схемы (`CompiledNode`: `selector`, `props`, `children`) и проп `renderNode` — функцию отрисовки узла; импортировать рендерер компоненту не нужно. Так устроен `FormWizard` из `@reformer/ui-kit`. Пример — [08-form-bundle.md](08-form-bundle.md).
- Контейнер можно адресовать через `selector` — тогда `setHidden` будет работать на его содержимое целиком.

## Combining behaviors on one node

**Problem.** На одном узле нужно сразу несколько эффектов: скрытие по условию, реактивный side-effect, обработчик события компонента, lifecycle-хук — без дублирования selector-кода.

**Solution.** Собрать ссылку на узел один раз и вызвать операторы по очереди в поведении формы. `apply([...])` для операторов узлов нет — каждый оператор принимает контроллер узла и записывает своё правило в хранилище области.

```tsx
import {
  defineFormBehavior,
  hideWhen,
  renderEffect,
  onComponentEvent,
  onMount,
} from '@reformer/core/behaviors';

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, schema, flow }) => {
  const wizard = schema.node('wizard');
  const mortgage = schema.node('mortgage-section');

  // 1. Реактивное условие — пересчитывается при изменении значений модели.
  hideWhen(mortgage, () => model.loanType !== 'mortgage');

  // 2. Реактивный эффект на области схемы — Preact effect() с автодиспозом. Навигация визарда —
  //    методами потока шагов (id шага = selector его узла), а не через ref компонента.
  renderEffect(schema, () => {
    if (model.loanType === 'mortgage') flow?.goTo('loan');
  });

  // 3. Подписка на проп-событие компонента (получает родные args). Кнопка отправки визарда зовёт
  //    обработчик через `bundle.submission.submit`: только после успешной проверки всей формы.
  onComponentEvent(wizard, 'onSubmit', async (values: CreditForm) => {
    await submitCreditApplication(values);
  });

  // 4. Lifecycle: onMount может вернуть cleanup.
  onMount(wizard, () => {
    console.log('wizard mounted');
    return () => console.log('cleanup');
  });
});
```

**Notes.**

- Повторный `hideWhen` на одном selector затирает предыдущее условие — это последняя запись побеждает.
- `onComponentEvent` мерджит обработчики по имени события (`onSubmit`, `onChange`, ...). Если схема уже содержит такой проп — он будет полностью заменён обработчиком из поведения.
- `renderEffect` принимает не узел, а область схемы: эффекты живут на уровне рендера дерева и автоматически диспозятся при unmount `FormRenderer`.
- `onInit` срабатывает синхронно при применении поведения (до первого рендера). Это единственный хук, способный изменить `componentProps` так, чтобы они попали в первый рендер.

## Вся форма read-only / view-mode

**Problem.** Нужно показать форму целиком в режиме просмотра (все поля задизейблены) — например, экран подтверждения, «read-only копия», или форма, заблокированная до загрузки данных.

**Solution.** Глобального `settings.readonly`/`settings.mode` **нет** — `RendererSettings` несёт `fieldWrapper` и `resolveFieldAdapter` (адаптеры сырых контролов, см. рецепт ниже), режимного флага среди них нет. Канон — вызвать `disable()` на корневой форме сборки (`bundle.form`). `disable()` каскадит `disabled` по всему поддереву (группа проставляет `disabled` себе и рекурсивно всем дочерним полям), а рендерер уже пробрасывает `disabled` ноды в каждый инпут. Ничего в схеме менять не нужно.

```tsx
const bundle = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditSchema,
    // Вся форма в режиме просмотра — один вызов после сборки, каскадит по всем полям.
    setup: (built) => built.form.disable(),
  })
);

// Вернуть редактируемость (например, по кнопке «Редактировать»):
// bundle.form.enable();

<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
```

Для условного дизейбла на монтировании то же самое можно сделать из поведения формы — `form.disable()` в `defineFormBehavior(({ form }) => …)` либо в `onInit` узла (срабатывает синхронно до первого рендера) — тогда поля отрендерятся уже задизейбленными.

**Notes.**

- `disable()`/`enable()` — на группе (корне и любой вложенной группе), каскад рекурсивный: дизейбл секции задизейблит только её поля.
- **`componentProps.disabled` каскад НЕ перебивает — он вообще не работает.** Рендерер листа ставит `disabled` из состояния ноды ПОСЛЕ пропсов схемы ([render-node.tsx](../../src/core/render-node.tsx), `ModelFieldRenderer`; так же устроен `FormField.Control` в [FormFieldControl.tsx](../../../reformer-cdk/src/components/form-field/FormFieldControl.tsx)), поэтому значение из схемы затирается, а не побеждает. Props-схемы field-компонентов его и не объявляют (`disabled` — seam-проп, см. [seam.props.ts](../../../reformer-ui-kit/src/fields/seam.props.ts)). Единственный рычаг — состояние ноды: `control.disable()` / `control.enable()` (или `disabled: true` в узле поля — нода создаётся отключённой), в том числе точечно на одном поле из поведения.
- Это ортогонально `hideWhen`: `disable()` оставляет поля видимыми, но неактивными; `hideWhen` убирает их из дерева.

## Презентационные блоки и живая сводка без своих компонентов

**Problem.** В форме нужны заголовки, инфо-плашка, разделитель и блок «Итого», где значения пересчитываются на лету. Заводить под каждый такой блок React-компонент (и, в JSON-варианте, регистрировать его) — много кода ради вёрстки.

**Solution.** `component` контейнера принимает нативный тег строкой, а `children` — не только узлы, но и текстовые части: литералы и сигналы. Вычисляемое значение подаётся обычным `computed` из `@reformer/core/signals`.

```tsx
import type { FormModel } from '@reformer/core';
import { computed } from '@reformer/core/signals';
import type { RenderNode } from '@reformer/renderer-react';
import { InputNumber } from '@reformer/ui-kit';

const installmentSchema = (model: FormModel<Installment>): RenderNode<Installment> => {
  const monthly = computed(() => Math.round((model.amount ?? 0) / (model.months || 1)));
  return {
    component: 'div',
    componentProps: { className: 'space-y-6' },
    children: [
      { component: 'h2', componentProps: { className: 'text-xl font-bold' }, children: ['Рассрочка'] },

      // текст и узлы в одном children → inline-разметка без лишних обёрток
      {
        component: 'div',
        componentProps: { className: 'p-4 bg-blue-50 border border-blue-200 rounded-md' },
        children: [
          {
            component: 'p',
            componentProps: { className: 'text-sm text-blue-800' },
            children: [
              'Проценты не начисляются. ',
              { component: 'b', children: ['Досрочное погашение бесплатно.'] },
            ],
          },
        ],
      },

      { model: model.$.amount, component: InputNumber, componentProps: { label: 'Сумма (₽)' } },
      { component: 'hr' },

      // Живая сводка: сигналы среди детей подписываются точечно
      {
        component: 'dl',
        componentProps: { className: 'grid grid-cols-2 gap-2 text-sm' },
        children: [
          { component: 'dt', children: ['Платёж в месяц'] },
          { component: 'dd', componentProps: { className: 'font-medium' }, children: [monthly, ' ₽'] },
        ],
      },
    ],
  };
};
```

**Notes.**

- Перерисовывается только сам текст — подписка идёт на сигналы текстовых детей, а не на поддерево узла.
- Тег и компонент свободно вкладываются друг в друга: `{ component: 'div', children: [{ component: Section, … }] }` и наоборот.
- `hideWhen`/`patchProps` работают по `selector` и на html-узлах; в DOM `selector` не пробрасывается.
- Живой пример обеих схем (типизованной и JSON) — `projects/react-playground/src/pages/demo/html-nodes/`.

## Сырой контрол сторонней UI-kit (FieldAdapter)

**Problem.** Нужно подключить контрол чужой библиотеки (antd `Checkbox`, MUI `Select`, свой `Radio`) напрямую, без обёртки. Но рендерер отдаёт полю value-based seam — `value` + `onChange(value)`, — а сырой контрол говорит на своём диалекте: `Checkbox` эмитит DOM-событие (`onChange(e) => e.target.checked`), `Select` — `onChange(value, option)`, `Radio` — `onChange(e) => e.target.value`. Статики `reformerAdapter` (как у компонентов `@reformer/ui-kit`) у чужого контрола нет, поэтому зарегистрированный как есть, он запишет в модель объект события вместо значения.

**Solution.** `settings.resolveFieldAdapter(component)` возвращает `FieldAdapter` для нужного компонента — рендерер сам переложит seam на его диалект. Резолв приоритетнее статики компонента; если компонент свой (можно повесить статику), проще `defineFieldControl(MyControl, { adapter })` из `@reformer/ui-kit/fields` — тот же адаптер поймёт и `FormField.Control` из `@reformer/cdk`. Адаптер описывает, из какого пропа контрол читает значение (`valueProp`, default `'value'`), каким колбэком эмитит (`changeProp`, default `'onChange'`), как из эмита достать значение (`fromEmit(arg, rest)`) и как значение поля привести к пропу (`toValue`). `control` в контрол по умолчанию **не** пробрасывается (opt-in — `passControl` / `reformerNeedsControl`); `disabled` — всегда. Нет ни резолва, ни статики → seam применяется как есть (для value-based контролов регистрировать ничего не нужно).

```tsx
import { Checkbox, Select, Radio } from 'some-ui-kit';
import { FormRenderer, type FieldAdapter } from '@reformer/renderer-react';

// Резолв по идентичности компонента (node.component).
const adapters = new Map<unknown, FieldAdapter>([
  // checked + DOM-событие: значение живёт в `checked`, эмит — событие.
  [Checkbox, { valueProp: 'checked', fromEmit: (e) => (e as any).target.checked, toValue: (v) => v ?? false }],
  // value + событие: достаём из target.
  [Radio, { fromEmit: (e) => (e as any).target.value }],
]);

<FormRenderer
  form={bundle}
  settings={{ resolveFieldAdapter: (component) => adapters.get(component) }}
/>;
```

**Notes.**

- Резолв идёт по `node.component` (по ссылке на компонент), поэтому `Map`/`switch` по идентичности — типичная реализация. Вернул `undefined` → статика компонента `reformerAdapter`, а без неё — value-based seam как есть.
- `fromEmit` получает `(arg, rest)`, где `arg` — ПЕРВЫЙ аргумент эмита контрола, `rest` — остальные props (после `strip`). Обработчик берёт только первый аргумент, поэтому лишние (`option` у `Select`) отбрасываются сами. `rest` нужен, когда значение достаётся с оглядкой на props (например, найти выбранное в `options`).
- `toValue` — обратный путь: coerce `null`/`undefined` под контракт контрола (`Checkbox` не любит `undefined` в `checked`).
- `componentProps` (после `strip`) спредятся ПЕРВЫМИ — seam (`value`/`onChange`/`onBlur`) перекрывает их при совпадении ключей. `strip` убирает служебные ключи, на которые контрол ругается неизвестным пропом. Blur по умолчанию идёт как `onBlur`; нестандартный канал — через `bindBlur(onBlur) => props`.
- `data-testid="input-{testId}"` проставляется автоматически, если его нет в props (testId — из `componentProps.testId` или пути сигнала).
- `FieldAdapter` — один тип на всех (`@reformer/core/react`, реэкспорт в `@reformer/renderer-react` и `@reformer/ui-kit/fields`): его же кладут в статику `reformerAdapter` через `defineFieldControl`, все поля опциональны. Пресеты кита (`checkedAdapter`, `valueChangeAdapter`, `nativeInputAdapter`, …) из `@reformer/ui-kit/fields` годятся и для `resolveFieldAdapter`.
- То же работает в `@reformer/renderer-json` без изменений кода: документ формата 2 рисует тот же `FormRenderer`, и `resolveFieldAdapter` применяется к контролам, зарегистрированным в реестре по имени (см. [renderer-json/05-cookbook.md](../../../reformer-renderer-json/docs/llms/05-cookbook.md)).

## See also

- [02-render-schema.md](02-render-schema.md) — узлы схемы.
- [03-render-behavior.md](03-render-behavior.md) — справочник по операторам узлов.
- [04-troubleshooting.md](04-troubleshooting.md) — типичные ошибки.
