# ArrayNode

Defined in: [core/nodes/array-node.ts:40](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L40)

ArrayNode - массив форм с реактивным состоянием

## Example

```typescript
const array = new ArrayNode({
  title: { value: '', component: Input },
  price: { value: 0, component: Input },
});

array.push({ title: 'Item 1', price: 100 });
array.at(0)?.title.setValue('Updated');
console.log(array.length.value); // 1
```

## Extends

- [`FormNode`](FormNode.md)\<`T`[]\>

## Type Parameters

### T

`T` *extends* [`FormFields`](../type-aliases/FormFields.md)

## Constructors

### Constructor

```ts
new ArrayNode<T>(schema, initialItems): ArrayNode<T>;
```

Defined in: [core/nodes/array-node.ts:80](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L80)

#### Parameters

##### schema

[`FormSchema`](../type-aliases/FormSchema.md)\<`T`\>

##### initialItems

`Partial`\<`T`\>[] = `[]`

#### Returns

`ArrayNode`\<`T`\>

#### Overrides

[`FormNode`](FormNode.md).[`constructor`](FormNode.md#constructor)

## Properties

### \_dirty

```ts
protected _dirty: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:51](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L51)

Значение узла было изменено (dirty)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_dirty`](FormNode.md#_dirty)

***

### \_status

```ts
protected _status: Signal<FieldStatus>;
```

Defined in: [core/nodes/form-node.ts:57](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L57)

Текущий статус узла
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_status`](FormNode.md#_status)

***

### \_touched

```ts
protected _touched: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L45)

Пользователь взаимодействовал с узлом (touched)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_touched`](FormNode.md#_touched)

***

### dirty

```ts
readonly dirty: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:70](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L70)

Значение узла было изменено (dirty)
Computed из _dirty для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`dirty`](FormNode.md#dirty)

***

### disabled

```ts
readonly disabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:94](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L94)

Узел отключен (disabled)

#### Inherited from

[`FormNode`](FormNode.md).[`disabled`](FormNode.md#disabled)

***

### enabled

```ts
readonly enabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:99](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L99)

Узел включен (enabled)

#### Inherited from

[`FormNode`](FormNode.md).[`enabled`](FormNode.md#enabled)

***

### errors

```ts
readonly errors: ReadonlySignal<ValidationError[]>;
```

Defined in: [core/nodes/array-node.ts:72](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L72)

Массив ошибок валидации

#### Overrides

[`FormNode`](FormNode.md).[`errors`](FormNode.md#errors)

***

### invalid

```ts
readonly invalid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:68](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L68)

Узел невалиден (есть ошибки валидации)

#### Overrides

[`FormNode`](FormNode.md).[`invalid`](FormNode.md#invalid)

***

### length

```ts
readonly length: ReadonlySignal<number>;
```

Defined in: [core/nodes/array-node.ts:74](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L74)

***

### pending

```ts
readonly pending: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:71](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L71)

Выполняется асинхронная валидация

#### Overrides

[`FormNode`](FormNode.md).[`pending`](FormNode.md#pending)

***

### pristine

```ts
readonly pristine: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:83](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L83)

Значение узла не было изменено (pristine)

#### Inherited from

[`FormNode`](FormNode.md).[`pristine`](FormNode.md#pristine)

***

### status

```ts
readonly status: ReadonlySignal<FieldStatus>;
```

Defined in: [core/nodes/array-node.ts:73](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L73)

Текущий статус узла
Computed из _status для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`status`](FormNode.md#status)

***

### touched

```ts
readonly touched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:69](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L69)

Пользователь взаимодействовал с узлом (touched)
Computed из _touched для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`touched`](FormNode.md#touched)

***

### untouched

```ts
readonly untouched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:72](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L72)

Пользователь не взаимодействовал с узлом (untouched)

#### Inherited from

[`FormNode`](FormNode.md).[`untouched`](FormNode.md#untouched)

***

### valid

```ts
readonly valid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:67](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L67)

Узел валиден (все валидаторы прошли успешно)

#### Overrides

[`FormNode`](FormNode.md).[`valid`](FormNode.md#valid)

***

### value

```ts
readonly value: ReadonlySignal<T[]>;
```

Defined in: [core/nodes/array-node.ts:66](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L66)

Текущее значение узла
- Для FieldNode: значение поля
- Для GroupNode: объект со значениями всех полей
- Для ArrayNode: массив значений элементов

#### Overrides

[`FormNode`](FormNode.md).[`value`](FormNode.md#value)

## Methods

### applyBehaviorSchema()

```ts
applyBehaviorSchema(schemaFn): void;
```

Defined in: [core/nodes/array-node.ts:455](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L455)

Применить behavior schema ко всем элементам ArrayNode

Автоматически применяется к новым элементам при push/insert.

#### Parameters

##### schemaFn

`unknown`

Behavior schema функция

#### Returns

`void`

#### Example

```typescript
import { addressBehavior } from './behaviors/address-behavior';

form.addresses.applyBehaviorSchema(addressBehavior);
```

***

### applyValidationSchema()

```ts
applyValidationSchema(schemaFn): void;
```

Defined in: [core/nodes/array-node.ts:426](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L426)

Применить validation schema ко всем элементам массива

Validation schema будет применена к:
- Всем существующим элементам
- Всем новым элементам, добавляемым через push/insert

#### Parameters

##### schemaFn

`unknown`

Функция валидации для элемента массива

#### Returns

`void`

#### Example

```typescript
import { propertyValidation } from './validation/property-validation';

form.properties.applyValidationSchema(propertyValidation);
```

***

### at()

```ts
at(index): any;
```

Defined in: [core/nodes/array-node.ts:188](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L188)

Получить элемент по индексу

#### Parameters

##### index

`number`

Индекс элемента

#### Returns

`any`

Типизированный GroupNode или undefined если индекс вне границ

***

### clear()

```ts
clear(): void;
```

Defined in: [core/nodes/array-node.ts:179](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L179)

Удалить все элементы массива

#### Returns

`void`

***

### clearErrors()

```ts
clearErrors(): void;
```

Defined in: [core/nodes/array-node.ts:288](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L288)

Очистить ошибки валидации

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`clearErrors`](FormNode.md#clearerrors)

***

### disable()

```ts
disable(): void;
```

Defined in: [core/nodes/form-node.ts:365](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L365)

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

Defined in: [core/nodes/array-node.ts:568](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L568)

Очистить все ресурсы узла
Рекурсивно очищает все subscriptions и элементы массива

#### Returns

`void`

#### Example

```typescript
useEffect(() => {
  return () => {
    arrayNode.dispose();
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

Defined in: [core/nodes/form-node.ts:376](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L376)

Включить узел

Template Method: обновляет статус в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`enable`](FormNode.md#enable)

***

### forEach()

```ts
forEach(callback): void;
```

Defined in: [core/nodes/array-node.ts:340](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L340)

Итерировать по элементам массива

#### Parameters

##### callback

(`item`, `index`) => `void`

Функция, вызываемая для каждого элемента с типизированным GroupNode

#### Returns

`void`

***

### getErrors()

```ts
getErrors(options?): ValidationError[];
```

Defined in: [core/nodes/form-node.ts:226](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L226)

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

### getValue()

```ts
getValue(): T[];
```

Defined in: [core/nodes/array-node.ts:196](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L196)

Получить значение узла (non-reactive)
Использует .peek() для получения значения без создания зависимости

#### Returns

`T`[]

#### Overrides

[`FormNode`](FormNode.md).[`getValue`](FormNode.md#getvalue)

***

### insert()

```ts
insert(index, initialValue?): void;
```

Defined in: [core/nodes/array-node.ts:160](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L160)

Вставить элемент в массив

#### Parameters

##### index

`number`

Индекс для вставки

##### initialValue?

`Partial`\<`T`\>

Начальные значения для нового элемента

#### Returns

`void`

***

### map()

```ts
map<R>(callback): R[];
```

Defined in: [core/nodes/array-node.ts:351](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L351)

Маппинг элементов массива

#### Type Parameters

##### R

`R`

#### Parameters

##### callback

(`item`, `index`) => `R`

Функция преобразования с типизированным GroupNode

#### Returns

`R`[]

Новый массив результатов

***

### markAsDirty()

```ts
markAsDirty(): void;
```

Defined in: [core/nodes/form-node.ts:308](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L308)

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

Defined in: [core/nodes/form-node.ts:319](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L319)

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

Defined in: [core/nodes/form-node.ts:286](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L286)

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

Defined in: [core/nodes/form-node.ts:297](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L297)

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

Defined in: [core/nodes/array-node.ts:596](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L596)

Hook: вызывается после disable()

Для ArrayNode: рекурсивно отключаем все элементы массива

#### Returns

`void`

#### Example

```typescript
// Отключить весь массив полей
form.items.disable();

// Все элементы становятся disabled
form.items.forEach(item => {
  console.log(item.status.value); // 'disabled'
});
```

#### Overrides

[`FormNode`](FormNode.md).[`onDisable`](FormNode.md#ondisable)

***

### onEnable()

```ts
protected onEnable(): void;
```

Defined in: [core/nodes/array-node.ts:618](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L618)

Hook: вызывается после enable()

Для ArrayNode: рекурсивно включаем все элементы массива

#### Returns

`void`

#### Example

```typescript
// Включить весь массив полей
form.items.enable();

// Все элементы становятся enabled
form.items.forEach(item => {
  console.log(item.status.value); // 'valid' или 'invalid'
});
```

#### Overrides

[`FormNode`](FormNode.md).[`onEnable`](FormNode.md#onenable)

***

### onMarkAsDirty()

```ts
protected onMarkAsDirty(): void;
```

Defined in: [core/nodes/array-node.ts:319](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L319)

Hook: вызывается после markAsDirty()

Для ArrayNode: рекурсивно помечаем все элементы массива как dirty

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsDirty`](FormNode.md#onmarkasdirty)

***

### onMarkAsPristine()

```ts
protected onMarkAsPristine(): void;
```

Defined in: [core/nodes/array-node.ts:328](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L328)

Hook: вызывается после markAsPristine()

Для ArrayNode: рекурсивно помечаем все элементы массива как pristine

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsPristine`](FormNode.md#onmarkaspristine)

***

### onMarkAsTouched()

```ts
protected onMarkAsTouched(): void;
```

Defined in: [core/nodes/array-node.ts:301](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L301)

Hook: вызывается после markAsTouched()

Для ArrayNode: рекурсивно помечаем все элементы массива как touched

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsTouched`](FormNode.md#onmarkastouched)

***

### onMarkAsUntouched()

```ts
protected onMarkAsUntouched(): void;
```

Defined in: [core/nodes/array-node.ts:310](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L310)

Hook: вызывается после markAsUntouched()

Для ArrayNode: рекурсивно помечаем все элементы массива как untouched

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsUntouched`](FormNode.md#onmarkasuntouched)

***

### patchValue()

```ts
patchValue(values): void;
```

Defined in: [core/nodes/array-node.ts:213](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L213)

Частично обновить значение узла
Для FieldNode: работает как setValue
Для GroupNode: обновляет только указанные поля
Для ArrayNode: обновляет только указанные элементы

#### Parameters

##### values

(`T` \| `undefined`)[]

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`patchValue`](FormNode.md#patchvalue)

***

### push()

```ts
push(initialValue?): void;
```

Defined in: [core/nodes/array-node.ts:133](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L133)

Добавить элемент в конец массива

#### Parameters

##### initialValue?

`Partial`\<`T`\>

Начальные значения для нового элемента

#### Returns

`void`

***

### removeAt()

```ts
removeAt(index): void;
```

Defined in: [core/nodes/array-node.ts:142](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L142)

Удалить элемент по индексу

#### Parameters

##### index

`number`

Индекс элемента для удаления

#### Returns

`void`

***

### reset()

```ts
reset(values?): void;
```

Defined in: [core/nodes/array-node.ts:238](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L238)

Сбросить массив к указанным значениям (или очистить)

#### Parameters

##### values?

`T`[]

опциональный массив значений для сброса

#### Returns

`void`

#### Remarks

Очищает текущий массив и заполняет новыми элементами

#### Example

```typescript
// Очистить массив
arrayNode.reset();

// Сбросить к новым значениям
arrayNode.reset([{ name: 'Item 1' }, { name: 'Item 2' }]);
```

#### Overrides

[`FormNode`](FormNode.md).[`reset`](FormNode.md#reset)

***

### resetToInitial()

```ts
resetToInitial(): void;
```

Defined in: [core/nodes/array-node.ts:273](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L273)

Сбросить массив к исходным значениям (initialItems)

#### Returns

`void`

#### Remarks

Восстанавливает массив в состояние, которое было при создании ArrayNode.
Более явный способ сброса к начальным значениям по сравнению с reset()

Полезно когда:
- Пользователь нажал "Cancel" - вернуть массив к исходным элементам
- Массив был изменен через reset(newValues), но нужно вернуться к началу
- Явное намерение показать "отмена всех изменений"

#### Example

```typescript
const arrayNode = new ArrayNode(
  { name: { value: '', component: Input } },
  [{ name: 'Initial 1' }, { name: 'Initial 2' }]
);

arrayNode.push({ name: 'New Item' });
arrayNode.reset([{ name: 'Temp' }]);
console.log(arrayNode.length.value); // 1

arrayNode.resetToInitial();
console.log(arrayNode.length.value); // 2
console.log(arrayNode.at(0)?.name.value.value); // 'Initial 1'
```

***

### setErrors()

```ts
setErrors(_errors): void;
```

Defined in: [core/nodes/array-node.ts:283](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L283)

Установить ошибки валидации извне

#### Parameters

##### \_errors

[`ValidationError`](../interfaces/ValidationError.md)[]

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`setErrors`](FormNode.md#seterrors)

***

### setValue()

```ts
setValue(values, options?): void;
```

Defined in: [core/nodes/array-node.ts:200](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L200)

Установить значение узла

#### Parameters

##### values

`T`[]

##### options?

[`SetValueOptions`](../interfaces/SetValueOptions.md)

опции установки значения

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`setValue`](FormNode.md#setvalue)

***

### touchAll()

```ts
touchAll(): void;
```

Defined in: [core/nodes/form-node.ts:349](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/form-node.ts#L349)

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

Defined in: [core/nodes/array-node.ts:278](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L278)

Запустить валидацию узла

#### Returns

`Promise`\<`boolean`\>

`Promise<boolean>` - true если валидация успешна

#### Overrides

[`FormNode`](FormNode.md).[`validate`](FormNode.md#validate)

***

### watchItems()

```ts
watchItems<K>(fieldKey, callback): () => void;
```

Defined in: [core/nodes/array-node.ts:500](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L500)

Подписка на изменения конкретного поля во всех элементах массива
Срабатывает при изменении значения поля в любом элементе

#### Type Parameters

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### fieldKey

`K`

Ключ поля для отслеживания

##### callback

(`values`) => `void` \| `Promise`\<`void`\>

Функция, вызываемая при изменении, получает массив всех значений и индекс измененного элемента

#### Returns

Функция отписки для cleanup

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
// Автоматический пересчет общей стоимости при изменении цен
const dispose = form.existingLoans.watchItems(
  'remainingAmount',
  (amounts) => {
    const totalDebt = amounts.reduce((sum, amount) => sum + (amount || 0), 0);
    form.totalDebt.setValue(totalDebt);
  }
);

// При изменении любого remainingAmount → пересчитается totalDebt
form.existingLoans.at(0)?.remainingAmount.setValue(500000);

// Cleanup
useEffect(() => dispose, []);
```

***

### watchLength()

```ts
watchLength(callback): () => void;
```

Defined in: [core/nodes/array-node.ts:544](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/nodes/array-node.ts#L544)

Подписка на изменение длины массива
Срабатывает при добавлении/удалении элементов

#### Parameters

##### callback

(`length`) => `void` \| `Promise`\<`void`\>

Функция, вызываемая при изменении длины, получает новую длину

#### Returns

Функция отписки для cleanup

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
// Обновление счетчика элементов в UI
const dispose = form.properties.watchLength((length) => {
  console.log(`Количество объектов недвижимости: ${length}`);
  form.propertyCount.setValue(length);
});

form.properties.push({ title: 'Квартира', value: 5000000 });
// Выведет: "Количество объектов недвижимости: 1"

// Cleanup
useEffect(() => dispose, []);
```
