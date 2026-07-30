# План: адаптер-хук в рендерере → любой UI-kit подключается сырыми компонентами (Hexa UI как первый)

## Context

`@reformer/renderer-react` прикладывает к компоненту поля фиксированный **value-based seam**
(`value` + `onChange(value)` + `onBlur` + `disabled` + `control`). Реальные UI-kit-контролы говорят
на разных диалектах (Checkbox: `checked`+`e.target.checked`; Select: `value`+`(value,option)`;
Radio: `value`+`e.target.value`), поэтому нужен **перевод (адаптер)** — он неизбежен и по природе
на каждое семейство контролов свой. Перевод **обязан** жить в слоте `node.component` (seam инжектится
туда до оборачивания fieldWrapper'ом — см. [render-node.tsx:159-176](packages/reformer-renderer-react/src/core/render-node.tsx#L159-L176)),
поэтому спрятать его целиком в FormField нельзя.

**Выбранное решение (Вариант A):** вынести адаптер в **хук на уровне рендерера**. Приложение
регистрирует **сырые** компоненты любого кита + отдаёт одну таблицу адаптеров через
`settings.resolveFieldAdapter`. Это делает подключение любого UI-kit максимально простым и generic;
Hexa UI — первый потребитель. Ядро при этом не зависит ни от одного кита (хук декларативный).

**Объём этой задачи:** в ЭТОМ репозитории реализуем ТОЛЬКО ядровый хук в `@reformer/renderer-react`
(разделы «Изменения в ядре» → 1, 2, 3, 4). Раздел «Hexa-интеграция» ниже — **контракт-референс** для
отдельного репозитория, где пользователь соберёт потребителя; здесь его НЕ реализуем.

## Изменения в ядре

### 1. `renderer-react` — тип адаптера + поле в настройках
[packages/reformer-renderer-react/src/core/types.ts](packages/reformer-renderer-react/src/core/types.ts):
```ts
export interface FieldAdapter {
  valueProp?: string;        // куда класть значение (default 'value')
  changeProp?: string;       // какой колбэк слушать (default 'onChange')
  fromEmit?: (arg: unknown, rest: Record<string, unknown>) => unknown; // emit контрола → значение
  toValue?: (value: unknown) => unknown;   // значение → valueProp (+coerce)
  bindBlur?: (onBlur: () => void) => Record<string, unknown>;
  strip?: string[];          // убрать перед спредом в контрол
}
export interface RendererSettings {
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
  /** Резолв адаптера по компоненту поля. Нет адаптера → текущий value-based seam (обратная совместимость). */
  resolveFieldAdapter?: (component: React.ComponentType<any>) => FieldAdapter | undefined;
}
```
Экспортировать тип `FieldAdapter` из [index.ts](packages/reformer-renderer-react/src/index.ts).

### 2. `renderer-react` — применить адаптер в `ModelFieldRenderer`
[render-node.tsx](packages/reformer-renderer-react/src/core/render-node.tsx): `RenderNodeComponent`
уже имеет `settings` ([:487](packages/reformer-renderer-react/src/core/render-node.tsx#L487)) — прокинуть
`resolveFieldAdapter={settings?.resolveFieldAdapter}` в `ModelFieldRenderer` ([:539-546](packages/reformer-renderer-react/src/core/render-node.tsx#L539-L546)).
Внутри `ModelFieldRenderer`, где сейчас собирается `input` ([:150-167](packages/reformer-renderer-react/src/core/render-node.tsx#L150-L167)):
```tsx
const adapter = resolveFieldAdapter?.(Component);
const seam = adapter
  ? {
      [adapter.valueProp ?? 'value']: (adapter.toValue ?? ((v)=>v))(value),
      [adapter.changeProp ?? 'onChange']: (a: unknown) => onChange((adapter.fromEmit ?? ((x)=>x))(a, rest)),
      ...(adapter.bindBlur ? adapter.bindBlur(onBlur) : { onBlur }),
      // control НЕ пробрасываем: сырой контрол его не потребляет (иначе React-warning про unknown prop)
    }
  : { control: fieldNode, value, onChange, onBlur }; // ← без адаптера поведение как сейчас (ui-kit не ломается)
// adapter.strip удаляется из inputComponentProps; disabled/data-testid проставляются как сейчас
const input = <Component disabled={disabled} {...inputComponentProps} {...(nodeRef?{ref:nodeRef}:{})} {...seam} />;
```
**Обратная совместимость:** `resolveFieldAdapter` опционален; без него ветка `else` — точно текущее
поведение (`control`+value-based seam), существующие ui-kit-формы не меняются.

### 3. `renderer-json` — изменений НЕТ
`JsonRendererSettings extends RendererSettings` ([json-renderer-context.tsx:17](packages/reformer-renderer-json/src/context/json-renderer-context.tsx#L17)),
`resolveFieldAdapter` наследуется автоматически; [json-form-renderer.tsx:176](packages/reformer-renderer-json/src/components/json-form-renderer.tsx#L176)
спредит `rendererSettings` в `FormRenderer`, поэтому поле долетает без правок. Приложение кладёт
`resolveFieldAdapter` в settings провайдера.

### 4. `cdk` — опционально
`CdkFormFieldControl` ([FormFieldControl.tsx:104-114](packages/reformer-cdk/src/components/form-field/FormFieldControl.tsx#L104-L114))
инжектит value-based seam при auto-render/`asChild` ui-kit `FormField`. Для Hexa мы используем СВОЙ
`HexaFormField` (чистый «хром», без cdk-слотов), поэтому этот путь не задействован. Правка cdk нужна
только если захотим, чтобы **standalone** `<FormField>` из ui-kit тоже уважал адаптер — вне текущей задачи.

## Hexa-интеграция (потребитель хука)

- **`hexa-adapters.ts`** — таблица `FieldAdapter` + резолвер:
  ```ts
  const TABLE = new Map<unknown, FieldAdapter>([
    [Checkbox, { valueProp:'checked', fromEmit:(e)=>(e as any).target.checked, toValue:(v)=>v??false }],
    [Toggle,   { valueProp:'checked', fromEmit:(c)=>c===true, toValue:(v)=>v??false }],
    [Select,   { fromEmit:(v)=>v, toValue:(v)=>v??undefined }],              // drop option (2-й арг игнорим)
    [Radio,    { fromEmit:(e)=>(e as any).target.value, toValue:(v)=>v??undefined }],
    // Textbox/Textarea/Number/Password — value-based, адаптер НЕ нужен (нет записи → default seam)
  ]);
  export const resolveHexaAdapter = (c: unknown) => TABLE.get(c);
  ```
- **`HexaFormField.tsx`** — «хром» (fieldWrapper): получает `{ control, className, testId, children }`,
  рисует label + ошибку средствами hexa (`FormLabel`/`Field` + `HelpMessage`), читая ядровый `control`
  (`control.error`, `control.componentProps` → label/required/description). `children` (уже адаптированный
  контрол) вставляет как есть; seam НЕ ре-биндит. Inline-контролы (Checkbox/Toggle) — подавляет верхний label.
- **`setup.ts`** — `hexaSettings` + регистрация СЫРЫХ компонентов:
  ```ts
  export const hexaSettings = { fieldWrapper: HexaFormField, resolveFieldAdapter: resolveHexaAdapter };
  export function registerHexaControls(reg) {
    reg.component('Input', Textbox); reg.component('Textarea', Textbox.Textarea);
    reg.component('Select', Select); reg.component('Checkbox', Checkbox);
    reg.component('Toggle', Toggle); reg.component('Radio', Radio);   // ← ВСЁ сырое
  }
  ```

## Использование в приложении — сырые компоненты, ноль клея

**renderer-react:**
```tsx
import { Textbox, Select, Checkbox } from '@kaspersky/hexa-ui';
import { hexaSettings } from '<hexa>';
const schema = () => ({ component: Box, children: [
  { value: model.$.email, component: Textbox,  componentProps: { label: 'Email' } },   // сырой Textbox
  { value: model.$.agree, component: Checkbox, componentProps: { label: 'Согласен' } }, // сырой Checkbox
]});
<FormRenderer render={schema} settings={hexaSettings} />;
```

**renderer-json:**
```tsx
const registry = defineRegistry((reg) => { registerHexaControls(reg); reg.dataSource('ROLES', ROLES); });
<JsonRendererProvider settings={{ registry, model, ...hexaSettings }}>
  <JsonFormRenderer schema={jsonSchema} />
</JsonRendererProvider>;
// JSON-узлы обычные: { "value":"$model(agree)", "component":"$component(Checkbox)", "componentProps":{"label":"Согласен"} }
```

Адаптер применяется рендерером к сырому `Checkbox` автоматически; `HexaFormField` пришёл дефолтным
fieldWrapper'ом через `settings`. Приложение per-control кода не пишет.

## Почему это «правильно» для любого кита

Подключить новый UI-kit = (1) одна `Map<component, FieldAdapter>` (только для контролов с нестандартным
диалектом; value-based — бесплатно), (2) один «хром»-FormField. Компоненты регистрируются **сырыми**,
адаптер — декларативные данные, ядро остаётся UI-агностичным. Тот же путь для shadcn/MUI/antd.

## Оценка объёма

| Слой | Объём | Комментарий |
|---|---|---|
| Ядро: `FieldAdapter` + `resolveFieldAdapter` + хук в ModelFieldRenderer | S | ~1 тип + ~15 строк + экспорт; opt-in, обратно совместимо |
| Тесты ядра (адаптер применяется/не ломает default) | S | unit на ModelFieldRenderer |
| Hexa: `hexa-adapters` (таблица+резолвер) | S | ~4 записи |
| Hexa: `HexaFormField` (хром) | S–M | label/ошибка через hexa, inline-label |
| Hexa: `setup` (hexaSettings + registerHexaControls) | S | сырые регистрации |
| Демо react + json (одинаковая форма) | S | приложение — сырые компоненты |
| deps + глобальные стили/шрифты | S | hexa, -icons, styled-components; peer override React |
| **Итого** | **~M** | ядровая часть маленькая и переиспользуемая всеми китами |

## Критичные файлы

Ядро (править): [types.ts](packages/reformer-renderer-react/src/core/types.ts),
[render-node.tsx](packages/reformer-renderer-react/src/core/render-node.tsx),
[index.ts](packages/reformer-renderer-react/src/index.ts).
Hexa (создать): `hexa-adapters.ts`, `HexaFormField.tsx`, `setup.ts`, демо-страницы
`projects/react-playground/src/pages/examples/hexa-{renderer-react,renderer-json}/`.
Референс-паттерны (читать): `FieldAdapter` — [adapters.ts](packages/reformer-ui-kit/src/fields/adapters.ts);
чтение `control` для label/ошибки — [form-field.tsx](packages/reformer-ui-kit/src/components/form-field/form-field.tsx).

## Риски / ограничения

- **React 19 vs hexa peer ≤18** — «19 ок» (override peer); первый шаг — smoke на React 19.
- **`control`-проп для сырых контролов** — в адаптер-ветке НЕ пробрасываем (иначе React-warning про unknown
  prop у antd-контролов, спредящих rest в DOM); в default-ветке оставляем (ui-kit его потребляет).
- **styled-components / глобальные стили / порталы** — импорт css+шрифтов; проверить `PopupConfigProvider`.
- **Тяжёлые транзитивные зависимости hexa** — импорт по subpath, не баррелом.
- **Экзотические контролы** (async-Select loadMore, imperative handle) — точечная обёртка как escape hatch.

## Verification (end-to-end)

1. **Обратная совместимость**: существующие ui-kit-формы (renderer-react и renderer-json) рендерятся
   без изменений при отсутствии `resolveFieldAdapter` (default-ветка = текущее поведение).
2. **Compat-smoke**: сырой hexa `Textbox` на React 19 — ввод/`onChange(value)`/`onBlur` без ошибок.
3. **renderer-react**: форма с сырыми `Textbox`/`Select`/`Checkbox` + `hexaSettings` — двусторонняя привязка
   к модели (Checkbox через адаптер пишет bool, Select — значение), показ ошибок.
4. **renderer-json**: та же форма из `json-schema.json`, `settings={{…hexaSettings}}` — вывод идентичен react.
5. **e2e/screenshot**: playwright (fullPage) в `projects/react-playground-e2e/screenshots/hexa/…`; заполнение
   + submit, сверка значений модели.
