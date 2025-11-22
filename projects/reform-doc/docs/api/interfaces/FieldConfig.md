# FieldConfig

Defined in: [core/types/deep-schema.ts:20](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L20)

Конфигурация поля

## Type Parameters

### T

`T`

## Properties

### asyncValidators?

```ts
optional asyncValidators: AsyncValidatorFn<T>[];
```

Defined in: [core/types/deep-schema.ts:27](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L27)

***

### component

```ts
component: ComponentType<any>;
```

Defined in: [core/types/deep-schema.ts:23](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L23)

***

### componentProps?

```ts
optional componentProps: any;
```

Defined in: [core/types/deep-schema.ts:25](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L25)

***

### debounce?

```ts
optional debounce: number;
```

Defined in: [core/types/deep-schema.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L31)

Задержка (в мс) перед запуском асинхронной валидации

***

### disabled?

```ts
optional disabled: boolean;
```

Defined in: [core/types/deep-schema.ts:28](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L28)

***

### updateOn?

```ts
optional updateOn: "change" | "blur" | "submit";
```

Defined in: [core/types/deep-schema.ts:29](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L29)

***

### validators?

```ts
optional validators: ValidatorFn<T>[];
```

Defined in: [core/types/deep-schema.ts:26](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L26)

***

### value

```ts
value: T | null;
```

Defined in: [core/types/deep-schema.ts:21](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/deep-schema.ts#L21)
