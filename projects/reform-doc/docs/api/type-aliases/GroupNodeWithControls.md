# GroupNodeWithControls

```ts
type GroupNodeWithControls<T> = GroupNode<T> & FormNodeControls<T>;
```

Defined in: [core/types/group-node-proxy.ts:103](https://github.com/AlexandrBukhtatyy/ReFormer/blob/9fa60ced367fa684435110fffa6b324fd4b5c03c/packages/reformer/src/core/types/group-node-proxy.ts#L103)

Комбинированный тип для GroupNode с Proxy доступом к полям

Объединяет методы и свойства GroupNode с типизированными полями формы.
Это позволяет использовать как API GroupNode, так и прямой доступ к полям.

## Type Parameters

### T

`T`

Тип модели данных формы

## Example

```typescript
interface UserForm {
  email: string;
  profile: {
    name: string;
    age: number;
  };
}

const form: GroupNodeWithControls<UserForm> = new GroupNode(schema);

// Доступ к методам GroupNode
await form.validate();
const values = form.getValue();
console.log(form.valid.value);

// Прямой доступ к полям (через Proxy)
form.email.setValue('test@mail.com');
form.profile.name.setValue('John');
```
