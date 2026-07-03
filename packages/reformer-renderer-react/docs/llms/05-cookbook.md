# Cookbook

Продвинутые рецепты для `@reformer/renderer-react`. Каждый рецепт — конкретный сценарий, описанный без воды: проблема, решение, ограничения.

## Custom fieldWrapper

**Problem.** Нужна собственная обёртка вокруг каждого поля (label, error, hint, аналитика, нестандартный layout) вместо стандартного `FormField` из `@reformer/ui-kit`.

**Solution.** `RenderSchema` использует `fieldWrapper` через `settings`. Кастомный wrapper получает `control` (FieldNode), `children` (отрендеренный input), `className`, `testId` — и сам строит обвязку с помощью compound-API из `@reformer/cdk/form-field`.

```tsx
import { FormField as CdkFormField } from '@reformer/cdk/form-field';
import { useFormControl, type FieldNode } from '@reformer/core';
import { FormRenderer, type FieldWrapperProps } from '@reformer/renderer-react';

function MyFieldWrapper({ control, className, children, testId }: FieldWrapperProps) {
  // Hint можно тащить из componentProps через useFormFieldContext.
  const { error } = useFormControl(control as FieldNode<unknown>);
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
        {error && <small className="text-red-600">{error}</small>}
      </div>
    </CdkFormField.Root>
  );
}

<FormRenderer render={schema} settings={{ fieldWrapper: MyFieldWrapper }} />;
```

**Notes.**

- Wrapper вызывается на каждое поле (`ModelFieldRenderNode`). Если поле — Checkbox, обычно label рендерится внутри input (см. ветку `isCheckbox` в `@reformer/ui-kit/FormField`); своему wrapper'у проверку нужно добавить вручную, иначе будет двойной label.
- Для конкретного поля можно перекрыть глобальный wrapper через `componentProps.fieldWrapper` (поле типа `ComponentType<FieldWrapperProps>` в `ModelFieldRenderNode.componentProps`).
- Не оборачивай wrapper в `React.memo` без сравнения по `control` и `children` — иначе DOM будет «застревать» на старом инпуте.

## Programmatic node manipulation

**Problem.** Нужно динамически прятать/показывать секцию или менять props ноды снаружи schema (например, по событию из `useEffect`, по кнопке debug-панели, или после загрузки данных).

**Solution.** Любая `RenderSchemaProxy` (результат `createRenderSchema`) даёт API `proxy.node(selector)` с методами `setHidden`, `resetHidden`, `patchProps`, `resetProps`. Это императивные мутации, реактивные через Preact-сигналы внутри прокси — перерендеривается только затронутая нода.

```tsx
import { useEffect, useMemo } from 'react';
import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
import { Section, Input } from '@reformer/ui-kit';

function CreditApplicationPage() {
  const schema = useMemo(
    () =>
      createRenderSchema<CreditForm>(() => ({
        selector: 'mortgage-section',
        component: Section,
        children: [{ value: model.$.propertyValue, component: Input }],
      })),
    []
  );

  useEffect(() => {
    // Скрыть секцию по внешнему сигналу.
    schema.node('mortgage-section').setHidden(true);
    // Точечно обновить пропс (мерджится с предыдущими patchProps).
    schema.node('mortgage-section').patchProps({ title: 'Недвижимость (скрыта)' });
    return () => {
      schema.node('mortgage-section').resetHidden();
      schema.node('mortgage-section').resetProps();
    };
  }, [schema]);

  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

**Notes.**

- Методы `setHidden/patchProps/resetHidden/resetProps` чейнятся (`return this`).
- `patchProps` именно мерджит — повторный вызов с `{ disabled: true }` не сбросит ранее заданный `title`. Для полной очистки используй `resetProps`.
- `setHidden(true)` перекрывает реактивное условие из `hideWhen`. Чтобы вернуть автоматику — `resetHidden()`.
- Селектор должен быть указан в `RenderNode.selector`. Без него `proxy.node('x')` вернёт контроллер с пустыми переопределениями (никаких ошибок не будет, но эффекта тоже не будет).

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

// В RenderSchema (children — top-level; листья на сигналах модели):
{
  selector: 'extras',
  component: CollapsibleSection,
  componentProps: { title: 'Дополнительно', defaultOpen: false },
  children: [
    { value: model.$.notes, component: Textarea },
    { value: model.$.tags, component: Input },
  ],
}
```

**Notes.**

- `children` всегда `ReactNode` — обходить как массив `RenderNode` нельзя: к этому моменту они уже превращены в React-элементы.
- Если контейнеру нужны ноды как данные (вычислить количество, отрисовать таб-бар) — описывай их через `componentProps`, а не через `children`. Пример — `FormWizard` из `@reformer/ui-kit/form-wizard` с `componentProps.steps`. Конвертер JSON-схемы поддерживает `JsonNode` и `$template` внутри произвольных props (см. [renderer-json/05-cookbook.md](../../../reformer-renderer-json/docs/llms/05-cookbook.md#template-arrays)).
- Контейнер можно адресовать через `selector` — тогда `setHidden` будет работать на его содержимое целиком.

## Combining behaviors on one node

**Problem.** На одном узле нужно сразу несколько эффектов: скрытие по условию, реактивный side-effect, обработчик события компонента, lifecycle-хук — без дублирования selector-кода.

**Solution.** Собрать ссылку на ноду один раз и навешать standalone-helpers по очереди. `apply([...])` в API нет — каждый helper принимает контроллер ноды и стейкает свой override в общие override-карты.

```tsx
import {
  hideWhen,
  renderEffect,
  onComponentEvent,
  onMount,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';

// form захвачен в замыкание фабрики поведения; ref — из schema.node('wizard').getRef().
const behavior: RenderBehaviorFn<CreditForm> = (schema) => {
  const wizard = schema.node('wizard');
  const wizardRef = wizard.getRef<FormWizardHandle<CreditForm>>();
  const mortgage = schema.node('mortgage-section');

  // 1. Реактивное условие — пересчитывается при изменении сигналов формы.
  hideWhen(mortgage, () => form.loanType.value.value !== 'mortgage');

  // 2. Реактивный эффект на схеме — Preact effect() с автодиспозом.
  renderEffect(schema, () => {
    if (form.loanType.value.value === 'mortgage') wizardRef.current?.goToStep(1);
  });

  // 3. Подписка на проп-событие компонента (получает родные args).
  onComponentEvent(wizard, 'onSubmit', async (values) => {
    await submitCreditApplication(values);
  });

  // 4. Lifecycle: onMount может вернуть cleanup.
  onMount(wizard, () => {
    console.log('wizard mounted');
    return () => console.log('cleanup');
  });
};
```

**Notes.**

- Повторный `hideWhen` на одном selector затирает предыдущее условие — это последняя запись побеждает.
- `onComponentEvent` мерджит обработчики по имени события (`onSubmit`, `onChange`, ...). Если schema уже содержит такой проп — он будет полностью заменён обработчиком из behavior.
- `renderEffect` принимает не node, а саму схему: эффекты живут на уровне рендера всего дерева и автоматически диспозятся при unmount `FormRenderer`.
- `onInit` срабатывает синхронно при applying behavior (до первого рендера). Это единственный хук, способный изменить `componentProps` так, чтобы они попали в первый рендер.

## Вся форма read-only / view-mode

**Problem.** Нужно показать форму целиком в режиме просмотра (все поля задизейблены) — например, экран подтверждения, «read-only копия», или форма, заблокированная до загрузки данных.

**Solution.** Глобального `settings.readonly`/`settings.mode` **нет** — `RendererSettings` несёт только `fieldWrapper`. Канон — вызвать `form.disable()` на корневой форме после `createForm`. `disable()` каскадит `disabled` по всему поддереву (группа проставляет `disabled` себе и рекурсивно всем дочерним полям), а рендерер уже пробрасывает `state.disabled` в каждый инпут. Ничего в схеме менять не нужно.

```tsx
const form = createForm({ model, schema });

// Вся форма в режиме просмотра — один вызов, каскадит по всем полям.
form.disable();

// Вернуть редактируемость (например, по кнопке «Редактировать»):
// form.enable();

<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
```

Для условного дизейбла на монтировании то же самое можно сделать из `renderBehavior` в `onInit` (срабатывает синхронно до первого рендера) — тогда поля отрендерятся уже задизейбленными.

**Notes.**

- `disable()`/`enable()` — на группе (корне и любой вложенной группе), каскад рекурсивный: дизейбл секции задизейблит только её поля.
- **Caveat:** явный `componentProps.disabled` на конкретном поле перебивает каскад. Рендерер собирает пропсы как `{ disabled: state.disabled, ...componentProps }` — спред идёт последним, поэтому жёстко заданный в схеме `disabled: false` оставит поле активным даже после `form.disable()`. Не задавай `disabled` в `componentProps`, если хочешь управлять им через `form.disable()`.
- Это ортогонально `hideWhen`: `disable()` оставляет поля видимыми, но неактивными; `hideWhen` убирает их из дерева.

## See also

- [02-render-schema.md](02-render-schema.md) — структура `RenderNode` и `RenderSchemaFn`.
- [03-render-behavior.md](03-render-behavior.md) — справочник по standalone-хелперам.
- [04-troubleshooting.md](04-troubleshooting.md) — типичные ошибки.
