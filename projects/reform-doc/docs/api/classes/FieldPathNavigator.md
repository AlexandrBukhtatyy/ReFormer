# FieldPathNavigator

Defined in: [core/utils/field-path-navigator.ts:59](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/utils/field-path-navigator.ts#L59)

Навигация по путям к полям формы

Централизует логику парсинга и навигации по путям к полям формы.
Используется в ValidationContext, BehaviorContext, GroupNode для единообразной
обработки путей вида "address.city" или "items[0].name".

Устраняет дублирование логики парсинга путей в 4 местах кодовой базы.

## Example

```typescript
const navigator = new FieldPathNavigator();

// Парсинг пути
const segments = navigator.parsePath('items[0].title');
// [{ key: 'items', index: 0 }, { key: 'title' }]

// Получение значения из объекта
const obj = { items: [{ title: 'Item 1' }] };
const value = navigator.getValueByPath(obj, 'items[0].title');
// 'Item 1'

// Получение узла формы
const titleNode = navigator.getNodeByPath(form, 'items[0].title');
titleNode?.setValue('New Title');
```

## Constructors

### Constructor

```ts
new FieldPathNavigator(): FieldPathNavigator;
```

#### Returns

`FieldPathNavigator`

## Methods

### getFormNodeValue()

```ts
getFormNodeValue(form, path): unknown;
```

Defined in: [core/utils/field-path-navigator.ts:291](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/utils/field-path-navigator.ts#L291)

Получить значение из FormNode по пути

Автоматически извлекает значение из FormNode (через .value.value).
Используется в ValidationContext и BehaviorContext для единообразного
доступа к значениям полей формы.

#### Parameters

##### form

`unknown`

Корневой узел формы (обычно GroupNode)

##### path

`string`

Путь к полю

#### Returns

`unknown`

Значение поля или undefined, если путь не найден

#### Example

```typescript
const form = new GroupNode({
  email: { value: 'test@mail.com', component: Input },
  address: {
    city: { value: 'Moscow', component: Input }
  },
  items: [{ title: { value: 'Item 1', component: Input } }]
});

navigator.getFormNodeValue(form, 'email');
// 'test@mail.com'

navigator.getFormNodeValue(form, 'address.city');
// 'Moscow'

navigator.getFormNodeValue(form, 'items[0].title');
// 'Item 1'

navigator.getFormNodeValue(form, 'invalid.path');
// undefined
```

***

### getNodeByPath()

```ts
getNodeByPath(form, path): unknown;
```

Defined in: [core/utils/field-path-navigator.ts:371](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/utils/field-path-navigator.ts#L371)

Получает узел формы по пути

Навигирует по структуре FormNode (GroupNode/FieldNode/ArrayNode)
и возвращает узел по указанному пути.

Поддерживает:
- Доступ к полям GroupNode через fields Map
- Доступ к элементам ArrayNode через индекс
- Proxy-доступ к полям (для обратной совместимости)

#### Parameters

##### form

`unknown`

Корневой узел формы (обычно GroupNode)

##### path

`string`

Путь к узлу

#### Returns

`unknown`

Узел формы или null, если путь не найден

#### Example

```typescript
const form = new GroupNode({
  email: { value: '', component: Input },
  address: {
    city: { value: '', component: Input }
  },
  items: [{ title: { value: '', component: Input } }]
});

const emailNode = navigator.getNodeByPath(form, 'email');
// FieldNode

const cityNode = navigator.getNodeByPath(form, 'address.city');
// FieldNode

const itemNode = navigator.getNodeByPath(form, 'items[0]');
// GroupNode

const titleNode = navigator.getNodeByPath(form, 'items[0].title');
// FieldNode

const invalidNode = navigator.getNodeByPath(form, 'invalid.path');
// null
```

***

### getValueByPath()

```ts
getValueByPath(obj, path): unknown;
```

Defined in: [core/utils/field-path-navigator.ts:166](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/utils/field-path-navigator.ts#L166)

Получает значение по пути из объекта

Проходит по всем сегментам пути и возвращает конечное значение.
Если путь не найден, возвращает undefined.

#### Parameters

##### obj

[`UnknownRecord`](../type-aliases/UnknownRecord.md)

Объект для навигации

##### path

`string`

Путь к значению

#### Returns

`unknown`

Значение или undefined, если путь не найден

#### Example

```typescript
const obj = {
  email: 'test@mail.com',
  address: { city: 'Moscow' },
  items: [{ title: 'Item 1' }]
};

navigator.getValueByPath(obj, 'email');
// 'test@mail.com'

navigator.getValueByPath(obj, 'address.city');
// 'Moscow'

navigator.getValueByPath(obj, 'items[0].title');
// 'Item 1'

navigator.getValueByPath(obj, 'invalid.path');
// undefined
```

***

### parsePath()

```ts
parsePath(path): PathSegment[];
```

Defined in: [core/utils/field-path-navigator.ts:84](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/utils/field-path-navigator.ts#L84)

Парсит путь в массив сегментов

Поддерживаемые форматы:
- Простые пути: "name", "email"
- Вложенные пути: "address.city", "user.profile.avatar"
- Массивы: "items[0]", "items[0].name", "tags[1][0]"
- Комбинации: "orders[0].items[1].price"

#### Parameters

##### path

`string`

Путь к полю (строка с точками и квадратными скобками)

#### Returns

[`PathSegment`](../interfaces/PathSegment.md)[]

Массив сегментов пути

#### Example

```typescript
navigator.parsePath('email');
// [{ key: 'email' }]

navigator.parsePath('address.city');
// [{ key: 'address' }, { key: 'city' }]

navigator.parsePath('items[0].name');
// [{ key: 'items', index: 0 }, { key: 'name' }]
```

***

### setValueByPath()

```ts
setValueByPath(
   obj, 
   path, 
   value): void;
```

Defined in: [core/utils/field-path-navigator.ts:211](https://github.com/AlexandrBukhtatyy/ReFormer/blob/69429d1a694e5580ca07c0984e88198935beb82c/packages/reformer/src/core/utils/field-path-navigator.ts#L211)

Устанавливает значение по пути в объекте (мутирует объект)

Создает промежуточные объекты, если они не существуют.
Выбрасывает ошибку, если ожидается массив, но его нет.

#### Parameters

##### obj

[`UnknownRecord`](../type-aliases/UnknownRecord.md)

Объект для модификации

##### path

`string`

Путь к значению

##### value

`unknown`

Новое значение

#### Returns

`void`

#### Throws

Если ожидается массив по пути, но его нет

#### Example

```typescript
const obj = { address: { city: '' } };
navigator.setValueByPath(obj, 'address.city', 'Moscow');
// obj.address.city === 'Moscow'

const obj2: UnknownRecord = {};
navigator.setValueByPath(obj2, 'address.city', 'Moscow');
// Создаст { address: { city: 'Moscow' } }

const obj3 = { items: [{ title: 'Old' }] };
navigator.setValueByPath(obj3, 'items[0].title', 'New');
// obj3.items[0].title === 'New'
```
