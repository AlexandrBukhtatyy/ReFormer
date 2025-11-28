# SubscriptionManager

Defined in: [core/utils/subscription-manager.ts:28](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L28)

Менеджер подписок для FormNode

Централизует управление effect-подписками в узлах формы,
предотвращает утечки памяти и упрощает отладку.

Каждая подписка имеет уникальный ключ, что позволяет:
- Отписываться от конкретной подписки по ключу
- Автоматически заменять существующие подписки
- Отслеживать количество активных подписок (для отладки)

## Example

```typescript
class FieldNode {
  private subscriptions = new SubscriptionManager();

  watch(callback: Function) {
    const dispose = effect(() => callback(this.value.value));
    return this.subscriptions.add('watch', dispose);
  }

  dispose() {
    this.subscriptions.clear();
  }
}
```

## Constructors

### Constructor

```ts
new SubscriptionManager(): SubscriptionManager;
```

#### Returns

`SubscriptionManager`

## Methods

### add()

```ts
add(key, dispose): () => void;
```

Defined in: [core/utils/subscription-manager.ts:64](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L64)

Добавляет подписку

Если подписка с таким ключом уже существует, отписывается от неё
и заменяет новой. Это предотвращает утечки памяти при повторной
регистрации подписки с тем же ключом.

#### Parameters

##### key

`string`

Уникальный ключ подписки

##### dispose

() => `void`

Функция отписки (обычно возвращаемая из effect())

#### Returns

Функция для отписки от этой конкретной подписки

```ts
(): void;
```

##### Returns

`void`

#### Example

```typescript
const manager = new SubscriptionManager();

// Добавление подписки
const unsubscribe = manager.add('mySubscription', () => {
  console.log('Disposing subscription');
});

// Отписка через возвращаемую функцию
unsubscribe();

// Или через manager.remove()
manager.add('anotherSub', disposeFn);
manager.remove('anotherSub');
```

***

### clear()

```ts
clear(): void;
```

Defined in: [core/utils/subscription-manager.ts:129](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L129)

Очищает все подписки

Вызывает функции отписки для всех активных подписок
и очищает хранилище. Обычно используется при dispose узла формы.

#### Returns

`void`

#### Example

```typescript
class FieldNode {
  private subscriptions = new SubscriptionManager();

  dispose() {
    // Отписываемся от всех effect
    this.subscriptions.clear();
  }
}
```

***

### dispose()

```ts
dispose(): void;
```

Defined in: [core/utils/subscription-manager.ts:218](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L218)

Отписывается от всех подписок (алиас для clear())

Используется при dispose() узла формы для совместимости с ожидаемым API.

#### Returns

`void`

#### Example

```typescript
class FieldNode {
  private subscriptions = new SubscriptionManager();

  dispose() {
    this.subscriptions.dispose();
  }
}
```

***

### getKeys()

```ts
getKeys(): string[];
```

Defined in: [core/utils/subscription-manager.ts:198](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L198)

Возвращает список всех ключей активных подписок

Полезно для отладки: можно увидеть, какие подписки активны.

#### Returns

`string`[]

Массив ключей всех активных подписок

#### Example

```typescript
const manager = new SubscriptionManager();
manager.add('watch-value', disposeFn1);
manager.add('watch-errors', disposeFn2);

console.log(manager.getKeys()); // ['watch-value', 'watch-errors']
```

***

### has()

```ts
has(key): boolean;
```

Defined in: [core/utils/subscription-manager.ts:178](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L178)

Проверяет, есть ли подписка с данным ключом

#### Parameters

##### key

`string`

Ключ подписки

#### Returns

`boolean`

true, если подписка существует

#### Example

```typescript
const manager = new SubscriptionManager();
manager.add('mySub', disposeFn);

console.log(manager.has('mySub')); // true
console.log(manager.has('nonExistent')); // false
```

***

### remove()

```ts
remove(key): boolean;
```

Defined in: [core/utils/subscription-manager.ts:101](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L101)

Удаляет подписку по ключу

Вызывает функцию отписки и удаляет подписку из хранилища.
Если подписка с таким ключом не найдена, ничего не делает.

#### Parameters

##### key

`string`

Ключ подписки

#### Returns

`boolean`

true, если подписка была удалена, false если не найдена

#### Example

```typescript
const manager = new SubscriptionManager();
manager.add('mySub', disposeFn);

// Удаление подписки
const removed = manager.remove('mySub'); // true

// Попытка удалить несуществующую подписку
const removed2 = manager.remove('nonExistent'); // false
```

***

### size()

```ts
size(): number;
```

Defined in: [core/utils/subscription-manager.ts:159](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/utils/subscription-manager.ts#L159)

Возвращает количество активных подписок

Полезно для отладки утечек памяти. Если количество подписок
растет без ограничений, это может указывать на то, что
компоненты не отписываются должным образом.

#### Returns

`number`

Количество активных подписок

#### Example

```typescript
const manager = new SubscriptionManager();
console.log(manager.size()); // 0

manager.add('sub1', disposeFn1);
manager.add('sub2', disposeFn2);
console.log(manager.size()); // 2

manager.clear();
console.log(manager.size()); // 0
```
