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

Defined in: [core/types/index.ts:9](https://github.com/AlexandrBukhtatyy/ReFormer/blob/21a22c7cca8ff4c7a6412f104e9d66a1709f1bf6/packages/reformer/src/core/types/index.ts#L9)

Represents any valid form value type
Use this instead of 'any' for form values to maintain type safety
