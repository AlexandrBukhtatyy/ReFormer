# Troubleshooting / FAQ

## Component "X" not found in registry

Имя из `component` поля схемы не зарегистрировано в реестре. Проверь:
- `defineRegistry` действительно содержит `reg.field('X', ...)` или `reg.container('X', ...)`.
- `JsonFormRenderer` обёрнут в `JsonRendererProvider` с этим реестром.
- Если используются вложенные провайдеры — реестр внутреннего провайдера наследуется через `withParent`, но дубли разрешаются в пользу внешнего.

## Field renders without label/error

Не зарегистрирован контейнер с ключом `FIELD_WRAPPER`. Добавь:

```typescript
import { FIELD_WRAPPER } from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';

reg.container(FIELD_WRAPPER, FormField);
```

## Cannot read field at path "..."

Путь в `model` не соответствует реальной структуре формы. Проверь:
- `model: 'personalData.firstName'` — поле `firstName` существует внутри `personalData` в `getReformerForm`.
- Для массивов: индекс должен существовать на момент рендера, иначе `convertNode` бросит ошибку.

## componentProps string passes through as plain string

Строка в `componentProps` ссылается на source, но он не зарегистрирован. Используй `reg.source('NAME', value)` либо передавай значение объектом напрямую.

## useJsonRendererSettings throws outside provider

`useJsonRendererSettings` работает только внутри `JsonRendererProvider`. Оберни вызывающий компонент в провайдер либо передай настройки в проп.

## "version" missing in schema

Поле `version` обязательно в `JsonFormSchema`. Сейчас единственное допустимое значение — `'1.0'`.

## Behavior selector matches nothing

`hideWhen`/`patchProps` ищут узел по `selector`. Убедись, что у узла он явно задан (`selector: 'mortgage-section'`), и что значение совпадает с тем, на которое смотрит behavior.

## $template inside array doesn't render rows

Проверь:
- Содержащий узел использует `model` для привязки к массиву формы.
- `componentProps.itemComponent` действительно `{ $template: { ... } }`, а не сразу `JsonNode`.
- Зарегистрирован контейнер-компонент (например `PropertyArray`), который умеет работать с `itemComponent`.

## TypeError: Cannot read properties of undefined (reading 'value') в `<FormField.Root>`

Симптомы: при toggle/click checkbox вся страница уходит в белый экран, в консоли — `TypeError: Cannot read properties of undefined (reading 'value')` + React unmount без error boundary.

Это **path mismatch** между схемой и FormProxy. Кастомный block-компонент (например `PropertiesArrayBlock`) вызвал `useFormControl(form.X.Y)` по пути, которого в форме нет (опечатка, или sub-form-схема изменена и поле уехало в другой шаг).

Что проверить:
1. Полный путь в `useFormControl(form.<step>.<field>)` совпадает с путём в `createForm({ form: { <step>: { <field>: ... } } })`.
2. Если поле **должно жить в step5**, не помещай его в step4 ради «удобства группировки» — кастомный block, написанный под «toggle живёт в step5», крашится.
3. Block ОБЯЗАН быть defensive:
   ```tsx
   function PropertiesArrayBlock({ form }: { form: FormProxy<MyForm> }) {
     const ctrl = useFormControl(form.step5.hasProperty);
     // Defensive null-check: путь мог не существовать, или контрол ещё не смонтирован.
     const hasProperty = (ctrl as { value?: boolean } | undefined)?.value;
     if (!hasProperty) return null;
     // ... FormArray.Root ...
   }
   ```
4. На уровне страницы оборачивай `<FormRenderer>` в React error boundary (минимум — `componentDidCatch` со fallback `<div>Ошибка рендера</div>`), чтобы один падающий блок не уносил весь React-tree.

> Это **самый частый crash** в кастомных блоках — добавляй defensive optional chaining (`?.`) на каждое чтение `useFormControl(...)?.value` / `useArrayLength(...)?.length`.

## See also

- [01-overview.md](01-overview.md)
- [02-json-schema.md](02-json-schema.md)
- [03-registry.md](03-registry.md)
