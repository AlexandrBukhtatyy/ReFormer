# FormNodeControls

```ts
type FormNodeControls<T> = { [K in keyof T]: NonNullable<T[K]> extends (infer U)[] ? U extends FormFields ? ArrayNodeWithControls<U> : FieldNode<T[K]> : NonNullable<T[K]> extends FormFields ? NonNullable<T[K]> extends Date | File | Blob ? FieldNode<T[K]> : GroupNodeWithControls<NonNullable<T[K]>> : FieldNode<T[K]> };
```

Defined in: [core/types/group-node-proxy.ts:58](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dc1362d11717598d8c52ddda4c24a269fc146261/packages/reformer/src/core/types/group-node-proxy.ts#L58)

Мапит тип модели данных T на правильные типы узлов формы

Рекурсивно определяет типы узлов на основе структуры данных:
- `T[K] extends Array<infer U>` где U - объект → `ArrayNodeWithControls<U>`
- `T[K] extends Array<infer U>` где U - примитив → `FieldNode<T[K]>` (массив как обычное поле)
- `T[K] extends object` → `GroupNodeWithControls<T[K]>` (вложенная форма с типизацией)
- `T[K]` примитив → `FieldNode<T[K]>` (простое поле)

Использует NonNullable для правильной обработки опциональных полей

## Type Parameters

### T

`T`

Тип модели данных формы
