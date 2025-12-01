# NodeFactory

Defined in: [core/factories/node-factory.ts:44](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/factories/node-factory.ts#L44)

Фабрика для создания узлов формы

Определяет тип конфига и создает соответствующий узел (FieldNode, GroupNode, ArrayNode)

## Constructors

### Constructor

```ts
new NodeFactory(): NodeFactory;
```

#### Returns

`NodeFactory`

## Methods

### createNode()

```ts
createNode<T>(config): FormNode<T>;
```

Defined in: [core/factories/node-factory.ts:90](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/factories/node-factory.ts#L90)

Создает узел формы на основе конфигурации

✅ ОБНОВЛЕНО: Теперь поддерживает массивы напрямую

Автоматически определяет тип узла:
- FieldNode: имеет value и component
- ArrayNode: массив [schema, ...items] или { schema, initialItems }
- GroupNode: объект без value, component, schema

#### Type Parameters

##### T

`T`

#### Parameters

##### config

`unknown`

Конфигурация узла

#### Returns

[`FormNode`](FormNode.md)\<`T`\>

Экземпляр FieldNode, GroupNode или ArrayNode

#### Throws

Error если конфиг не соответствует ни одному типу

#### Example

```typescript
const factory = new NodeFactory();

// FieldNode
const field = factory.createNode({
  value: 'test@mail.com',
  component: Input,
  validators: [required, email]
});

// GroupNode
const group = factory.createNode({
  email: { value: '', component: Input },
  password: { value: '', component: Input }
});

// ArrayNode (объект)
const array = factory.createNode({
  schema: { title: { value: '', component: Input } },
  initialItems: [{ title: 'Item 1' }]
});

// ArrayNode (массив) - новый формат
const array2 = factory.createNode([
  { title: { value: '', component: Input } }, // schema
  { title: 'Item 1' }, // initial item 1
  { title: 'Item 2' }  // initial item 2
]);
```

***

### extractValues()

```ts
extractValues(schema): unknown;
```

Defined in: [core/factories/node-factory.ts:204](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/factories/node-factory.ts#L204)

Извлечь значения из схемы (рекурсивно)

✅ НОВОЕ: Извлечено из GroupNode для централизации логики

Преобразует схему формы в объект со значениями:
- `{ name: { value: 'John', component: Input } } → { name: 'John' }`
- Поддерживает вложенные группы
- Поддерживает массивы

#### Parameters

##### schema

`unknown`

Схема формы

#### Returns

`unknown`

Объект со значениями полей

#### Example

```typescript
const factory = new NodeFactory();

const schema = {
  name: { value: 'John', component: Input },
  age: { value: 30, component: Input },
  address: {
    city: { value: 'Moscow', component: Input }
  }
};

factory.extractValues(schema);
// { name: 'John', age: 30, address: { city: 'Moscow' } }
```

***

### isArrayConfig()

```ts
isArrayConfig(config): boolean;
```

Defined in: [core/factories/node-factory.ts:276](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/factories/node-factory.ts#L276)

Проверяет, является ли конфиг конфигурацией массива (ArrayConfig)

ArrayConfig имеет обязательное свойство:
- schema: схема для элементов массива

И НЕ имеет:
- value (отличие от FieldConfig)

#### Parameters

##### config

`unknown`

Проверяемая конфигурация

#### Returns

`boolean`

true если config является ArrayConfig

#### Example

```typescript
const factory = new NodeFactory();

factory.isArrayConfig({ schema: {}, initialItems: [] }); // true
factory.isArrayConfig({ value: '', component: Input }); // false
factory.isArrayConfig({ email: { value: '' } }); // false
```

***

### isFieldConfig()

```ts
isFieldConfig(config): boolean;
```

Defined in: [core/factories/node-factory.ts:249](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/factories/node-factory.ts#L249)

Проверяет, является ли конфиг конфигурацией поля (FieldConfig)

FieldConfig имеет обязательные свойства:
- value: начальное значение поля
- component: React-компонент для отображения

#### Parameters

##### config

`unknown`

Проверяемая конфигурация

#### Returns

`boolean`

true если config является FieldConfig

#### Example

```typescript
const factory = new NodeFactory();

factory.isFieldConfig({ value: '', component: Input }); // true
factory.isFieldConfig({ email: { value: '' } }); // false
factory.isFieldConfig(null); // false
```

***

### isGroupConfig()

```ts
isGroupConfig(config): boolean;
```

Defined in: [core/factories/node-factory.ts:307](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/factories/node-factory.ts#L307)

Проверяет, является ли конфиг конфигурацией группы (GroupConfig)

GroupConfig - это объект, который:
- НЕ является FieldConfig (нет value/component)
- НЕ является ArrayConfig (нет schema)
- Содержит вложенные конфиги полей/групп/массивов

#### Parameters

##### config

`unknown`

Проверяемая конфигурация

#### Returns

`boolean`

true если config является GroupConfig

#### Example

```typescript
const factory = new NodeFactory();

factory.isGroupConfig({
  email: { value: '', component: Input },
  password: { value: '', component: Input }
}); // true

factory.isGroupConfig({ value: '', component: Input }); // false
factory.isGroupConfig({ schema: {} }); // false
factory.isGroupConfig(null); // false
```
