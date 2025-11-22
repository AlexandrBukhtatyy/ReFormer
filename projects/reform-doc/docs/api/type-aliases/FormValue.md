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

Defined in: [core/types/index.ts:9](https://github.com/AlexandrBukhtatyy/ReFormer/blob/82f7a382c065e1c53e721ca1f2d0088e6c1b9020/packages/reformer/src/core/types/index.ts#L9)

Represents any valid form value type
Use this instead of 'any' for form values to maintain type safety
