# RegistryStack

Defined in: [core/utils/registry-stack.ts:28](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L28)

Generic Registry Stack - утилита для управления стеком регистрации

Используется ValidationRegistry и BehaviorRegistry для tracking активного контекста.
Устраняет дублирование кода между параллельными системами.

## Example

```typescript
class ValidationRegistry {
  private static registryStack = new RegistryStack<ValidationRegistry>();

  static getCurrent() {
    return ValidationRegistry.registryStack.getCurrent();
  }

  beginRegistration() {
    ValidationRegistry.registryStack.push(this);
  }

  endRegistration() {
    ValidationRegistry.registryStack.verify(this, 'ValidationRegistry');
  }
}
```

## Type Parameters

### T

`T`

Тип элементов в стеке (ValidationRegistry или BehaviorRegistry)

## Constructors

### Constructor

```ts
new RegistryStack<T>(): RegistryStack<T>;
```

#### Returns

`RegistryStack`\<`T`\>

## Accessors

### length

#### Get Signature

```ts
get length(): number;
```

Defined in: [core/utils/registry-stack.ts:73](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L73)

Получить длину стека

##### Returns

`number`

Количество элементов в стеке

## Methods

### clear()

```ts
clear(): void;
```

Defined in: [core/utils/registry-stack.ts:88](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L88)

Очистить стек

#### Returns

`void`

***

### getCurrent()

```ts
getCurrent(): T | null;
```

Defined in: [core/utils/registry-stack.ts:51](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L51)

Получить текущий элемент (вершину стека) без извлечения

#### Returns

`T` \| `null`

Текущий элемент или null если стек пуст

***

### isEmpty()

```ts
isEmpty(): boolean;
```

Defined in: [core/utils/registry-stack.ts:81](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L81)

Проверить, пуст ли стек

#### Returns

`boolean`

true если стек пуст

***

### pop()

```ts
pop(): T | undefined;
```

Defined in: [core/utils/registry-stack.ts:43](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L43)

Извлечь элемент из стека

#### Returns

`T` \| `undefined`

Извлеченный элемент или undefined если стек пуст

***

### push()

```ts
push(item): void;
```

Defined in: [core/utils/registry-stack.ts:35](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L35)

Добавить элемент в стек

#### Parameters

##### item

`T`

Элемент для добавления

#### Returns

`void`

***

### verify()

```ts
verify(expected, name): void;
```

Defined in: [core/utils/registry-stack.ts:62](https://github.com/AlexandrBukhtatyy/ReFormer/blob/a3c7aab04746efd72e6c230f052496b66681f449/packages/reformer/src/core/utils/registry-stack.ts#L62)

Извлечь элемент из стека с проверкой
Выводит предупреждение в DEV режиме если извлеченный элемент не совпадает с ожидаемым

#### Parameters

##### expected

`T`

Ожидаемый элемент

##### name

`string`

Имя реестра для отладки (например, 'ValidationRegistry')

#### Returns

`void`
