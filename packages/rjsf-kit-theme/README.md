# @reformer/rjsf-kit-theme

Тема [RJSF](https://rjsf-team.github.io/react-jsonschema-form/) из любого кита ReFormer: виджеты
RJSF рисуются полями кита, поле — в рамке поля кита, объект — в его контейнере, отправка — его
кнопкой. Под RJSF кит не пишет ни строчки: тема строится из его каталога
(`component-catalog.json`) и пространства имён.

Пакет рантаймовый: его берут и превью билдера (домен `rjsf`), и форма в приложении. От пакетов
билдера он не зависит.

```tsx
import { withTheme } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { createKitTheme } from '@reformer/rjsf-kit-theme';
import * as kit from '@reformer/ui-kit';
import catalog from '@reformer/ui-kit/component-catalog.json';

const { theme, problems } = createKitTheme({
  namespace: kit,
  components: catalog.components,
  slots: catalog.kit.infra,
  ...catalog.kit.renderers?.rjsf,
});
const Form = withTheme(theme);

<Form schema={schema} uiSchema={uiSchema} validator={validator} />;
```

Peer-зависимости: `react`, `@rjsf/core`, `@rjsf/utils`, `@reformer/core` (адаптеры полей).

## Как кит становится темой

**Виджеты.** Каждая роль RJSF заполняется первой найденной записью каталога:

| Виджет RJSF      | Записи кита                             |
| ---------------- | --------------------------------------- |
| `TextWidget`     | `Input`                                 |
| `PasswordWidget` | `InputPassword`, иначе `Input` с `type` |
| `TextareaWidget` | `Textarea`                              |
| `CheckboxWidget` | `Checkbox`, `Switch`                    |
| `SelectWidget`   | `Select`, `NativeSelect`                |
| `RadioWidget`    | `RadioGroup`                            |
| `RangeWidget`    | `Slider`                                |
| `UpDownWidget`   | `InputNumber`                           |
| `DateWidget`     | `DatePicker`                            |

Сопоставление идёт по имени записи, а не экспорта: имя записи у китов общее (`Checkbox`),
экспорт — свой (`CheckboxWithLabel`). Каждое поле кита — ещё и виджет под своим именем:
`"ui:widget": "Switch"` рисует переключатель кита, даже если флажком стал `Checkbox`.

**Мост.** Виджет — один на все поля: значение идёт через адаптер поля кита (`reformerAdapter`,
`bindFieldProps` из `@reformer/core`), как у `FormField`. Досказывается то, в чём соглашения RJSF и
полей ReFormer расходятся:

- варианты выбора — пропом `options` в форме `{ value, label }`, только контролу, объявившему
  `options` в каталоге; контрол видит значения строками, RJSF получает исходные (число остаётся
  числом);
- дата RJSF — строка `YYYY-MM-DD`, поле даты кита — `Date`;
- `minimum`, `maximum`, `multipleOf` — пропсами `min`, `max`, `step`;
- контрол с `reformerLayout: 'inline-label'` получает подпись пропом `label`, рамка свою не рисует;
- `readonly` — это `disabled` контрола; пустой ввод — «значения нет» (`ui:emptyValue`).

У каждого контрола `data-testid="input-<имя поля>"` — как у форм ReFormer.

**Свойства контрола — `ui:options`.** Собственные пропсы поля кита задаются подсказками отрисовки
RJSF — теми, что запись объявила в `propsSchema` каталога:

```json
{
  "phone": {
    "ui:widget": "InputMask",
    "ui:options": { "mask": "+7 (999) 999-99-99", "tooltip": "Мобильный" }
  }
}
```

Ключ, которого запись не объявляла, контролу не уходит. Не уходят и закрытые для подсказок пропсы
(`RESERVED_OPTION_PROPS`): подпись, описание, обязательность и варианты — это `title`,
`description`, `required` и `enum` схемы, подсказка в поле — `ui:placeholder`, значение — данные
формы; `asChild` — режим слота, которому нужен дочерний элемент. Постоянный проп роли
(`type: 'password'` у `Input` под `PasswordWidget`) подсказки не перекрывают.

Границы и шаг числа мост по умолчанию берёт из схемы (`minimum`, `maximum`, `multipleOf`);
`ui:options.min`, `max` и `step` их перекрывают — для контрола, но не для проверки значения.

Редактору формы тот же ответ дают чистые функции над каталогом, без пространства имён:

```ts
import { kitWidgetTarget, registryWidgetName, widgetOptionProps } from '@reformer/rjsf-kit-theme';

const widget = registryWidgetName(fieldSchema, uiSchema['ui:widget']); // 'TextWidget', 'Switch'…
const target = widget && kitWidgetTarget(widget, { components: catalog.components });
const editable = target ? widgetOptionProps(target.record, target.props) : [];
```

**Шаблоны.** Поле — рамка кита (`kit.infra.fieldFrame`, пропсы `KitFieldFrameProps`), объект —
`Box`, отправка — `Button`. Кит без рамки получает минимальную собственную: стандартный шаблон RJSF
подписал бы флажок кита дважды.

**Уточнения кита** — блок `kit.renderers.rjsf` каталога (контракт `2.1`):

```json
{
  "kit": {
    "renderers": {
      "rjsf": {
        "widgets": { "CheckboxWidget": "Switch" },
        "templates": { "object": "Stack", "submit": "PrimaryButton" }
      }
    }
  }
}
```

## Расхождения

Чего в ките не нашлось, остаётся стандартным RJSF — форма рисуется всегда. `problems` перечисляет,
что именно:

| Код                 | Значит                                                           |
| ------------------- | ---------------------------------------------------------------- |
| `widget-default`    | для роли RJSF в ките нет поля — стандартный виджет               |
| `template-default`  | нет компонента под шаблон (`field` — своя минимальная рамка)     |
| `component-missing` | кит назвал компонент, а в каталоге или пространстве имён его нет |

Пустое пространство имён — кита нет: тема пустая, то есть стандартная тема RJSF, без расхождений.
