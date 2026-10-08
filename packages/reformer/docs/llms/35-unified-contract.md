# Единый контракт формы — одна схема, одна сборка, одно поведение

## Purpose

Форма описывается одинаково для всех способов реализации — разметка в JSX, рендерер по TS-схеме,
рендерер по JSON. Схема одна (дерево узлов), привязка одна (ручка `model.$.…`), сборка одна
(`createForm`), поведение одно (`defineFormBehavior`). Способы отличаются только видом схемы
(билдер или документ) и тем, кто рисует результат.

Прежние записи узла — ключи `value` / `array` и запись «имя поля → узел» — удалены: тип узла
закрыт, сборка их не читает. Удалены и оператор `each`, свободный `cross` и имя `createCoreForm`:
их заменяют `applyEach` со схемой строки, `cross` из аргумента схемы и `createForm`.

| Слой      | поле                              | массив под-форм                           | подформа                              |
| --------- | --------------------------------- | ----------------------------------------- | ------------------------------------- |
| схема     | `{ model: model.$.x, component }` | `{ model: model.$.items, item }`          | `{ model: model.$.group, part }`      |
| валидация | `validate(model.$.x, rules)`      | `applyEach(model.$.items, itemRules)`     | `apply(model.$.group, groupRules)`    |
| поведение | `compute(model.$.x, …)`           | `applyEach(model.$.items, itemBehavior)`  | `apply(model.$.group, groupBehavior)` |

Правило привязки: `model.$.…` — привязка (схема, правило, оператор). Без `$` — чтение значения
(`model.loanType === 'mortgage'`), мутация (`model.items.push()`) и под-модель как область.

## Модель — начальные значения и шаблоны элементов

```typescript
import { arrayOf, createModel } from '@reformer/core';

const blankPhone = (): Phone => ({ number: '' });
const blankCoBorrower = (): CoBorrower => ({ name: '', phones: arrayOf(blankPhone) });

export const createCreditModel = () =>
  createModel<CreditForm>({
    loanType: 'consumer',
    registrationAddress: { city: '', street: '' },
    coBorrowers: arrayOf(blankCoBorrower), // пустой массив + шаблон нового элемента
    tags: [], // массив как одно значение поля — шаблон не нужен
  });
```

`arrayOf(blank, items?)` возвращает обычный массив `U[]` и запоминает фабрику нового элемента.
После этого `push()` и `insertAt(i)` без значения кладут элемент по шаблону — в модели, в ноде
массива формы и в кнопке «Добавить» секции массива.

- Шаблон переживает `set` / `patch` / `reset` модели.
- Вложенный массив объявляется внутри шаблона элемента; элементы, пришедшие обычными данными
  (загрузка с сервера), получают его шаблон из шаблона родителя.
- У массива без шаблона `push()` без значения бросает ошибку с подсказкой.
- Шаблон привязан к самому массиву: до `createModel` его нельзя копировать. `structuredClone`,
  `JSON.parse(JSON.stringify(…))` и `[...array]` отдают массив без шаблона. Начальные значения с
  `arrayOf` держат в фабрике, а не в константе, которую клонируют.

## Схема — одно дерево

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';

// подформа: объявлена один раз, получает под-модель
const address = (model: FormModel<Address>): FormSchemaNode => ({
  component: Box,
  children: [
    { model: model.$.city, component: Input, componentProps: { label: 'Город' } },
    { model: model.$.street, component: Input, componentProps: { label: 'Улица' } },
  ],
});

// строка массива — такая же функция от под-модели
const coBorrower = (model: FormModel<CoBorrower>): FormSchemaNode => ({
  selector: 'co-borrower',
  component: Box,
  children: [{ model: model.$.name, component: Input, componentProps: { label: 'ФИО' } }],
});

export const creditSchema = (model: FormModel<CreditForm>): FormSchemaNode => ({
  component: Box,
  children: [
    { model: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип' } }, // поле
    { model: model.$.tags, component: SelectMulti }, // массив как одно значение
    {
      selector: 'registration',
      component: Section,
      componentProps: { title: 'Адрес регистрации' },
      children: [{ model: model.$.registrationAddress, part: address }], // подформа
    },
    { model: model.$.coBorrowers, component: FormArray, item: coBorrower }, // массив под-форм
  ],
});
```

Чем узел является, решают ручка и соседние ключи:

| Узел            | Как отличить                                  |
| --------------- | --------------------------------------------- |
| поле            | `model` — лист или массив; нет `item`, `part` |
| массив под-форм | `model` — массив, `item` — функция            |
| подформа        | `model` — группа, `part` — функция            |
| контейнер       | есть `children`, нет `model`                  |

- Тип узла `FormSchemaNode` закрыт: опечатка в ключе, группа без `part`, `item` не на массиве и
  привязка value-фасадом (`model: model.email`) не компилируются.
- Вложенные узлы читаются только из `children` и из поддерева `part`. В `componentProps` и под
  произвольными ключами сборка не заглядывает; в dev она предупреждает о ключах узла, которые не
  читает.
- Вид ноды формы определяет узел модели, а не имя: поле данных может называться `value`, `schema`,
  `form`, `model` или `children`.
- Поля подформы принадлежат той же форме: `form.registrationAddress.city`.
- Билдер `item` / `part` вызывается один раз на под-модель; сборка и рендерер получают одно и то
  же поддерево (`schemaSubtree(builder, subModel)`).
- `initialValue` узла-массива — запасной шаблон нового элемента для форм, чья модель создаётся из
  данных без кода. Шаблон модели (`arrayOf`) главнее.

## Валидация — подформа и массив подключаются привязкой

```typescript
import {
  apply,
  applyEach,
  defineValidationSchema,
  validate,
  validateWhen,
} from '@reformer/core/validation';

const addressRules = defineValidationSchema<Address>(({ model, cross }) => {
  validate(model.$.city, [required()]);
  // cross — из аргумента схемы: снимок области (Address) выведен, приведения не нужны
  cross(model.$.street, (address) =>
    address.city !== '' && address.street === '' ? streetRequired : null
  );
});

const coBorrowerRules = defineValidationSchema<CoBorrower>(({ model }) => {
  validate(model.$.name, [required()]);
});

export const contactsRules = defineValidationSchema<CreditForm>(({ model }) => {
  apply(model.$.registrationAddress, addressRules);
  validateWhen(
    () => !model.sameAsRegistration,
    () => apply(model.$.residenceAddress, addressRules)
  );
  applyEach(model.$.coBorrowers, coBorrowerRules);
});
```

- У схемы, подключённой через `apply(ручка, схема)` / `applyEach`, своя область: `model` — под-модель,
  `cross` из аргумента схемы получает её снимок. Захватывать снимок в замыкание не нужно.
- Одна и та же схема подключается и к группе, и к элементам массива.
- `apply(model.$.a, rules)` принимает и массив ручек: `apply([model.$.a, model.$.b], rules)`.
- `apply(schemaA, schemaB)` — композиция схем над той же моделью — остаётся.
- Правило значения — `Rule<T> = (value: T) => ValidationError | null`: один аргумент. Тип значения
  сверяется с типом поля; набор правил объявляют типом поля (`Rule<LoanType>[]`,
  `Rule<number | null>[]`).
- `ValidationError.message` необязателен: без него текст берётся из словаря локали по коду.
- `cross` берётся только из аргумента схемы: свободного оператора с таким именем в
  `@reformer/core/validation` нет. Нет и `each` — правила строки подключает `applyEach`.

### Результат прогона

```typescript
const result = await credit.validation.runAll(); // либо runStep('loan'), runValidation(model, rules)
// result.status: 'valid' | 'invalid' | 'error' | 'cancelled'
// result.errors: Map<ручка поля, ошибки>;  result.failures: правила, не вернувшие результат
```

- `validateAll()` / `validateStep()` / `validateModel()` отвечают `boolean`: `true` только для `valid`.
- **Сбой async-правила блокирует**: статус `error`, на поле — ошибка `{ code: 'ruleFailed' }`.
- Отменённый прогон (`cancelled`) по нодам не разносится.
- Пока идут async-правила поля, его нода в `pending`; `validation.validating` — идёт ли прогон.
- `form.validate()` / `form.submit()` правил не запускают: они отражают ошибки, которые разнёс раннер.

## Поведение — модель, форма и схема

```typescript
import {
  apply,
  applyEach,
  defineFormBehavior,
  enableWhen,
  hideWhen,
  onComponentEvent,
  onMount,
} from '@reformer/core/behaviors';

const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
  hideWhen(schema.node('street'), () => model.city === ''); // узел ищется внутри части
});

export const creditBehavior = defineFormBehavior<CreditForm>(({ model, form, schema }) => {
  const isMortgage = () => model.loanType === 'mortgage';

  enableWhen(model.$.propertyValue, isMortgage, { resetOnDisable: true });
  hideWhen(schema.node('mortgage'), () => !isMortgage());
  onComponentEvent(schema.node('wizard'), 'onSubmit', () => submitApplication(model.get()));
  onMount(schema.node('data-boundary'), () => void loadApplication(model));

  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
  applyEach(model.$.coBorrowers, coBorrowerBehavior);
});
```

Операторы узлов схемы:

| Оператор                                  | Что записывает                                             |
| ----------------------------------------- | ---------------------------------------------------------- |
| `hideWhen(node, condition)`               | узел скрыт, пока условие истинно                           |
| `onComponentEvent(node, event, handler)`  | обработчик пропа-события компонента                        |
| `onMount(node, fn)` / `onUnmount(node, fn)` | хуки монтирования узла                                   |
| `onInit(node, fn)`                        | `fn` вызывается сразу, до первого рендера                  |
| `renderEffect(schema, fn)`                | реактивный эффект, пока схема области смонтирована         |
| `schema.node(sel).setHidden / patchProps` | принудительная видимость и пропсы узла                     |
| `schema.node(sel).getRef()`               | ref на компонент узла — объект `{ current }`               |

- **Области изолированы.** `schema.node(selector)` ищет узел только в своей области: корневое
  поведение — в корневом дереве, поведение подформы и строки массива — в своём поддереве. До узла
  строки или части корень дотягивается через `applyEach` / `apply`. Два монтирования одной части
  не конфликтуют.
- **Исключение — ref по пути модели**: `schema.node('phones.0.number').getRef()` ищется от корня.
- **Операторы узлов только записывают правило — исполняет его рендерер.** При разметке в JSX они
  ничего не делают: видимость, отправка и загрузка данных остаются в JSX.
- Правило на селектор, которого нет в дереве, ничего не делает; в dev — предупреждение.

## Сборка — `createForm`

```tsx
import { createForm, useFormBundle } from '@reformer/core';

const credit = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(), // либо initial: { … }
    schema: creditSchema, // (model) => узел; для JSON — документ + registry
    behavior: creditBehavior,
    validation: { steps: { loan: loanRules, contacts: contactsRules }, extras: crossRules },
  })
);
// credit = { model, form, validation, render }

<FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />; // рендерер
<FormField control={credit.form.loanType} />; // разметка в JSX — та же сборка
```

- Порядок: модель → `seed` → дерево схемы → ноды формы → поведение → валидация → `setup`. Дерево
  строится один раз. Ноды строятся по виду узла модели: лист и массив-значение — `FieldNode`,
  группа — `GroupNode`, массив под-форм — `ModelArrayNode`.
- В dev сборка проверяет селекторы корневого дерева: повтор `selector`, правило поведения на узел,
  которого нет, и ключ `validation.steps` без шага с таким `selector` дают предупреждение.
- `validation` в бандле типизирована по конфигу: правила переданы — поле есть всегда.
- `render` — `{ tree, controller, node(selector) }`: готовое дерево и схема-контроллер сборки.
- JSON: `createForm({ model, schema: document, registry })` — дерево собирает
  `registry.resolveSchema`. Ядро документ не разбирает.
- Внутри рендерера бандл доступен компонентам через `useFormBundleContext()` — так визард берёт
  форму и валидацию сам.

### Низкоуровневая фабрика

`createFormFromModel({ model, schema })` — форма из модели и готового дерева, без бандла.

Формы без модели нет: значения принадлежат модели. `createForm` без `model` и `initial` либо с
готовым деревом вместо билдера бросает ошибку с подсказкой.

## Частые ошибки

| Ошибка                                             | Как правильно                                           |
| -------------------------------------------------- | ------------------------------------------------------- |
| `model: model.address` (под-модель у поля)         | `model: model.$.address.city` — привязка всегда с `$`   |
| `{ model: model.$.address, component }` без `part` | группа полем не бывает — нужен `part`                   |
| `createForm({ model, schema: дерево })`            | `schema` — билдер `(model) => узел`                     |
| `hideWhen(schema.node('row-узел'), …)` из корня    | внутри `applyEach(model.$.items, itemBehavior)`         |
| `push({})` для новой строки                        | `arrayOf(blank)` в модели и `push()` без значения       |
| `createModel(structuredClone(INITIAL))` с `arrayOf` | фабрика начальных значений — клон теряет шаблон массива |
| `cross` в подформе читает корень                   | `apply(model.$.group, rules)` — область подформы        |
| `{ value: model.$.x }`, `{ array: model.items }`   | `{ model: model.$.x }`, `{ model: model.$.items, item }` |
| узлы записью `{ email: { model, component } }`     | `{ children: [{ model, component }] }`                  |
| `Rule<unknown>[]` и `(form: Root)` с приведением   | `Rule<ТипПоля>[]`, `cross` из аргумента схемы           |
| `try { … } catch { return null }` в async-правиле «на всякий случай» | сбой правила блокирует сам; `catch` — только если проверка необязательна |
