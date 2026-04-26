# Troubleshooting / FAQ

Типичные проблемы при использовании `@reformer/cdk` (FormField, FormArray, FormWizard) с краткими причинами и решениями.

## `FormArray.AddButton` не появляется на странице

**Причина.** `FormArray.AddButton` не самостоятельный элемент — он рендерит кнопку только внутри `FormArray.Root`. Если он вынесен наружу или `Root` не отрендерился (например, под условным `if`), кнопки не будет.

**Решение.** Поместите `AddButton` в дерево `Root` либо вызывайте `useFormArrayContext().add()` из своей кнопки (см. [05-recipes.md → Custom AddButton](05-recipes.md)).

```tsx
<FormArray.Root control={form.items}>
  <FormArray.List>{renderItem}</FormArray.List>
  <FormArray.AddButton>+ Добавить</FormArray.AddButton>
</FormArray.Root>
```

## `FormArray.List` ререндерит весь массив при изменении одного элемента

**Причина.** Render-функция массива возвращает inline JSX, который не мемоизирован. Изменение поля у элемента триггерит ререндер `FormArray.Root` (через `useFormControl(arrayNode)`), а List-children получают новые ссылки.

**Решение.** Вынесите рендер элемента в отдельный компонент, обёрнутый в `React.memo`. Передавайте `control` (стабильный по identity на протяжении жизни элемента) и `id` для key.

```tsx
const Item = React.memo(({ control }: { control: FormProxy<Property> }) => (
  <PropertyForm control={control} />
));

<FormArray.List>
  {({ control, id }) => <Item key={id} control={control} />}
</FormArray.List>
```

`useFormArray` мемоизирует `items` по длине массива (см. `useFormArray.ts`), поэтому смена значения внутри элемента не пересоздаёт `items`-массив.

## `FormWizardHandle.goToStep` возвращает `false`

**Причина.** `goToStep(n)` пускает только если `n === 1` или `n - 1` уже в `completedSteps` (см. `FormWizard.tsx:goToStep`). Это защита от пропуска валидации. Также `false` возвращается при `n < 1` или `n > totalSteps`.

**Решение.**
- Для последовательного перехода вперёд используйте `await navRef.current?.goToNextStep()` — он сам валидирует и помечает шаг completed.
- Для произвольного «прыжка» предварительно отметьте предыдущий шаг как completed через `goToNextStep()` или вручную (через свой `useState` поверх).
- Проверьте `n` в диапазоне `[1; totalSteps]` (totalSteps = количество `FormWizard.Step` детей).

## Шаг без `stepValidations[N]` пропускается без проверки

**Причина.** `validateCurrentStep` сначала смотрит `config.stepValidations[currentStep]`. Если схемы нет — выводит `console.warn` и возвращает `true` (шаг считается валидным).

**Решение.** Добавьте схему для каждого шага в `stepValidations`. Если шаг чисто информационный (например, «Подтверждение»), используйте схему-no-op: `() => ({})` (или импортируйте noop-validation из вашего набора).

```typescript
const config: FormWizardConfig<MyForm> = {
  stepValidations: {
    1: amountSchema,
    2: personalSchema,
    3: () => ({}), // подтверждение, нет полей для валидации
  },
  fullValidation: fullSchema,
};
```

## `useFormArrayContext` бросает исключение

**Сообщение.** `Error: FormArray.* components must be used within FormArray.Root or RenderSchema FormArray`.

**Причина.** Хук вызван вне дерева `FormArray.Root`. Часто — в компоненте, который рендерится через портал (Modal, Tooltip), либо рядом с `Root`, а не внутри.

**Решение.** Поместите потребителя внутрь `FormArray.Root`. Для портала — оберните потребителя ещё одним `Root` с тем же `control`, либо используйте ref-handle `FormArrayHandle` снаружи.

## `useFormFieldContext` бросает исключение

**Сообщение.** `Error: FormField.* components must be used within <FormField.Root>`.

**Причина.** Тот же сценарий: `FormField.Label` / `Control` / `Error` без обёрнутого `FormField.Root`. Также возникает, если `Root` рендерит `null` (например, когда поле скрыто `enableWhen`) — Label/Error всё равно бросят, если рендерятся параллельно.

**Решение.** Перепроверьте дерево; если поле условное — выносите всю секцию в `if (!visible) return null;` снаружи `FormField.Root`.

## `FormField.Error` не показывает ошибку, хотя `errors.length > 0`

**Причина.** Поле не помечено как touched, `shouldShowError === false`. По умолчанию ReFormer показывает ошибки только после blur/submit.

**Решение.**
- На сабмите формы вызовите `form.markAsTouched()` перед `await form.validate()`.
- Для немедленной валидации поля используйте `revalidateWhen({ when: 'change' })` behavior, либо вручную `control.markAsTouched()` в `onChange`.

```tsx
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();
  if (form.valid.value) { /* submit */ }
};
```

## `FormField.Description` есть в DOM, но `aria-describedby` пустой

**Причина.** В `FormField.Root` не передан проп `hasDescription`. Без него `Control` не вписывает `descriptionId` в `aria-describedby` (это сделано осознанно — чтобы избежать двойного рендера от динамической регистрации).

**Решение.** Установите `hasDescription` в `Root` явно.

```tsx
<FormField.Root control={form.email} hasDescription>
  <FormField.Label />
  <FormField.Control />
  <FormField.Description>Hint</FormField.Description>
</FormField.Root>
```

## Multi-step submit срабатывает раньше валидации последнего шага

**Причина.** `FormWizard.Actions` диспатчит `submit` сразу при `onClick`. Если пользователь нажал Submit, не пройдя валидацию последнего шага через Next, `goToNextStep` не вызывался — но `submit` всё равно запустит `config.fullValidation` поверх всей формы. Однако touched-флаги ставятся только на полях с ошибками, и пользователю может быть неочевидно где именно проблема.

**Решение.** В кастомном submit-обработчике сначала вызывайте `validateCurrentStep`, затем `submit`. Или используйте `FormWizard.Actions`-render, где `submit.disabled === true` пока поля не валидны (Actions сам отключает кнопку при `isValidating`).

```tsx
const handleSubmit = async () => {
  const stepOk = await navRef.current?.validateCurrentStep();
  if (!stepOk) return;
  await navRef.current?.submit(api.submit);
};
```

## `FormArray.List` теряет focus или ререндерит inputs при `add`/`removeAt`

**Причина.** Используется `index` в качестве React-key. После `removeAt(0)` индексы сдвигаются, React переиспользует DOM-узлы для других данных — фокус «переезжает».

**Решение.** Используйте `id` из item-render-props, который ReFormer присваивает каждому элементу при `push`/`insert`:

```tsx
<FormArray.List>
  {({ control, id, remove }) => (
    <div key={id}>           {/* ✓ стабильный id */}
      <ItemForm control={control} />
    </div>
  )}
</FormArray.List>
```

Сам `FormArray.List` уже использует `item.id` для ключа `<FormArrayItemContext.Provider key={item.id}>` — но если внутренний контейнер тоже задаёт key, поставьте `id`, а не `index`.

## `FormWizard` показывает «No validation schema for step N» в консоли

**Причина.** `validateCurrentStep` warn'ит, если `config.stepValidations[currentStep]` отсутствует.

**Решение.** Добавьте schema для шага N или, если шаг намеренно без валидации, передайте noop: `[N]: () => ({})`.

## Ref `FormArrayHandle.length` / `isEmpty` не обновляется

**Причина.** Эти поля snapshot'ятся в `useImperativeHandle` от `arrayState` и пересоздаются при каждом ререндере. Если вы храните `arrayRef.current` в замыкании или в `useEffect` без зависимостей, можете прочитать устаревшее значение.

**Решение.** Читайте `arrayRef.current.length` непосредственно в обработчике, не кешируйте. Для реактивной длины снаружи используйте `useFormControl(form.items).length` — это даст подписку.

## See also

- [01-overview.md](01-overview.md), [04-form-field.md](04-form-field.md), [05-recipes.md](05-recipes.md).
- [@reformer/core troubleshooting](../../../reformer/docs/llms/) — общие проблемы с валидацией и behaviors.
