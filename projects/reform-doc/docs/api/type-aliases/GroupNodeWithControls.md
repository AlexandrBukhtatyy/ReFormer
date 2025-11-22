# Type Alias: GroupNodeWithControls\<T\>

> **GroupNodeWithControls**\<`T`\> = `GroupNode`\<`T`\> & [`FormNodeControls`](FormNodeControls.md)\<`T`\>

Defined in: [core/types/group-node-proxy.ts:95](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/group-node-proxy.ts#L95)

Комбинированный тип для GroupNode с Proxy доступом к полям

Объединяет методы и свойства GroupNode с типизированными полями формы.
Это позволяет использовать как API GroupNode, так и прямой доступ к полям.

## Type Parameters

### T

`T` _extends_ [`FormFields`](FormFields.md)

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
