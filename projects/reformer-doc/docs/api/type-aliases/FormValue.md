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

Defined in: [core/types/index.ts:12](https://github.com/AlexandrBukhtatyy/ReFormer/blob/8fb78cbcd4dc6409ef1f3e23e9b6b2b668787a30/packages/reformer/src/core/types/index.ts#L12)

Represents any valid form value type
Use this instead of 'any' for form values to maintain type safety
