# FieldNode

Defined in: [core/nodes/field-node.ts:32](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L32)

FieldNode - узел для отдельного поля формы

## Example

```typescript
const field = new FieldNode({
  value: '',
  component: Input,
  validators: [required, email],
});

field.setValue('test@mail.com');
await field.validate();
console.log(field.valid.value); // true
```

## Extends

- [`FormNode`](FormNode.md)\<`T`\>

## Type Parameters

### T

`T`

## Constructors

### Constructor

```ts
new FieldNode<T>(config): FieldNode<T>;
```

Defined in: [core/nodes/field-node.ts:88](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L88)

#### Parameters

##### config

[`FieldConfig`](../interfaces/FieldConfig.md)\<`T`\>

#### Returns

`FieldNode`\<`T`\>

#### Overrides

[`FormNode`](FormNode.md).[`constructor`](FormNode.md#constructor)

## Properties

### \_dirty

```ts
protected _dirty: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:51](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L51)

Значение узла было изменено (dirty)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_dirty`](FormNode.md#_dirty)

***

### \_status

```ts
protected _status: Signal<FieldStatus>;
```

Defined in: [core/nodes/form-node.ts:57](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L57)

Текущий статус узла
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_status`](FormNode.md#_status)

***

### \_touched

```ts
protected _touched: Signal<boolean>;
```

Defined in: [core/nodes/form-node.ts:45](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L45)

Пользователь взаимодействовал с узлом (touched)
Protected: наследники могут читать/изменять через методы

#### Inherited from

[`FormNode`](FormNode.md).[`_touched`](FormNode.md#_touched)

***

### component

```ts
readonly component: ComponentType<any>;
```

Defined in: [core/nodes/field-node.ts:82](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L82)

***

### componentProps

```ts
readonly componentProps: ReadonlySignal<Record<string, any>>;
```

Defined in: [core/nodes/field-node.ts:55](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L55)

***

### dirty

```ts
readonly dirty: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:78](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L78)

Значение узла было изменено (dirty)
Computed из _dirty для предоставления readonly интерфейса

#### Inherited from

[`FormNode`](FormNode.md).[`dirty`](FormNode.md#dirty)

***

### disabled

```ts
readonly disabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:94](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L94)

Узел отключен (disabled)

#### Inherited from

[`FormNode`](FormNode.md).[`disabled`](FormNode.md#disabled)

***

### enabled

```ts
readonly enabled: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:99](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L99)

Узел включен (enabled)

#### Inherited from

[`FormNode`](FormNode.md).[`enabled`](FormNode.md#enabled)

***

### errors

```ts
readonly errors: ReadonlySignal<ValidationError[]>;
```

Defined in: [core/nodes/field-node.ts:53](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L53)

Массив ошибок валидации

#### Overrides

[`FormNode`](FormNode.md).[`errors`](FormNode.md#errors)

***

### invalid

```ts
readonly invalid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/field-node.ts:50](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L50)

Узел невалиден (есть ошибки валидации)

#### Overrides

[`FormNode`](FormNode.md).[`invalid`](FormNode.md#invalid)

***

### pending

```ts
readonly pending: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/field-node.ts:52](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L52)

Выполняется асинхронная валидация

#### Overrides

[`FormNode`](FormNode.md).[`pending`](FormNode.md#pending)

***

### pristine

```ts
readonly pristine: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:83](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L83)

Значение узла не было изменено (pristine)

#### Inherited from

[`FormNode`](FormNode.md).[`pristine`](FormNode.md#pristine)

***

### shouldShowError

```ts
readonly shouldShowError: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/field-node.ts:61](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L61)

Вычисляемое свойство: нужно ли показывать ошибку
Ошибка показывается если поле невалидно И (touched ИЛИ dirty)

***

### status

```ts
readonly status: ReadonlySignal<FieldStatus>;
```

Defined in: [core/nodes/form-node.ts:89](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L89)

Текущий статус узла
Computed из _status для предоставления readonly интерфейса

#### Inherited from

[`FormNode`](FormNode.md).[`status`](FormNode.md#status)

***

### touched

```ts
readonly touched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:67](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L67)

Пользователь взаимодействовал с узлом (touched)
Computed из _touched для предоставления readonly интерфейса

#### Inherited from

[`FormNode`](FormNode.md).[`touched`](FormNode.md#touched)

***

### untouched

```ts
readonly untouched: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/form-node.ts:72](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L72)

Пользователь не взаимодействовал с узлом (untouched)

#### Inherited from

[`FormNode`](FormNode.md).[`untouched`](FormNode.md#untouched)

***

### valid

```ts
readonly valid: ReadonlySignal<boolean>;
```

Defined in: [core/nodes/field-node.ts:49](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L49)

Узел валиден (все валидаторы прошли успешно)

#### Overrides

[`FormNode`](FormNode.md).[`valid`](FormNode.md#valid)

***

### value

```ts
readonly value: ReadonlySignal<T>;
```

Defined in: [core/nodes/field-node.ts:48](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L48)

Текущее значение узла
- Для FieldNode: значение поля
- Для GroupNode: объект со значениями всех полей
- Для ArrayNode: массив значений элементов

#### Overrides

[`FormNode`](FormNode.md).[`value`](FormNode.md#value)

## Methods

### clearErrors()

```ts
clearErrors(): void;
```

Defined in: [core/nodes/field-node.ts:391](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L391)

Очистить ошибки валидации

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`clearErrors`](FormNode.md#clearerrors)

***

### computeFrom()

```ts
computeFrom<TSource>(sources, computeFn): () => void;
```

Defined in: [core/nodes/field-node.ts:542](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L542)

Вычисляемое значение из других полей
Автоматически обновляет текущее поле при изменении источников

#### Type Parameters

##### TSource

`TSource` *extends* readonly `unknown`[]

#### Parameters

##### sources

`ReadonlySignal`\<`TSource`\[`number`\]\>[]

Массив ReadonlySignal для отслеживания

##### computeFn

(...`values`) => `T`

Функция вычисления нового значения

#### Returns

Функция отписки для cleanup

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
// Автоматический расчет первоначального взноса (20% от стоимости)
const dispose = form.initialPayment.computeFrom(
  [form.propertyValue.value],
  (propertyValue) => {
    return propertyValue ? propertyValue * 0.2 : null;
  }
);

// Cleanup
useEffect(() => dispose, []);
```

***

### disable()

```ts
disable(): void;
```

Defined in: [core/nodes/form-node.ts:365](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L365)

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

Defined in: [core/nodes/field-node.ts:576](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L576)

Очистить все ресурсы и таймеры
Должен вызываться при unmount компонента

#### Returns

`void`

#### Example

```typescript
useEffect(() => {
  return () => {
    field.dispose();
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

Defined in: [core/nodes/form-node.ts:376](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L376)

Включить узел

Template Method: обновляет статус в базовом классе,
вызывает hook для кастомной логики в наследниках

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`enable`](FormNode.md#enable)

***

### getErrors()

```ts
getErrors(options?): ValidationError[];
```

Defined in: [core/nodes/form-node.ts:226](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L226)

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

### getUpdateOn()

```ts
getUpdateOn(): "change" | "blur" | "submit";
```

Defined in: [core/nodes/field-node.ts:484](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L484)

#### Returns

`"change"` \| `"blur"` \| `"submit"`

***

### getValue()

```ts
getValue(): T;
```

Defined in: [core/nodes/field-node.ts:130](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L130)

Получить значение узла (non-reactive)
Использует .peek() для получения значения без создания зависимости

#### Returns

`T`

#### Overrides

[`FormNode`](FormNode.md).[`getValue`](FormNode.md#getvalue)

***

### markAsDirty()

```ts
markAsDirty(): void;
```

Defined in: [core/nodes/form-node.ts:308](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L308)

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

Defined in: [core/nodes/form-node.ts:319](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L319)

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

Defined in: [core/nodes/form-node.ts:286](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L286)

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

Defined in: [core/nodes/form-node.ts:297](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L297)

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

Defined in: [core/nodes/field-node.ts:416](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L416)

Hook: вызывается после disable()

Для FieldNode: очищаем ошибки валидации

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onDisable`](FormNode.md#ondisable)

***

### onEnable()

```ts
protected onEnable(): void;
```

Defined in: [core/nodes/field-node.ts:425](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L425)

Hook: вызывается после enable()

Для FieldNode: запускаем валидацию

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onEnable`](FormNode.md#onenable)

***

### onMarkAsDirty()

```ts
protected onMarkAsDirty(): void;
```

Defined in: [core/nodes/form-node.ts:442](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L442)

Hook: вызывается после markAsDirty()

Переопределите в наследниках для дополнительной логики:
- GroupNode: может обновить родительскую форму
- ArrayNode: может обновить родительскую форму
- FieldNode: пустая реализация

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`onMarkAsDirty`](FormNode.md#onmarkasdirty)

***

### onMarkAsPristine()

```ts
protected onMarkAsPristine(): void;
```

Defined in: [core/nodes/form-node.ts:454](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L454)

Hook: вызывается после markAsPristine()

Переопределите в наследниках для дополнительной логики:
- GroupNode: пометить все дочерние узлы как pristine
- ArrayNode: пометить все элементы массива как pristine
- FieldNode: пустая реализация

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`onMarkAsPristine`](FormNode.md#onmarkaspristine)

***

### onMarkAsTouched()

```ts
protected onMarkAsTouched(): void;
```

Defined in: [core/nodes/field-node.ts:405](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L405)

Hook: вызывается после markAsTouched()

Для FieldNode: если updateOn === 'blur', запускаем валидацию

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`onMarkAsTouched`](FormNode.md#onmarkastouched)

***

### onMarkAsUntouched()

```ts
protected onMarkAsUntouched(): void;
```

Defined in: [core/nodes/form-node.ts:430](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L430)

Hook: вызывается после markAsUntouched()

Переопределите в наследниках для дополнительной логики:
- GroupNode: пометить все дочерние узлы как untouched
- ArrayNode: пометить все элементы массива как untouched
- FieldNode: пустая реализация (нет дочерних узлов)

#### Returns

`void`

#### Inherited from

[`FormNode`](FormNode.md).[`onMarkAsUntouched`](FormNode.md#onmarkasuntouched)

***

### patchValue()

```ts
patchValue(value): void;
```

Defined in: [core/nodes/field-node.ts:163](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L163)

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

Defined in: [core/nodes/field-node.ts:190](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L190)

Сбросить поле к указанному значению (или к initialValue)

#### Parameters

##### value?

`T`

опциональное значение для сброса. Если не указано, используется initialValue

#### Returns

`void`

#### Remarks

Этот метод:
- Устанавливает значение в value или initialValue
- Очищает ошибки валидации
- Сбрасывает touched/dirty флаги
- Устанавливает статус в 'valid'

Если вам нужно сбросить к исходному значению, используйте resetToInitial()

#### Example

```typescript
// Сброс к initialValue
field.reset();

// Сброс к новому значению
field.reset('new value');
```

#### Overrides

[`FormNode`](FormNode.md).[`reset`](FormNode.md#reset)

***

### resetToInitial()

```ts
resetToInitial(): void;
```

Defined in: [core/nodes/field-node.ts:223](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L223)

Сбросить поле к исходному значению (initialValue)

#### Returns

`void`

#### Remarks

Алиас для reset() без параметров, но более явный:
- resetToInitial() - явно показывает намерение вернуться к начальному значению
- reset() - может принимать новое значение

Полезно когда:
- Пользователь нажал "Cancel" - вернуть форму в исходное состояние
- Форма была изменена через reset(newValue), но нужно вернуться к самому началу
- Явное намерение показать "отмену всех изменений"

#### Example

```typescript
const field = new FieldNode({ value: 'initial', component: Input });

field.setValue('changed');
field.reset('temp value');
console.log(field.value.value); // 'temp value'

field.resetToInitial();
console.log(field.value.value); // 'initial'
```

***

### setErrors()

```ts
setErrors(errors): void;
```

Defined in: [core/nodes/field-node.ts:386](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L386)

Установить ошибки валидации извне

#### Parameters

##### errors

[`ValidationError`](../interfaces/ValidationError.md)[]

массив ошибок

#### Returns

`void`

#### Overrides

[`FormNode`](FormNode.md).[`setErrors`](FormNode.md#seterrors)

***

### setUpdateOn()

```ts
setUpdateOn(updateOn): void;
```

Defined in: [core/nodes/field-node.ts:480](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L480)

Динамически изменяет триггер валидации (updateOn)
Полезно для адаптивной валидации - например, переключиться на instant feedback после первого submit

#### Parameters

##### updateOn

новый триггер валидации: 'change' | 'blur' | 'submit'

`"change"` | `"blur"` | `"submit"`

#### Returns

`void`

#### Example

```typescript
// Сценарий 1: Instant feedback после submit
const form = new GroupNode({
  email: {
    value: '',
    component: Input,
    updateOn: 'submit', // Изначально валидация только при submit
    validators: [required, email]
  }
});

await form.submit(async (values) => {
  // После submit переключаем на instant feedback
  form.email.setUpdateOn('change');
  await api.save(values);
});

// Теперь валидация происходит при каждом изменении

// Сценарий 2: Прогрессивное улучшение
form.email.setUpdateOn('blur');  // Сначала только при blur
// ... пользователь начинает вводить ...
form.email.setUpdateOn('change'); // Переключаем на change для real-time feedback
```

***

### setValue()

```ts
setValue(value, options?): void;
```

Defined in: [core/nodes/field-node.ts:134](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L134)

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

### touchAll()

```ts
touchAll(): void;
```

Defined in: [core/nodes/form-node.ts:349](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/form-node.ts#L349)

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

### updateComponentProps()

```ts
updateComponentProps(props): void;
```

Defined in: [core/nodes/field-node.ts:441](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L441)

Обновляет свойства компонента (например, опции для Select)

#### Parameters

##### props

`Partial`\<`Record`\<`string`, `any`\>\>

#### Returns

`void`

#### Example

```typescript
// Обновление опций для Select после загрузки справочников
form.registrationAddress.city.updateComponentProps({
  options: cities
});
```

***

### validate()

```ts
validate(options?): Promise<boolean>;
```

Defined in: [core/nodes/field-node.ts:245](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L245)

Запустить валидацию поля

#### Parameters

##### options?

опции валидации

###### debounce?

`number`

#### Returns

`Promise`\<`boolean`\>

`Promise<boolean>` - true если поле валидно

#### Remarks

Метод защищен от race conditions через validationId.
При быстром вводе только последняя валидация применяет результаты.

#### Example

```typescript
// Обычная валидация
await field.validate();

// С debounce
await field.validate({ debounce: 300 });
```

#### Overrides

[`FormNode`](FormNode.md).[`validate`](FormNode.md#validate)

***

### watch()

```ts
watch(callback): () => void;
```

Defined in: [core/nodes/field-node.ts:509](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/nodes/field-node.ts#L509)

Подписка на изменения значения поля
Автоматически отслеживает изменения через @preact/signals effect

#### Parameters

##### callback

(`value`) => `void` \| `Promise`\<`void`\>

Функция, вызываемая при изменении значения

#### Returns

Функция отписки для cleanup

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
const unsubscribe = form.email.watch((value) => {
  console.log('Email changed:', value);
});

// Cleanup
useEffect(() => unsubscribe, []);
```
