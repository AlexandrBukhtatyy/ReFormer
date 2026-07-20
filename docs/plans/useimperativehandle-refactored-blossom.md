# План: типизированные императивные handle для полей UI-kit, связанные со схемой по селектору

> Тип: implementation plan. Полный роллаут (фундамент + baseline для всех полей + 5 rich-handle + примеры).
> Декларативный оператор renderer-json (`focusWhen`/`call`) — **отложен**, в этом плане только JS-слой (`getRef` + render-behaviors).
> Дата: 2026-07-19.

## Context

Сейчас `useImperativeHandle` в ReFormer применяется только к контейнерам — `FormWizard` (`FormWizardHandle<T>`) и `FormArray` (`FormArrayHandle<T>`). Инфраструктура «достучаться до компонента по селектору из схемы» уже есть — `RenderNodeControl.getRef<H>()` ([render-schema-proxy.ts:234](../../packages/reformer-renderer-react/src/core/render-schema-proxy.ts)) кэширует `createRef` в `refRegistry` и уже используется render-behaviors для управления wizard. Но `ref` реально прикрепляется **только в ветках контейнера** ([render-node.tsx:474/484](../../packages/reformer-renderer-react/src/core/render-node.tsx)); для листового поля ref не пробрасывается, поэтому `schema.node('email').getRef()` навсегда возвращает `null` (**GAP 1**).

**Цель:** дать каждому полю UI-kit типизированный императивный handle и пробросить его через схему, чтобы из behaviors можно было делать `schema.node('email').getRef<InputHandle>().current?.focus()`. Handle покрывает только **истинно императивные** действия (focus/scroll/open/close/reload/toggleVisibility); реактивное состояние остаётся в behaviors.

**Почему это оправдано (кратко):** заполняет уже спроектированную дыру (паттерн `*Handle`+`getRef` доказан на wizard); даёт то, что реактивно невыразимо (focus-on-error, scroll-to-field, программное открытие dropdown, `reload()` async-источника); централизуется через единую точку — HOC `withFormControl`.
**Главный риск:** императивный escape hatch в signal-first ядре → жёсткая граница слоёв (ниже) обязательна, иначе появятся два способа делать одно и то же.

## Граница слоёв (обязательный инвариант)

| Действие | Слой | API |
|---|---|---|
| value / compute / copy / sync | реактивный | `computeFrom/copyFrom/…`, `field.setValue` |
| enable / disable | реактивный | `enableWhen/disableWhen` |
| visibility | реактивный | `hideWhen/setHidden` |
| options / props | реактивный | `updateComponentProps/patchProps` |
| validate | реактивный | `validate/revalidateWhen` |
| **focus / blur / scrollIntoView** | **императивный (handle)** | `getRef<FieldHandle>().current?.focus()` |
| **open / close (dropdown, popover, calendar)** | **императивный** | `getRef<SelectAsyncHandle>().current?.open()` |
| **reload / loadMore (async source)** | **императивный** | `…reload()` |
| **select / setSelectionRange** | **императивный** | `getRef<InputHandle>().current?.select()` |
| **toggleVisibility (password)** | **императивный** | `getRef<InputPasswordHandle>().current?.setVisible(v)` |

Value/disabled/visible/options/validation через handle **не дублировать**.

## Архитектурные решения

- **D1 — два механизма, не один.** `buildHandle(elRef)` на слое HOC умеет собрать только **baseline**-handle из DOM-узла; rich-методы (`open/reload/toggleVisibility`) живут внутри `useState/useReducer` композита и из HOC недостижимы. Поэтому: baseline `FieldHandle` синтезирует `withFormControl`; rich-handle реализует сам композит своим `useImperativeHandle`, а field-обёртка использует **passthrough** (ref потребителя указывает прямо на handle композита).
- **D2 — расширяем HOC третьим аргументом `options`, не перегружаем `FieldAdapter`.** `FieldAdapter` строго про event-shape ([with-form-control.tsx:11](../../packages/reformer-ui-kit/src/fields/with-form-control.tsx)); добавление в него handle-логики размывает контракт всех 6 пресетов. Добавляем: `withFormControl(Primitive, adapter, options?: { exposesHandle?: boolean; buildHandle?: (el) => FieldHandle })`. Аддитивно — все существующие вызовы (`InputBaseField` и т.п.) не меняются.
- **D3 — `forwardRef` в HOC** (не полагаться на React-19 ref-as-prop): совместимость с React-18-консумерами на границе seam + единый стиль с `FormWizard`/`FormArray`. Возвращаемый тип меняется на `ForwardRefExoticComponent<… & RefAttributes<FieldHandle>>`, но field-варианты присваиваются в `component: ComponentType<any>` схемы → слой схемы не затронут (явных аннотаций `ComponentType<Record<string,unknown>>` на вариантах нет).
- **D4 — контракты handle живут в `@reformer/ui-kit`** (поля их реализуют; ui-kit зависит от cdk/renderer, не наоборот). Baseline — в новом React-free файле `packages/reformer-ui-kit/src/fields/field-handle.ts` (`import type { RefObject }` полностью стирается — безопасно для Node/MCP-ограничения, как `seam.props.ts`). Rich-handle — рядом со своим композитом (напр. `SelectAsyncHandle` в `select-async.tsx`). Оба реэкспортируются из индекса пакета. Зеркалит `FormWizardHandle` рядом с `FormWizard`.
- **D5 — `getRef<H>()` уже generic и unconstrained**; типобезопасность — на утверждении вызывающего (как сегодня `getRef<FormWizardHandle<T>>()`). Не выводим `H` из селектора (схема не индексирована статически). Просто отгружаем хорошо названные экспортируемые типы handle.

## Контракты handle

```ts
// packages/reformer-ui-kit/src/fields/field-handle.ts (новый, React-free)
export interface FieldHandle {
  focus(): void;
  blur(): void;
  scrollIntoView(opts?: ScrollIntoViewOptions): void;
  getElement(): HTMLElement | null;
}
export const makeElementFieldHandle = (el: RefObject<HTMLElement | null>): FieldHandle => ({
  focus: () => el.current?.focus(),
  blur: () => el.current?.blur(),
  scrollIntoView: (a) => el.current?.scrollIntoView(a),
  getElement: () => el.current,
});

// рядом с композитами:
export interface InputHandle extends FieldHandle { select(): void; setSelectionRange(s: number, e: number): void; }
export interface SelectAsyncHandle extends FieldHandle { open(): void; close(): void; clear(): void; reload(): void; loadMore(): void; }
export interface ComboboxHandle extends FieldHandle { open(): void; close(): void; clear(): void; }
export interface DatePickerHandle extends FieldHandle { open(): void; close(): void; }
export interface InputPasswordHandle extends FieldHandle { toggleVisibility(): void; setVisible(v: boolean): void; }
```

## Фазы

### Фаза 0 — фундамент: baseline-контракт + HOC (поведение не меняется)
Каждое поле может экспонировать `FieldHandle`, но ещё никто не потребляет — мёржится изолированно.
- `packages/reformer-ui-kit/src/fields/field-handle.ts` (новый): `FieldHandle` + `makeElementFieldHandle`.
- `packages/reformer-ui-kit/src/fields/with-form-control.tsx:40-62`: перевести `Field` на `forwardRef`; добавить внутренний `elRef`; **разделить на два внутренних компонента** `BaselineField`/`PassthroughField` по `options.exposesHandle`, чтобы хуки были безусловны (Rules of Hooks — см. R1). Baseline: `ref={elRef}` в примитив + `useImperativeHandle(ref, () => options.buildHandle?.(elRef) ?? makeElementFieldHandle(elRef), [])`. Passthrough: `ref={ref}` прямо в примитив, без своего `useImperativeHandle`. Логику `control`/value/onChange/bind/strip сохранить дословно.
- **Приёмка:** `pnpm -F @reformer/ui-kit typecheck`; unit — монтируем `InputBaseField` с `ref`, `ref.current.focus()` → `document.activeElement` === input. Рендерер не трогаем.

### Фаза 1 — проброс ref листа через рендерер (закрывает GAP 1)
`schema.node('email').getRef<FieldHandle>().current?.focus()` работает для листа с `selector`.
- `packages/reformer-renderer-react/src/core/render-node.tsx`: передать уже вычисленный `nodeRef` ([:395](../../packages/reformer-renderer-react/src/core/render-node.tsx)) в лист-ветку ([:428](../../packages/reformer-renderer-react/src/core/render-node.tsx)) и в `ModelFieldRenderer`; отрендерить `<Component ref={nodeRef} control={fieldNode} …/>` ([:145](../../packages/reformer-renderer-react/src/core/render-node.tsx)). Контейнерные ветки не трогаем. `ModelFieldRenderer` — `memo`, `nodeRef` — стабильный `createRef` → memo не тарашит.
- `packages/reformer-ui-kit/src/components/input/input-field.tsx`: диспетчер `InputField` (роутит на `InputNumberField`/`InputBaseField`) сделать `forwardRef` и пробросить `ref`, иначе для `type="number"` и дефолтного input ref теряется.
- **Приёмка:** unit — одно-листовая `createRenderSchema` с `selector:'email'`, behavior в `onMount` зовёт `getRef().current?.focus()`; проверить фокус **и** что `control`-путь value/onChange цел (ввод обновляет сигнал) — ключевой регресс.

### Фаза 2 — PoC rich-handle на одном композите (InputPassword)
Проверяем passthrough + rich-слой end-to-end на простейшем уже-`forwardRef` композите.
- `packages/reformer-ui-kit/src/components/input/variants/password/input-password-base.tsx`: тип ref → `InputPasswordHandle`; `useImperativeHandle` с baseline + `toggleVisibility()`/`setVisible(v)` (использует существующий `useState showPassword`).
- `…/input-password-base.field.tsx`: передать `{ exposesHandle: true }` в `withFormControl`.
- Экспорт `InputPasswordHandle` из индекса ui-kit.
- **Приёмка:** unit — `getRef<InputPasswordHandle>().current?.toggleVisibility()` переключает `type` input между `password`/`text`; `focus()` фокусирует.

### Фаза 3 — раскатка rich-handle на остальные 4 композита
Каждый получает `<Name>Handle extends FieldHandle` + `{ exposesHandle: true }` в `.field.tsx`:
- **SelectAsync** (`packages/reformer-ui-kit/src/components/select/variants/async/select-async.tsx`): **поднять `open` в контролируемый `useState`** (сейчас Radix `Root` неконтролируемый, `onOpenChange` только шлёт `onBlur` — императивного `open()` нет); добавить `triggerRef` на `SelectTrigger`; экспонировать `open/close/reload/loadMore/clear` + baseline. `reload/loadMore` — из `useResourceOptions`. Проверить регресс: typeahead, фокус поиска, пагинация-по-скроллу, `onBlur` при закрытии.
- **Combobox** (`…/combobox/variants/base/combobox-base.tsx`): ретрофит `forwardRef` + `triggerRef` на `Button` (сейчас plain-функция без ref); `open/close/clear` + baseline (использует существующий `useState open`).
- **DatePicker** (`…/date-picker/variants/base/date-picker-base.tsx`): ретрофит `forwardRef` + `triggerRef`; `open/close` + baseline (существующий `useState open`).
- **InputNumberField** (`…/input/variants/number/input-number.field.tsx`): кастомная обёртка мимо `withFormControl` → перевести на `forwardRef`, `elRef` на `<Input>`, baseline через общий `makeElementFieldHandle` (rich-методы не нужны).
- **Приёмка:** per-composite unit на ключевой императивный метод (open меню, clear, toggle); e2e в Фазе 5.

### Фаза 4 — динамические селекторы для строк FormArray
`schema.node('phones.0.number').getRef()` резолвится без перечисления индексов автором схемы.
- Сигнал значения уже несёт индексный `__path` (`phones.0.number`), уже читается в [render-node.tsx:128](../../packages/reformer-renderer-react/src/core/render-node.tsx). В лист-ветке резолвить ключ ref как `node.selector ?? __path` (только для model-field нод) и брать из `overrideMaps.refRegistry` — не переиспользуя контейнерный `nodeRef` с [:395](../../packages/reformer-renderer-react/src/core/render-node.tsx) (он ключуется только по `selector` и `undefined`, когда селектора нет).
- **Приёмка:** array-e2e — добавить строку, после `queueMicrotask` сфокусировать input новой строки из behavior.

### Фаза 5 — экспорты, доки, e2e
- Публичные экспорты всех handle-типов (индекс ui-kit).
- Доки-рецепт (`packages/reformer-ui-kit/docs/llms/…`) по образцу wizard-примера в `render-behavior.ts`.
- Playground-страница + Playwright-спеки (см. Тесты).

## Ключевые код-наброски (тонкие места)

### GAP 1 — проброс ref листа (`render-node.tsx`)
`ref` — отдельный канал от `control`, они не конфликтуют; HOC `control` и так снимает.
```tsx
// лист-ветка (~:428) — передаём уже вычисленный nodeRef
return <ModelFieldRenderer node={node} fieldNode={fieldNode}
                           fieldWrapper={fieldWrapper} nodeRef={nodeRef} />;
// ModelFieldRenderer (~:96) — добавить prop, повесить на Component (~:145)
const input = (
  <Component ref={nodeRef} control={fieldNode} {...inputProps} onChange={onChange} onBlur={onBlur} />
);
```
Фаза 4: внутри лист-ветки вычислить `const refKey = node.selector ?? (node.value as {__path?:string}).__path;` и смотреть `overrideMaps.refRegistry` по нему.

### HOC → forwardRef, разнесённый на два компонента (`with-form-control.tsx`)
Разнесение обязательно: при `exposesHandle` нельзя одновременно форвардить `ref` в ребёнка и биндить свой `useImperativeHandle` (последний писатель побеждает, ref задвоится). Два внутренних компонента держат хуки безусловными:
```tsx
export function withFormControl<P extends object, H extends FieldHandle = FieldHandle>(
  Primitive: ComponentType<P>, adapter: FieldAdapter,
  options?: { exposesHandle?: boolean; buildHandle?: (el: RefObject<HTMLElement|null>) => H },
): ForwardRefExoticComponent<Record<string, unknown> & RefAttributes<H>> {
  // общий helper строит bind/rest как сейчас (value/onChange/onBlur/strip — дословно)
  const BaselineField = forwardRef<H, Record<string, unknown>>((props, ref) => {
    const elRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(ref, () => (options?.buildHandle?.(elRef) ?? makeElementFieldHandle(elRef)) as H, []);
    const { rest, bind } = bindField(props, adapter);
    return <Primitive ref={elRef as never} {...(rest as P)} {...(bind as Partial<P>)} />;
  });
  const PassthroughField = forwardRef<H, Record<string, unknown>>((props, ref) => {
    const { rest, bind } = bindField(props, adapter);
    return <Primitive ref={ref as never} {...(rest as P)} {...(bind as Partial<P>)} />;
  });
  const Field = options?.exposesHandle ? PassthroughField : BaselineField;
  Field.displayName = `Field(${Primitive.displayName ?? Primitive.name ?? 'Component'})`;
  return Field;
}
```

## Риски и снятие

- **R1 — двойной привод ref / условные хуки при `exposesHandle`.** → разнести на `BaselineField`/`PassthroughField` (выше), `useImperativeHandle` только на baseline-пути.
- **R2 — `getRef()` после первого рендера — no-op** (не бампает version, [proxy:234](../../packages/reformer-renderer-react/src/core/render-schema-proxy.ts)). → документировать: `getRef()` вызывать на этапе применения behaviors (как wizard). Version-bump НЕ добавлять (изменит семантику wizard, ре-рендер на каждый getRef).
- **R3 — `null` для скрытых/условных/размонтированных полей и только что добавленных строк.** → behaviors обязаны гардить `?.`; для focus-after-push — `queueMicrotask` (`render-behavior.ts:53`) или `onMount` ([render-node.tsx:408](../../packages/reformer-renderer-react/src/core/render-node.tsx), `useNodeLifecycle`). `renderEffect` бежит на Preact-effect, не на React-commit → синхронное чтение `.current` сразу после структурной смены может видеть stale `null`; для focus-after-mount предпочитать `onMount`/microtask.
- **R4 — тип-рябь от `forwardRef` (D3).** → варианты потребляются как `ComponentType<any>`; прогнать typecheck по ui-kit + renderer + playground; явных ломающих аннотаций нет.
- **R5 — контролируемый `open` в SelectAsync меняет поведение.** → регресс typeahead/поиск/пагинация/`onBlur`.
- **R6 — cdk `FormFieldControl` уже `forwardRef` и ставит `<Component ref={ref}>`** ([FormFieldControl.tsx:105](../../packages/reformer-cdk/src/components/form-field/FormFieldControl.tsx)) → TS-flow `<FormField>` получает handle бесплатно; проверить отсутствие регресса при `ref===undefined`.
- **R7 — коллизия `selector` и `__path` (Фаза 4).** → приоритет явного `selector` над `__path`; `__path`-fallback документировать как удобство для массивов.

## Тесты и верификация

**Unit (vitest, colocated `*.test.tsx`):**
- HOC: `InputBaseField` baseline `focus/blur/getElement/scrollIntoView`; регресс `control`/value/onChange не сломан.
- Renderer GAP 1: одно-листовая `createRenderSchema` + behavior `getRef().current.focus()` в `onMount`; фокус + поток value.
- Каждый композит: ключевой метод (InputPassword `toggleVisibility`; SelectAsync `open`/`reload`/`clear`; Combobox `open`/`clear`; DatePicker `open`; InputNumberField `focus`).
- Null-safety: скрытая нода → `getRef().current === null`, behavior гардит, без throw.
- Фаза 4: `phones.0.number` резолвится по `__path`.

**e2e (Playwright, `projects/react-playground-e2e`, по образцу POM `credit-form-page.pom.ts` + `behaviors.spec.ts`):**
- Новая playground-страница: «focus первого невалидного поля на submit» (baseline по нескольким типам полей).
- Композиты: кнопка вне формы зовёт `open()` у Select/Combobox/DatePicker через handle — popover открывается; `toggleVisibility()` у пароля раскрывает текст.
- Array: добавить строку, программно сфокусировать input новой строки (Фаза 4).
- Скриншоты (fullPage) → `projects/react-playground-e2e/screenshots/imperative-handle/`.

## Разбивка на PR

1. **PR-1 (фундамент):** `field-handle.ts` + `withFormControl` forwardRef/split + `InputField`-диспетчер forwardRef + unit. Ценность сама по себе (поля под `<FormField>` становятся focus-able).
2. **PR-2 (GAP 1):** ref листа в `render-node.tsx` + unit. Включает `getRef()` для листьев.
3. **PR-3 (rich PoC):** InputPassword handle + passthrough.
4. **PR-4 (rich rollout):** SelectAsync (контролируемый `open`), Combobox, DatePicker, InputNumberField + тесты.
5. **PR-5 (array-адресация):** `selector ?? __path` + array-e2e. Изолирован.
6. **PR-6 (доки/e2e/экспорты):** публичные экспорты, доки-рецепт, playground + спеки.

PR-1/PR-2 мёржатся независимо от композитов; PR-5 полностью опционален и изолируем.

## Целевые сценарии (акцептанс-таргеты)

```ts
// 1. focus + scroll на первое невалидное поле после submit (baseline)
async function handleSubmit() {
  if (await schema.validateAll()) return submit();
  const sel = schema.selectors().find((s) => schema.node(s).isInvalid?.());
  const ref = schema.node(sel).getRef<FieldHandle>();
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  ref.current?.focus();
}

// 2. зависимый async-Select: реактивно параметры источника, императивно clear+reload+open
renderEffect(schema, () => {
  const country = form.address.country.value.value;
  const city = schema.node('city');
  city.patchProps({ dataSourceParams: { country } });      // реактивно
  const ref = city.getRef<SelectAsyncHandle>();            // императивно
  ref.current?.clear(); ref.current?.reload(); ref.current?.open();
});

// 3. DatePicker: открыть календарь при выборе «свой период»
renderEffect(schema, () => {
  if (form.period.value.value === 'custom')
    schema.node('customDate').getRef<DatePickerHandle>().current?.open();
});

// 4. InputPassword: мастер-переключатель видимости всех паролей
onComponentEvent(schema.node('showAllPasswords'), 'onCheckedChange', (checked: boolean) => {
  for (const s of ['password', 'passwordConfirm'])
    schema.node(s).getRef<InputPasswordHandle>().current?.setVisible(checked);
});

// 5. FormArray + Input: фокус в поле новой строки (Фаза 4 + null-lifecycle)
const phones = schema.node('phones').getRef<FormArrayHandle<Phone>>();
phones.current?.add({ number: '' });
queueMicrotask(() => {
  const idx = (phones.current?.length ?? 1) - 1;
  schema.node(`phones.${idx}.number`).getRef<InputHandle>().current?.focus();
});
```
