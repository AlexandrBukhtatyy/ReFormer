# GroupNode

Defined in: [core/nodes/group-node.ts:78](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L78)

GroupNode - узел для группы полей

Поддерживает два API:
1. Старый API (только schema) - обратная совместимость
2. Новый API (config с form, behavior, validation) - автоматическое применение схем

## Example

```typescript
// 1. Старый способ (обратная совместимость)
const simpleForm = new GroupNode({
  email: { value: '', component: Input },
  password: { value: '', component: Input },
});

// 2. Новый способ (с behavior и validation схемами)
const fullForm = new GroupNode({
  form: {
    email: { value: '', component: Input },
    password: { value: '', component: Input },
  },
  behavior: (path) => {
    computeFrom(path.email, [path.email], (values) => values[0]?.trim());
  },
  validation: (path) => {
    required(path.email, { message: 'Email обязателен' });
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
  },
});

// Прямой доступ к полям через Proxy
fullForm.email.setValue('test@mail.com');
await fullForm.validate();
console.log(fullForm.valid.value); // true
```

## Extends

- [`FormNode`](FormNode.md)\<`T`\>

## Type Parameters

### T

`T`

## Constructors

### Constructor

```ts
new GroupNode<T>(schema): GroupNode<T>;
```

Defined in: [core/nodes/group-node.ts:176](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L176)

Создать GroupNode только со схемой формы (обратная совместимость)

#### Parameters

##### schema

[`FormSchema`](../type-aliases/FormSchema.md)\<`T`\>

#### Returns

`GroupNode`\<`T`\>

#### Overrides

[`FormNode`](FormNode.md).[`constructor`](FormNode.md#constructor)

### Constructor

```ts
new GroupNode<T>(config): GroupNode<T>;
```

Defined in: [core/nodes/group-node.ts:181](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L181)

Создать GroupNode с полной конфигурацией (form, behavior, validation)

#### Parameters

##### config

[`GroupNodeConfig`](../interfaces/GroupNodeConfig.md)\<`T`\>

#### Returns

`GroupNode`\<`T`\>

#### Overrides

```ts
FormNode<T>.constructor
```

## Properties

### \_dirty

```ts
protected _dirty: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:51](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L51)

Значение узла было изменено (dirty)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_dirty`](FormNode.md#_dirty)

***

### \_status

```ts
protected _status: Signal<FieldStatus>;
```

Defined in: [core/nodes/form-node.ts:57](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L57)

Текущий статус узла
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_status`](FormNode.md#_status)

***

### \_touched

```ts
protected _touched: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L45)

Пользователь взаимодействовал с узлом (touched)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_touched`](FormNode.md#_touched)

***

### dirty

```ts
readonly dirty: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/group-node.ts:163](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L163)

Значение узла было изменено (dirty)
Computed из _dirty для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`dirty`](FormNode.md#dirty)

***

### disabled

```ts
readonly disabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:94](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L94)

Узел отключен (disabled)

#### Inherited from

[`FormNode`](FormNode.md).[`disabled`](FormNode.md#disabled)

***

### enabled

```ts
readonly enabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:99](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L99)

Узел включен (enabled)

#### Inherited from

[`FormNode`](FormNode.md).[`enabled`](FormNode.md#enabled)

***

### errors

```ts
readonly errors: ReadonlySignal<ValidationError[]>;
```

Defined in: [core/nodes/group-node.ts:165](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L165)

Массив ошибок валидации

#### Overrides

[`FormNode`](FormNode.md).[`errors`](FormNode.md#errors)

***

### id

```ts
id: string;
```

Defined in: [core/nodes/group-node.ts:82](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L82)

***

### invalid

```ts
readonly invalid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/group-node.ts:161](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L161)

Узел невалиден (есть ошибки валидации)

#### Overrides

[`FormNode`](FormNode.md).[`invalid`](FormNode.md#invalid)

***

### pending

```ts
readonly pending: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/group-node.ts:164](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L164)

Выполняется асинхронная валидация

#### Overrides

[`FormNode`](FormNode.md).[`pending`](FormNode.md#pending)

***

### pristine

```ts
readonly pristine: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:83](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L83)

Значение узла не было изменено (pristine)

#### Inherited from

[`FormNode`](FormNode.md).[`pristine`](FormNode.md#pristine)

***

### status

```ts
readonly status: ReadonlySignal<FieldStatus>;
```

Defined in: [core/nodes/group-node.ts:166](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L166)

Текущий статус узла
Computed из _status для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`status`](FormNode.md#status)

***

### submitting

```ts
readonly submitting: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/group-node.ts:167](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L167)

***

### touched

```ts
readonly touched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/group-node.ts:162](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L162)

Пользователь взаимодействовал с узлом (touched)
Computed из _touched для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`touched`](FormNode.md#touched)

***

### untouched

```ts
readonly untouched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:72](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L72)

Пользователь не взаимодействовал с узлом (untouched)

#### Inherited from

[`FormNode`](FormNode.md).[`untouched`](FormNode.md#untouched)

***

### valid

```ts
readonly valid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/group-node.ts:160](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L160)

Узел валиден (все валидаторы прошли успешно)

#### Overrides

[`FormNode`](FormNode.md).[`valid`](FormNode.md#valid)

***

### value

```ts
readonly value: ReadonlySignal<T>;
```

Defined in: [core/nodes/group-node.ts:159](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L159)

Текущее значение узла
- Для FieldNode: значение поля
- Для GroupNode: объект со значениями всех полей
- Для ArrayNode: массив значений элементов

#### Overrides

[`FormNode`](FormNode.md).[`value`](FormNode.md#value)

## Accessors

### fields

#### Get Signature

```ts
get fields(): FieldRegistry<T>;
```

Defined in: [core/nodes/group-node.ts:418](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L418)

Получить Map всех полей формы

Используется в FieldPathNavigator для навигации по полям

##### Returns

`FieldRegistry`\<`T`\>

Map полей формы

## Methods

### applyBehaviorSchema()

```ts
applyBehaviorSchema(schemaFn): () => void;
```

Defined in: [core/nodes/group-node.ts:595](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L595)

Применить behavior schema к форме

✅ РЕФАКТОРИНГ: Делегирование BehaviorApplicator (SRP)

Логика применения behavior схемы извлечена в BehaviorApplicator для:
- Соблюдения Single Responsibility Principle
- Уменьшения размера GroupNode (~50 строк)
- Улучшения тестируемости
- Консистентности с ValidationApplicator

#### Parameters

##### schemaFn

`BehaviorSchemaFn`\<`T`\>

Функция описания поведения формы

#### Returns

Функция cleanup для отписки от всех behaviors

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
import { copyFrom, enableWhen, computeFrom } from '@/lib/forms/core/behaviors';

const behaviorSchema: BehaviorSchemaFn<MyForm> = (path) => {
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true
  });

  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage');

  computeFrom(
    path.initialPayment,
    [path.propertyValue],
    (propertyValue) => propertyValue ? propertyValue * 0.2 : null
  );
};

const cleanup = form.applyBehaviorSchema(behaviorSchema);

// Cleanup при unmount
useEffect(() => cleanup, []);
```

***

### applyContextualValidators()

```ts
applyContextualValidators(validators): Promise<void>;
```

Defined in: [core/nodes/group-node.ts:685](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L685)

Применить contextual валидаторы к полям

✅ РЕФАКТОРИНГ: Делегирование ValidationApplicator (SRP)

Логика применения валидаторов извлечена в ValidationApplicator для:
- Соблюдения Single Responsibility Principle
- Уменьшения размера GroupNode (~120 строк)
- Улучшения тестируемости

#### Parameters

##### validators

[`ValidatorRegistration`](../interfaces/ValidatorRegistration.md)[]

Зарегистрированные валидаторы

#### Returns

`Promise`\<`void`\>

***

### applyValidationSchema()

```ts
applyValidationSchema(schemaFn): void;
```

Defined in: [core/nodes/group-node.ts:542](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L542)

Применить validation schema к форме

Использует локальный реестр валидаторов (this.validationRegistry)
вместо глобального Singleton для изоляции форм друг от друга.

#### Parameters

##### schemaFn

[`ValidationSchemaFn`](../type-aliases/ValidationSchemaFn.md)\<`T`\>

#### Returns

`void`

***

### clearErrors()

```ts
clearErrors(): void;
```

Defined in: [core/nodes/group-node.ts:383](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L383)

Очистить все errors (form-level + field-level)

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`clearErrors`](FormNode.md#clearerrors)

***

### disable()

```ts
disable(): void;
```

Defined in: [core/nodes/form-node.ts:365](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L365)

Отключить узел

Template Method: обновляет статус в базовом классе,
вызывает hook для кастомной логики в наследниках

Отключенные узлы не проходят валидацию и не включаются в getValue()

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`disable`](FormNode.md#disable)

***

### dispose()

```ts
dispose(): void;
```

Defined in: [core/nodes/group-node.ts:867](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L867)

Очистить все ресурсы узла
Рекурсивно очищает все subscriptions и дочерние узлы

#### Returns

`void`

#### Example

```typescript
useEffect(() => {
  return () => {
    form.dispose();
  };
}, []);
```

#### Overrides

[`FormNode`](FormNode.md).[`dispose`](FormNode.md#dispose)

***

### enable()

```ts
enable(): void;
```

Defined in: [core/nodes/form-node.ts:376](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L376)

Включить узел

Template Method: обновляет статус в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`enable`](FormNode.md#enable)

***

### getAllFields()

```ts
getAllFields(): IterableIterator<FormNode<FormValue>>;
```

Defined in: [core/nodes/group-node.ts:467](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L467)

Получить все поля формы как итератор

Предоставляет доступ к внутренним полям для валидации и других операций

#### Returns

`IterableIterator`\<[`FormNode`](FormNode.md)\<[`FormValue`](../type-aliases/FormValue.md)\>\>

Итератор по всем полям формы

#### Example

```typescript
// Валидация всех полей
await Promise.all(
  Array.from(form.getAllFields()).map(field => field.validate())
);
```

***

### getErrors()

```ts
getErrors(options?): ValidationError[];
```

Defined in: [core/nodes/form-node.ts:226](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L226)

Получить ошибки валидации с фильтрацией

Позволяет фильтровать ошибки по различным критериям:
- По коду ошибки
- По сообщению (частичное совпадение)
- По параметрам
- Через кастомный предикат

Без параметров возвращает все ошибки (эквивалент errors.value)

#### Parameters

##### options?

[`ErrorFilterOptions`](../interfaces/ErrorFilterOptions.md)

Опции фильтрации ошибок

#### Returns

[`ValidationError`](../interfaces/ValidationError.md)[]

Отфильтрованный массив ошибок валидации

#### Example

```typescript
// Все ошибки
const allErrors = form.getErrors();

// Ошибки с конкретным кодом
const requiredErrors = form.getErrors({ code: 'required' });

// Ошибки с несколькими кодами
const errors = form.getErrors({ code: ['required', 'email'] });

// Ошибки по сообщению
const passwordErrors = form.getErrors({ message: 'Password' });

// Ошибки по параметрам
const minLengthErrors = form.getErrors({
  params: { minLength: 8 }
});

// Кастомная фильтрация
const customErrors = form.getErrors({
  predicate: (err) => err.code.startsWith('custom_')
});
```

#### Inherited from

[`FormNode`](FormNode.md).[`getErrors`](FormNode.md#geterrors)

***

### getField()

```ts
getField<K>(key): FormNode<T[K]> | undefined;
```

Defined in: [core/nodes/group-node.ts:407](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L407)

Получить поле по ключу

Публичный метод для доступа к полю из fieldRegistry

#### Type Parameters

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### key

`K`

Ключ поля

#### Returns

[`FormNode`](FormNode.md)\<`T`\[`K`\]\> \| `undefined`

FormNode или undefined, если поле не найдено

#### Example

```typescript
const emailField = form.getField('email');
if (emailField) {
  console.log(emailField.value.value);
}
```

***

### getFieldByPath()

```ts
getFieldByPath(path): 
  | FormNode<FormValue>
  | undefined;
```

Defined in: [core/nodes/group-node.ts:628](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L628)

Получить вложенное поле по пути

Поддерживаемые форматы путей:
- Simple: "email" - получить поле верхнего уровня
- Nested: "address.city" - получить вложенное поле
- Array index: "items[0]" - получить элемент массива по индексу
- Combined: "items[0].name" - получить поле элемента массива

#### Parameters

##### path

`string`

Путь к полю

#### Returns

  \| [`FormNode`](FormNode.md)\<[`FormValue`](../type-aliases/FormValue.md)\>
  \| `undefined`

FormNode если найдено, undefined если путь не существует

#### Example

```typescript
const form = new GroupNode({
  email: { value: '', component: Input },
  address: {
    city: { value: '', component: Input }
  },
  items: [{ name: { value: '', component: Input } }]
});

form.getFieldByPath('email');           // FieldNode
form.getFieldByPath('address.city');    // FieldNode
form.getFieldByPath('items[0]');        // GroupNode
form.getFieldByPath('items[0].name');   // FieldNode
form.getFieldByPath('invalid.path');    // undefined
```

***

### getProxy()

```ts
getProxy(): any;
```

Defined in: [core/nodes/group-node.ts:448](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L448)

Получить Proxy-инстанс для прямого доступа к полям

Proxy позволяет обращаться к полям формы напрямую через точечную нотацию:
- form.email вместо form.fields.get('email')
- form.address.city вместо form.fields.get('address').fields.get('city')

Используется в:
- BehaviorApplicator для доступа к полям в behavior functions
- ValidationApplicator для доступа к форме в tree validators

#### Returns

`any`

Proxy-инстанс с типобезопасным доступом к полям или сама форма, если proxy не доступен

#### Example

```typescript
const form = new GroupNode({
  controls: {
    email: new FieldNode({ value: '' }),
    name: new FieldNode({ value: '' })
  }
});

const proxy = form.getProxy();
console.log(proxy.email.value); // Прямой доступ к полю
```

***

### getValue()

```ts
getValue(): T;
```

Defined in: [core/nodes/group-node.ts:248](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L248)

Получить значение узла (non-reactive)
Использует .peek() для получения значения без создания зависимости

#### Returns

`T`

#### Overrides

[`FormNode`](FormNode.md).[`getValue`](FormNode.md#getvalue)

***

### linkFields()

```ts
linkFields<K1, K2>(
   sourceKey, 
   targetKey, 
   transform?): () => void;
```

Defined in: [core/nodes/group-node.ts:744](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L744)

Связывает два поля: при изменении source автоматически обновляется target
Поддерживает опциональную трансформацию значения

#### Type Parameters

##### K1

`K1` *extends* `string` \| `number` \| `symbol`

##### K2

`K2` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### sourceKey

`K1`

Ключ поля-источника

##### targetKey

`K2`

Ключ поля-цели

##### transform?

(`value`) => `T`\[`K2`\]

Опциональная функция трансформации значения

#### Returns

Функция отписки для cleanup

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
// Автоматический расчет минимального взноса от стоимости недвижимости
const dispose = form.linkFields(
  'propertyValue',
  'initialPayment',
  (propertyValue) => propertyValue ? propertyValue * 0.2 : null
);

// При изменении propertyValue → автоматически обновится initialPayment
form.propertyValue.setValue(1000000);
// initialPayment станет 200000

// Cleanup
useEffect(() => dispose, []);
```

***

### markAsDirty()

```ts
markAsDirty(): void;
```

Defined in: [core/nodes/form-node.ts:308](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L308)

Отметить узел как dirty (значение изменено)

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`markAsDirty`](FormNode.md#markasdirty)

***

### markAsPristine()

```ts
markAsPristine(): void;
```

Defined in: [core/nodes/form-node.ts:319](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L319)

Отметить узел как pristine (значение не изменено)

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`markAsPristine`](FormNode.md#markaspristine)

***

### markAsTouched()

```ts
markAsTouched(): void;
```

Defined in: [core/nodes/form-node.ts:286](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L286)

Отметить узел как touched (пользователь взаимодействовал)

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`markAsTouched`](FormNode.md#markastouched)

***

### markAsUntouched()

```ts
markAsUntouched(): void;
```

Defined in: [core/nodes/form-node.ts:297](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L297)

Отметить узел как untouched

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`markAsUntouched`](FormNode.md#markasuntouched)

***

### onDisable()

```ts
protected onDisable(): void;
```

Defined in: [core/nodes/group-node.ts:831](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L831)

Hook: вызывается после disable()

Для GroupNode: рекурсивно отключаем все дочерние поля

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onDisable`](FormNode.md#ondisable)

***

### onEnable()

```ts
protected onEnable(): void;
```

Defined in: [core/nodes/group-node.ts:845](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L845)

Hook: вызывается после enable()

Для GroupNode: рекурсивно включаем все дочерние поля

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onEnable`](FormNode.md#onenable)

***

### onMarkAsDirty()

```ts
protected onMarkAsDirty(): void;
```

Defined in: [core/nodes/group-node.ts:498](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L498)

Hook: вызывается после markAsDirty()

Для GroupNode: рекурсивно помечаем все дочерние поля как dirty

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsDirty`](FormNode.md#onmarkasdirty)

***

### onMarkAsPristine()

```ts
protected onMarkAsPristine(): void;
```

Defined in: [core/nodes/group-node.ts:507](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L507)

Hook: вызывается после markAsPristine()

Для GroupNode: рекурсивно помечаем все дочерние поля как pristine

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsPristine`](FormNode.md#onmarkaspristine)

***

### onMarkAsTouched()

```ts
protected onMarkAsTouched(): void;
```

Defined in: [core/nodes/group-node.ts:480](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L480)

Hook: вызывается после markAsTouched()

Для GroupNode: рекурсивно помечаем все дочерние поля как touched

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsTouched`](FormNode.md#onmarkastouched)

***

### onMarkAsUntouched()

```ts
protected onMarkAsUntouched(): void;
```

Defined in: [core/nodes/group-node.ts:489](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L489)

Hook: вызывается после markAsUntouched()

Для GroupNode: рекурсивно помечаем все дочерние поля как untouched

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsUntouched`](FormNode.md#onmarkasuntouched)

***

### patchValue()

```ts
patchValue(value): void;
```

Defined in: [core/nodes/group-node.ts:268](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L268)

Частично обновить значение узла
Для FieldNode: работает как setValue
Для GroupNode: обновляет только указанные поля
Для ArrayNode: обновляет только указанные элементы

#### Parameters

##### value

`Partial`\<`T`\>

частичное значение для обновления

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`patchValue`](FormNode.md#patchvalue)

***

### reset()

```ts
reset(value?): void;
```

Defined in: [core/nodes/group-node.ts:295](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L295)

Сбросить форму к указанным значениям (или к initialValues)

#### Parameters

##### value?

`T`

опциональный объект со значениями для сброса

#### Returns

`void`

#### Remarks

Рекурсивно вызывает reset() для всех полей формы

#### Example

```typescript
// Сброс к initialValues
form.reset();

// Сброс к новым значениям
form.reset({ email: 'new@mail.com', password: '' });
```

#### Overrides

[`FormNode`](FormNode.md).[`reset`](FormNode.md#reset)

***

### resetToInitial()

```ts
resetToInitial(): void;
```

Defined in: [core/nodes/group-node.ts:330](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L330)

Сбросить форму к исходным значениям (initialValues)

#### Returns

`void`

#### Remarks

Рекурсивно вызывает resetToInitial() для всех полей формы.
Более явный способ сброса к начальным значениям по сравнению с reset()

Полезно когда:
- Пользователь нажал "Cancel" - полная отмена изменений
- Форма была изменена через reset(newValues), но нужно вернуться к самому началу
- Явное намерение показать "отмена всех изменений"

#### Example

```typescript
const form = new GroupNode({
  email: { value: 'initial@mail.com', component: Input },
  name: { value: 'John', component: Input }
});

form.email.setValue('changed@mail.com');
form.reset({ email: 'temp@mail.com', name: 'Jane' });
console.log(form.getValue()); // { email: 'temp@mail.com', name: 'Jane' }

form.resetToInitial();
console.log(form.getValue()); // { email: 'initial@mail.com', name: 'John' }
```

***

### setErrors()

```ts
setErrors(errors): void;
```

Defined in: [core/nodes/group-node.ts:376](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L376)

Установить form-level validation errors
Используется для server-side validation или кросс-полевых ошибок

#### Parameters

##### errors

[`ValidationError`](../interfaces/ValidationError.md)[]

массив ошибок уровня формы

#### Returns

`void`

#### Example

```typescript
// Server-side validation после submit
try {
  await api.createUser(form.getValue());
} catch (error) {
  form.setErrors([
    { code: 'duplicate_email', message: 'Email уже используется' }
  ]);
}
```

#### Overrides

[`FormNode`](FormNode.md).[`setErrors`](FormNode.md#seterrors)

***

### setValue()

```ts
setValue(value, options?): void;
```

Defined in: [core/nodes/group-node.ts:257](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L257)

Установить значение узла

#### Parameters

##### value

`T`

новое значение

##### options?

[`SetValueOptions`](../interfaces/SetValueOptions.md)

опции установки значения

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`setValue`](FormNode.md#setvalue)

***

### submit()

```ts
submit<R>(onSubmit): Promise<R | null>;
```

Defined in: [core/nodes/group-node.ts:519](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L519)

Отправить форму
Валидирует форму и вызывает onSubmit если форма валидна

#### Type Parameters

##### R

`R`

#### Parameters

##### onSubmit

(`values`) => `R` \| `Promise`\<`R`\>

#### Returns

`Promise`\<`R` \| `null`\>

***

### touchAll()

```ts
touchAll(): void;
```

Defined in: [core/nodes/form-node.ts:349](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/form-node.ts#L349)

Пометить все поля (включая вложенные) как touched
Алиас для markAsTouched(), но более явно показывает намерение
пометить ВСЕ поля рекурсивно

Полезно для:
- Показа всех ошибок валидации перед submit
- Принудительного отображения ошибок при нажатии "Validate All"
- Отображения невалидных полей в wizard/step form

#### Returns

`void`

#### Example

```typescript
// Показать все ошибки перед submit
form.touchAll();
const isValid = await form.validate();
if (!isValid) {
  // Все ошибки теперь видны пользователю
}

// Или использовать submit() который уже вызывает touchAll
await form.submit(async (values) => {
  await api.save(values);
});
```

#### Inherited from

[`FormNode`](FormNode.md).[`touchAll`](FormNode.md#touchall)

***

### validate()

```ts
validate(): Promise<boolean>;
```

Defined in: [core/nodes/group-node.ts:340](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L340)

Запустить валидацию узла

#### Returns

`Promise`\<`boolean`\>

`Promise<boolean>` - true если валидация успешна

#### Overrides

[`FormNode`](FormNode.md).[`validate`](FormNode.md#validate)

***

### watchField()

```ts
watchField<K>(fieldPath, callback): () => void;
```

Defined in: [core/nodes/group-node.ts:802](https://github.com/AlexandrBukhtatyy/ReFormer/blob/81b4edf889773afad8bd14cea3a7a05de464964e/packages/reformer/src/core/nodes/group-node.ts#L802)

Подписка на изменения вложенного поля по строковому пути
Поддерживает вложенные пути типа "address.city"

#### Type Parameters

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### fieldPath

`K` *extends* `string` ? `K`\<`K`\> : `string`

Строковый путь к полю (например, "address.city")

##### callback

(`value`) => `void` \| `Promise`\<`void`\>

Функция, вызываемая при изменении поля

#### Returns

Функция отписки для cleanup

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
// Подписка на изменение страны для загрузки городов
const dispose = form.watchField(
  'registrationAddress.country',
  async (countryCode) => {
    if (countryCode) {
      const cities = await fetchCitiesByCountry(countryCode);
      form.registrationAddress.city.updateComponentProps({
        options: cities
      });
    }
  }
);

// Cleanup
useEffect(() => dispose, []);
```
