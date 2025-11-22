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

Defined in: [core/types/index.ts:9](https://github.com/AlexandrBukhtatyy/ReFormer/blob/6c591333cce7039afe1dde0903d75315103b9850/packages/reformer/src/core/types/index.ts#L9)

Represents any valid form value type
Use this instead of 'any' for form values to maintain type safety
