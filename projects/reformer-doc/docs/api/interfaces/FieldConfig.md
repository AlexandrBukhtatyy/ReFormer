# FieldConfig

Defined in: [core/types/deep-schema.ts:24](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L24)

Конфигурация поля

## Type Parameters

### T

`T`

## Properties

### asyncValidators?

```ts
optional asyncValidators: AsyncValidatorFn<T>[];
```

Defined in: [core/types/deep-schema.ts:31](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L31)

***

### component

```ts
component: ComponentType<any>;
```

Defined in: [core/types/deep-schema.ts:27](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L27)

***

### componentProps?

```ts
optional componentProps: any;
```

Defined in: [core/types/deep-schema.ts:29](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L29)

***

### debounce?

```ts
optional debounce: number;
```

Defined in: [core/types/deep-schema.ts:35](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L35)

Задержка (в мс) перед запуском асинхронной валидации

***

### disabled?

```ts
optional disabled: boolean;
```

Defined in: [core/types/deep-schema.ts:32](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L32)

***

### updateOn?

```ts
optional updateOn: "change" | "blur" | "submit";
```

Defined in: [core/types/deep-schema.ts:33](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L33)

***

### validators?

```ts
optional validators: ValidatorFn<T>[];
```

Defined in: [core/types/deep-schema.ts:30](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L30)

***

### value

```ts
value: T | null;
```

Defined in: [core/types/deep-schema.ts:25](https://github.com/AlexandrBukhtatyy/ReFormer/blob/34c25f8a76648f468be9f6786e03e9ad735d7890/packages/reformer/src/core/types/deep-schema.ts#L25)
