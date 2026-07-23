## 5. TROUBLESHOOTING

| Error                                                  | Cause                                                    | Solution                                          |
| ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------- |
| `'string' is not assignable to '{ message?: string }'` | Валидатору передали строку вместо options                | Используй `required({ message: 'text' })`         |
| `Module has no exported member`                        | Неверный источник импорта                                | `watchField`/примитивы — из `@reformer/core`; DSL — из `@reformer/core/behaviors`; фабрики — из `@reformer/core/validators` |
| `undefined` из `useFormControlValue`                   | Деструктурировали хук                                    | `const v = useFormControlValue(...)` — без деструктуризации |
| `enableWhen`/`disableWhen` не срабатывает              | Поле не материализовано в форме (элемент массива)        | Убедись, что поле есть в схеме `createForm`; для per-item — `applyEach` |
| `Cycle detected`                                       | Взаимные `compute`/`computeFrom` без стабилизации        | Разорви цикл через условие `when` или `peek`; см. 22-cycle-detection.md |
| Значение поля не пишется                               | Пишем в форму вместо модели                              | Значения принадлежат модели: `model.field = ...` / `model.$.field.value = ...` |
| Ошибки не появляются после submit                      | Не вызвали `validateModel` (`form.submit()` НЕ гоняет schema-валидацию) | `await validateModel(model, schema)` из `@reformer/core/validation` — он роутит ошибки в ноды |
