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

Defined in: [core/types/index.ts:9](https://github.com/AlexandrBukhtatyy/ReFormer/blob/38c056cd3838adfe8f094f9ee4c602d4ad0ef4a6/packages/reformer/src/core/types/index.ts#L9)

Represents any valid form value type
Use this instead of 'any' for form values to maintain type safety
