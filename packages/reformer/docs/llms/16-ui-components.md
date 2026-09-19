## 14.5 UI COMPONENT PATTERNS

> **Default rule (read first)**: для UI используй `FormField` из
> [`@reformer/ui-kit`](../../reformer-ui-kit/) — он покрывает 95% случаев одной
> строкой `<FormField control={form.x} />`. Свои обёртки поля пиши ТОЛЬКО если
> ui-kit не подходит (другая design system, особый low-level input).
>
> Канонический schema-driven подход:
>
> - **компонент** объявляется в схеме как `component: Input` (или `SelectAsync`, `CheckboxWithLabel`, …) —
>   сам компонент кита, отдельных «field-версий» нет: связывает его с полем обёртка (`FormField`)
> - **пропсы** компонента — в `componentProps: { label, placeholder, options, type, ... }`
> - **JSX рендерит**: `<FormField control={form.x} />` БЕЗ дополнительных props
>
> См. `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")`
> для полного руководства.

### Default — FormField из ui-kit (canonical)

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { FormField, Input, SelectAsync, CheckboxWithLabel, Button } from '@reformer/ui-kit';

type RegistrationForm = {
  email: string;
  country: string;
  agree: boolean;
};

function RegistrationPage() {
  const form = useMemo(() => {
    const model = createModel<RegistrationForm>({ email: '', country: 'ru', agree: false });
    const schema = {
      email: {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
      },
      country: {
        value: model.$.country,
        component: SelectAsync,
        componentProps: {
          label: 'Country',
          options: [
            { value: 'ru', label: 'Россия' },
            { value: 'by', label: 'Беларусь' },
          ],
        },
      },
      agree: {
        value: model.$.agree,
        component: CheckboxWithLabel,
        componentProps: { label: 'I agree to terms' },
      },
    };
    return createForm<RegistrationForm>({ model, schema });
  }, []);

  return (
    <form>
      <FormField control={form.email} testId="email" />
      <FormField control={form.country} testId="country" />
      <FormField control={form.agree} testId="agree" />
      <Button type="submit">Register</Button>
    </form>
  );
}
```

`FormField` сам читает `componentProps.label`, `componentProps.placeholder`,
`componentProps.options` через `useFormControl(...).componentProps` и применяет
их к нужному `<input>`/`<select>`/etc. Error rendering, `pending` для async-валидаций,
`data-testid` для e2e — всё из коробки.

### Anti-patterns (не делай так)

❌ **Свои field-компоненты с label-prop'ами в JSX**:

```tsx
// WRONG — дублирует логику FormField, ломает schema-driven архитектуру
<Input control={form.email} label="Email" placeholder="..." />
<Select control={form.country} options={[...]} />
```

❌ **Передача компонент-пропсов через JSX вместо схемы**:

```tsx
// WRONG — нарушает single source of truth (схема)
<FormField control={form.email} label="Email" />
```

✅ Всё это в схеме:

```ts
{ email: { component: Input, componentProps: { label: 'Email' } } }
```

```tsx
<FormField control={form.email} />
```

### Advanced — кастомный input через `children` slot

Когда нужен низкоуровневый input, которого нет в ui-kit (маска, особый combobox):

```tsx
import { FormField } from '@reformer/ui-kit';
import { InputMask } from 'react-input-mask';

<FormField control={form.phone} testId="phone">
  <InputMask mask="+7 (999) 999-99-99" />
</FormField>;
```

`children` оборачивается в `CdkFormField.Control asChild` и получает все нужные
props (`value`, `onChange`, `onBlur`, `aria-invalid`) — в диалекте ребёнка, если тот объявил
статику `reformerAdapter` (`defineFieldControl` из `@reformer/ui-kit/fields`), иначе value-based.

### Advanced — write your own from scratch (rare)

Если ты не хочешь подключать `@reformer/ui-kit`, пиши свои компоненты на основе
`useFormControl` — но **сохраняй schema-driven подход**: читай label/placeholder
из `componentProps`, не из JSX-props.

```tsx
import type { FieldNode } from '@reformer/core';
import { useFormControl } from '@reformer/core';

type MyFormFieldProps<T> = { control: FieldNode<T> }; // ← ОДИН prop

function MyFormField<T>({ control }: MyFormFieldProps<T>) {
  const { value, errors, disabled, shouldShowError, componentProps } = useFormControl(control);
  // componentProps = { label, placeholder, type, options, ... } — из СХЕМЫ
  const cp = (componentProps ?? {}) as Record<string, unknown>;

  return (
    <label>
      {cp.label && <span>{cp.label as string}</span>}
      <input
        type={(cp.type as string) ?? 'text'}
        value={(value ?? '') as string}
        placeholder={cp.placeholder as string | undefined}
        disabled={disabled}
        onChange={(e) => (control.setValue as (v: unknown) => void)(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && errors[0] && <span>{errors[0].message}</span>}
    </label>
  );
}
```

Использование — как у `FormField`:

```tsx
<MyFormField control={form.email} /> // ← без label-prop
```

### Связывание поля с контролом — `FieldAdapter` (`@reformer/core`)

Контролы говорят на разных диалектах (`checked` + `onCheckedChange`, `onValueChange`, DOM-событие
в `onChange`), форма — на value-based seam (`value` + `onChange(value)` + `onBlur`). Перевод
описывает `FieldAdapter` (`valueProp`, `changeProp`, `fromEmit`, `toValue`, `bindBlur`, `strip`,
`passControl` — все необязательны). Компонент объявляет его статикой `reformerAdapter`, а обёртка
поля (`FormField.Control` из `@reformer/cdk`, рендерер `@reformer/renderer-react`) читает статику
и связывает поле сама — отдельные «field-версии» компонентов не нужны.

| Символ                        | Назначение                                                                  |
| ----------------------------- | --------------------------------------------------------------------------- |
| `FieldAdapter`                | Тип адаптера: диалект контрола                                              |
| `getFieldAdapter(component)`  | Статика `component.reformerAdapter` либо `undefined`                        |
| `bindFieldProps(adapter, seam, props)` | Props контрола под адаптер (без адаптера — seam как есть)          |
| `FieldHandle`                 | Императивный handle поля: `focus` / `blur` / `scrollIntoView` / `getElement` |
| `makeElementFieldHandle(ref)` | Базовый `FieldHandle` из DOM-узла                                           |
| `useFieldHandleRef(outerRef)` | Ref для контрола + публикация handle потребителю (строит ОБЁРТКА поля)     |

В приложении обычно достаточно `defineFieldControl(MyControl, { adapter })` из
`@reformer/ui-kit/fields` (плюс готовые пресеты `checkedAdapter`, `valueChangeAdapter`, …); для
компонентов чужой библиотеки без статики — `RendererSettings.resolveFieldAdapter`.

### Integration with UI libraries (shadcn etc.)

> **Через рендерер — без обёртки.** Если ты рендеришь форму через `@reformer/renderer-react` /
> `@reformer/renderer-json`, вместо ручной обёртки на каждый контрол можно зарегистрировать сырой
> компонент и передать `settings.resolveFieldAdapter` — рендерер сам сведёт value-seam к диалекту
> контрола. Свой компонент можно подготовить и один раз — статикой
> `defineFieldControl(MyInput, { adapter })` из `@reformer/ui-kit/fields`: его поймут и рендерер,
> и `FormField.Control` из `@reformer/cdk`. Ручная обёртка на `useFormControl` (ниже) нужна для
> прямого JSX без `FormField` и рендерера.

Если есть существующая design system — оборачивай её компоненты в один
`MyFormField` (как выше) и используй один прop `control`. Не множь обёртки на
тип input'а — пусть `componentProps.type` диспатчит внутри.

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ShadcnFormField({ control }: { control: FieldNode<string> }) {
  const { value, errors, disabled, componentProps } = useFormControl(control);
  const cp = (componentProps ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-2">
      {cp.label && <Label>{cp.label as string}</Label>}
      <Input
        value={(value ?? '') as string}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
      />
      {errors[0] && <p className="text-red-500">{errors[0].message}</p>}
    </div>
  );
}
```
