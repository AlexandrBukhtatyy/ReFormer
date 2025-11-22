# Type Alias: DeepControls\<T\>

> **DeepControls**\<`T`\> = \{ \[K in keyof T\]: NonNullable\<T\[K\]\> extends (infer U)\[\] ? U extends FormFields ? ArrayControlProxy\<U\> : FieldNode\<T\[K\]\> : NonNullable\<T\[K\]\> extends FormFields ? NonNullable\<T\[K\]\> extends Date \| File \| Blob ? FieldNode\<T\[K\]\> : DeepControls\<NonNullable\<T\[K\]\>\> & GroupControlProxy\<NonNullable\<T\[K\]\>\> : FieldNode\<T\[K\]\> \}

Defined in: [core/types/deep-schema.ts:129](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0a4bb3eb91c092897c9afb429f71c64b1be9df7b/packages/reformer/src/core/types/deep-schema.ts#L129)

Типы контроллеров с учетом вложенности

Предоставляет типобезопасный доступ к полям формы через Proxy:

- Поля → FieldNode
- Группы → DeepControls + GroupControlProxy
- Массивы → ArrayControlProxy

Использует NonNullable для корректной обработки опциональных полей

## Type Parameters

### T

`T`

## Example

```typescript
const form = new FormStore(schema);

// Доступ к полю
form.controls.name.value;

// Доступ к вложенной группе
form.controls.address.city.value;

// Доступ к опциональному массиву
form.controls.items?.[0].title.value;
form.controls.items?.length;
form.controls.items?.push();
```
