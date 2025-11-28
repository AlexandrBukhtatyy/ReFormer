# FieldPath

```ts
type FieldPath<T> = { [K in keyof T]: NonNullable<T[K]> extends unknown[] ? FieldPathNode<T, T[K], K> : NonNullable<T[K]> extends Date | File | Blob | AnyFunction ? FieldPathNode<T, T[K], K> : NonNullable<T[K]> extends object ? FieldPathNode<T, T[K], K> & FieldPath<NonNullable<T[K]>> : FieldPathNode<T, T[K], K> };
```

Defined in: [core/types/field-path.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6a3c391fd3177a419f8ce8013fe1d505a3c04543/packages/reformer/src/core/types/field-path.ts#L31)

FieldPath предоставляет типобезопасный доступ к путям полей формы

Рекурсивно обрабатывает вложенные объекты для поддержки вложенных форм.

Использование:
```typescript
const validation = (path: FieldPath<MyForm>) => {
  required(path.email, { message: 'Email обязателен' });

  // Вложенные объекты
  required(path.registrationAddress.city);
  minLength(path.registrationAddress.street, 3);

  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      required(path.propertyValue, { message: 'Укажите стоимость' });
    }
  );
};
```

## Type Parameters

### T

`T`
