# PathSegment

Defined in: [core/utils/field-path-navigator.ts:19](https://github.com/AlexandrBukhtatyy/ReFormer/blob/cfe63ccdb422f5ff2245f12de46311ef4d5a36a2/packages/reformer/src/core/utils/field-path-navigator.ts#L19)

Сегмент пути к полю формы

Представляет один сегмент в пути к полю, например:
- `"email" → { key: 'email' }`
- `"items[0]" → { key: 'items', index: 0 }`

## Example

```typescript
// Путь "items[0].name" разбивается на:
[
  { key: 'items', index: 0 },
  { key: 'name' }
]
```

## Properties

### index?

```ts
optional index: number;
```

Defined in: [core/utils/field-path-navigator.ts:29](https://github.com/AlexandrBukhtatyy/ReFormer/blob/cfe63ccdb422f5ff2245f12de46311ef4d5a36a2/packages/reformer/src/core/utils/field-path-navigator.ts#L29)

Индекс в массиве (опционально)
Присутствует только для сегментов вида "items[0]"

***

### key

```ts
key: string;
```

Defined in: [core/utils/field-path-navigator.ts:23](https://github.com/AlexandrBukhtatyy/ReFormer/blob/cfe63ccdb422f5ff2245f12de46311ef4d5a36a2/packages/reformer/src/core/utils/field-path-navigator.ts#L23)

Ключ поля
