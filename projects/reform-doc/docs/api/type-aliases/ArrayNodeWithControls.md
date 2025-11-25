# ArrayNodeWithControls

```ts
type ArrayNodeWithControls<T> = ArrayNode<T> & object;
```

Defined in: [core/types/group-node-proxy.ts:126](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8c48398964e4c099041999cd19130ed40474d567/packages/reformer/src/core/types/group-node-proxy.ts#L126)

Комбинированный тип для ArrayNode с Proxy доступом к элементам

Объединяет методы и свойства ArrayNode с типизированным доступом к элементам массива.

## Type Declaration

### at()

```ts
at(index): any;
```

Безопасный доступ к элементу массива по индексу
Возвращает GroupNode с типизированными полями или undefined

#### Parameters

##### index

`number`

#### Returns

`any`

### forEach()

```ts
forEach(callback): void;
```

Итерация по элементам массива с типизированными элементами

#### Parameters

##### callback

(`item`, `index`) => `void`

#### Returns

`void`

### map()

```ts
map<R>(callback): R[];
```

Маппинг элементов массива с типизированными элементами

#### Type Parameters

##### R

`R`

#### Parameters

##### callback

(`item`, `index`) => `R`

#### Returns

`R`[]

## Type Parameters

### T

`T` *extends* [`FormFields`](FormFields.md)

Тип модели данных элемента массива

## Example

```typescript
interface TodoItem {
  title: string;
  completed: boolean;
}

const todos: ArrayNodeWithControls<TodoItem> = new ArrayNode(schema);

// Доступ к методам ArrayNode
todos.push({ title: 'New todo', completed: false });
todos.removeAt(0);

// Доступ к элементам (через Proxy)
todos.at(0)?.title.setValue('Updated title');

// Итерация
todos.forEach((item, i) => {
  console.log(item.title.value.value);
});
```
