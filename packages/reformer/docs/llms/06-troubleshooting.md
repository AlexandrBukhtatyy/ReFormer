## 5. TROUBLESHOOTING

| Error                                                  | Cause                          | Solution                          |
| ------------------------------------------------------ | ------------------------------ | --------------------------------- |
| `'string' is not assignable to '{ message?: string }'` | Wrong validator format         | Use `{ message: 'text' }`         |
| `'null' is not assignable to 'undefined'`              | Wrong optional type            | Replace `null` with `undefined`   |
| `FormFields[]` instead of concrete type                | Type inference issue           | Use `as FieldNode<T>`             |
| `Type 'X' is missing properties from type 'Y'`         | Cross-level computeFrom        | Use watchField instead            |
| `Module has no exported member`                        | Wrong import source            | Types from core, functions from submodules |
