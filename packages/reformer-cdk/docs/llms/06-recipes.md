# Advanced Recipes

Готовые рецепты для нетривиальных задач: вложенные массивы, кастомный AddButton, условный шаг в wizard, управление wizard снаружи. Каждый рецепт — Problem → Solution → Notes.

## Nested FieldArray

### Problem

В одной форме нужно несколько уровней вложенности массивов: например, `properties[]` (имущество клиента) и внутри каждого — `coOwners[]` (совладельцы). Вложенный массив — это `FormArray<T>` внутри `FormGroup<Property>` строки, и стандартного `FieldArray.Root + List` достаточно, чтобы рендерить любую глубину.

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
- Значение массива производно от значений строк, поэтому `FieldArray.Root` перерисовывается при любой правке внутри строки — в том числе во вложенном `coOwners`. Стабильны `control` строки и её `id` (ключ строки, `keyAt(index)`): они не меняются ни от правок, ни от `move`/`swap`.
- `useFieldArrayItemContext()` внутри вложенного `List` вернёт **внутренний** item (`coOwner`), не внешний. Если нужен индекс внешнего элемента, забирайте его в замыкании render-функции (`index`, `property`).
- Тяжёлую строку выносите в отдельный компонент под `React.memo` с пропом `control` — тогда перерисовка массива не перерисовывает неизменённые строки.

## Custom AddButton

### Problem

`FieldArray.AddButton` рендерит обычный `<button>` (или Slot через `asChild`). Иногда нужно совсем другое UI: dropdown с выбором типа, drag-drop файлов, шаблоны заготовок. Самый чистый путь — обойти compound-компонент и вызвать `useFieldArrayContext()` напрямую.

### Solution

```tsx
import { useFieldArrayContext } from '@reformer/cdk/field-array';
import { Menu } from '@/ui';

// Полный элемент: модель берёт переданное значение как есть и недостающие ключи не достраивает.
const blankProperty: Property = { type: 'apartment', address: '', estimatedValue: 0 };

function AddPropertyMenu() {
  const { add } = useFieldArrayContext<Property>();

  return (
    <Menu>
      <Menu.Trigger className="btn-primary">+ Добавить имущество ▾</Menu.Trigger>
      <Menu.Content>
        <Menu.Item onSelect={() => add()}>Квартира</Menu.Item>
        <Menu.Item onSelect={() => add({ ...blankProperty, type: 'house' })}>Дом</Menu.Item>
        <Menu.Item onSelect={() => add({ ...blankProperty, type: 'commercial' })}>
          Коммерческое
        </Menu.Item>
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

- Хук работает только внутри `FieldArray.Root` — снаружи бросает `Error: FieldArray.* components must be used within FieldArray.Root or RenderSchema FieldArray`.
- `add()` без аргумента берёт элемент из шаблона массива модели — `createModel({ properties: arrayOf(blankProperty) })` (`arrayOf` из `@reformer/core`); шаблона нет — ошибка. `add(value)` уходит в `control.push(value)` как есть: передавайте элемент целиком (`{ ...blankProperty, type: 'house' }`), частичный объект не дополняется значениями шаблона.
- Если кастомный триггер живёт **снаружи** `Root` (например, в шапке страницы), используйте ref-handle: `useRef<FieldArrayHandle<T>>` + `arrayRef.current?.add(...)` — или сам узел массива: `form.properties.push(...)`.
- Для batch-добавления нескольких элементов вызывайте `add` в цикле — каждый push меняет длину массива и перерисовывает `List`.

## Conditional step in FormWizard

### Problem

Шаг «верификация документов» нужен только для суммы > 1 000 000. Набор шагов потока задаётся в `createForm({ flow })` один раз и потом не меняется, а `FormWizard.Step` сопоставляются шагам потока по позиции. Поэтому условный рендер `{needsVerification && <FormWizard.Step … />}` при потоке сборки ломает соответствие: шаг в потоке остался, а разметки для него нет.

### Solution

Шаг остаётся в потоке, условными становятся его правила и содержимое. Правила шага (и всё, что шаг проверяет при отправке) заворачиваются в `validateWhen`: пока шаг не нужен, его правила не действуют, и «Далее» проходит его без замечаний.

```tsx
import { createForm, type FormGroup } from '@reformer/core';
import { useFormBundle, useFormControlValue } from '@reformer/core/react';
import { defineValidation, validate, validateWhen } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { FormWizard } from '@reformer/cdk/form-wizard';
import { FormField } from '@reformer/ui-kit';

const needsVerification = (amount: number): boolean => amount > 1_000_000;

const verificationRules = defineValidation<CreditForm>(({ model }) => {
  validateWhen(
    () => needsVerification(model.loanAmount),
    () => {
      validate(model.$.passportScan, [required({ code: 'passportScan.required' })]);
    }
  );
});

function VerificationStep({ control }: { control: FormGroup<CreditForm> }) {
  const amount = useFormControlValue(control.loanAmount);
  if (!needsVerification(amount))
    return <p>Для этой суммы верификация не нужна — нажмите «Далее».</p>;
  return <FormField control={control.passportScan} />;
}

function CreditWizard() {
  const bundle = useFormBundle(() =>
    createForm<CreditForm>({
      initial,
      flow: {
        steps: [
          { id: 'loan', rules: loanRules },
          { id: 'contacts', rules: contactsRules },
          { id: 'verification', rules: verificationRules },
          { id: 'confirm' },
        ],
      },
    })
  );

  return (
    <FormWizard form={bundle.form} flow={bundle.flow}>
      <FormWizard.Step component={LoanStep} control={bundle.form} />
      <FormWizard.Step component={ContactsStep} control={bundle.form} />
      <FormWizard.Step component={VerificationStep} control={bundle.form} />
      <FormWizard.Step component={ConfirmStep} control={bundle.form} />
      {/* …Actions… */}
    </FormWizard>
  );
}
```

Если шаг должен именно исчезнуть из нумерации и индикатора — соберите свой поток на нужный набор шагов и передайте его пропом `flow`. Правила шагов при этом берутся из сборки по идентификатору (`bundle.validateStep(id)`), поэтому поток сборки по-прежнему объявляет **все** шаги:

```tsx
import { useMemo } from 'react';
import { createFormFlow, type FormBundle } from '@reformer/core';

const STEP_IDS = ['loan', 'contacts', 'verification', 'confirm'] as const;

function CreditWizard({ bundle }: { bundle: FormBundle<CreditForm> }) {
  const amount = useFormControlValue(bundle.form.loanAmount);
  const withVerification = needsVerification(amount);

  // Новый поток начинает с первого шага, пройденных шагов у него нет.
  const flow = useMemo(
    () =>
      createFormFlow({
        steps: STEP_IDS.filter((id) => id !== 'verification' || withVerification),
        validateStep: bundle.validateStep,
      }),
    [bundle, withVerification]
  );

  return (
    <FormWizard form={bundle.form} flow={flow}>
      <FormWizard.Step component={LoanStep} control={bundle.form} />
      <FormWizard.Step component={ContactsStep} control={bundle.form} />
      {withVerification && <FormWizard.Step component={VerificationStep} control={bundle.form} />}
      <FormWizard.Step component={ConfirmStep} control={bundle.form} />
      {/* …Actions… */}
    </FormWizard>
  );
}
```

### Notes

- **Первый вариант — основной.** Номера шагов, пройденные шаги и правила не сдвигаются: шаг всегда на своём месте, меняется только то, что он проверяет и показывает.
- **`validateWhen` нужен в обоих вариантах.** Полный набор правил отправки (`bundle.submit`) — правила всех шагов потока сборки плюс `extras`; без условия ненужный шаг заблокировал бы отправку.
- **Смена своего потока сбрасывает позицию.** Новый поток стоит на первом шаге без пройденных: условие, от которого зависит набор шагов, держите на первом шаге (пользователь меняет сумму там же, куда поток и вернётся). Колбэк `onStepChange` при смене потока не вызывается. Поведение формы (`defineFormBehavior(({ flow }) => …)`) и `bundle.flow` по-прежнему указывают на поток сборки, а не на свой — переходы оттуда визард этого варианта не увидит.
- **Шаги сопоставляются по позиции**: число и порядок `FormWizard.Step` совпадают с `flow.steps`. Индикатору передавайте массив шагов, построенный из того же списка (`number` — позиция с единицы).
- Позиционный поток (визард без `flow` и без сборки в контексте) тоже пересобирается при смене числа `FormWizard.Step` — с тем же сбросом, — но правил шагов у него нет вовсе.
- Неактивные `FormWizard.Step` возвращают `null`; значения их полей живут в модели независимо от рендера.

## Externally-controlled wizard via `bundle.flow`

### Problem

Кнопка «Сохранить и выйти» лежит вне `FormWizard` (в шапке страницы), нужна программная отправка. Аналогично — переход на шаг по клику в стороннем breadcrumb или после ответа из API.

### Solution

У визарда нет `ref`: он рисует поток сборки, и код снаружи управляет тем же потоком.

```tsx
import { useFormBundle, useFormFlow } from '@reformer/core/react';
import { FormWizard } from '@reformer/cdk/form-wizard';

function Page() {
  // createCreditApplication — createForm({ …, flow: { steps: [{ id: 'loan', … }, …] } })
  const bundle = useFormBundle(() => createCreditApplication());
  const flow = bundle.flow!; // поток объявлен в createForm
  const { current, validating } = useFormFlow(flow);

  const handleSaveAndExit = async () => {
    // Полная проверка, при успехе — обработчик со значениями модели.
    const outcome = await bundle.submit(api.saveDraft);
    if (outcome.status === 'submitted') router.push('/dashboard');
    else if (outcome.status === 'failed') toast('Сервер не принял заявку');
    // 'invalid' — замечания уже видны: поля помечены touched
  };

  const jumpToContacts = () => {
    const transition = flow.goTo('contacts');
    if (transition.status === 'stayed') toast('Сначала заполните предыдущие шаги'); // reason: 'locked'
  };

  return (
    <>
      <header className="flex justify-between p-4 border-b">
        <span>Шаг: {current}</span>
        <button onClick={jumpToContacts} disabled={validating}>
          Перейти к контактам
        </button>
        <button onClick={() => void handleSaveAndExit()}>Сохранить и выйти</button>
      </header>

      <FormWizard form={bundle.form} flow={flow}>
        <FormWizard.Step component={LoanStep} control={bundle.form} />
        <FormWizard.Step component={ApplicantStep} control={bundle.form} />
        <FormWizard.Step component={ContactsStep} control={bundle.form} />
      </FormWizard>
    </>
  );
}
```

### Notes

- Операции потока: `next()` (проверка текущего шага и переход, `Promise<FlowTransition>`), `previous()`, `goTo(id)`, `canGoTo(id)`, `reset()`. Итог перехода — `{ status: 'moved', from, to }` либо `{ status: 'stayed', step, reason, validation? }`, где `reason` — `'invalid' | 'error' | 'cancelled' | 'edge' | 'locked'`.
- `goTo(id)` пускает на первый шаг и на шаг, предыдущий которого пройден; иначе — `stayed` с `reason: 'locked'`. Неизвестный идентификатор — исключение. Чтобы пройти вперёд с проверкой — `await flow.next()`.
- `bundle.submit(handler)` возвращает `SubmitResult`: `submitted` (с `result`), `invalid` / `error` / `cancelled` (с `validation`, обработчик не вызывался) или `failed` (обработчик бросил `error`).
- Переходы снаружи не вызывают `onStepChange` и `scrollToTop` визарда — на смену шага реагируйте через `useFormFlow(flow).current`.
- Из поведения формы — тот же поток: `defineFormBehavior<CreditForm>(({ flow }) => { … flow?.goTo('loan'); })`.
- Внутри дерева визарда то же доступно через `useFormWizard()`: `goToStep(n)` (номер с единицы), `goToNextStep()`, `submit(handler)`.

## See also

- [02-field-array.md](02-field-array.md) — основы FieldArray (compound API, ref-handle).
- [03-form-navigation.md](03-form-navigation.md) — основы FormWizard (поток шагов, Indicator, Actions, Progress).
- [04-form-field.md](04-form-field.md) — компоновка одного поля.
- [07-troubleshooting.md](07-troubleshooting.md) — типичные ошибки и пути их обхода.
