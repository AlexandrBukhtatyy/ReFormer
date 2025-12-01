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

Defined in: [core/types/index.ts:12](https://github.com/AlexandrBukhtatyy/ReFormer/blob/0ba4d0477dce65d180e9ae66a77e31ad88abc032/packages/reformer/src/core/types/index.ts#L12)

Represents any valid form value type
Use this instead of 'any' for form values to maintain type safety
