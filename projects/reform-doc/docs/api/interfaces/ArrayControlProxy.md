# Interface: ArrayControlProxy\<T\>

Defined in: [core/types/deep-schema.ts:217](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L217)

Интерфейс для ArrayProxy (массивы форм)

Предоставляет массивоподобный API с дополнительными возможностями
для управления динамическим списком форм

## Example

```typescript
// Добавить элемент
form.controls.items.push({ title: 'New item' });

// Удалить элемент
form.controls.items.remove(0);

// Вставить элемент
form.controls.items.insert(1, { title: 'Inserted' });

// Доступ по индексу
form.controls.items[0].title.value = 'Updated';

// Итерация
form.controls.items.forEach((item, i) => {
  console.log(item.title.value);
});

// Маппинг
const titles = form.controls.items.map((item) => item.title.value);
```

## Type Parameters

### T

`T` _extends_ [`FormFields`](../type-aliases/FormFields.md)

## Indexable

\[`index`: `number`\]: [`DeepControls`](../type-aliases/DeepControls.md)\<`T`\> & [`GroupControlProxy`](GroupControlProxy.md)\<`T`\>

Доступ к элементу массива по индексу
Возвращает Proxy с доступом к полям элемента

## Properties

### errors

> **errors**: [`ValidationError`](ValidationError.md)[]

Defined in: [core/types/deep-schema.ts:255](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L255)

Все ошибки валидации в массиве

---

### invalid

> **invalid**: `boolean`

Defined in: [core/types/deep-schema.ts:250](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L250)

Хотя бы один элемент массива невалиден

---

### items

> **items**: `ReadonlySignal`\<[`DeepControls`](../type-aliases/DeepControls.md)\<`T`\> & [`GroupControlProxy`](GroupControlProxy.md)\<`T`\>[]\>

Defined in: [core/types/deep-schema.ts:240](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L240)

Массив всех элементов (реактивный)

---

### length

> **length**: `ReadonlySignal`\<`number`\>

Defined in: [core/types/deep-schema.ts:235](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L235)

Количество элементов в массиве (реактивное)

---

### valid

> **valid**: `boolean`

Defined in: [core/types/deep-schema.ts:245](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L245)

Все элементы массива валидны

## Methods

### at()

> **at**(`index`): [`DeepControls`](../type-aliases/DeepControls.md)\<`T`\> & [`GroupControlProxy`](GroupControlProxy.md)\<`T`\> \| `undefined`

Defined in: [core/types/deep-schema.ts:292](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L292)

Получить элемент по индексу (безопасный доступ)

#### Parameters

##### index

`number`

Индекс элемента

#### Returns

[`DeepControls`](../type-aliases/DeepControls.md)\<`T`\> & [`GroupControlProxy`](GroupControlProxy.md)\<`T`\> \| `undefined`

Элемент или undefined если индекс вне границ

---

### clear()

> **clear**(): `void`

Defined in: [core/types/deep-schema.ts:285](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L285)

Удалить все элементы массива

#### Returns

`void`

---

### forEach()

> **forEach**(`callback`): `void`

Defined in: [core/types/deep-schema.ts:302](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L302)

Итерировать по элементам массива

#### Parameters

##### callback

(`item`, `index`) => `void`

Функция, вызываемая для каждого элемента

#### Returns

`void`

---

### getValue()

> **getValue**(): `T`[]

Defined in: [core/types/deep-schema.ts:323](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L323)

Получить значения всех элементов массива

#### Returns

`T`[]

---

### insert()

> **insert**(`index`, `value?`): `void`

Defined in: [core/types/deep-schema.ts:280](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L280)

Вставить элемент в массив
Автоматически сдвигает индексы последующих элементов

#### Parameters

##### index

`number`

Индекс для вставки

##### value?

`Partial`\<`T`\>

Начальные значения для нового элемента

#### Returns

`void`

---

### map()

> **map**\<`R`\>(`callback`): `R`[]

Defined in: [core/types/deep-schema.ts:309](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L309)

Маппинг элементов массива

#### Type Parameters

##### R

`R`

#### Parameters

##### callback

(`item`, `index`) => `R`

Функция преобразования

#### Returns

`R`[]

Новый массив результатов

---

### markAsTouched()

> **markAsTouched**(): `void`

Defined in: [core/types/deep-schema.ts:334](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L334)

Пометить все элементы как touched

#### Returns

`void`

---

### push()

> **push**(`value?`): `void`

Defined in: [core/types/deep-schema.ts:265](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L265)

Добавить элемент в конец массива

#### Parameters

##### value?

`Partial`\<`T`\>

Начальные значения для нового элемента

#### Returns

`void`

---

### remove()

> **remove**(`index`): `void`

Defined in: [core/types/deep-schema.ts:272](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L272)

Удалить элемент по индексу
Автоматически переиндексирует оставшиеся элементы

#### Parameters

##### index

`number`

Индекс элемента для удаления

#### Returns

`void`

---

### reset()

> **reset**(): `void`

Defined in: [core/types/deep-schema.ts:339](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L339)

Сбросить все элементы к начальным значениям

#### Returns

`void`

---

### setValue()

> **setValue**(`values`): `void`

Defined in: [core/types/deep-schema.ts:329](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L329)

Установить значения элементов массива
Удаляет существующие элементы и создает новые

#### Parameters

##### values

`Partial`\<`T`\>[]

#### Returns

`void`

---

### validate()

> **validate**(): `Promise`\<`boolean`\>

Defined in: [core/types/deep-schema.ts:318](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L318)

Валидировать все элементы массива

#### Returns

`Promise`\<`boolean`\>
