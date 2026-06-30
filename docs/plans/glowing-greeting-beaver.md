# Перестановка элементов массива в форме (reorder / move up-down)

## Context

Сейчас форм-массивы ReFormer поддерживают только `push` / `insert` / `removeAt` / `clear`.
Возможности **переупорядочить** уже добавленные элементы нет ни на одном слое: ни в core-узлах
(`ArrayNode`, `ModelArrayNode`), ни в CDK (`useFormArray`, `FormArray`, `FormArrayHandle`),
ни в UI (`FormArraySection`, `ModelArraySectionRenderer`). В примерах комплексной кредитной формы
(шаг 5: «Имущество» / «Существующие кредиты» / «Созаёмщики») пользователь может только добавлять и
удалять строки, но не менять их порядок.

Задача: добавить операцию перестановки элементов массива (move/swap) сквозь все слои библиотеки и
показать её в трёх вариантах комплексной формы. По решению пользователя:

- **UI-механика** — кнопки **↑ / ↓** в шапке каждой карточки (рядом с «Удалить»), отключены на границах.
  Под капотом — `move(from, from±1)`. Доступно (a11y), стабильно тестируется в Playwright, без новых зависимостей.
- **Охват** — все 3 варианта примера: `complex-multy-step-form` (compound), `…-renderer` (render-schema),
  `…-renderer-json` (JSON).

### Ключевые факты архитектуры (проверено по исходникам)

- Примеры используют **model-backed** массивы (`array: model.properties` → `ModelArrayNode`), а не
  plain `ArrayNode`. Данные принадлежат модели; per-item под-формы кешируются по identity узла модели
  (`facadeCache` в [form-model.ts](packages/reformer/src/core/model/form-model.ts#L380), WeakMap-кеш в
  [model-array-node.ts](packages/reformer/src/core/nodes/model-array-node.ts#L34)).
- **Модель-массив уже умеет `move`** — [form-model.ts:189-195](packages/reformer/src/core/model/form-model.ts#L189)
  делает иммутабельный реассайн `this.items.value = arr` + `reindex()`, и `move` уже есть в публичном
  фасаде ([form-model.ts:276](packages/reformer/src/core/model/form-model.ts#L276)). Но типизированные
  контракты `ModelArrayControl` и `RenderModelArrayControl` его **не объявляют** — значит узлы/рендерер
  до него «не дотягиваются».
- Перестановка **сохраняет длину**. Из-за этого **три места реактивности завязаны на `length`** и при
  реордере молча мутируют данные без ре-рендера — все три требуют правки:
  - `ModelArrayNode` `effect()` ([model-array-node.ts:71-85](packages/reformer/src/core/nodes/model-array-node.ts#L71))
    — внутренний `effect` **сработает** (читает `control.length` → `arr.items.value`, реассайн сигнала уведомит,
    `itemNodes` пересоберётся в новом порядке из кеша, состояние под-форм сохранится). Сам узел править не нужно,
    НО React-обёртки над ним (ниже) — нужно.
  - CDK `useFormArray` ([useFormArray.ts:105-114](packages/reformer-cdk/src/components/form-array/useFormArray.ts#L105))
    — мемоизирует `items` по `[control, length]`. Длина не меняется → `items` остаётся со старым порядком →
    **compound-путь (`FormArraySection` → `FormArray.Root` → `useFormArray`) НЕ перерисуется.** **Требует починки** (шаг 4).
  - Renderer-react `useModelArrayLength` ([render-node.tsx:119-129](packages/reformer-renderer-react/src/core/render-node.tsx#L119))
    через `useSyncExternalStore` отдаёт **snapshot = число длины** → при реордере число не меняется →
    React **не перерисует** список. **Требует починки** (шаг 6).
- Рендер массива в **двух независимых местах** (разный JSX): `FormArraySection`
  ([ui-kit](packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx)) — для compound-примера;
  `ModelArraySectionRenderer` ([render-node.tsx:153-240](packages/reformer-renderer-react/src/core/render-node.tsx#L153))
  — для render-schema и JSON примеров. Кнопки нужны в обоих.
- **Сборка**: playground резолвит `@reformer/*` через `package.json#exports` → `dist/*.js` (собранный код),
  vite-алиаса на `src` нет. После правок пакетов **обязательна пересборка** (см. «Build & verification»).

---

## Design overview

Поток данных при клике «↑»/«↓» (model-backed путь):

```
кнопка → control.move(i, i-1)                 // RenderModelArrayControl / ModelArrayNode
       → model ArrayNode.move()                // form-model.ts: items.value = reordered + reindex()
       → items signal реассайнится (identity ↑)
          ├─ ModelArrayNode.effect() ре-ран → itemNodes пересобран в новом порядке (кеш по identity)
          ├─ [compound] useFormControl(value) меняется → useFormArray ре-мапит items ([…, value] в deps)
          │            → FormArraySection ре-рендер, control.map() в новом порядке
          └─ [renderer-react] revision-подписка → React ре-рендер → control.at(i) в новом порядке
                                                 (key=stableKey(item) сохраняет инстансы карточек)
```

`move(from, to)` — основной примитив; `moveUp = move(i, i-1)`, `moveDown = move(i, i+1)`.
`swap(a, b)` добавляем в core-API для полноты (UI его не использует).

---

## Implementation steps

### 1. Core: `ArrayNode.move` / `ArrayNode.swap` (plain массивы)

Файл: [packages/reformer/src/core/nodes/array-node.ts](packages/reformer/src/core/nodes/array-node.ts)
(рядом с `insert`/`removeAt`). Bounds-check в стиле существующих методов (`FormErrorHandler.handle(…, ErrorStrategy.LOG)`),
иммутабельный реассайн сигнала `this.items.value`, **без `dispose`** (элементы переставляются, не удаляются):

```ts
move(from: number, to: number): void {
  const len = this.items.value.length;
  if (from < 0 || from >= len || to < 0 || to >= len) {
    FormErrorHandler.handle(new Error(`ArrayNode.move: index out of bounds (from=${from}, to=${to}, length=${len})`),
      'ArrayNode.move', ErrorStrategy.LOG);
    return;
  }
  if (from === to) return;
  const next = [...this.items.value];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  this.items.value = next;
}

swap(a: number, b: number): void {
  const len = this.items.value.length;
  if (a < 0 || a >= len || b < 0 || b >= len) { /* FormErrorHandler.handle(…LOG); */ return; }
  if (a === b) return;
  const next = [...this.items.value];
  [next[a], next[b]] = [next[b], next[a]];
  this.items.value = next;
}
```

Реордер значений не меняет → отдельный `validate()` не нужен (computed-агрегаты пересчитаются сами).

### 2. Model-backed путь: контракт + узел + фасад

- **`ModelArrayControl`** ([model-array-node.ts:20-29](packages/reformer/src/core/nodes/model-array-node.ts#L20))
  — добавить в интерфейс:
  ```ts
  move(from: number, to: number): void;
  swap(a: number, b: number): void;
  ```
- **`ModelArrayNode`** — публичные методы-делегаты (рядом с `removeAt`, ~стр. 121). `effect()` сам
  пересоберёт `itemNodes` (см. Context), дополнительной ручной перестановки массива прокси **не требуется**:
  ```ts
  move(from: number, to: number): void { this.control.move(from, to); }
  swap(a: number, b: number): void { this.control.swap(a, b); }
  ```
- **Модель-фасад** ([form-model.ts](packages/reformer/src/core/model/form-model.ts)) — `move` уже есть
  (метод класса `ArrayNode` стр.189 + фасад стр.276). Добавить парный `swap` в класс `ArrayNode` и в
  `arrayValueProxy.api` (стр.268-288):
  ```ts
  // в классе ArrayNode (после move):
  swap(a: number, b: number): void {
    const arr = [...this.items.peek()];
    [arr[a], arr[b]] = [arr[b], arr[a]];
    this.items.value = arr;
    this.reindex();
  }
  // в arrayValueProxy.api:
  swap: (a: number, b: number) => arr.swap(a, b),
  ```

### 3. Тип `FormArrayProxy`

Файл: [packages/reformer/src/core/types/form-proxy.ts](packages/reformer/src/core/types/form-proxy.ts)
— добавить `move`/`swap` в тип-алиас `FormArrayProxy<T>`, чтобы они были видны на резолвленном control.

### 4. CDK-слой

Файл-каталог: [packages/reformer-cdk/src/components/form-array/](packages/reformer-cdk/src/components/form-array/)

- **`useFormArray`** (`useFormArray.ts`):
  - **Починка реактивности (обязательно)** — подписаться также на `value` (его ссылка-массив меняется при
    реордере, в отличие от `length`) и добавить в deps мемоизации:
    ```ts
    const { length, value } = useFormControl(control);
    const items = useMemo(() => control.map(/* … */), [control, length, value]); // value → ре-расчёт при move/swap
    ```
  - В `UseFormArrayReturn<T>` и в возвращаемом объекте добавить `move(from, to)` / `swap(a, b)`
    (делегируют `control.move/.swap`).
- **`FormArray.tsx`**:
  - `FormArrayContextValue` и `FormArrayHandle<T>` — добавить `move` / `swap`.
  - Render-prop `FormArrayItemRenderProps<T>` (и `FormArrayItemContextValue`) — добавить производные
    хелперы для UI кнопок:
    ```ts
    moveUp: () => void;        // move(index, index-1)
    moveDown: () => void;      // move(index, index+1)
    canMoveUp: boolean;        // index > 0
    canMoveDown: boolean;      // index < length - 1
    ```
    Вычисляются в `FormArray.List` из `index` и текущей длины.

### 5. UI Kit: `FormArraySection` (compound-путь)

Файл: [packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx](packages/reformer-ui-kit/src/components/form-array/form-array-section.tsx)

- Новый проп `reorderable?: boolean` (default `false`) — обратная совместимость: существующие вызовы не меняются.
- В шапке карточки (блок `<div className="flex justify-between items-center mb-3">`, стр.167-181) перед/рядом
  с кнопкой «Удалить» отрисовать ↑/↓, используя хелперы из render-prop `FormArray.List`
  (`moveUp/moveDown/canMoveUp/canMoveDown`). `disabled` на границах. testId по конвенции POM:
  ```tsx
  {
    reorderable && (
      <div className="flex gap-1">
        <button
          type="button"
          onClick={moveUp}
          disabled={!canMoveUp}
          data-testid={`array-item-${index}-move-up`}
          aria-label="Переместить вверх"
          className={iconBtnClass}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={moveDown}
          disabled={!canMoveDown}
          data-testid={`array-item-${index}-move-down`}
          aria-label="Переместить вниз"
          className={iconBtnClass}
        >
          ↓
        </button>
      </div>
    );
  }
  ```
  (Для этого `FormArray.List` render-prop расширяется в шаге 4; деструктуризация в строке 162 дополняется.)

### 6. Renderer-react: `ModelArraySectionRenderer` + реактивность

Файлы: [packages/reformer-renderer-react/src/core/types.ts](packages/reformer-renderer-react/src/core/types.ts),
[render-node.tsx](packages/reformer-renderer-react/src/core/render-node.tsx)

- **`RenderModelArrayControl`** (types.ts:82-88) — добавить `move(from: number, to: number): void;`
  (рантайм-фасад его уже имеет). `componentProps` уже имеет index-signature `[key: string]: unknown` —
  можно добавить явный `reorderable?: boolean` для читаемости.
- **Починка реактивности** — заменить length-only snapshot на revision-подписку, которая срабатывает на
  ЛЮБОЕ изменение сигнала `items` (включая реордер при неизменной длине):
  ```ts
  function useModelArrayRevision(control: RenderModelArrayControl): void {
    const rev = useRef(0);
    useSyncExternalStore(
      (cb) =>
        effect(() => {
          void control.length;
          rev.current++;
          cb();
        }), // читает arr.items.value → подписка на сигнал
      () => rev.current,
      () => rev.current
    );
  }
  ```
  В `ModelArraySectionRenderer`: `useModelArrayRevision(control);` затем `const length = control.length;`
  (читается на каждом ре-рендере). `key={stableKey(im)}` уже стабилен по identity элемента → React
  переставит DOM, сохранив инстансы карточек.
- **Кнопки ↑/↓** в шапке карточки (блок стр.210-222), gated `cp.reorderable`, `onClick={() => control.move(i, i-1)}`
  / `control.move(i, i+1)`, `disabled` при `i===0` / `i===length-1`, те же testId-ы (`array-item-${i}-move-up`/`-move-down`).

### 7. Подключить во все 3 примера (шаг 5 формы, 3 массива: properties / existingLoans / coBorrowers)

- **compound** — [AdditionalInfoForm.tsx](projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/AdditionalInfo/AdditionalInfoForm.tsx):
  на каждый из 3 `<FormArraySection …>` добавить проп `reorderable`.
- **render-schema** — [render-schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts):
  в `componentProps` каждого из 3 array-узлов добавить `reorderable: true`.
- **JSON** — [json-schema.json](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.json):
  в `componentProps` каждого из 3 array-узлов добавить `"reorderable": true`. (При наличии codegen/JSON-schema
  валидатора — см. `scripts/gen-form-json-schema.ts` — проверить, что `reorderable` не отсекается схемой; при
  необходимости расширить тип `componentProps` в JSON-renderer.)

### 8. Тесты

- **Unit** (vitest):
  - [packages/reformer/tests/core/nodes/](packages/reformer/tests/core/nodes/) — `ArrayNode.move/swap`:
    порядок значений меняется, длина сохраняется, bounds-check (out-of-range → no-op + лог).
  - `ModelArrayNode.move/swap`: после `move` `at(newIndex)` возвращает **тот же** инстанс под-формы
    (состояние/identity сохранены), значения следуют за элементом; `effect` пересобирает порядок.
- **E2E** (Playwright) — [projects/react-playground-e2e/tests/pages/complex-multy-step-form/](projects/react-playground-e2e/tests/pages/complex-multy-step-form/):
  новый `reorder.spec.ts` (или расширить `arrays.spec.ts`): добавить ≥2 созаёмщиков, заполнить отличимые
  значения, кликнуть ↑/↓, проверить смену порядка и сохранение значений; проверить `disabled` на границах.
  В POM [credit-form-page.pom.ts](projects/react-playground-e2e/tests/pages/complex-multy-step-form/credit-form-page.pom.ts)
  добавить методы `moveItemUp(testId, index)` / `moveItemDown(testId, index)` по локаторам
  `data-testid="array-item-${index}-move-up|-move-down"`. Spec переиспользуется для iter-проектов
  (core / renderer-react / renderer-json) — покрывает оба пути рендера.

---

## Build & verification

Порядок зависимостей пакетов: `core → cdk → renderer-react → ui-kit` (+ `renderer-json` при необходимости).

1. **Сборка пакетов** (playground читает `dist`, не `src`):
   ```bash
   npm run build --workspaces        # пересобрать всё в правильном порядке
   # либо точечно (быстрее), соблюдая порядок зависимостей:
   # npm run build:stackblitz -w @reformer/core
   # npm run build:stackblitz -w @reformer/cdk
   # npm run build:stackblitz -w @reformer/renderer-react
   # npm run build:stackblitz -w @reformer/ui-kit
   ```
2. **Unit-тесты**:
   ```bash
   npm test -w @reformer/core
   npm test -w @reformer/cdk
   ```
3. **Playground вручную / MCP-playwright**: `npm run dev` → открыть каждый из 3 примеров комплексной
   формы, шаг 5, добавить ≥2 элемента в массив, кликнуть ↑/↓, убедиться что порядок и значения корректны,
   кнопки отключены на границах. Скриншоты — в `projects/react-playground-e2e/screenshots/array-reorder/`.
4. **E2E**:
   ```bash
   cd projects/react-playground-e2e
   npx playwright test tests/pages/complex-multy-step-form/reorder.spec.ts
   ```

---

## Risks / notes

- **Renderer-реактивность** — главный риск: без revision-подписки (шаг 6) реордер в render-schema/JSON
  вариантах визуально «не сработает» при неизменной длине. Проверять именно эти два варианта, не только compound.
- **`reindex()` и пути под-моделей** — `move` ребейзит пути узлов (`joinPath(path, i)`), но identity
  `GroupNode` сохраняется → `facadeCache`/WeakMap-кеши не сбрасываются, состояние под-форм и фокус сохраняются.
  Подтвердить тестом на ModelArrayNode.
- **JSON-валидация схемы** — если в `scripts/gen-form-json-schema.ts` есть строгая схема `componentProps`,
  `reorderable` нужно туда добавить, иначе CI-проверка json-schema упадёт.
- **Обратная совместимость** — `reorderable` по умолчанию `false`; существующие массивы и их e2e-тесты
  (ARR-001/002) не затрагиваются (кнопки ↑/↓ не появляются без флага).
- **`swap` в API** — добавляется для полноты публичного контракта; UI использует только `move`. Если не нужен —
  можно опустить из шагов 1-2 без влияния на функциональность кнопок.
