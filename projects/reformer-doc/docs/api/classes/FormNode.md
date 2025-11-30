# FormNode

Defined in: [core/nodes/form-node.ts:41](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L41)

Абстрактный базовый класс для всех узлов формы

Все узлы (поля, группы, массивы) наследуют от этого класса
и реализуют единый интерфейс для работы с состоянием и валидацией

Template Method паттерн используется для управления состоянием:
- Общие signals (_touched, _dirty, _status) определены в базовом классе
- Публичные методы (markAsTouched, disable и т.д.) реализованы здесь
- Protected hooks (onMarkAsTouched, onDisable и т.д.) переопределяются в наследниках

## Extended by

- [`FieldNode`](FieldNode.md)
- [`GroupNode`](GroupNode.md)
- [`ArrayNode`](ArrayNode.md)

## Type Parameters

### T

`T`

## Constructors

### Constructor

```ts
new FormNode<T>(): FormNode<T>;
```

#### Returns

`FormNode`\<`T`\>

## Methods

### clearErrors()

```ts
abstract clearErrors(): void;
```

Defined in: [core/nodes/form-node.ts:190](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L190)

Очистить ошибки валидации

#### Returns

`void`

***

### disable()

```ts
disable(): void;
```

Defined in: [core/nodes/form-node.ts:370](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L370)

Отключить узел

Template Method: обновляет статус в базовом классе,
вызывает hook для кастомной логики в наследниках

Отключенные узлы не проходят валидацию и не включаются в getValue()

#### Returns

`void`

***

### dispose()?

```ts
optional dispose(): void;
```

Defined in: [core/nodes/form-node.ts:400](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L400)

Очистить все ресурсы узла
Должен вызываться при unmount компонента для предотвращения memory leaks

#### Returns

`void`

#### Example

```typescript
// React component
useEffect(() => {
  return () => {
    form.dispose(); // Cleanup при unmount
  };
}, []);
```

***

### enable()

```ts
enable(): void;
```

Defined in: [core/nodes/form-node.ts:381](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L381)

Включить узел

Template Method: обновляет статус в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

***

### getErrors()

```ts
getErrors(options?): ValidationError[];
```

Defined in: [core/nodes/form-node.ts:231](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L231)

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

***

### getValue()

```ts
abstract getValue(): T;
```

Defined in: [core/nodes/form-node.ts:146](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L146)

Получить значение узла (non-reactive)
Использует .peek() для получения значения без создания зависимости

#### Returns

`T`

***

### markAsDirty()

```ts
markAsDirty(): void;
```

Defined in: [core/nodes/form-node.ts:313](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L313)

Отметить узел как dirty (значение изменено)

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

***

### markAsPristine()

```ts
markAsPristine(): void;
```

Defined in: [core/nodes/form-node.ts:324](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L324)

Отметить узел как pristine (значение не изменено)

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

***

### markAsTouched()

```ts
markAsTouched(): void;
```

Defined in: [core/nodes/form-node.ts:291](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L291)

Отметить узел как touched (пользователь взаимодействовал)

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

***

### markAsUntouched()

```ts
markAsUntouched(): void;
```

Defined in: [core/nodes/form-node.ts:302](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L302)

Отметить узел как untouched

Template Method: обновляет signal в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

***

### onDisable()

```ts
protected onDisable(): void;
```

Defined in: [core/nodes/form-node.ts:479](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L479)

Hook: вызывается после disable()

Переопределите в наследниках для дополнительной логики:
- GroupNode: отключить все дочерние узлы
- ArrayNode: отключить все элементы массива
- FieldNode: очистить ошибки валидации

#### Returns

`void`

#### Example

```typescript
// GroupNode
protected onDisable(): void {
  this.fields.forEach(field => field.disable());
}
```

***

### onEnable()

```ts
protected onEnable(): void;
```

Defined in: [core/nodes/form-node.ts:491](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L491)

Hook: вызывается после enable()

Переопределите в наследниках для дополнительной логики:
- GroupNode: включить все дочерние узлы
- ArrayNode: включить все элементы массива
- FieldNode: пустая реализация

#### Returns

`void`

***

### onMarkAsDirty()

```ts
protected onMarkAsDirty(): void;
```

Defined in: [core/nodes/form-node.ts:447](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L447)

Hook: вызывается после markAsDirty()

Переопределите в наследниках для дополнительной логики:
- GroupNode: может обновить родительскую форму
- ArrayNode: может обновить родительскую форму
- FieldNode: пустая реализация

#### Returns

`void`

***

### onMarkAsPristine()

```ts
protected onMarkAsPristine(): void;
```

Defined in: [core/nodes/form-node.ts:459](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L459)

Hook: вызывается после markAsPristine()

Переопределите в наследниках для дополнительной логики:
- GroupNode: пометить все дочерние узлы как pristine
- ArrayNode: пометить все элементы массива как pristine
- FieldNode: пустая реализация

#### Returns

`void`

***

### onMarkAsTouched()

```ts
protected onMarkAsTouched(): void;
```

Defined in: [core/nodes/form-node.ts:422](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L422)

Hook: вызывается после markAsTouched()

Переопределите в наследниках для дополнительной логики:
- GroupNode: пометить все дочерние узлы как touched
- ArrayNode: пометить все элементы массива как touched
- FieldNode: пустая реализация (нет дочерних узлов)

#### Returns

`void`

#### Example

```typescript
// GroupNode
protected onMarkAsTouched(): void {
  this.fields.forEach(field => field.markAsTouched());
}
```

***

### onMarkAsUntouched()

```ts
protected onMarkAsUntouched(): void;
```

Defined in: [core/nodes/form-node.ts:435](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L435)

Hook: вызывается после markAsUntouched()

Переопределите в наследниках для дополнительной логики:
- GroupNode: пометить все дочерние узлы как untouched
- ArrayNode: пометить все элементы массива как untouched
- FieldNode: пустая реализация (нет дочерних узлов)

#### Returns

`void`

***

### patchValue()

```ts
abstract patchValue(value): void;
```

Defined in: [core/nodes/form-node.ts:163](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L163)

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

***

### reset()

```ts
abstract reset(value?): void;
```

Defined in: [core/nodes/form-node.ts:169](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L169)

Сбросить узел к начальному состоянию

#### Parameters

##### value?

`T`

опциональное новое начальное значение

#### Returns

`void`

***

### setErrors()

```ts
abstract setErrors(errors): void;
```

Defined in: [core/nodes/form-node.ts:185](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L185)

Установить ошибки валидации извне

#### Parameters

##### errors

[`ValidationError`](../interfaces/ValidationError.md)[]

массив ошибок

#### Returns

`void`

***

### setValue()

```ts
abstract setValue(value, options?): void;
```

Defined in: [core/nodes/form-node.ts:153](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L153)

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

***

### touchAll()

```ts
touchAll(): void;
```

Defined in: [core/nodes/form-node.ts:354](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L354)

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

***

### validate()

```ts
abstract validate(): Promise<boolean>;
```

Defined in: [core/nodes/form-node.ts:179](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L179)

Запустить валидацию узла

#### Returns

`Promise`\<`boolean`\>

`Promise<boolean>` - true если валидация успешна

## Properties

### \_dirty

```ts
protected _dirty: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:56](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L56)

Значение узла было изменено (dirty)
Protected: наследники могут читать/изменять через методы

***

### \_status

```ts
protected _status: Signal<FieldStatus>;
```

Defined in: [core/nodes/form-node.ts:62](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L62)

Текущий статус узла
Protected: наследники могут читать/изменять через методы

***

### \_touched

```ts
protected _touched: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:50](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L50)

Пользователь взаимодействовал с узлом (touched)
Protected: наследники могут читать/изменять через методы

***

### dirty

```ts
readonly dirty: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:83](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L83)

Значение узла было изменено (dirty)
Computed из _dirty для предоставления readonly интерфейса

***

### disabled

```ts
readonly disabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:99](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L99)

Узел отключен (disabled)

***

### enabled

```ts
readonly enabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:104](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L104)

Узел включен (enabled)

***

### errors

```ts
abstract readonly errors: ReadonlySignal<ValidationError[]>;
```

Defined in: [core/nodes/form-node.ts:136](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L136)

Массив ошибок валидации

***

### invalid

```ts
abstract readonly invalid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:126](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L126)

Узел невалиден (есть ошибки валидации)

***

### pending

```ts
abstract readonly pending: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:131](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L131)

Выполняется асинхронная валидация

***

### pristine

```ts
readonly pristine: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:88](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L88)

Значение узла не было изменено (pristine)

***

### status

```ts
readonly status: ReadonlySignal<FieldStatus>;
```

Defined in: [core/nodes/form-node.ts:94](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L94)

Текущий статус узла
Computed из _status для предоставления readonly интерфейса

***

### touched

```ts
readonly touched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:72](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L72)

Пользователь взаимодействовал с узлом (touched)
Computed из _touched для предоставления readonly интерфейса

***

### untouched

```ts
readonly untouched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:77](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L77)

Пользователь не взаимодействовал с узлом (untouched)

***

### valid

```ts
abstract readonly valid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:121](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L121)

Узел валиден (все валидаторы прошли успешно)

***

### value

```ts
abstract readonly value: ReadonlySignal<T>;
```

Defined in: [core/nodes/form-node.ts:116](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/nodes/form-node.ts#L116)

Текущее значение узла
- Для FieldNode: значение поля
- Для GroupNode: объект со значениями всех полей
- Для ArrayNode: массив значений элементов
