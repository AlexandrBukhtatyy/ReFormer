# ArrayNode

Defined in: [core/nodes/array-node.ts:44](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L44)

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

`T` *extends* `FormFields`

## Constructors

### Constructor

```ts
new ArrayNode<T>(schema, initialItems): ArrayNode<T>;
```

Defined in: [core/nodes/array-node.ts:84](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L84)

#### Parameters

##### schema

[`FormSchema`](../type-aliases/FormSchema.md)\<`T`\>

##### initialItems

`Partial`\<`T`\>[] = `[]`

#### Returns

`ArrayNode`\<`T`\>

#### Overrides

[`FormNode`](FormNode.md).[`constructor`](FormNode.md#constructor)

## Methods

### applyBehaviorSchema()

```ts
applyBehaviorSchema(schemaFn): void;
```

Defined in: [core/nodes/array-node.ts:459](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L459)

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

Defined in: [core/nodes/array-node.ts:430](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L430)

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

Defined in: [core/nodes/array-node.ts:192](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L192)

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

Defined in: [core/nodes/array-node.ts:183](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L183)

Удалить все элементы массива

#### Returns

`void`

***

### clearErrors()

```ts
clearErrors(): void;
```

Defined in: [core/nodes/array-node.ts:292](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L292)

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

Defined in: [core/nodes/form-node.ts:370](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L370)

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

Defined in: [core/nodes/array-node.ts:572](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L572)

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

Defined in: [core/nodes/form-node.ts:381](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L381)

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

Defined in: [core/nodes/array-node.ts:344](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L344)

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

Defined in: [core/nodes/form-node.ts:231](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L231)

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

Defined in: [core/nodes/array-node.ts:200](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L200)

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

Defined in: [core/nodes/array-node.ts:164](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L164)

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

Defined in: [core/nodes/array-node.ts:355](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L355)

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

Defined in: [core/nodes/form-node.ts:313](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L313)

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

Defined in: [core/nodes/form-node.ts:324](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L324)

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

Defined in: [core/nodes/form-node.ts:291](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L291)

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

Defined in: [core/nodes/form-node.ts:302](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L302)

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

Defined in: [core/nodes/array-node.ts:600](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L600)

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

Defined in: [core/nodes/array-node.ts:622](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L622)

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

Defined in: [core/nodes/array-node.ts:323](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L323)

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

Defined in: [core/nodes/array-node.ts:332](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L332)

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

Defined in: [core/nodes/array-node.ts:305](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L305)

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

Defined in: [core/nodes/array-node.ts:314](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L314)

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

Defined in: [core/nodes/array-node.ts:217](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L217)

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

Defined in: [core/nodes/array-node.ts:137](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L137)

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

Defined in: [core/nodes/array-node.ts:146](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L146)

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

Defined in: [core/nodes/array-node.ts:242](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L242)

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

Defined in: [core/nodes/array-node.ts:277](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L277)

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

Defined in: [core/nodes/array-node.ts:287](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L287)

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

Defined in: [core/nodes/array-node.ts:204](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L204)

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

Defined in: [core/nodes/form-node.ts:354](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L354)

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

Defined in: [core/nodes/array-node.ts:282](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L282)

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

Defined in: [core/nodes/array-node.ts:504](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L504)

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

Defined in: [core/nodes/array-node.ts:548](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L548)

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

## Properties

### \_dirty

```ts
protected _dirty: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:56](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L56)

Значение узла было изменено (dirty)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_dirty`](FormNode.md#_dirty)

***

### \_status

```ts
protected _status: Signal<FieldStatus>;
```

Defined in: [core/nodes/form-node.ts:62](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L62)

Текущий статус узла
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_status`](FormNode.md#_status)

***

### \_touched

```ts
protected _touched: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:50](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L50)

Пользователь взаимодействовал с узлом (touched)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_touched`](FormNode.md#_touched)

***

### dirty

```ts
readonly dirty: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:74](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L74)

Значение узла было изменено (dirty)
Computed из _dirty для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`dirty`](FormNode.md#dirty)

***

### disabled

```ts
readonly disabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:99](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L99)

Узел отключен (disabled)

#### Inherited from

[`FormNode`](FormNode.md).[`disabled`](FormNode.md#disabled)

***

### enabled

```ts
readonly enabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:104](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L104)

Узел включен (enabled)

#### Inherited from

[`FormNode`](FormNode.md).[`enabled`](FormNode.md#enabled)

***

### errors

```ts
readonly errors: ReadonlySignal<ValidationError[]>;
```

Defined in: [core/nodes/array-node.ts:76](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L76)

Массив ошибок валидации

#### Overrides

[`FormNode`](FormNode.md).[`errors`](FormNode.md#errors)

***

### invalid

```ts
readonly invalid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:72](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L72)

Узел невалиден (есть ошибки валидации)

#### Overrides

[`FormNode`](FormNode.md).[`invalid`](FormNode.md#invalid)

***

### length

```ts
readonly length: ReadonlySignal<number>;
```

Defined in: [core/nodes/array-node.ts:78](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L78)

***

### pending

```ts
readonly pending: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:75](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L75)

Выполняется асинхронная валидация

#### Overrides

[`FormNode`](FormNode.md).[`pending`](FormNode.md#pending)

***

### pristine

```ts
readonly pristine: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:88](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L88)

Значение узла не было изменено (pristine)

#### Inherited from

[`FormNode`](FormNode.md).[`pristine`](FormNode.md#pristine)

***

### status

```ts
readonly status: ReadonlySignal<FieldStatus>;
```

Defined in: [core/nodes/array-node.ts:77](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L77)

Текущий статус узла
Computed из _status для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`status`](FormNode.md#status)

***

### touched

```ts
readonly touched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:73](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L73)

Пользователь взаимодействовал с узлом (touched)
Computed из _touched для предоставления readonly интерфейса

#### Overrides

[`FormNode`](FormNode.md).[`touched`](FormNode.md#touched)

***

### untouched

```ts
readonly untouched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:77](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/form-node.ts#L77)

Пользователь не взаимодействовал с узлом (untouched)

#### Inherited from

[`FormNode`](FormNode.md).[`untouched`](FormNode.md#untouched)

***

### valid

```ts
readonly valid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/array-node.ts:71](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L71)

Узел валиден (все валидаторы прошли успешно)

#### Overrides

[`FormNode`](FormNode.md).[`valid`](FormNode.md#valid)

***

### value

```ts
readonly value: ReadonlySignal<T[]>;
```

Defined in: [core/nodes/array-node.ts:70](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/nodes/array-node.ts#L70)

Текущее значение узла
- Для FieldNode: значение поля
- Для GroupNode: объект со значениями всех полей
- Для ArrayNode: массив значений элементов

#### Overrides

[`FormNode`](FormNode.md).[`value`](FormNode.md#value)
