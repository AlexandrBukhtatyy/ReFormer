# Advanced Recipes

Готовые рецепты для нетривиальных задач: вложенные массивы, кастомный AddButton, динамическое количество шагов в wizard, externally-controlled wizard. Каждый рецепт — Problem → Solution → Notes.

## Nested FormArray

### Problem

В одной форме нужно несколько уровней вложенности массивов: например, `properties[]` (имущество клиента) и внутри каждого — `coOwners[]` (совладельцы). Контролы вложенных массивов — это `ArrayNode<T>` внутри `FormProxy<Property>`, и стандартного `FormArray.Root + List` достаточно, чтобы рендерить любую глубину.

### Solution

```tsx
import { FormArray } from '@reformer/cdk/form-array';
import { FormField } from '@reformer/ui-kit';

<FormArray.Root control={form.properties}>
  <FormArray.List className="space-y-4">
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
        <FormArray.Root control={property.coOwners}>
          <FormArray.List className="space-y-2">
            {({ control: owner, index: ownerIdx, remove: removeOwner }) => (
              <div className="flex gap-2">
                <FormField control={owner.fullName} className="flex-1" />
                <FormField control={owner.share} className="w-24" />
                <button type="button" onClick={removeOwner}>
                  ×
                </button>
              </div>
            )}
          </FormArray.List>
          <FormArray.AddButton className="btn-secondary mt-2">
            + Добавить совладельца
          </FormArray.AddButton>
        </FormArray.Root>
      </fieldset>
    )}
  </FormArray.List>
  <FormArray.AddButton className="btn-primary">+ Добавить имущество</FormArray.AddButton>
</FormArray.Root>;
```

### Notes

- Каждый `FormArray.Root` создаёт собственный `FormArrayContext`. Внутренний `useFormArrayContext()` (например, в `AddButton`) видит ближайший провайдер — в примере выше `coOwners`, не `properties`.
- `FormArray.List` мемоизирует элементы по `length` массива (см. `useFormArray`); смена порядка/количества внутреннего массива не дёргает внешний `List`.
- `useFormArrayItemContext()` внутри вложенного `List` вернёт **внутренний** item (`coOwner`), не внешний. Если нужен индекс внешнего элемента, забирайте его в замыкании render-функции (`index`, `property`).
- Рендер-проп `FormArray.List` стабилен по identity: вынесите тяжёлые шаги в отдельный компонент, чтобы получить React.memo-эффект.

## Custom AddButton

### Problem

`FormArray.AddButton` рендерит обычный `<button>` (или Slot через `asChild`). Иногда нужно совсем другое UI: dropdown с выбором типа, drag-drop файлов, шаблоны заготовок. Самый чистый путь — обойти compound-компонент и вызвать `useFormArrayContext()` напрямую.

### Solution

```tsx
import { useFormArrayContext } from '@reformer/cdk/form-array';
import { Menu } from '@/ui';

function AddPropertyMenu() {
  const { add } = useFormArrayContext<Property>();

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

<FormArray.Root control={form.properties}>
  <FormArray.List>{({ control }) => <PropertyForm control={control} />}</FormArray.List>
  <AddPropertyMenu />
</FormArray.Root>;
```

### Notes

- Хук работает только внутри `FormArray.Root` — снаружи бросает `Error: FormArray.* components must be used within FormArray.Root`.
- `add(value?: Partial<T>)` пропускает значение в `control.push(value)` — не задавать поля можно, ReFormer возьмёт значения по умолчанию из схемы.
- Если кастомный триггер живёт **снаружи** `Root` (например, в шапке страницы), используйте ref-handle: `useRef<FormArrayHandle<T>>` + `arrayRef.current?.add(...)`.
- Для batch-добавления нескольких элементов вызывайте `add` в цикле — каждый push триггерит ререндер `List` (через `length`-зависимость в `useFormArray`).

## Conditional / dynamic step count in FormWizard

### Problem

`FormWizard` считает количество шагов через `Children.forEach` по `FormWizard.Step` детям (см. `FormWizard.tsx`). Если шаг условный (например, «верификация документов» нужна только для суммы > 1 000 000), достаточно условного рендера: `{showVerification && <FormWizard.Step ... />}`. `totalSteps` пересчитается, индикатор сожмётся.

### Solution

```tsx
import { useMemo } from 'react';
import { useFormControl } from '@reformer/core';
import { FormWizard, type FormWizardConfig } from '@reformer/cdk/form-wizard';

function CreditWizard({ form, stepSchemas, fullSchema }: Props) {
  const { value: amount } = useFormControl(form.amount);
  const needsVerification = amount > 1_000_000;

  // config — пара колбэков validateStep / validateAll (не схемы, не generic).
  // step (1-based) роутится в нужную схему; при выключенной верификации
  // нумерация сдвигается — учитываем это в самом колбэке.
  const config = useMemo<FormWizardConfig>(
    () => ({
      validateStep: (step) => {
        const schema = needsVerification
          ? stepSchemas.withVerification[step - 1]
          : stepSchemas.withoutVerification[step - 1];
        return validateFormModel(form.model, schema ?? { children: [] }).then(
          (r) => Object.keys(r.errors).length === 0
        );
      },
      validateAll: () =>
        validateFormModel(form.model, fullSchema).then(
          (r) => Object.keys(r.errors).length === 0
        ),
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

- [02-form-array.md](02-form-array.md) — основы FormArray (compound API, ref-handle).
- [03-form-navigation.md](03-form-navigation.md) — основы FormWizard (Indicator, Actions, Progress).
- [04-form-field.md](04-form-field.md) — компоновка одного поля.
- [06-troubleshooting.md](06-troubleshooting.md) — типичные ошибки и пути их обхода.
