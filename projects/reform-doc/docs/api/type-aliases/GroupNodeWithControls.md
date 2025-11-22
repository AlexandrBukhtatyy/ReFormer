# GroupNodeWithControls

```ts
type GroupNodeWithControls<T> = GroupNode<T> & FormNodeControls<T>;
```

Defined in: [core/types/group-node-proxy.ts:95](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/group-node-proxy.ts#L95)

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
