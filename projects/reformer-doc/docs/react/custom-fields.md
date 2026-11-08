---
sidebar_position: 3
---

# Свои компоненты полей

Своё поле — React-компонент, который читает состояние [ноды](../reference/glossary.md) через
`useFormControl` и пишет значение методом `setValue`. Пропсы поля — подпись, варианты выбора —
приходят из узла схемы, а не из JSX.

## Когда нужно

- В проекте своя дизайн-система, и `@reformer/ui-kit` не подходит.
- Нужен особый контрол: маска, комбобокс, выбор на карте.
- Готовый компонент чужой библиотеки нужно подключить к форме.

Если подходит `@reformer/ui-kit` — берите его `FormField`: он читает `componentProps`, показывает
замечания и `pending`, ставит `aria-*` и `data-testid`.

## Пример

Одна обёртка на всё поле: значение, запись, подпись и текст замечания.

```tsx
import { useFormControl } from '@reformer/core/react';
import { useIssueMessageResolver } from '@reformer/cdk';
import type { FormControl } from '@reformer/core';

export function MyField({ control }: { control: FormControl<string> }) {
  const { value, issues, disabled, shouldShowError, shouldShowIssues, componentProps } =
    useFormControl(control);
  const message = useIssueMessageResolver(); // код замечания → текст: словарь формы, затем локаль
  const props = componentProps as { label?: string; placeholder?: string; type?: string };

  return (
    <label className="field">
      {props.label && <span>{props.label}</span>}
      <input
        type={props.type ?? 'text'}
        value={value ?? ''}
        placeholder={props.placeholder}
        disabled={disabled}
        aria-invalid={shouldShowError}
        onChange={(event) => control.setValue(event.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowIssues && issues[0] && <span className="error">{message(issues[0])}</span>}
    </label>
  );
}
```

Пропсы — в узле схемы, в JSX — только `control`:

```tsx
// узел схемы
{
  model: model.$.email,
  component: MyField,
  componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
}

// разметка
<MyField control={form.email} />
```

Четыре обязательные детали:

- **значение** читается из `value`, а не из своего `useState`;
- **запись** — `control.setValue(...)`; **уход из поля** — `control.markAsTouched()`: после него
  замечания поля становятся видны;
- **пустое значение** рисуется как `''` (`value ?? ''`) — иначе `input` станет неуправляемым;
- **текст замечания** берётся по коду: в замечании (`{ code, params, severity }`) текста нет.
  `useIssueMessageResolver()` из `@reformer/cdk` учитывает словарь формы от
  `ValidationMessagesProvider`; без cdk — `useIssueMessage(messages)` из `@reformer/core/react`.

## Поле с вариантами выбора

Варианты приходят из `componentProps.options`:

```tsx
type Option = { value: string; label: string };

export function MySelect({ control }: { control: FormControl<string> }) {
  const { value, disabled, issues, shouldShowIssues, componentProps } = useFormControl(control);
  const message = useIssueMessageResolver();
  const props = componentProps as { label?: string; options?: Option[] };

  return (
    <label className="field">
      {props.label && <span>{props.label}</span>}
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => control.setValue(event.target.value)}
        onBlur={() => control.markAsTouched()}
      >
        <option value="">Выберите…</option>
        {(props.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {shouldShowIssues && issues[0] && <span className="error">{message(issues[0])}</span>}
    </label>
  );
}
```

Варианты меняют на лету: `form.country.updateComponentProps({ options })` — например, после загрузки
в [поведении](../behaviors/watch.md#onchange). Компонент перерисуется сам.

## Компонент чужой библиотеки

Если контрол уже есть (shadcn, MUI), обёртку писать не нужно. Объявите компоненту, как он читает и
пишет значение, — и кладите его в `component` узла как есть. Связывание с полем выполнит `FormField`
или рендерер.

```tsx
import { checkedAdapter, defineFieldControl } from '@reformer/ui-kit/fields';
import { Checkbox } from '@/components/ui/checkbox';

// Checkbox говорит на checked / onCheckedChange — адаптер сводит это к значению поля.
export const FormCheckbox = defineFieldControl(Checkbox, { adapter: checkedAdapter });

// узел схемы: { model: model.$.agree, component: FormCheckbox, componentProps: { label: 'Согласен' } }
```

- Готовые адаптеры `@reformer/ui-kit/fields`: `nativeInputAdapter`, `textValueAdapter`,
  `checkedAdapter`, `pressedAdapter`, `valueChangeAdapter`, `multiValueAdapter`, `sliderAdapter`,
  `dateAdapter`, `datePickerAdapter`, `dateRangeAdapter`.
- `defineFieldControl` не создаёт новый компонент: он добавляет статики тому же компоненту и
  возвращает его.
- Компоненту, которому статику не добавить, при рендере через `@reformer/renderer-react` адаптер
  задаёт `settings.resolveFieldAdapter`.

## Подводные камни

:::warning Пропсы поля — в схеме, не в JSX

```tsx
// ❌ пропсы в JSX — мимо схемы
<MyField control={form.email} label="Email" />

// ✅ всё в схеме, в JSX — только control
<MyField control={form.email} />
```

:::

- **Одна обёртка на набор полей.** Тип `input` выбирайте по `componentProps.type` внутри одной
  обёртки, а не пишите обёртку под каждый тип.
- **`componentProps.disabled` поле не выключает** — выключает `enableWhen` или ключ узла `disabled`.
  Читайте доступность из `disabled` состояния.

## См. также

- [React-хуки](./hooks.md) — `useFormControl` и остальные хуки.
- [Обработка ошибок](../validation/error-handling.md) — замечания и доступность.
- [Схема формы](../core-concepts/schemas/form-schema) — где объявляются `component` и
  `componentProps`.
