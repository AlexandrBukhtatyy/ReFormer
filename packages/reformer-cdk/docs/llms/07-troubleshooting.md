# Troubleshooting / FAQ

Типичные проблемы при использовании `@reformer/cdk` (FormField, FieldArray, FormWizard) с краткими причинами и решениями.

## `FieldArray.AddButton` не появляется на странице

**Причина.** `FieldArray.AddButton` не самостоятельный элемент — он рендерит кнопку только внутри `FieldArray.Root`. Если он вынесен наружу или `Root` не отрендерился (например, под условным `if`), кнопки не будет.

**Решение.** Поместите `AddButton` в дерево `Root` либо вызывайте `useFieldArrayContext().add()` из своей кнопки (см. [06-recipes.md → Custom AddButton](06-recipes.md)).

```tsx
<FieldArray.Root control={form.items}>
  <FieldArray.List>{renderItem}</FieldArray.List>
  <FieldArray.AddButton>+ Добавить</FieldArray.AddButton>
</FieldArray.Root>
```

## `FieldArray.List` ререндерит весь массив при изменении одного элемента

**Причина.** Значение массива производно от значений строк: правка поля в строке меняет `value` массива, `FieldArray.Root` (через `useFormControl(arrayNode)`) перерисовывается, `items` пересобираются, а inline-JSX render-функции создаётся заново для каждой строки.

**Решение.** Вынесите рендер элемента в отдельный компонент, обёрнутый в `React.memo`. Передавайте `control` (стабильный по identity на протяжении жизни строки, в том числе при `move`/`swap`) и `id` для key.

```tsx
const Item = React.memo(({ control }: { control: FormGroup<Property> }) => (
  <PropertyForm control={control} />
));

<FieldArray.List>{({ control, id }) => <Item key={id} control={control} />}</FieldArray.List>;
```

Пересоздаются только объекты `items` (`{ control, index, id, remove, … }`); сами `control` и `id` строк остаются прежними, поэтому `React.memo` по `control` отсекает перерисовку неизменённых строк.

## `goTo` / `goToStep` не переводит на шаг

**Причина.** Поток пускает только на первый шаг и на шаг, предыдущий которого пройден (`flow.canGoTo`). `bundle.flow.goTo(id)` в этом случае возвращает `{ status: 'stayed', reason: 'locked' }`, `goToStep(n)` из `useFormWizard()` и индикатора — `false`. Это защита от пропуска проверки шага. `goToStep(n)` вне диапазона `[1; totalSteps]` тоже даёт `false`, а `goTo` с идентификатором, которого нет в потоке, бросает исключение.

**Решение.**

- Для перехода вперёд с проверкой используйте `await bundle.flow.next()` (или `goToNextStep()` внутри визарда) — он проверит шаг и отметит его пройденным.
- Помните, что возврат назад (`previous()`, `goTo` на более ранний шаг) снимает отметку «пройден» с целевого шага и всех следующих: вперёд их снова придётся пройти через `next()`.
- Номер шага — позиция в `flow.steps` с единицы; `totalSteps === flow.steps.length`.

## Шаг проходится без проверки

**Причина.** Одно из трёх:

1. У шага в `flow.steps` нет `rules` (или `rules: null`) — такой шаг проходит «Далее» без проверки.
2. Визард работает на **позиционном** потоке: ему не передан `flow`, и он отрисован вне сборки (`FormBundleContext`). Позиционный поток строится по числу `FormWizard.Step` и правил не имеет вовсе.
3. Правила шага обёрнуты в `validateWhen`, и условие сейчас ложно.

**Решение.** Объявите шаги и их правила в сборке и передайте поток визарду:

```tsx
const bundle = useFormBundle(() =>
  createForm<CreditForm>({
    initial,
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'personal', rules: personalRules },
        { id: 'confirm' }, // информационный шаг — без правил, явно
      ],
    },
  })
);

<FormWizard form={bundle.form} flow={bundle.flow}>
  …
</FormWizard>;
```

Правила шага — `defineValidation` из `@reformer/core/validation`, стабильные ссылки уровня модуля.

## `useFieldArrayContext` бросает исключение

**Сообщение.** `Error: FieldArray.* components must be used within FieldArray.Root or RenderSchema FieldArray`.

**Причина.** Хук вызван вне дерева `FieldArray.Root`. Часто — в компоненте, который рендерится через портал (Modal, Tooltip), либо рядом с `Root`, а не внутри.

**Решение.** Поместите потребителя внутрь `FieldArray.Root`. Для портала — оберните потребителя ещё одним `Root` с тем же `control`, либо используйте ref-handle `FieldArrayHandle` снаружи.

## `useFormFieldContext` бросает исключение

**Сообщение.** `Error: FormField.* components must be used within <FormField.Root>`.

**Причина.** Тот же сценарий: `FormField.Label` / `Control` / `Error` без обёрнутого `FormField.Root`. Также возникает, если `Root` рендерит `null` (например, когда поле скрыто `enableWhen`) — Label/Error всё равно бросят, если рендерятся параллельно.

**Решение.** Перепроверьте дерево; если поле условное — выносите всю секцию в `if (!visible) return null;` снаружи `FormField.Root`.

## `FormField.Error` не показывает ошибку, хотя `issues.length > 0`

**Причина.** `shouldShowError === false`: поле невалидно, но его не трогали и не меняли. Ошибка видна, когда поле `touched` или `dirty`.

**Решение.**

- Отправляйте через `bundle.submit(handler)`: при замечаниях он помечает тронутыми все поля формы и обработчик не вызывает.
- `bundle.validate()` проверяет всю форму и помечает тронутыми проверенные поля.
- Для живой проверки задайте стратегию сборке: `createForm({ …, validation: { rules, strategy: 'change' } })` (или `'blur'`, `'afterFirstSubmit'`); армирует её `useFormBundle`.

```tsx
const handleSubmit = async () => {
  const outcome = await bundle.submit(api.send);
  if (outcome.status === 'invalid') {
    /* замечания уже видны — поля помечены touched */
  }
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

## Кнопка отправки визарда вызывает обработчик без проверки

**Причина.** Визард отрисован с пропсами `form`/`flow` вне сборки (`FormBundleContext`). В этом режиме `submit.onClick` / `FormWizard.Submit` зовут `onSubmit` из `FormWizard.Actions` сразу по нажатию: проверку делает приложение. Внутри сборки (`FormRenderer`) отправка идёт через `bundle.submit`, и `onSubmit` вызывается только после успешной проверки всей формы.

**Решение.** В режиме пропсов отправляйте через сборку:

```tsx
<FormWizard.Actions onSubmit={() => void bundle.submit(api.send)}>…</FormWizard.Actions>
```

`bundle.submit` проверяет полный набор правил — правила всех шагов плюс `validation.extras` (или `validation.rules`, если он задан), — поэтому отдельно проверять последний шаг не нужно. Флаг `isSubmitting` визарда вне сборки всегда `false`: прогресс отправки берите из `bundle.submitting`.

## `FieldArray.List` теряет focus или ререндерит inputs при `add`/`removeAt`

**Причина.** Используется `index` в качестве React-key. После `removeAt(0)` индексы сдвигаются, React переиспользует DOM-узлы для других данных — фокус «переезжает».

**Решение.** Используйте `id` из item-render-props — стабильный строковый ключ строки (`keyAt(index)` узла массива): он держится за элемент модели и не меняется при `removeAt`, `move` и `swap`.

```tsx
<FieldArray.List>
  {({ control, id }) => (
    <div key={id}>
      {/* ✓ стабильный ключ строки */}
      <ItemForm control={control} />
    </div>
  )}
</FieldArray.List>
```

Сам `FieldArray.List` уже использует `item.id` для ключа `<FieldArrayItemContext.Provider key={item.id}>` — но если внутренний контейнер тоже задаёт key, поставьте `id`, а не `index`. Без компонента массива ключ строки берётся у узла: `form.items.map((row, i) => <Row key={form.items.keyAt(i)} control={row} />)`.

## Ошибки и предупреждения потока шагов

| Сообщение                                                                                                             | Причина и решение                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[@reformer/cdk] FormWizard: no form…`                                                                                | Визард вне сборки и без пропа `form`. Передайте `form={bundle.form}` или отрисуйте визард внутри `FormRenderer`.                                                             |
| `[@reformer/core] createForm:` в `flow.steps` есть шаги, для которых в дереве схемы нет узла с таким `selector` (dev) | Часть идентификаторов шагов не совпала с `selector` узлов шагов в схеме — опечатка в одном из них. Если не совпал ни один, сборка считает, что шаги собраны в JSX, и молчит. |
| `[@reformer/core] createForm: шаг потока «X» повторяется.`                                                            | Два шага с одним `id` в `flow.steps`.                                                                                                                                        |
| `[@reformer/core] createForm: шага «X» нет в потоке.`                                                                 | `bundle.validateStep('X')` с идентификатором, которого нет в `flow.steps`.                                                                                                   |
| `[@reformer/core] FormFlow: шага «X» нет.`                                                                            | `flow.goTo('X')` с неизвестным идентификатором.                                                                                                                              |

## Ref `FieldArrayHandle.length` / `isEmpty` не обновляется

**Причина.** Эти поля snapshot'ятся в `useImperativeHandle` от `arrayState` и пересоздаются при каждом ререндере. Если вы храните `arrayRef.current` в замыкании или в `useEffect` без зависимостей, можете прочитать устаревшее значение.

**Решение.** Читайте `arrayRef.current.length` непосредственно в обработчике, не кешируйте. Для реактивной длины снаружи используйте `useArrayLength(form.items)` или `useFormControl(form.items).length` из `@reformer/core/react` — это даст подписку. Сам узел отдаёт текущую длину числом: `form.items.length`.

## See also

- [01-overview.md](01-overview.md), [04-form-field.md](04-form-field.md), [06-recipes.md](06-recipes.md).
- [@reformer/core troubleshooting](../../../reformer/docs/llms/) — общие проблемы с валидацией и behaviors.
