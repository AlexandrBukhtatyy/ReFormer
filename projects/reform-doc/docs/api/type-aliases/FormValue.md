# FormValue

```ts
type FormValue = 
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | File
  | FormValue[]
  | {
[key: string]: FormValue;
};
```

Defined in: [core/types/index.ts:9](https://github.com/AlexandrBukhtatyy/ReFormer/blob/dcfbc8e01cad51c12ece27c493ae5214ef7de021/packages/reformer/src/core/types/index.ts#L9)

Represents any valid form value type
Use this instead of 'any' for form values to maintain type safety
