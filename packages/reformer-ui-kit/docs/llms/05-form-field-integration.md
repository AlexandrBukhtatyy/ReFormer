# FormField integration

`FormField` из `@reformer/ui-kit` — это готовая обёртка-«склейка» поверх
headless-компонента `FormField` из [`@reformer/cdk`](../../../reformer-cdk/).
Она автоматически рендерит `Label` → `Control` → `Error`, читает `pending`-флаг
для async-валидаций и подставляет `data-testid` для e2e.

В отличие от headless-`FormField` из CDK (нужно вручную собирать `Root` /
`Label` / `Control` / `Error`), ui-kit-вариант — однострочный:

```tsx
<FormField control={form.email} testId="email" />
```

Под капотом — разметка shadcn `Field` (упрощённо, без рядов для иконки подсказки):

```tsx
<CdkFormField.Root control={control}>
  {/* Field: flex w-full flex-col gap-3; direction="row" — подпись слева от контрола */}
  <Field className={className} data-testid={`field-${testId}`}>
    {!inlineLabel && <CdkFormField.Label data-slot="field-label" data-testid={`label-${testId}`} />}
    {/* FieldContent: flex flex-1 flex-col gap-1.5 */}
    <FieldContent>
      <CdkFormField.Control data-testid={`input-${testId}`} />
      {description && <CdkFormField.Description data-slot="field-description" />}
      <CdkFormField.Error data-slot="field-error" data-testid={`error-${testId}`} />
      {pending && <span role="status">{t('kit.formField.validating')}</span>}
    </FieldContent>
  </Field>
</CdkFormField.Root>
```

Подпись у чекбокса и переключателя (`inlineLabel`) рисует сам контрол. Текст ожидания async-проверки —
из словаря кита (`kit.formField.validating`: «Validating...», в русской локали «Проверка...»).

`Control` сам инстанцирует `control.component` (`Input`, `SelectAsync`,
`CheckboxWithLabel`...) и связывает его с `FormControl`: значение, `onChange`, `onBlur`,
`disabled` и `aria-*` — в диалекте контрола. Диалект берётся из статики компонента
`reformerAdapter` (`defineFieldControl` из `@reformer/ui-kit/fields`): `Input` получает
`value` + `onChange(event)`, `CheckboxWithLabel` — `checked` + `onCheckedChange`, value-based
контрол без статики — seam как есть. Отдельных «field-версий» компонентов нет — в `component`
поля кладётся сам компонент. Ref, переданный в `Control`, получает императивный handle
контрола или базовый `FieldHandle`, построенный из его DOM-узла.

## API

```typescript
interface FormFieldProps {
  control: FormControl<any>;
  className?: string;
  testId?: string;
  /** Подпись над контролом ('col', по умолчанию) или слева от него ('row') */
  direction?: 'col' | 'row';
  /** Кастомный input — для использования с RenderSchema fieldWrapper */
  children?: React.ReactNode;
}
```

| Prop        | Тип              | Описание                                                                                                                                                     |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `control`   | `FormControl<T>` | Поле формы. Из него берутся `component`, `componentProps`, `value`, `issues` / `shouldShowIssues`, `pending`, `disabled`.                                    |
| `className` | `string`         | Класс корневой `<div>`-обёртки.                                                                                                                              |
| `testId`    | `string`         | Префикс для `data-testid` (`field-<id>`, `label-<id>`, `input-<id>`, `error-<id>`). Если опущен — пытается взять `componentProps.testId`. Иначе `'unknown'`. |
| `direction` | `'col' \| 'row'` | Раскладка подписи и контрола: `'col'` (по умолчанию) — подпись над контролом, `'row'` — слева от него. См. сценарий 5.                                       |
| `children`  | `ReactNode`      | Кастомный контрол: оборачивается в `CdkFormField.Control asChild`. См. сценарий 3.                                                                           |

`FormField` обёрнут в `React.memo` со сравнением по ссылочному равенству
`control` — это критично для производительности больших форм (при ререндере
родителя поле не пересчитывается, пока не сменился сам `FormControl`).

`direction` — проп самого `FormField`, а не `componentProps`: из схемы поля он не читается.

### Props поля, которые читает обёртка (`componentProps`)

Подпись, подсказки и маркер обязательности задаются НЕ пропсами `FormField`, а в
`componentProps` поля — общем мешке для обёртки и контрола:

| `componentProps` | Кто рисует | Описание                                                                                                                              |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `label`          | FormField  | Подпись над полем. У inline-контролов (Checkbox/Switch) её рисует сам контрол справа от себя.                                         |
| `required`       | FormField  | Маркер `*` у подписи + `aria-required`.                                                                                               |
| `description`    | FormField  | Текст под полем.                                                                                                                      |
| `labelTooltip`   | FormField  | Иконка (i) с тултипом ПОСЛЕ подписи. У inline-контролов — справа от контрола.                                                         |
| `tooltip`        | контрол    | Иконка (i) с тултипом В САМОМ контроле: у полей ввода и селектов — внутри справа, у Checkbox/Switch/Radio — после текста.             |
| `testId`         | FormField  | Префикс `data-testid`; иконки получают `label-tooltip-<id>` и `input-<id>-tooltip` (у radio-варианта — `input-<id>-<value>-tooltip`). |

```tsx
{
  model: model.$.email,
  component: Input,
  componentProps: {
    label: 'Email',
    description: 'Не передаём третьим лицам',   // под полем
    labelTooltip: 'Нужен для отправки чеков',     // (i) после подписи
    tooltip: 'Только корпоративный домен',        // (i) внутри инпута
  },
}
```

`labelTooltip` и `tooltip` независимы — можно задать оба. Тултип открывается по наведению, фокусу с
клавиатуры и клику/тапу (работает на тач-устройствах), закрывается по `Escape` и клику вне. Текст
подсказки дублируется в скрытом элементе и попадает в `aria-describedby` контрола — screen reader
зачитывает его при фокусе на поле.

Порядок в правой зоне поля, слева направо: **крестик очистки → (i) → родные элементы контрола**
(шеврон селекта, глаз пароля, скрепка FileUpload). Нет других элементов — иконка у правого края.
У контролов без естественного места внутри (Slider, Calendar, InputOTP, Toggle, ToggleGroup,
NativeSelectMulti, аватар) иконка встаёт справа от контрола. `RadioGroup` дополнительно принимает
подсказку у каждого варианта: `options: [{ value, label, tooltip }]`.

Ограничения: `labelTooltip`, как и `description`, читается один раз при монтировании — смена через
`updateComponentProps` не подхватится. Пустая строка = подсказки нет. Если у Checkbox/Switch заданы
оба пропа, иконок будет две. Свой компонент-обёртку подсказки можно собрать из публичного
`InfoHint`; свои поля получают `tooltip` через `withFieldTooltip` / `useFieldTooltip` из
`@reformer/ui-kit/fields`.

**Выключенное поле (`disabled`).** `FormField` ставит на корень `data-disabled="true"`, и подпись
поля тускнеет вместе с контролом (у RadioGroup — и подписи вариантов). Собственные кнопки контрола гаснут: крестик очистки не рисуется
вовсе, «глаз» пароля и скрепка FileUpload не реагируют ни на клик, ни на наведение. Подсказки —
исключение: обе иконки (i) остаются рабочими, потому что по значению в заблокированном поле пояснение
нужно не меньше, чем в активном.

## Common Patterns

### 1. Standalone

Самый частый сценарий: ручная форма с `FormField`-ами для каждого поля.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { Button, FormField, Input, SelectAsync } from '@reformer/ui-kit';

type RegistrationForm = {
  email: string;
  country: string | null;
};

const registrationRules = defineValidation<RegistrationForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.country, [required()]);
});

const createRegistrationForm = () =>
  createForm<RegistrationForm>({
    initial: { email: '', country: null },
    schema: (model) => ({
      children: [
        {
          model: model.$.email,
          component: Input,
          componentProps: { label: 'Email', placeholder: 'you@example.com', testId: 'email' },
        },
        {
          model: model.$.country,
          component: SelectAsync,
          componentProps: {
            label: 'Страна',
            testId: 'country',
            options: [
              { value: 'ru', label: 'Россия' },
              { value: 'by', label: 'Беларусь' },
            ],
          },
        },
      ],
    }),
    validation: registrationRules,
  });

function RegistrationPage() {
  const registration = useFormBundle(createRegistrationForm);
  const { form } = registration;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await registration.submission.submit((values) => api.register(values));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField control={form.email} testId="email" />
      <FormField control={form.country} testId="country" />
      <Button type="submit">Регистрация</Button>
    </form>
  );
}
```

`Label` берётся из `componentProps.label` через `CdkFormField.Label`. Замечание — ошибка или
предупреждение (`severity: 'warning'`) — появляется под полем, когда оно есть у ноды и поле
`touched` или `dirty` (`shouldShowIssues`): после `bundle.submission.submit(handler)` /
`bundle.validate()` (они помечают поля `touched`) либо при живой проверке —
`validation: { rules, strategy: 'blur' | 'change' | 'afterFirstSubmit' }`. Под полем одно
замечание — главное: первая ошибка, а без ошибок — первое предупреждение. Ошибка красится
токеном `--destructive` и ставит контролу `aria-invalid`; предупреждение — токеном `--warning`
(`text-warning`), поле при этом валидно. Текст замечания — по коду из словаря формы
(`ValidationMessagesProvider messages` из `@reformer/cdk`), локали или встроенного английского.

### 2. Как `fieldWrapper` в `FormRenderer`

В `@reformer/renderer-react` каждый field-узел `RenderSchema` оборачивается в
указанный `fieldWrapper`. `FormField` из ui-kit идеально подходит для этой
роли — он использует тот же контракт `FormControl`, что и сам рендерер.

```tsx
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField, Input, InputNumber, Section } from '@reformer/ui-kit';
import { createCreditApplicationModel } from './model/model';

const applicationSchema = (model: FormModel<CreditApplication>): FormSchemaNode => ({
  component: Section,
  componentProps: { title: 'Заявка', className: 'space-y-4' },
  children: [
    { model: model.$.email, component: Input, componentProps: { testId: 'email' } },
    { model: model.$.phone, component: Input, componentProps: { testId: 'phone' } },
    { model: model.$.amount, component: InputNumber, componentProps: { testId: 'amount' } },
  ],
});

function CreditApplicationPage() {
  const application = useFormBundle(() =>
    createForm<CreditApplication>({
      model: createCreditApplicationModel(),
      schema: applicationSchema,
    })
  );

  // settings.fieldWrapper применяется к каждому field-узлу автоматически.
  return <FormRenderer form={application} settings={{ fieldWrapper: FormField }} />;
}
```

`testId` рендерер выводит из пути модели (`model.$.<path>`, точки → дефисы), а
`componentProps.testId` узла его переопределяет:

```tsx
// узел в разметке строки массива: item: (row) => ({ children: [...] })
{ model: row.$.bank, component: Input, componentProps: { testId: 'existingLoan-bank' } }
// → <FormField control={...} testId="existingLoan-bank" />
// → data-testid="field-existingLoan-bank", "input-existingLoan-bank", ...
```

> `fieldWrapper` отвечает только за обвязку поля (label / error / `testId`). Сам
> контрол (`node.component`) связывает рендерер: seam (`value` + `onChange(value)` +
> `onBlur`) переводится в диалект контрола по его статике `reformerAdapter` — у
> компонентов `@reformer/ui-kit` она уже объявлена. Готовый связанный контрол
> приходит в `FormField` как `children`, и `FormField.Control asChild` второй раз его
> не привязывает. Если в схеме стоят СЫРЫЕ контролы чужого UI-kit без статики
> (checkbox с `checked` + `onChange(event)`, select с `onChange(value, option)` и т.п.),
> в тех же `settings` рядом с `fieldWrapper` задаётся `resolveFieldAdapter` — он
> приоритетнее статики и переводит seam на диалект каждого контрола без обёртки под
> каждый контрол. Детали (`FieldAdapter` / `resolveFieldAdapter`) — в docs
> [`@reformer/renderer-react`](../../../reformer-renderer-react/docs/llms/05-cookbook.md).

### 3. Кастомизация через `children`

Для случаев, когда нужен нестандартный контрол (например, маска, которая не
зарегистрирована в `control.component`, или комбинированный input). `children`
оборачивается в `CdkFormField.Control asChild`, и в кастомный input
прокидываются все нужные props (`value`, `onChange`, `onBlur`, `aria-invalid`) — в диалекте
ребёнка (его `reformerAdapter`, иначе value-based seam). Привязки, которые у ребёнка уже
заданы явно, не перекрываются.

```tsx
import { FormField } from '@reformer/ui-kit';
import { InputMask } from '@reformer/ui-kit/input-mask';

<FormField control={form.phone} testId="phone">
  <InputMask mask="+7 (999) 999-99-99" />
</FormField>;
```

> Важно: кастомный child должен быть единичным React-элементом и принимать
> `value`/`onChange(value)`/`onBlur`/`aria-invalid` — либо объявить свой диалект через
> `defineFieldControl(MyInput, { adapter })` из `@reformer/ui-kit/fields`. Для
> сложных случаев — двух input-ов рядом — используй `CdkFormField.Root` напрямую,
> минуя ui-kit-обёртку.

### 4. Inline-label контролы (Checkbox, Switch)

`CheckboxWithLabel` и `SwitchWithLabel` сами рендерят `label` рядом с собственным контролом.
Если бы `FormField` ставил `Label` сверху, мы получили бы дубль:

```
Условия использования       <-- FormField.Label (нежелательно)
[ ] Условия использования    <-- сам CheckboxWithLabel
```

Поэтому `FormField` не рендерит верхний `Label` для контролов со статическим маркером
`reformerLayout === 'inline-label'`. Сравнение с конкретным компонентом
(`control.component === Checkbox`) снято в v7: маркер работает для любого варианта и
для пользовательских контролов.

> Маркер — неэнфорсимая конвенция. Свой inline-контрол обязан его объявить —
> `defineFieldControl(MyControl, { adapter, layout: 'inline-label' })` из
> `@reformer/ui-kit/fields`, — иначе подпись задвоится молча.

```tsx
import { createForm } from '@reformer/core';
import { CheckboxWithLabel, FormField } from '@reformer/ui-kit';

const { form } = createForm<{ accept: boolean }>({
  initial: { accept: false },
  schema: (model) => ({
    children: [
      {
        model: model.$.accept,
        component: CheckboxWithLabel,
        componentProps: { label: 'Принимаю условия' },
      },
    ],
  }),
});

<FormField control={form.accept} testId="accept" />;
// рендерится только чекбокс с label справа + error снизу.
```

Маркер — статика на компоненте, поэтому если ты оборачиваешь `CheckboxWithLabel` в свой
компонент (HOC, `forwardRef`-обёртка), статики `reformerLayout` и `reformerAdapter` на
обёртке нет — подпись задвоится, а значение не свяжется. Решения:

- Класть в схему сам `CheckboxWithLabel` из `@reformer/ui-kit`.
- Либо объявить статики на обёртке: `defineFieldControl(MyCheckbox, { adapter: checkedAdapter,
  layout: 'inline-label' })`.

### 5. Подпись слева от контрола (`direction="row"`)

По умолчанию (`direction="col"`) подпись стоит над контролом. `direction="row"` ставит её слева:

```tsx
<FormField control={form.email} direction="row" />
```

```
Email   [ you@example.com        ]
        Не передаём третьим лицам      <-- description
        Введите email                  <-- error
```

- В ряд встают только подпись (вместе с иконкой `labelTooltip`) и колонка контрола. Описание,
  ошибка и «Проверка…» остаются ПОД контролом, а не под подписью.
- Подпись выровнена по базовой линии первой строки контрола — стоит на уровне текста в поле при
  любой его высоте (`Input`, `Textarea`, `RadioGroup`).
- Ширина подписи — по содержимому, но не больше половины ряда: длинная подпись переносится,
  контрол занимает остаток.
- У inline-контролов (`CheckboxWithLabel`, `SwitchWithLabel`) верхней подписи нет — для них
  раскладка не меняется.
- Корневой `Field` получает `data-orientation="horizontal"` (в `col` — `"vertical"`).

Подписи разной длины дают «рваный» левый край контролов. Чтобы выровнять их в колонку, задай
подписи фиксированную ширину через `className` — селектор покрывает и голую подпись, и ряд подписи
с иконкой `labelTooltip`, а inline-контролы не задевает:

```tsx
<FormField
  control={form.email}
  direction="row"
  className="[&>[data-slot^=field-label]]:w-40"
/>
```

В `FormRenderer` обёртку поля вызывает рендерер и передаёт ей только `control`, `className`,
`testId` и `children` — поэтому `direction` задаётся своей обёрткой поверх `FormField`:

```tsx
import { FormRenderer, type FieldWrapperProps } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

// Объявляется на уровне модуля: новая ссылка на каждый рендер перемонтировала бы все поля.
const RowField = (props: FieldWrapperProps) => <FormField {...props} direction="row" />;

// Вся форма в ряд (`bundle` — сборка createForm):
<FormRenderer form={bundle} settings={{ fieldWrapper: RowField }} />;

// Либо одно поле — через componentProps.fieldWrapper листа схемы:
{ model: model.$.email, component: Input, componentProps: { label: 'Email', fieldWrapper: RowField } }
```

## Anti-patterns

- Передавать `control` другого типа (`FormGroup`, `FormArray`) — ожидается
  именно `FormControl<T>`. Для массивов — `FieldArraySection` кита или `FieldArray.Root` из CDK; для
  групп — отдельные `FormField` на каждое лиственное поле.
- Динамически менять `control` (`<FormField control={isAdvanced ? form.x : form.y} />`)
  — `React.memo` не пересоздаст внутренний `Root`, но сам `Root` сменит контекст,
  что может привести к лишнему re-mount контрола. Предпочтительно условно
  рендерить два разных `FormField`.
- Перекрывать `componentProps.testId` через атрибут — побеждает явный
  `testId`-prop `FormField`, поэтому смесь даёт неожиданный результат. Выбирай
  один источник.
- Использовать `FormField` для чисто декоративных компонентов (заголовков,
  баннеров) — обёртка ставит `Label` и слот ошибки, что нелогично. Для такого
  рендерь компоненты напрямую (через container-узлы `Box`/`Section`).

## See also

- [02-text-fields.md](02-text-fields.md), [03-choice-fields.md](03-choice-fields.md) — компоненты, которые `FormField` оборачивает.
- [04-layout-and-buttons.md](04-layout-and-buttons.md) — `Button` для submit/prev/next.
- [06-troubleshooting.md](06-troubleshooting.md) — «label дублируется», «error не появляется», «FormField не подцепляет ошибки».
- CDK-хуки: [@reformer/cdk/form-field](../../../reformer-cdk/docs/llms/) (`FormField.Root`, `useFormFieldContext`).
