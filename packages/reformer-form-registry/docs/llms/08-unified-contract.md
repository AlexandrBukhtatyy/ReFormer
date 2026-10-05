# Запись единого контракта: документ формата 2 и одно поведение

## Purpose

Реестр форм собирает форму единой сборкой: `createForm` из `@reformer/core` и `FormRenderer` из
`@reformer/renderer-react`. Документ схемы — формата 2, поведение формы одно. Прежний путь
(`createJsonForm` + `JsonFormRenderer` + `renderBehavior`) остаётся для записей, написанных под него.

Формат документа — `reformer://docs/renderer-json`, раздел «JSON-схема: формат 2». Контракт
целиком — раздел «Единый контракт формы» в `reformer://docs/core`.

## Запись

```ts
import type { FormEntry } from '@reformer/form-registry';
import { defineFormBehavior, enableWhen, hideWhen, onComponentEvent } from '@reformer/core/behaviors';

const checkoutBehavior = (options: Record<string, unknown>) =>
  defineFormBehavior<CheckoutForm>(({ model, schema }) => {
    enableWhen(model.$.deliveryAddress, () => model.delivery === 'courier');
    hideWhen(schema.node('courier'), () => model.delivery !== 'courier');
    onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
      const result = await submitOrder(model.get());
      (options.onResult as ((result: unknown) => void) | undefined)?.(result);
    });
  });

export const checkoutEntry: FormEntry<CheckoutForm> = {
  id: 'checkout',
  version: '1.0.0',
  owner: 'mfe-orders',

  schema: { kind: 'http', url: '/forms/checkout.json' }, // документ формата 2
  compatibleSchema: '^1.0.0',

  registry: { kind: 'inline', value: createCheckoutRegistry() },
  model: { kind: 'inline', value: createCheckoutModel },
  behavior: { kind: 'inline', value: checkoutBehavior },
  validation: { kind: 'inline', value: { steps: { delivery: deliveryRules } } },
};
```

Отличия от прежней записи:

- `renderBehavior` нет. Правила узлов (`hideWhen`, `onComponentEvent`, `onMount`) пишутся в том же
  `behavior`, через `schema.node(selector)`.
- `behavior` — поведение либо фабрика `(options) => поведение`
  (`FormBehaviorFactory`). Фабрика получает настройки места монтирования.
- Шаги визарда — дети узла визарда в документе; `selector` шага — ключ его правил в
  `validation.steps`. Форму и валидацию визард берёт из сборки сам.

## Настройки места монтирования

```tsx
<FormOutlet id="checkout" behaviorOptions={{ onResult: showToast }} />
```

Колбэки вроде `onResult` принадлежат хосту, а запись одна на все места, где форму покажут, —
поэтому они приходят пропом и попадают в фабрику поведения аргументом. Без пропа фабрика получает
пустой объект. Фабрика вызывается один раз, при сборке формы.

Прежнее имя пропа — `renderBehaviorOptions` — работает как синоним.

## Документ прежнего формата

Загрузчик (`loadForm`) приводит документ к формату 2 сам — `migrateJsonSchema` на каждой загрузке:

- документ из бандла, по сети и из постоянного кэша обрабатывается одинаково;
- в кэше остаётся ответ сервера: перевод идёт после чтения, а не перед записью. Кэш переживает
  выкладку, и документ, сохранённый прежним кодом, откроется новым;
- исходный объект не мутируется.

Компонент-визард узнаётся по имени в реестре. Имена по умолчанию — `Wizard`,
`RendererFormWizard`, `FormWizard`; свои добавляются опцией:

```tsx
<FormRegistryProvider options={{ stepHosts: STEP_HOSTS }} … />
```

```ts
await loadForm(entry, baseRegistry, { stepHosts: ['Wizard', 'CheckoutStepper'] });
```

Массив держите стабильным по ссылке.

Документ с полем `format`, отличным от `2`, по сети отвергается до кэша (`not-a-form-schema`):
документ выкатили вперёд кода.

## Какой путь выберет монтирование

| Запись | Документ | Что произойдёт |
| --- | --- | --- |
| без `renderBehavior` | формат 2 | единая сборка |
| без `renderBehavior` | прежний формат | документ переводится в формат 2 → единая сборка |
| с `renderBehavior` | прежний формат | прежний путь: `createJsonForm` + `JsonFormRenderer` |
| с `renderBehavior` | формат 2 | `FormLoadError`: поведение написано под прежнюю сборку |

Запись с `renderBehavior` — запись прежнего контракта: её документ не переводится. Чтобы перейти
на единый контракт, перенесите правила узлов в `behavior` и уберите `renderBehavior`.

`LoadedForm.schema` у записи единого контракта — всегда формат 2.

## onReady

```tsx
<FormOutlet id="checkout" onReady={(bundle) => bundle.model.patch(prefill)} />
```

`onReady` получает собранный бандл (`MountedFormBundle`): у записи единого контракта —
`FormBundle` из `createForm` (`{ model, form, validation?, render }`), у записи прежнего контракта —
бандл `createJsonForm`. `model`, `form` и `validation` есть у обоих.

## Preflight и части документа

Проверки идут по корневому дереву и по именованным частям (`parts`):

- имена `$component` / `$dataSource` / `$fn` внутри частей сверяются с реестром;
- селекторы внутри частей считаются известными для ключей `validation.steps`;
- `$part(name)` без объявления в `parts` — `missing-parts` (error), с перечнем объявленных;
- путь `$model(...)` внутри части достраивается от группы, к которой часть подключена:
  `$model(city)` в части, подключённой к `registrationAddress`, проверяется как
  `registrationAddress.city`;
- шаблон строки массива (`item`) против начальных значений не проверяется: его пути относительны
  элементу, а массив на старте обычно пуст.

## Обёртка поля и адаптеры

Обёртку поля (`FIELD_WRAPPER`) сборка берёт из реестра формы — базового, скомпонованного с
расширением записи. Реестр уходит в сборку явно, а не через React-контекст: провайдер хоста и
рендерер ремоута могут жить в разных бандлах.

`resolveFieldAdapter` для компонентов чужого кита по-прежнему задаётся хостом в
`JsonRendererProvider` — монтирование доносит его до рендерера.

## Частые ошибки

| Симптом | Причина |
| --- | --- |
| `документ схемы — формата 2, а запись несёт renderBehavior` | запись прежнего контракта получила новый документ — перенесите правила в `behavior` |
| шаги визарда после перевода остались в `componentProps.steps` | визард зарегистрирован под своим именем — добавьте его в `stepHosts` |
| `missing-parts` | опечатка в `$part(...)` либо часть не объявлена в `parts` |
| `onResult` не вызывается | `behavior` записи — готовое поведение, а не фабрика: настройки места получает только фабрика |
| правило `hideWhen` узла внутри подформы не срабатывает | корневое поведение не видит узлы частей — подключите поведение подформы через `apply(model.$.group, behavior)` |
