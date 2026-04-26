# FormField

Headless compound component для построения доступной (a11y) анатомии поля формы. `FormField` берёт на себя ID-провязку (`htmlFor`, `aria-labelledby`, `aria-describedby`, `aria-errormessage`, `aria-invalid`, `aria-required`), подписку на состояние `FieldNode` и приклеивание `value`/`onChange`/`onBlur` к интерактивному контролу. UI вы строите сами.

## Purpose

- Дать минимальный «скелет» поля: label + control + description + error.
- Не навязывать стилей — каждый sub-компонент рендерит обычные HTML-элементы (или `Slot` через `asChild`).
- Подписаться на `FieldNode` ровно один раз в `Root` и раздать состояние детям через React Context.
- Гарантировать корректные ARIA-атрибуты в нетривиальных сценариях (multi-error, отсутствие label, async pending).

В отличие от `FormField` из `@reformer/ui-kit`, который рендерит готовый layout (label сверху, ошибка снизу), `FormField` из `@reformer/cdk` ничего не рендерит сверх минимально необходимого и нужен, когда требуется собственный layout.

## Components

| Component | Purpose | Notes |
|---|---|---|
| `FormField.Root` | Context provider; принимает `control: FieldNode<T>` и опциональный `id`/`hasDescription`. | Подписывается на `useFormControl(control)` один раз. Без `Root` дети бросают исключение. |
| `FormField.Label` | `<label>` с автоматическим `htmlFor`. Текст по умолчанию из `componentProps.label`. Required-индикатор `*` добавляется при `required`. | Возвращает `null`, если нет ни `componentProps.label`, ни `children`. Используйте `forceRender` чтобы рендерить пустой label. |
| `FormField.Control` | Auto-renders `control.component` со всеми пропсами и a11y-атрибутами. С `asChild`/`children` — вмёрживает a11y-атрибуты в произвольный дочерний элемент через `Slot`. | Auto-mode прокидывает `componentProps`, `value`, `disabled`, `onChange`, `onBlur`. |
| `FormField.Error` | `<p role="alert">` с `errors[0].message`. Поддерживает `multi`, `render`, кастомные `children`. | Не рендерится, пока `shouldShowError === false` (поле не touched / нет ошибок). |
| `FormField.Description` | `<p>` с стабильным `id={ids.descriptionId}` для `aria-describedby`. | Чтобы `Control` автоматически прописал `aria-describedby`, передайте `hasDescription` в `Root`. |
| `useFormFieldContext<T>()` | Хук для произвольных дочерних компонентов, которым нужен `control`, `value`, `errors`, `ids`, `componentProps`. | Бросает `Error`, если вызван вне `FormField.Root`. |
| `useFormField(control, id?)` | Standalone hook без compound API. Возвращает `labelProps`, `controlProps`, `errorProps`, `descriptionProps`, `state`, `actions`, `ids`. | Удобен, когда нужен полный контроль над DOM-структурой и пропсами. |

## Examples

### Базовый сценарий — auto-render всех частей

Минимум кода: `Label` и `Control` сами берут текст / компонент из конфига поля, `Error` прячется до touch.

```tsx
import { FormField } from '@reformer/cdk/form-field';

function EmailField({ control }: { control: typeof form.email }) {
  return (
    <FormField.Root control={control}>
      <FormField.Label />
      <FormField.Control />
      <FormField.Error />
    </FormField.Root>
  );
}
```

`Label` рендерит текст из `componentProps.label`, `Control` — компонент, заданный через `component:` в схеме формы (`Input`, `InputPassword`, `Select`...).

### Custom layout — обёртки и стилизация

Когда требуется горизонтальный layout, иконка слева и helper-текст:

```tsx
<FormField.Root control={form.email} hasDescription>
  <div className="grid grid-cols-[120px_1fr] items-start gap-3">
    <FormField.Label className="pt-2 text-sm font-medium text-gray-700" />

    <div className="space-y-1">
      <FormField.Control asChild>
        <Input type="email" leftIcon={<MailIcon />} className="w-full" />
      </FormField.Control>
      <FormField.Description className="text-xs text-gray-500">
        Мы не передаём email третьим сторонам.
      </FormField.Description>
      <FormField.Error className="text-xs text-red-600" />
    </div>
  </div>
</FormField.Root>
```

Передача `hasDescription` обязательна для того, чтобы `Control` прописал `aria-describedby={descriptionId}`.

### Async-валидация с pending-индикатором

Состояние асинхронной валидации (`pending`) доступно через `useFormFieldContext()`. Удобно показать спиннер или disabled у submit-кнопки.

```tsx
import { FormField, useFormFieldContext } from '@reformer/cdk/form-field';

function PendingDot() {
  const { pending } = useFormFieldContext();
  if (!pending) return null;
  return <Spinner size="sm" aria-label="Проверяем..." />;
}

<FormField.Root control={form.username}>
  <div className="flex items-center gap-2">
    <FormField.Label />
    <PendingDot />
  </div>
  <FormField.Control />
  <FormField.Error multi className="text-xs text-red-600" />
</FormField.Root>
```

`multi` рендерит все ошибки из `errors[]` (например, async-валидатор может вернуть и «слишком короткое имя», и «уже занято»). Первая ошибка получит `id={errorId}` для `aria-errormessage`.

### Интеграция с готовым `FormField` из `@reformer/ui-kit`

`@reformer/ui-kit` экспортирует свой `FormField`, который собран на этих compound-блоках. В большинстве форм его достаточно — без необходимости опускаться на уровень CDK:

```tsx
import { FormField } from '@reformer/ui-kit';

<form>
  <FormField control={form.username} className="mb-4" />
  <FormField control={form.email} className="mb-4" />
</form>
```

Если нужен один кастомный кейс среди типовых — комбинируйте: `FormField` из ui-kit для большинства полей и `FormField.Root` из cdk для нестандартного:

```tsx
import { FormField } from '@reformer/ui-kit';
import { FormField as FieldRoot } from '@reformer/cdk/form-field';

<>
  <FormField control={form.email} />
  <FieldRoot.Root control={form.captcha}>
    <FieldRoot.Label />
    <div className="flex items-center gap-2">
      <FieldRoot.Control asChild>
        <Input className="flex-1" />
      </FieldRoot.Control>
      <CaptchaImage />
    </div>
    <FieldRoot.Error />
  </FieldRoot.Root>
</>
```

## Anti-patterns

- **Использовать `FormField.Label` / `Error` / `Control` без `FormField.Root`.** Каждый дочерний компонент вызывает `useFormFieldContext()` и бросает: `FormField.* components must be used within <FormField.Root>`.
- **Подписываться на `useFormControl(control)` рядом с `FormField.Root`.** `Root` уже подписан — лишняя подписка приведёт к двойному ререндеру. Используйте `useFormFieldContext()` для доступа к состоянию.
- **Передавать `id` руками в `Control` / `Label`.** ID назначаются автоматически из `useId()`. Если нужен предсказуемый ID для тестов, передайте `id="my-field"` в `Root` — все потомки получат `control-my-field`, `label-my-field`, …
- **Забывать `hasDescription` при наличии `FormField.Description`.** Без флага `Control` не пропишет `aria-describedby={descriptionId}`, и screen reader не зачитает helper-текст.
- **Двойное рендерание ошибки (`Error` + ручной `<p>`).** `FormField.Error` уже подписан на `errors`/`shouldShowError`. Если нужен кастомный layout — используйте `render` prop, а не дублируйте.
- **Применять `asChild` к компоненту, который не пробрасывает `ref`/`...props`.** `Slot` объединяет пропсы и ref в дочерний элемент; если потомок их не принимает, `aria-*`-атрибуты потеряются.

## Troubleshooting

- **`Error: FormField.* components must be used within <FormField.Root>`.** Проверьте, что вызов `FormField.Label` / `Control` / `Error` обёрнут в `FormField.Root` и компонент не рендерится в портале выше провайдера.
- **`Label` ничего не показывает.** В схеме поля нет `componentProps.label`. Вариант: задайте `label` в схеме, или передайте `children` в `FormField.Label`, или поставьте `forceRender`.
- **`Control` рендерит «голый» `<input>` без стилей.** Auto-mode рендерит `control.component` — убедитесь, что в схеме указан компонент (`component: Input`). Иначе используйте `asChild` + свой компонент.
- **`aria-describedby` пустой при наличии `Description`.** Не передан `hasDescription` в `Root`. Это не «магический» флаг — без него `Control` не знает, что description есть в дереве.
- **`FormField.Error` не появляется при наличии ошибки.** Поле не помечено как touched. Используйте `form.markAsTouched()` или `control.markAsTouched()` перед сабмитом, либо настройте `revalidateWhen` чтобы помечать touched по `change`.
- **При async-валидации индикатор моргает.** `pending` переключается на каждый `setValue`. Дебаунсьте источник или добавьте задержку перед показом спиннера (например, `useDeferredValue`).
- **Дубликаты `id` в DOM.** Несколько `FormField.Root` с одинаковым явным `id`. Опустите `id` (тогда работает `useId()`) или дайте уникальные значения.

## See also

- [01-overview.md](01-overview.md) — общее введение в `@reformer/cdk`.
- [02-form-array.md](02-form-array.md), [03-form-navigation.md](03-form-navigation.md) — соседние compound-компоненты.
- [05-recipes.md](05-recipes.md) — продвинутые паттерны (включая собственный wrapper над FormField).
- [06-troubleshooting.md](06-troubleshooting.md) — типичные ошибки FormField/FormArray/FormWizard.
- [Эталон использования: RegistrationForm.tsx](../../../../projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx) — `FormField` из ui-kit вокруг каждого поля.
- [CreditApplicationForm steps](../../../../projects/react-playground/src/pages/examples/complex-multy-step-form/) — поля внутри multi-step формы.
- [src/components/form-field/](../../src/components/form-field/) — исходники compound-блоков и `useFormField`.
