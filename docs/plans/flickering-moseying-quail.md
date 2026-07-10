# План: вложенные объектные группы → суб-модели `FormModel` + миграция «везде» (код + JSDoc)

## Context / цель

Сделать так, чтобы `model.personalData` сам по себе был `FormModel<PersonalData>` (с `.$`), и групп-хелперы
писались как `propertyItem` (без функций-обёрток):
```ts
const personalDataNodes = (m: FormModel<PersonalData>) => ({ lastName: { value: m.$.lastName, ... } });
personalData: personalDataNodes(model.personalData),
```
Затем **провести миграцию везде** — и в коде, и в JSDoc-документации.

Механизм: вложенные объектные группы промоутятся в `FormModel` на уровне value-доступа (симметрично
элементам массива). `FormModel = ModelObject & ModelApi` — надмножество value-прокси, поэтому изменение
**аддитивно**: старый value-доступ (`model.personalData.lastName`), `model.$.personalData.lastName` и
`model.get()` продолжают работать. Инвариант: `model.personalData.$.lastName === model.$.personalData.lastName`.

## Производительность и память

Проверено по [form-model.ts](packages/reformer/src/core/model/form-model.ts):
- Сейчас `groupValueProxy` создаётся **новым Proxy на каждый доступ** к `model.personalData` (не кэшируется).
  `makeFormModel` — **кэшируется** по `GroupNode` (`facadeCache: WeakMap`).
- После промоушена `model.personalData` → закэшированный фасад (лениво, один на группу).

**Итог — нейтрально-положительно:**
- **CPU:** в горячих путях (`compute`/render многократно читают `model.personalData.field`) аллокация нового
  прокси на каждый доступ заменяется на `WeakMap.get` (O(1)) → меньше GC-нагрузки. Первый доступ чуть дороже
  (сборка фасада: proxy + api из 8 замыканий + signalsProxy), но однократно.
- **Память:** +ограниченный удерживаемый набор — ~1 маленький фасад на *реально доступную* группу (типичная
  форма: ~4 группы). Раньше удерживалось 0, но были транзиенты на каждый доступ. WeakMap по `GroupNode` →
  фасады элементов массива GC-ятся при удалении элемента. Утечки нет; неограниченного роста нет.
- `arr[i]` для объект-элементов тоже переходит на кэш → `arr[i] === arr.at(i)`.

## 1. Ядро (аддитивно, verified SAFE сквозным сканом)

- [form-model.ts](packages/reformer/src/core/model/form-model.ts): объединить `childValue`+`itemFacade` →
  `nodeValue` (группа → `makeFormModel`); удалить мёртвый `groupValueProxy`; в get-trap `makeFormModel`
  добавить `if (key === '__path') return group.path;` (паритет; `has`/`ownKeys` не трогаем → `'__path' in model === false`).
- [types.ts](packages/reformer/src/core/model/types.ts): `ModelValue<V>` ветка объекта `ModelObject` →
  `FormModel<NonNullable<V>>`. `ModelObject`/`ModelArrayItem` оставляем.

Скан подтвердил SAFE: value read+write вложенных групп (в т.ч. `model.registrationAddress.city = ''` в
поведениях) сохранён set-trap'ом; `Object.keys`/spread не меняются (API/`__path` не enumerable); рендер
читает FormProxy/сигналы; `create-form` harvest не затронут; коллизий зарезервированных имён нет.

## 2. Миграция КОДА

### Hand-maintained (мигрируем на суб-модельную форму)
- **[schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/schema.ts)**:
  3 хелпера `(s: ModelSignals<T>)` → `(m: FormModel<T>)`, `s.field` → `m.$.field`; 4 call-site →
  `personalDataNodes(model.personalData)` и т.д.; в `coBorrowerItem` `item.$.personalData.field` →
  `item.personalData.$.field`. Импорт: убрать `ModelSignals`.
- **[validation.ts](projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/validation.ts)**:
  `addressFields(s: ModelSignals<Address>)` → `(m: FormModel<Address>)`, вызовы → `model.registrationAddress`/
  `model.residenceAddress`; инлайны `m.personalData.field`/`m.passportData.field` (`m = model.$`) →
  `model.personalData.$.field`; `im.$.personalData.field` → `im.personalData.$.field`.
- **[render-schema.ts](projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts)**:
  27 инлайнов `m.<group>.<field>` (`m = model.$`) → `model.<group>.$.<field>`; `im.$.personalData.field` →
  `im.personalData.$.field`.
- **behavior.ts** group-level `copyFrom/enableWhen/apply(model.$.<group>, …)` — оставить как есть (принимают
  сигнальную группу; `model.<group>.$` эквивалентно, миграция косметическая) — **проверить API перед правкой**.

### Сгенерированные snapshot'ы `mcp-credit-application-*-v20` (8 файлов) — мигрируем руками (решение пользователя)
Несмотря на iter-происхождение, мигрируем все 8 файлов по тем же правилам:
- `core-v20/form.schema.ts` (~29 сайтов), `core-v20/validation.ts` (~23), `core-v20/form.behavior.ts` (2 field-level)
- `renderer-react-v20/renderer.schema.ts` (~25), `renderer-react-v20/validation.ts` (~23), `.../form.behavior.ts` (2)
- `renderer-json-v20/validation.ts` (~21), `renderer-json-v20/form.behavior.ts` (2; учесть динамический ключ `[src]` в `copyFrom`)
Правила: `m.<group>.<field>` (`m=model.$`) → `model.<group>.$.<field>`; `item.$.personalData.field` →
`item.personalData.$.field`; `model.$.<group>.<field>` → `model.<group>.$.<field>`. Группа-level
`copyFrom/enableWhen(model.$.<group>)` — оставить (эквивалент). **Примечание:** следующий прогон iter-генератора
перезапишет эти файлы, если сам генератор не обновить (см. §3 — обновить и шаблоны/промты генератора).

### Core-тесты (6 файлов) — контрактные, НЕ переписываем
`form-model.test.ts`, `scenarios.test.ts`, `create-form-*.test.ts`, `validate-model.test.ts`,
`field-node-model-binding.test.ts` **проверяют** контракт `.$`-пути (`m.$.personalData.lastName.__path ===
'personalData.lastName'`), который **не меняется** → должны продолжать проходить как есть. Добавляем **новые**
тесты под суб-модель (§4); существующие ассерты не трогаем.

### Общие правила миграции (для всех файлов)
| Было | Стало |
|---|---|
| хелпер `(s: ModelSignals<T>) => s.field`, вызов `f(model.$.group)` | `(m: FormModel<T>) => m.$.field`, вызов `f(model.group)` |
| инлайн `model.$.group.field` / `m.group.field` (`m=model.$`) | `model.group.$.field` |
| элемент массива `item.$.personalData.field` | `item.personalData.$.field` |

## 3. Миграция ДОКУМЕНТАЦИИ (JSDoc + recipes)

- **JSDoc** [types.ts](packages/reformer/src/core/model/types.ts): MUST — строки 8, 54, 145 (проза
  «value-proxy без `.$`» → «под-модель `FormModel` с `.$`/API»); reconsider — 69 (`ModelObject`), 180
  (`FormModel`). Плюс сам код ветки `ModelValue` (§1).
- **JSDoc** [form-model.ts](packages/reformer/src/core/model/form-model.ts): дополнить `@example` у
  `createModel` вложенной группой (показать `model.profile.$.name` / `model.profile.get()`); модульная шапка.
- **JSDoc** [create-form.ts](packages/reformer/src/core/utils/create-form.ts:206): пометить, что
  `model.profile.$.name` эквивалентно `model.$.profile.name`.
- **docs/llms recipes** (питают `llms.txt`): `09-formschema.md`, `19-reading-values.md`,
  `30-type-safety-recipes.md` — сниппеты, обучающие `ModelSignals`-хелперу, показать суб-модельную форму.
- **Публичный сайт reformer-doc**: `docs/core-concepts/model.md` («Два способа доступа») — добавить, что
  вложенная группа — суб-модель `FormModel` (`.$`/`.get()`/…). **RU-зеркало обязательно** — сайт рендерит RU
  из `i18n/ru/`, не из `docs/`; править обе версии. Прочие `reformer-doc/**` сниппеты с `ModelSignals`-хелпером
  — привести к суб-модельной форме (для консистентности).
- **Генерируемое НЕ трогаем руками**: `llms.txt` (регенерится `generate:llms` из JSDoc+docs/llms), `dist/*.d.ts`
  (из src через vite-plugin-dts). Правки только в `src` JSDoc + `docs/llms/*.md`.

## 4. Тесты ядра — добавить

Новый `describe` в [form-model.test.ts](packages/reformer/tests/core/model/form-model.test.ts): идентичность
сигнала (`m.personalData.$.lastName === m.$.personalData.lastName`), `__path` группы/листа, value-доступ
сохранён, стабильность фасада, scoped `get/isDirty/reset/signalAt`, реактивность, `model.__path === ''` +
`'__path' in m === false`, `m.coBorrowers[0] === m.coBorrowers.at(0)`.

## 5. Verification
1. `cd packages/reformer && npx vitest run` (весь core-набор) + `npx tsc --noEmit`.
2. Typecheck/сборка `projects/react-playground` + `projects/reformer-doc` (доки собираются).
3. `npm run generate:llms -- --audit` — без churn публичных символов; `mcp__reformer__find_recipe`/
   `get_symbol_docs` отдают обновлённую прозу.
4. E2E `complex-multy-step-form` (+ `-renderer`): шаги 2/3 — ввод, сброс `city`, вычисляемые `fullName`/`age`.
5. Прогнать E2E/typecheck по мигрированным `mcp-*-v20` (iter POM переиспользуется).

## Объём (итог)
- Ядро: 2 файла (`form-model.ts`, `types.ts`).
- Код-миграция: 3 hand-maintained + 8 `mcp-*-v20` = **11 файлов**, ~200 сайтов.
- Тесты: +новые в `form-model.test.ts` (контрактные не трогаем).
- Доки: JSDoc (`types.ts`/`form-model.ts`/`create-form.ts`), `docs/llms/*`, `reformer-doc` (en+ru),
  промты/шаблоны iter-генератора (чтобы регенерация не откатывала миграцию).

_Реализацию удобно распараллелить workflow-оркестрацией (по файлу/группе на агента) — механические правки
однотипны; ядро и типы — первым шагом, затем консумеры, затем доки._
