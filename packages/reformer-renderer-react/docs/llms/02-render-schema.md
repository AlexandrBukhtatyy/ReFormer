# Render Schema

## Key Concepts

Единая схема: одно дерево узлов описывает и layout, и привязку полей к модели. Привязка идёт через **ручки модели** (`model.$.<field>`) в ключе `model` узла.

- **Билдер схемы** — `(model: FormModel<T>) => RenderNode<T>`. Его получает `createForm({ schema })`, вызывает один раз и компилирует дерево. Тип `FormSchemaNode` из `@reformer/core` описывает то же дерево без React-типов; `RenderNode<T>` из рендерера уточняет `component` до React-компонента.
- **`ModelFieldRenderNode`** — узел-поле. Несёт `model` (ручку значения: лист `model.$.email` или массив целиком `model.$.tags` — мультивыбор, теги, файлы), `component` (UI-компонент), `componentProps` (пропсы поля), опц. `disabled` (поле создаётся отключённым). Нода поля (`FormControl`: замечания, `disabled`, `touched`) находится по ручке через реестр `getNodeForSignal`, который заполняет сборка. Поля `validators` у узла **НЕТ** — правила валидации значений живут в отдельной `ValidationDefinition` над моделью (`validators: [...]` на листе даст `TS2353`; см. [06-validation.md](06-validation.md)). Компонент листа получает **value-based seam** (`value`, `disabled`, `onChange(value)`, `onBlur`) — value-based контролам настройка не нужна. Сырой контрол сторонней UI-kit с другим диалектом (`checked`+событие у Checkbox, `(value, option)` у Select) подключается через `FieldAdapter`: рендерер сам переложит seam на его контракт, не оборачивая контрол (`settings.resolveFieldAdapter`; см. [05-cookbook.md](05-cookbook.md)).
- **`ArrayRenderNode<T>`** — массив под-форм. `model` — ручка массива (`model.$.coBorrowers`), `item(row)` строит поддерево строки по под-модели элемента, `component` — компонент-рендерер секции. Шаблон нового элемента — в модели (`arrayOf(blank)`); `initialValue` узла — запасной.
- **`PartRenderNode<T>`** — подформа: `model` — ручка группы (`model.$.address`), `part(subModel)` — часть схемы, объявленная один раз и подключаемая к любой группе той же формы данных.
- **`ContainerRenderNode<T>`** — узел-контейнер. В `component` — React-компонент **либо нативный HTML-тег строкой** (`'div'`, `'h3'`, `'hr'`), содержимое задаётся в **top-level** `children` (НЕ в `componentProps`): вложенные узлы и текстовые части (`RenderChild`) вперемешку. Контейнер без `component` — группировка в схеме: рендерер рисует только его детей (такой узел описывает тип `FormSchemaNode`; `ContainerRenderNode` требует `component`).
- **`selector`** — идентификатор узла: по нему узел адресуют поведение (`schema.node('…')`) и поток шагов визарда. В одной области схемы `selector` уникален — повтор бросает исключение при сборке.

Ключей `value:` и `array:` у узла нет — это прежний контракт. Компилятор их не читает и в dev пишет предупреждение с подсказкой (`value` → `model: model.$.<поле>`, `array` → `model: model.$.<массив>`).

Вид узла определяет компилятор ядра `compileSchema` — его итог читают и сборка формы, и рендерер:

```typescript
import { compileSchema } from '@reformer/core';
import { isHtmlTagRenderNode } from '@reformer/renderer-react';

const { root } = compileSchema(tree, model);
switch (root.kind) {
  case 'field': /* root.handle — ручка модели; root.component, root.props */ break;
  case 'array': /* root.control — массив модели; root.row(rowModel) — схема строки */ break;
  case 'part': /* root.content — скомпилированная схема части */ break;
  case 'container': /* root.children — узлы и текст ({ kind: 'text', parts }) */ break;
}
if (isHtmlTagRenderNode(tree)) {
  /* tree.component — строка-тег ('div'), а не компонент */
}
```

### HTML-узлы и текст

Презентационная вёрстка (заголовки, инфо-плашки, разделители, сводки) описывается прямо в схеме — отдельный React-компонент ради неё заводить не нужно:

```typescript
{
  component: 'div',
  componentProps: { className: 'p-4 bg-blue-50 rounded-md' },  // для тега это DOM-атрибуты
  children: [
    { component: 'h3', children: ['Итого'] },
    { component: 'p', children: ['Платёж: ', model.$.monthlyPayment, ' ₽'] },
    { component: 'hr' },
  ],
}
```

- **Ребёнок** (`RenderChild`) — вложенный узел ЛИБО текстовая часть: литерал (`string`/`number`) или **сигнал** (`model.$.x`, `computed(...)`). Соседние текстовые части склеиваются без разделителя; `null`/`undefined` в сигнале дают пустую строку.
- Сигнал подписывается **точечно**: при изменении модели перерисовывается только текст, а не поддерево узла.
- Порядок в `children` соблюдается, поэтому текст можно ставить и до, и после узла: `{ component: 'p', children: [{ component: 'b', children: ['Важно:'] }, ' и далее текст'] }` → `<p><b>Важно:</b> и далее текст</p>`.
- `selector` в DOM **не** пробрасывается (он адресует узел схемы, а не элемент), но `hideWhen`/`patchProps` по нему работают как обычно.
- Void-теги (`hr`, `br`, `img`) содержимого не получают — `children` для них игнорируются.
- Текст работает и на узле-компоненте: `{ component: Button, children: ['Отправить'] }` — он приходит компоненту обычным React-`children`.
- Компоненты, которые рисуют детей сами (`__selfManagedChildren`: `FormWizard`, табы), получают узлы-дети данными — текстовые части им не передаются (в dev об этом предупреждает console.warn).

## Examples

Двухколоночная форма с секцией. Листья несут `model: model.$.x` + `component` + `componentProps`. `children` — top-level свойство контейнера:

```tsx
import type { FormModel } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { Box, Section, Input } from '@reformer/ui-kit';

export const mySchema = (model: FormModel<MyForm>): RenderNode<MyForm> => ({
  component: Box,
  componentProps: { className: 'grid grid-cols-2 gap-4' },
  children: [
    {
      component: Section,
      componentProps: { title: 'Личные данные', className: 'space-y-4' },
      children: [
        { model: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
        { model: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
      ],
    },
  ],
});
```

### Массив модели { #array }

Узел-массив: `model` — ручка массива модели, `item(row)` строит поддерево по под-модели строки, `component` — компонент-рендерер секции. Оформление (заголовок, кнопки, empty-message, reorder) — в `componentProps`:

```tsx
import type { FormModel } from '@reformer/core';
import { Box, FieldArray, Input, SelectAsync } from '@reformer/ui-kit';

// Строка массива — функция от под-модели элемента: пути — от строки.
const coBorrowerRow = (row: FormModel<CoBorrower>): RenderNode<CreditForm> => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    { model: row.$.phone, component: Input, componentProps: { label: 'Телефон' } },
    { model: row.$.relationship, component: SelectAsync, componentProps: { label: 'Отношение' } },
  ],
});

const coBorrowersNode: RenderNode<CreditForm> = {
  selector: 'co-borrowers-array',
  model: model.$.coBorrowers,
  component: FieldArray, // ОБЯЗАТЕЛЕН для UI управления (add/remove/reorder)
  componentProps: {
    title: 'Созаемщики',
    itemLabel: 'Созаемщик',
    addButtonLabel: '+ Добавить созаемщика',
    emptyMessage: 'Нажмите «Добавить созаемщика»',
    reorderable: true,
  },
  item: coBorrowerRow,
};
```

Шаблон новой строки для кнопки «Добавить» объявляется в модели — рядом с остальными начальными значениями:

```typescript
import { arrayOf, createModel } from '@reformer/core';

createModel<CreditForm>({ /* … */ coBorrowers: arrayOf(blankCoBorrower) });
```

Внутри `item` листья привязываются к ручкам **под-модели** строки (`row.$.<field>`). Форму строки (`FormGroup` в `FormArray`) строит сборка; рендерер итерирует строки и рисует поддерево каждой в её собственной области схемы (`selector` внутри строки адресуется из поведения строки — `applyEach`, см. [08-form-bundle.md](08-form-bundle.md)).

**Top-level свойства узла** (не в `componentProps`): `model` (ручка массива), `item(row)` (схема строки), `component` (компонент-рендерер секции), `initialValue` (запасной шаблон нового элемента), `selector` (для поведения).

**`component` обязателен, если нужен UI управления.** Рендерер сам разметку не шипает: он итерирует массив и отдаёт компоненту готовые элементы. Узел **без** `component` рендерится безхромным fallback'ом — элементы есть, кнопок «Добавить»/«Удалить»/↑↓ нет, в консоль идёт предупреждение. Бери `FieldArray` (редактируемая секция) или `List` (display-список без add/remove) из `@reformer/ui-kit` либо свой компонент.

**`initialValue` — запасной путь.** Нужен форме, чья модель создаётся из данных без кода; шаблон модели (`arrayOf(blank)`) главнее. Значение или фабрика `() => value`.

**Полный контракт `componentProps`** для `component: FieldArray` (`@reformer/ui-kit`) — других полей нет:

| prop | default |
|---|---|
| `title?: string` | — |
| `addButtonLabel?: string` | словарь локали (`kit.fieldArray.add`) |
| `removeButtonLabel?: string` | словарь локали (`kit.fieldArray.remove`) |
| `emptyMessage?: string` | — (показ при `length === 0`) |
| `emptyMessageHint?: string` | — (подсказка под empty-состоянием) |
| `itemLabel?: string \| ((row, i) => string)` | — (string → `` `${itemLabel} #${i + 1}` ``) |
| `reorderable?: boolean` | `false` (кнопки ↑/↓, `disabled` на концах) |
| `showRemoveOnSingle?: boolean` | `false` (кнопка «Удалить» скрыта при единственном элементе) |
| `className?: string` | `'space-y-3 mt-2'` |
| `cardClassName?: string` | `'mb-4 p-4 bg-card text-card-foreground rounded border'` |

**`maxItems` НЕ существует.** Это выдуманный проп — компонент его игнорирует. Чтобы ограничить количество элементов, используй поведение (`hideWhen` на add-аффордансе), а не проп.

**Контракт компонента-рендерера массива.** Итерацию (подписку на структуру, кэш поддеревьев, стабильные ключи) делает рендерер, а компонент получает `ArrayComponentProps` — готовые `items: ArrayItemSlot[]` (`{ key, index, model, children }`) и колбэки `onAdd`/`onRemove`/`onMove` — плюс `componentProps` узла. `onAdd()` зовёт `push()` без значения: новая строка берётся из шаблона массива. Компонент не подписывается на модель и не вызывает хуков рендерера, поэтому свою секцию можно написать на любой UI-библиотеке и протестировать на фейковых `items` без формы:

```tsx
import type { ArrayComponentProps } from '@reformer/renderer-react';

function MyArraySection({ items, onAdd, onRemove }: ArrayComponentProps) {
  return (
    <div>
      {items.map((it) => (
        <div key={it.key}>
          {it.children}
          <button onClick={() => onRemove(it.index)}>Удалить</button>
        </div>
      ))}
      <button onClick={onAdd}>Добавить</button>
    </div>
  );
}
```

Узел массива `{ model, item, component }` — канон для схемы (одинаково для renderer-react и renderer-json; эталон — `complex-multy-step-form`, файлы `schema/steps/*.ts` и `schema/sections/*.ts`); `FieldArraySection` из [ui-kit](../../../reformer-ui-kit/docs/llms/08-field-array-section.md) и `FieldArray` из [cdk](../../../reformer-cdk/docs/llms/02-field-array.md) — для рукописного JSX. Они параллельны, а не конкурируют: узел массива описывает массив декларативно в дереве, compound-компоненты собирают его руками.

Testid-конвенции секции (для e2e): `array-add`, `array-item-{i}`, `array-item-{i}-remove`, `array-item-{i}-move-up`, `array-item-{i}-move-down`.

### Подформа { #part }

Часть схемы объявляется один раз как функция от под-модели и ставится в схему сколько угодно раз — к разным группам той же формы данных:

```typescript
const address = (sub: FormModel<Address>): RenderNode<CreditForm> => ({
  component: Box,
  children: [{ model: sub.$.city, component: Input, componentProps: { label: 'Город' } }],
});

{ model: model.$.registrationAddress, part: address }
{ model: model.$.residenceAddress, part: address }
```

У части своя область схемы: её `selector` адресуется из поведения, подключённого к той же группе (`apply(model.$.registrationAddress, addressBehavior)`).

## Programmatic API

У бандла `createForm` есть управление узлами корневой области — `bundle.render.node(selector)`:

```tsx
// Императивное управление узлом по selector (например, из демо-панели или useEffect):
bundle.render.node('extra-section').setHidden(true);
bundle.render.node('extra-section').patchProps({ title: 'Новый заголовок' });
bundle.render.node('extra-section').resetHidden();
```

Декларативные правила (`hideWhen`, `onComponentEvent`, lifecycle) пишутся в поведении формы — `defineFormBehavior(({ model, schema }) => hideWhen(schema.node('extra-section'), () => !model.hasExtras))`, см. [03-render-behavior.md](03-render-behavior.md).

Низкоуровневый путь без бандла — `createRenderSchema(fn)`: оборачивает `RenderSchemaFn` (`() => RenderNode<T>`) в `RenderSchemaProxy` с тем же `.node(selector)` и рендерится через `<FormRenderer render={proxy} />`. Форму из того же дерева тогда собирают отдельно — `createFormFromModel({ model, schema })`; области строк и подформ у такой схемы нет (она одна на всё дерево).

## Anti-patterns

- **Возвращать React-element вместо узла** — билдер схемы возвращает описание (`{ component, componentProps, children }` или `{ model, component }`), а не JSX. Сам JSX строит `FormRenderer`.
- **Ключи `value:` / `array:` у узла** — прежний контракт. Поле — `{ model: model.$.x, component }`, массив — `{ model: model.$.items, component: FieldArray, item: (row) => узел }`.
- **`model: model.items` (value-фасад) вместо `model: model.$.items`** — привязка узла — ручка из дерева `model.$`. Фасад компилятор не распознаёт как поле и пишет предупреждение.
- **Класть `children` в `componentProps`** — `children` это TOP-LEVEL свойство контейнера. В `componentProps.children` узлы не отрисуются.
- **Повторять `selector` в одной области** — сборка бросает исключение с путями обоих узлов. В строках массива и подформах селекторы живут в своих областях и с корнем не пересекаются.
- **Рендерить дерево без сборки** — лист находит ноду поля по ручке через реестр, который заполняет `createForm` (на низкоуровневом пути — `createFormFromModel({ model, schema })`). Без сборки поле логирует warning и рендерится как `null`.
- **Заводить компонент ради статичного блока текста** — `{ component: 'div', children: [{ component: 'p', children: ['…'] }] }` описывает то же самое схемой; отдельный компонент нужен, когда есть своя логика или состояние.
- **Ожидать реактивности от интерполяции строкой** — `children: [\`Платёж: ${model.$.x.value} ₽\`]` читает значение ОДИН раз при построении схемы. Реактивен только сам сигнал: `children: ['Платёж: ', model.$.x, ' ₽']`.

## See also

- [01-overview.md](01-overview.md) — сборка `createForm` и `FormRenderer`.
- [03-render-behavior.md](03-render-behavior.md) — `hideWhen`, `renderEffect`, lifecycle.
- [06-validation.md](06-validation.md) — валидация значений отдельной схемой над моделью (у узла нет `validators`).
- [08-form-bundle.md](08-form-bundle.md) — области схемы строк и подформ.
- [04-troubleshooting.md](04-troubleshooting.md).
- [05-cookbook.md](05-cookbook.md) — `resolveFieldAdapter`/`FieldAdapter`: подключение сырых контролов сторонней UI-kit без per-контрол обёрток.
