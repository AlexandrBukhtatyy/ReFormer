# ValidationError

Defined in: [core/types/index.ts:53](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/types/index.ts#L53)

Ошибка валидации

## Properties

### code

```ts
code: string;
```

Defined in: [core/types/index.ts:54](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/types/index.ts#L54)

***

### message

```ts
message: string;
```

Defined in: [core/types/index.ts:55](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/types/index.ts#L55)

***

### params?

```ts
optional params: FormFields;
```

Defined in: [core/types/index.ts:56](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/types/index.ts#L56)

***

### severity?

```ts
optional severity: "error" | "warning";
```

Defined in: [core/types/index.ts:58](https://github.com/AlexandrBukhtatyy/ReFormer/blob/c914b0e8aa05b7fd141395bf4d8c4eec038cba53/packages/reformer/src/core/types/index.ts#L58)

Severity level: 'error' (default) blocks submission, 'warning' shows message but allows submission
