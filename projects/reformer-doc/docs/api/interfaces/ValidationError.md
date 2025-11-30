# ValidationError

Defined in: [core/types/index.ts:53](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/types/index.ts#L53)

Ошибка валидации

## Properties

### code

```ts
code: string;
```

Defined in: [core/types/index.ts:54](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/types/index.ts#L54)

***

### message

```ts
message: string;
```

Defined in: [core/types/index.ts:55](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/types/index.ts#L55)

***

### params?

```ts
optional params: FormFields;
```

Defined in: [core/types/index.ts:56](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/types/index.ts#L56)

***

### severity?

```ts
optional severity: "error" | "warning";
```

Defined in: [core/types/index.ts:58](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/types/index.ts#L58)

Severity level: 'error' (default) blocks submission, 'warning' shows message but allows submission
