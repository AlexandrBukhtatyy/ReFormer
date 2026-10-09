# Advanced Recipes

Готовые рецепты для нетривиальных задач: вложенные массивы, кастомный AddButton, динамическое количество шагов в wizard, externally-controlled wizard. Каждый рецепт — Problem → Solution → Notes.

## Nested FieldArray

### Problem

В одной форме нужно несколько уровней вложенности массивов: например, `properties[]` (имущество клиента) и внутри каждого — `coOwners[]` (совладельцы). Контролы вложенных массивов — это `ArrayNode<T>` внутри `FormProxy<Property>`, и стандартного `FieldArray.Root + List` достаточно, чтобы рендерить любую глубину.

### Solution

```tsx
import { FieldArray } from '@reformer/cdk/field-array';
import { FormField } from '@reformer/ui-kit';

<FieldArray.Root control={form.properties}>
  <FieldArray.List className="space-y-4">
    {({ control: property, index, remove }) => (
      <fieldset className="border rounded p-4">
        <legend className="flex justify-between w-full">
          <span>Имущество #{index + 1}</span>
          <button type="button" onClick={remove}>
            ×
          </button>
        </legend>

        <FormField control={property.address} />
        <FormField control={property.estimatedValue} />

        <h4 className="mt-4 mb-2">Совладельцы</h4>
        <FieldArray.Root control={property.coOwners}>
          <FieldArray.List className="space-y-2">
            {({ control: owner, index: ownerIdx, remove: removeOwner }) => (
              <div className="flex gap-2">
                <FormField control={owner.fullName} className="flex-1" />
                <FormField control={owner.share} className="w-24" />
                <button type="button" onClick={removeOwner}>
                  ×
                </button>
              </div>
            )}
          </FieldArray.List>
          <FieldArray.AddButton className="btn-secondary mt-2">
            + Добавить совладельца
          </FieldArray.AddButton>
        </FieldArray.Root>
      </fieldset>
    )}
  </FieldArray.List>
  <FieldArray.AddButton className="btn-primary">+ Добавить имущество</FieldArray.AddButton>
</FieldArray.Root>;
```

### Notes

- Каждый `FieldArray.Root` создаёт собственный `FieldArrayContext`. Внутренний `useFieldArrayContext()` (например, в `AddButton`) видит ближайший провайдер — в примере выше `coOwners`, не `properties`.
- `FieldArray.List` мемоизирует элементы по `length` массива (см. `useFieldArray`); смена порядка/количества внутреннего массива не дёргает внешний `List`.
- `useFieldArrayItemContext()` внутри вложенного `List` вернёт **внутренний** item (`coOwner`), не внешний. Если нужен индекс внешнего элемента, забирайте его в замыкании render-функции (`index`, `property`).
- Рендер-проп `FieldArray.List` стабилен по identity: вынесите тяжёлые шаги в отдельный компонент, чтобы получить React.memo-эффект.

## Custom AddButton

### Problem

`FieldArray.AddButton` рендерит обычный `<button>` (или Slot через `asChild`). Иногда нужно совсем другое UI: dropdown с выбором типа, drag-drop файлов, шаблоны заготовок. Самый чистый путь — обойти compound-компонент и вызвать `useFieldArrayContext()` напрямую.

### Solution

```tsx
import { useFieldArrayContext } from '@reformer/cdk/field-array';
import { Menu } from '@/ui';

function AddPropertyMenu() {
  const { add } = useFieldArrayContext<Property>();

  return (
    <Menu>
      <Menu.Trigger className="btn-primary">+ Добавить имущество ▾</Menu.Trigger>
      <Menu.Content>
        <Menu.Item onSelect={() => add({ type: 'apartment' })}>Квартира</Menu.Item>
        <Menu.Item onSelect={() => add({ type: 'house', estimatedValue: 0 })}>Дом</Menu.Item>
        <Menu.Item onSelect={() => add({ type: 'commercial' })}>Коммерческое</Menu.Item>
      </Menu.Content>
    </Menu>
  );
}

<FieldArray.Root control={form.properties}>
  <FieldArray.List>{({ control }) => <PropertyForm control={control} />}</FieldArray.List>
  <AddPropertyMenu />
</FieldArray.Root>;
```

### Notes

- Хук работает только внутри `FieldArray.Root` — снаружи бросает `Error: FieldArray.* components must be used within FieldArray.Root`.
- `add(value?: Partial<T>)` пропускает значение в `control.push(value)` — не задавать поля можно, ReFormer возьмёт значения по умолчанию из схемы.
- Если кастомный триггер живёт **снаружи** `Root` (например, в шапке страницы), используйте ref-handle: `useRef<FieldArrayHandle<T>>` + `arrayRef.current?.add(...)`.
- Для batch-добавления нескольких элементов вызывайте `add` в цикле — каждый push триггерит ререндер `List` (через `length`-зависимость в `useFieldArray`).

## Conditional / dynamic step count in FormWizard

### Problem

`FormWizard` считает количество шагов через `Children.forEach` по `FormWizard.Step` детям (см. `FormWizard.tsx`). Если шаг условный (например, «верификация документов» нужна только для суммы > 1 000 000), достаточно условного рендера: `{showVerification && <FormWizard.Step ... />}`. `totalSteps` пересчитается, индикатор сожмётся.

### Solution

```tsx
import { useMemo } from 'react';
import { useFormControl } from '@reformer/core/react';
import { validateModel } from '@reformer/core/validation';
import { FormWizard, type FormWizardConfig } from '@reformer/cdk/form-wizard';

function CreditWizard({ form, stepSchemas, fullSchema }: Props) {
  const { value: amount } = useFormControl(form.amount);
  const needsVerification = amount > 1_000_000;

  // config — пара колбэков validateStep / validateAll (не схемы, не generic).
  // step (1-based) роутится в нужную ValidationSchema (@reformer/core/validation);
  // при выключенной верификации нумерация сдвигается — учитываем это в самом колбэке.
  // validateModel(model, schema) => Promise<boolean>, ошибки сам роутит в ноды.
  const config = useMemo<FormWizardConfig>(
    () => ({
      validateStep: (step) => {
        const schema = needsVerification
          ? stepSchemas.withVerification[step - 1]
          : stepSchemas.withoutVerification[step - 1];
        return schema ? validateModel(form.model, schema) : true; // нет схемы — шаг валиден
      },
      validateAll: () => validateModel(form.model, fullSchema),
    }),
    [needsVerification, stepSchemas, fullSchema, form]
  );

  return (
    <FormWizard form={form} config={config}>
      <FormWizard.Step component={AmountForm} control={form} />
      <FormWizard.Step component={PersonalForm} control={form} />
      <FormWizard.Step component={ContactForm} control={form} />
      {needsVerification && <FormWizard.Step component={VerificationForm} control={form} />}
      <FormWizard.Step component={ConfirmationForm} control={form} />

      <FormWizard.Actions onSubmit={handleSubmit}>
        {({ prev, next, submit, isLastStep }) => (
          <div>
            <button onClick={prev.onClick} disabled={prev.disabled}>Назад</button>
            {isLastStep ? (
              <button onClick={submit.onClick} disabled={submit.disabled}>Подтвердить</button>
            ) : (
              <button onClick={next.onClick} disabled={next.disabled}>Далее</button>
            )}
          </div>
        )}
      </FormWizard.Actions>
    </FormWizard>
  );
}
```

### Notes

- **Номера шагов сдвигаются** при включении/выключении: `validateStep(4)` должен разрешаться либо в схему верификации, либо в схему подтверждения — в зависимости от `needsVerification`. Держите колбэк `validateStep`/`validateAll` в `useMemo` от того же флага, иначе он замкнётся на устаревшую нумерацию.
- `currentStep` в state `FormWizard` хранится как число. Если флаг изменился пока пользователь стоит на шаге 4 (где раньше была верификация, а теперь подтверждение), он останется на том же номере — но рендер увидит уже другой `Step`. В критичных кейсах вызывайте `navRef.current?.goToStep(1)` после переключения.
- `completedSteps` — массив номеров; при изменении общей нумерации логика «можно ли перейти на шаг N» (`step === 1 || completedSteps.includes(step - 1)`) может отметить шаг как доступный без валидации. Скиньте `completedSteps` через перемонтирование `FormWizard` (key={needsVerification}) если важна строгость.
- Children-формы рендерятся условно `_stepIndex === currentStep` (см. `FormWizardStep.tsx`); неактивные `Step` возвращают `null`, состояние их полей живёт в `form` независимо от рендера.

## Externally-controlled wizard via `useRef<FormWizardHandle>`

### Problem

Кнопка «Сохранить и выйти» лежит вне `FormWizard` (в шапке страницы), нужен программный submit. Аналогично — переход на шаг по клику в стороннем breadcrumb или после ответа из API.

### Solution

```tsx
import { useRef } from 'react';
import { FormWizard, type FormWizardHandle } from '@reformer/cdk/form-wizard';

function Page({ form, config }: Props) {
  const navRef = useRef<FormWizardHandle<CreditApplication>>(null);

  const handleSaveAndExit = async () => {
    // submit с полной валидацией; null если форма невалидна
    const result = await navRef.current?.submit(async (values) => {
      return api.saveDraft(values);
    });
    if (result) router.push('/dashboard');
  };

  const jumpToContacts = () => {
    const ok = navRef.current?.goToStep(3);
    if (!ok) toast('Сначала заполните предыдущие шаги');
  };

  return (
    <>
      <header className="flex justify-between p-4 border-b">
        <button onClick={jumpToContacts}>Перейти к контактам</button>
        <button onClick={handleSaveAndExit}>Сохранить и выйти</button>
      </header>

      <FormWizard ref={navRef} form={form} config={config}>
        <FormWizard.Step component={Step1} control={form} />
        <FormWizard.Step component={Step2} control={form} />
        <FormWizard.Step component={Step3} control={form} />
      </FormWizard>
    </>
  );
}
```

### Notes

- `FormWizardHandle` exposes: `currentStep`, `completedSteps`, `goToNextStep` (с валидацией), `goToPreviousStep`, `goToStep` (boolean — true если переход разрешён), `submit`, `validateCurrentStep`, `isFirstStep`, `isLastStep`, `isValidating`, `form`.
- `submit(onSubmit)` сначала прогоняет `config.validateAll?.()` (если колбэк задан), затем `form.markAsTouched()` если invalid, иначе делегирует в `form.submit(onSubmit, { skipValidation: true })`. Возвращает `R | null`. `null` — форма не прошла валидацию.
- `goToStep(n)` возвращает `false`, если `n > totalSteps`, `n < 1`, или предыдущий шаг (`n - 1`) не в `completedSteps` (исключение — сам шаг 1). Используйте `await goToNextStep()` чтобы пройти вперёд с валидацией.
- Ref становится `null` пока компонент не смонтировался. Все вызовы — `navRef.current?.method()` с optional chaining, либо проверка `if (!navRef.current) return`.

## See also

- [02-field-array.md](02-field-array.md) — основы FieldArray (compound API, ref-handle).
- [03-form-navigation.md](03-form-navigation.md) — основы FormWizard (Indicator, Actions, Progress).
- [04-form-field.md](04-form-field.md) — компоновка одного поля.
- [07-troubleshooting.md](07-troubleshooting.md) — типичные ошибки и пути их обхода.
