# Единый план повышения качества агента в билдере

> Составлен 2026-08-13 по итогам двух живых прогонов ассистента с локальной моделью
> (gemma4:26b через Ollama) и прогонов инструментов на wizard-схемах. Пути в разделах 2–5 —
> от `projects/reformer-builder/src`, если не указано иное.

Проверено на реальном коде (все ссылки — файл:строка, читал сам). Базовая линия зелёная: `npx vitest run src/model/node-kind.test.ts src/model/wizard-node.test.ts src/agent/core/tools/write-tools.test.ts src/io/validate.test.ts src/dnd/resolve-drop.test.ts` → 61 passed.

---

## 1. Корень проблемы

**К1. Ответ write-инструмента физически не может описать больше одного узла.** `OpDescription` = `{kind, summary}` (`gate.ts:41-45`), текст собирается в единственном месте — `commitMutation`, `gate.ts:79`: `Готово: ${summary}. Адрес узла: ${ref}.` Через него проходят все 8 write-инструментов. Вставка `Tabs`, разворачивающая 6 узлов (`catalog/make-node.ts:120-144`), и вставка одного `Input` отчитываются неотличимо. Отсюда сбой №1 (второй TabsList) и невидимость посеянного `Step` (`make-node.ts:296-301` сеет `steps: [stepNode('Шаг 1')]`).

**К2. Правил «что куда можно класть» нет ни на одном слое.** `insert_node` проверяет ровно одно — что `insertSlotOf` вернул путь (`tools/insert-node.ts:72-78`); `move_node` — то же (`move-node.ts:52-59`); `ChildSlot` (`node-kind.ts:47-59`) типа приёма не описывает; `validateSchema` (`io/validate.ts:75-92`) делегирует в ajv, где `componentProps` объявлен как `{"type":"object"}` (`packages/reformer-renderer-json/src/schema/form-schema.schema.json`, containerNode), то есть весь слот `componentProps.steps` вне видимости валидатора. Отсюда D/E/F и «Форма валидна: ошибок нет» на битой форме.

**К3. Слот `steps` — свойство ЗНАЧЕНИЯ, а не компонента, и проигрывает `children` при выборе.** `node-kind.ts:162`: `Array.isArray(steps) && steps.some(isNodeLike)` — пустой массив или отсутствующий ключ убивает слот навсегда; дальше `insertSlotOf` синтезирует `children` (`slots.ts:31`), а `insertNode` создаёт отсутствующий массив сам (`mutate.ts:196`), поэтому вставка всегда «успешна». Плюс во **всех четырёх** точках выбора слота `children` имеет приоритет — `agent/core/slots.ts:25-26`, `store/reducers.ts:538`, `store/reducers.ts:613` (moveIn), `dnd/resolve-drop.ts:58` — вопреки порядку самого `childSlots`, который кладёт `steps` ПЕРВЫМ (`node-kind.ts:162` до `:171`). Визард умеет самоуничтожаться: `remove_node` последнего шага оставляет `steps: []`, и слот исчезает. Отсюда B и C.

**К4. Каталог знает структуру, до модели доходят три поля.** `ComponentSummary`/`ComponentDetail` = `name/role/category/props` (`catalog-digest.ts:20-40`); `compoundParent` (`catalog/types.ts:56`) и `partsOf/partNamesOf` (`catalog/compound.ts:18-40`) в дайджест не попадают, хотя человеку Инспектор их показывает (`Inspector.tsx:405` → `:195-199`). Измерено мной: в ките 357 записей, 168 палитро-видимых, из них **91 — части compound'ов**, и `required` в `propsSchema` нет **ни у одной из 357** (поэтому `TabsTrigger` без `value` формально валиден). При бюджете `TOOL_TEXT_BUDGET = 1500` (`types.ts:24`) в ответ `list_components` помещается ~56 записей, из которых **39 (70%) — части**. `wizardPropsSchema` — один `className` (`synthetic-entries.ts:39-44`, намеренно «правится на canvas»).

**К5. Ход без памяти и без сигнала об обрыве.** `historyFor` (`run.ts:28-34`) фильтрует `entries.filter((e) => e.text.trim().length > 0)`, а молчаливая модель порождает именно такие реплики: `ChatEntry` держит `tools` отдельно от `text` (`session.ts:36-42`). `stopWhen: stepCountIs(req.maxSteps)` (`ai-sdk.ts:79`) даёт `finishReason: 'tool-calls'`, которого нет в `BROKEN_FINISH` (`ai-sdk.ts:35-41`) → `done: complete`, UI показывает штатное завершение.

**Вывод:** это не «модель не умеет». Это три отсутствующих сигнала (что создано / куда положено / что сломано) плюс невидимый предохранитель на 24 шага. Валидация и каталог — вторичны: они делают сигнал богаче, но сами по себе ни один из шести сценариев не чинят.

---

## 2. План правок по слоям

### Слой A — модель и слоты

**A1. `steps` остаётся слотом при пустом массиве и у визард-именованных узлов.**
Файл: `model/node-kind.ts`, `childSlots` (:159-170). Рядом с `VOID_HTML_TAGS` (:79-94) завести `const STEPS_HOST_NAMES = new Set(['Wizard','RendererFormWizard','FormWizard'])`, имя брать локальным `parseOperator(c.component)` (импорт уже есть, :20). Условие: `Array.isArray(steps) ? steps.some(isNodeLike) || STEPS_HOST_NAMES.has(name) : STEPS_HOST_NAMES.has(name)`; при отсутствии массива — слот с `entries: []`, `length: 0`.
*Чинит:* B (`steps: []`), C (нет ключа `steps`), и самонаводящийся случай «удалили последний шаг → визард навсегда стал children-таргетом».
*Почему не через дескриптор кита:* контракт кита трогать не надо — `FormWizard`/`Wizard`/`RendererFormWizard`/`Step` уже перечислены как семейство в `kits/legacy-reformer-ui-kit.ts` NEEDS_SHIM; четвёртый список имён заводить незачем. Промотировать в дескриптор — когда появится сторонний кит со своим именем визарда.
*Риск:* гейт по имени обязателен. Убрать `.some(isNodeLike)` без него нельзя: в ките есть `StepIndicator` и `FormWizard` с пропом `steps` из НЕ-узлов (проверено; обе записи `palette:false`, то есть в каталог билдера не попадают — `catalog/contract.ts:83-85`, но в чужой загруженной схеме встретиться могут). Побочно: у голого визарда появляется drop-зона и цель для `⌘→` — обязательно делать вместе с A2 и D2, иначе получаем новый путь «поле молча стало шагом».
*Комментарии-инварианты, которые станут ложными и правятся тем же коммитом:* докстринг `node-kind.ts:1-14`, `make-node.ts:292-295` («сеем один шаг, чтобы слот `steps` сразу был активен»), `model/wizard-node.test.ts:3-4`.
*Проверка:* `model/wizard-node.test.ts` — `steps: []` даёт слот с нулём entries; визард без ключа `steps` даёт слот; `StepIndicator` со `steps` из не-узлов слота НЕ получает.

**A2. Убрать приоритет `children` во всех четырёх точках выбора слота.**
Файлы: `agent/core/slots.ts:25-26` (удалить ранний возврат `children`), `store/reducers.ts:538`, `store/reducers.ts:613` (moveIn), `dnd/resolve-drop.ts:58` — везде `slots.find(s => s.kind === 'children') ?? slots[0]` → `slots[0]`. Переписать шапку `slots.ts:5-8` («предпочесть children» → «взять первый не-одиночный слот в порядке childSlots»).
*Чинит:* уже испорченный визард (есть и `steps`, и `children`) — без этого A1 только предотвращает порчу, но не лечит: любая следующая вставка продолжает уезжать в `children`, который не рендерит ни `preview-runtime/wizard-preview.tsx:101` (`__selfManagedChildren = true`), ни продовый шим `RendererFormWizard.tsx` (читает только `props.steps`).
*Риск:* правку делать во всех четырёх местах одновременно, иначе агент и ручной редактор разойдутся (инвариант заявлен в шапке `slots.ts:2-8`). Поведение меняется только у узла с ДВУМЯ множественными слотами — кроме визарда таких нет (массив даёт одиночный `template`, поле — одиночный `wrapper`).
*Известная неполнота (оговорка проверяющего):* пустая drop-зона на канвасе рисуется послотно (`SchematicCanvas.tsx:257-279`), а `commitDrop(schema, path, 'into')` (:268) идентичность слота теряет и выводит её заново в `resolveDrop`. После A2 зона под `children` визарда положит узел в `steps`. Полное лечение — протянуть `slotPath` в `resolveDrop/commitDrop`; это отдельная правка UI-слоя, не блокирующая A1/A2.
*Проверка:* `dnd/resolve-drop.test.ts` — визард со `steps:[X]` и `children:[]`, зона `into` → `steps`; `store/reducers.test.ts` — `addComponent` при выделенном визарде кладёт в `steps`.

**A3. `group_nodes` не группирует шаги.**
Файл: `agent/core/tools/group-nodes.ts`, после проверки «все в одном слоте» (:59-62): если последний сегмент `slotPath === 'steps'` — `fail('INVALID_PARENT', 'Шаги мастера группировать нельзя: заверни поля ВНУТРИ шага.')`. Сегодня `groupBlock` (`mutate.ts:363-384`) безусловно вставляет `$html(div)` на место блока, и два шага схлопываются в один без заголовка.
*Риск:* агент станет строже человека (`⌘G`, `reducers.ts:752-759`) — зафиксировать комментарием.
*Проверка:* `write-tools.test.ts` рядом с существующим кейсом группировки полей внутри шага.

**A4. `move_node`: явный отказ вместо невнятной ajv-ошибки.**
Файл: `agent/core/tools/move-node.ts`, перед `moveNode`: если `siblingInfo(ctx.draft, found.path) === null` — `fail('INVALID_PARENT', '… это шаблон массива или обёртка поля — перенести нельзя')`. Сегодня перенос `item/$template` даёт `SCHEMA_INVALID: … must have required property '$template'` — два сожжённых шага. Приём и формулировка копируются из уже работающего `duplicate-node.ts:31-36`.
*Риск:* перенос `wrapper` сегодня формально «работает» и станет ошибкой — осознанное сужение, назвать в PR.

---

### Слой B — каталог

**B1. Скрыть части compound'ов из НЕотфильтрованного `list_components`.**
Файл: `agent/core/catalog-digest.ts`, `listComponents` (:55-63): `.filter((e) => (filter?.query ? true : !isCompoundPart(e)))` — дословный аналог `panels/PalettePanel.tsx:112`. `ComponentSummary` и `label()` (:124-126) НЕ трогать.
*Чинит:* корень «0 полей» в обоих сгоревших прогонах. Измерено: сейчас при бюджете 1500 показывается 56 из 168, 39 из них — части; поля в окно не попадают вовсе.
*Почему не «подписывать части»:* суффикс «, часть Tabs» сжимает окно ещё на ~30% и не запрещает вставить `TabsList` внутрь `Tabs` (по подписи это законно). Ничего не теряется: все 91 часть начинаются с имени своего корня, а категория части = категория корня (`catalog/contract.ts:111`), то есть `query` по имени корня и по категории их находит; `describe_component`/`insert_node` читают `getCatalogEntry`, а не список.
*Обязательный спутник:* `notice()` (:97-98) → «… показано N из M самостоятельных; части compound'ов ищи по имени корня (query=tabs)».
*Проверка:* `catalog-digest.test.ts` — в `listComponents()` нет `TabsList`, в `listComponents({query:'tabs'})` есть; `renderComponentList(listComponents(), 1500)` содержит имя хотя бы одного поля (сегодня падал бы).

**B2. `describe_component` отдаёт структуру, а не только пропсы.**
Файл: `catalog-digest.ts`, `describeComponent` (:66-81) + `renderComponentDetail` (:129-145): добавить `compoundParent` (из `entry`) и `parts: partNamesOf(entry.name)` (обе функции экспортированы, `catalog/compound.ts:23-30`), печатать «Часть компонента Tabs — вставляй только внутрь Tabs» / «Собирается из частей: … — создаются автоматически при вставке». Это дословно тот текст, что Инспектор уже показывает человеку (`Inspector.tsx:197`).
Дополнительно — скелет по умолчанию: в `tools/describe-component.ts:39` дописать `renderOutline(buildOutline({ root: makeNodeFor(entry.name, entry.role, entry.compoundParent) }), …)` под заголовком «Скелет по умолчанию (адреса относительные)». Это закрывает и «`describe_component('Wizard')` молчит про steps» (для Wizard даст `/root/componentProps/steps/0 · Step`), и «молчит про compound-скелет Tabs», ноль новых типов и форматтеров — `outline.ts:51-113` уже ходит по `childSlots` и соблюдает бюджет.
*Риск:* адреса надо явно пометить как шаблонные, иначе модель примет их за адреса в реальной форме. `makeNodeFor` дёргает `getActiveDescriptor()` (`make-node.ts:313`) — порядок безопасен, `describeComponent` начинается с `getCatalogEntry → getCatalog`.
*Проверка:* `catalog-digest.test.ts` — `describeComponent('TabsTrigger').compoundParent === 'Tabs'`; `describe_component('Wizard').text` содержит `componentProps/steps` и `Step`; `describe_component('Tabs').text` содержит `TabsTrigger`.

**B3. `describe_component` для имени вне каталога, но присутствующего в форме.**
Файл: `tools/describe-component.ts` — принимать `ctx` (сигнатура `AgentTool.run(params, ctx)` это уже позволяет, `types.ts:105`) и до `fail()` проверять `collectOperatorNames(ctx.draft).components` (тот же вызов, что в `io/validate.ts:76`): если имя есть в открытой форме — отвечать «компонент из реестра проекта; новые такие узлы вставлять нельзя, существующие править можно», состав слотов брать с фактического узла через `childSlots` (как `get-form-node.ts:35-40`).
*Чинит:* `describe_component('RendererFormWizard') → UNKNOWN_COMPONENT` при том, что корень фикстуры `model/__fixtures__/sample-schema.ts:12` и реальных примеров playground — именно `$component(RendererFormWizard)`. Система одновременно говорит «его нет» и пропускает его валидацией (`io/validate.ts:14-20`).
*Риск:* в тексте нужна явная формулировка «вставлять нельзя» — `insert_node` его отклонит (`insert-node.ts:58-66`).

---

### Слой C — валидация

**C1. Гейт сравнивает ошибки строками с индексами — перевести на нормализованное мультимножество.**
Файл: `agent/core/gate.ts:31-38` и `:60-64`. Сейчас `new Set(validateSchema(base).errors)` и `.filter(e => !known.has(e))`, а строки содержат индексный путь (формат — `packages/reformer-renderer-json/src/validate.ts:129-153`). Вставка узла ПЕРЕД уже битым соседом сдвигает `children[0]` → `children[1]`, ошибка читается как новая, и невиновная правка отвергается с указанием на чужой узел. Политика «правка не обязана лечить, но обязана не ухудшать» (`gate.ts:8-11`) на сдвиге индексов не работает уже сегодня; с добавлением любых структурных правил (у всех путь в тексте) это станет нормой.
*Правка:* сравнивать счётчики сообщений с вырезанными числовыми индексами. Именно счётчики, не `Set`: при нормализации `Set` даёт дыру — форма с одной плохой строкой примет вторую такую же.
*Проверка:* `write-tools.test.ts` — база с одной ошибкой в `children[0]`, `insert_node index=0` → `ok`; правка, добавляющая новую ошибку тому же узлу → `SCHEMA_INVALID`.

**C2. Узкая валидация непрозрачного слота.**
Файл: `io/validate.ts`, `validateSchema` (:75-92). После `validateFormSchema` прогнать элементы `componentProps.steps` через `formSchemaMetaSchema` (экспортируется — `packages/reformer-renderer-json/src/index.ts`), скомпилированную ОДИН раз на уровне модуля; ошибки префиксить абсолютным путём элемента.
*Почему только `steps`:* `wrapper` (form-schema.schema.json:68) и `item.$template` (:79-86) ajv уже видит; непрозрачен ровно `componentProps`. Обход «мета-схема на каждом узле» отвергнут: мета-схема рекурсивна, это O(n²) и дубли ошибок на каждом уровне предков, плюс замер адверсария — 305 мс против 8.7 мс на форме из 55 узлов, а `commitMutation` валидирует КАЖДУЮ правку.
*Не делать:* правило «элемент массив-слота, не проходящий `isNodeLike`, — ошибка» в общем виде. В `children` не-узлы законны (`JsonChild`, textChild в form-schema.schema.json:39-43), их сеет `make-node.ts:48,58,132,137`, и `catalog/compound.test.ts:67-77` требует `errors === []` для каждого compound-шаблона.

**C3. Реляционные проверки Tabs/Accordion — предупреждениями, в билдере.**
Файл: `io/validate.ts` — пост-проход после `validateFormSchema`; `ValidationResult` (:36-39) расширить необязательным `warnings: string[]`. Правила: `defaultValue` корня входит в множество `value` его триггеров; множества `value` у `TabsTrigger` и `TabsContent` внутри одного `Tabs` совпадают; `value` непустой.
*Чинит:* сбой №2 (`defaultValue="step1"` без такого триггера, `trigger-undefined/content-undefined`, сирота-триггер).
*Жёсткие ограничения (иначе правка вредна):*
- **Не в `packages/reformer-renderer-json`** — пакет кит-агностичен (`dependencies = {ajv}`), а новая `error` там гасит форму панелью `SchemaErrorPanel` в DEV у примеров playground (`json-form-renderer.tsx:279-281`), у сгенерированного билдером кода и у MCP.
- **Не уровня `error`** — `error` идёт через `commitMutation` (`gate.ts:61`), а транзакций нет: `insert_node(TabsTrigger)` даёт `partNode` без `value` (`make-node.ts:56-59`) и был бы отвергнут; `duplicate_node` триггера даёт дубль `value`; вставка одного триггера ломает биекцию; `remove_node` одного триггера создаёт сироту. Промежуточное состояние сборки закономерно неполно.
- Гейт (`gate.ts:61-64`) фильтрует `.errors` — `warnings` мимо него проходят автоматически, править гейт не нужно. Сохранение (`app/save-actions.ts:552-557` делает `return` при `!valid`) и `canvas/FloatingActions.tsx:58` не блокируются.
*Проверка:* `catalog/make-node.test.ts` — каждый `COMPOUND_TEMPLATES[root]()` даёт ноль предупреждений (шаблон = эталонный экземпляр семейства); `io/validate.test.ts` — битый Tabs даёт предупреждения, `steps` из двух `Box` (реальный `projects/react-playground/src/pages/examples/builder-tests/test-02/form.json`) остаётся валидным.

**C4. `required` для `value` у частей Radix + посев значения.**
Файлы: `packages/reformer-ui-kit/scripts/generate-catalog.ts` (ручная карта `PART_PROPS`, чей докстринг буквально «пропсы частей, без которых часть не работает») — добавить `required: ['value']` только для `TabsTrigger/TabsContent/AccordionItem`; `packages/reformer-renderer-json/src/validate.ts:198-203` — валидировать отсутствующий `componentProps` как `{}` (иначе `required` не сработает). **Обязательный спутник:** `make-node.ts:320` для части с required-`value` сеять уникальную заготовку, иначе `insert_node(TabsTrigger)` начнёт отвергаться гейтом.
*Оговорка:* `required` переживает `toComponentPropsValidatorSchema` (`schema/index.ts:171-181`), механизм уже есть. Сегодня `required` нет ни у одной из 357 записей (проверено), поэтому поведение изменится ровно для добавленных.
*Приоритет ниже C3:* цепочка из трёх файлов в двух пакетах против одного пост-прохода в билдере.

**C5. Мемоизация ajv.**
Файл: `packages/reformer-renderer-json/src/validate.ts:334-335, 349-350` — `new Ajv()+compile(formSchemaMetaSchema)` и кэш валидаторов пропсов создаются на КАЖДЫЙ вызов. Замер адверсария: компиляция 7.4 мс, полный вызов 12 мс, вызов уже скомпилированной функции 0.007 мс. Ход из 10 write-вызовов = ~130 мс впустую.
*Правка:* ленивые модульные синглтоны; кэш валидаторов пропсов ключевать по ССЫЛКЕ на объект `propSchemas` через `WeakMap` (иначе при смене активного кита протечёт схема прошлого) — тот же приём, что `baselineCache` в `gate.ts:29`.
*Не делать:* инкрементальную валидацию «только поддерева» — требует знать корень compound'а выше точки правки и разводит гейт с `validate_form` ради копеек.

---

### Слой D — контракт инструментов

**D1. Ответ write-инструмента описывает созданное поддерево.**
Файл: `agent/core/gate.ts`, `commitMutation` (:75-82). При `kind === 'add'` дописать к тексту outline поддерева, переиспользуя ИДИОМУ, которая уже работает в `tools/remove-node.ts:33`: `buildOutline(result.schema).filter(e => e.ref.startsWith(`${ref}/`))`, отступы нормализовать по глубине корня, бюджет — `TOOL_TEXT_BUDGET` МИНУС длина уже собранного префикса (иначе `clamp` в `registry.ts:34-38` дорежет по символам и отдаст оборванный JSON Pointer).
*Чинит:* сбой №1 целиком (модель узнаёт, что `TabsList` и два `TabsTrigger` уже созданы, и с какими адресами), невидимый посеянный `Step` у визарда, а заодно `duplicate_node` (`:39` копирует поддерево, отчитывается одним адресом) и `group_nodes` (`:77` сдвигает адреса всех сгруппированных узлов, молча).
*Почему в `gate.ts`, а не в `insert-node.ts`:* не нужны ни экспорт `outlineOf`, ни поле `detail` в `OpDescription`; одним куском чинятся три инструмента вместо одного. `op.summary` (то, что видит UI, `changeset.ts:58-60`) не меняется.
*Оговорка проверяющего:* `renderEntry` (`outline.ts:89-95`) печатает component/model/label/required, но НЕ `componentProps.value` и не текстовые подписи вкладок — модель узнает адреса частей, но не их `value`. Это не отменяет правку, но формулировать эффект надо так.
*Риск:* ответ на одиночный `Input`/`Box` не меняется вовсе (поддерева нет) — массовый путь без регресса. Тестов, проверяющих успешный текст write-инструмента, сейчас нет (в `write-tools.test.ts:19` `res.text` используется только как сообщение ассерта).
*Проверка:* `write-tools.test.ts` — `insert_node('Tabs','/root')` → в `text` есть `TabsList` и адрес хотя бы одного `TabsTrigger`, нет «(ответ обрезан)»; `insert_node('Input','/root')` → строго `Готово: … Адрес узла: ….`; `duplicate_node` контейнера с двумя детьми → два адреса-потомка; глубокая схема + `insert_node('Table')` → `text.length <= TOOL_TEXT_BUDGET`.

**D2. `insert_node`/`move_node` знают, в какой слот кладут, и отказываются от бессмысленного.**
Файлы: `agent/core/slots.ts` — `insertSlotOf` возвращает `{path, kind}` вместо голого пути (функция приватная для агента, потребителей два: `insert-node.ts:72`, `move-node.ts:52`; `slotLength` рядом). Затем в обоих инструментах:
- `kind === 'steps'` и вставляемый — не контейнер, принимающий детей → `fail('INVALID_PARENT', 'В мастер кладут только шаги. Вставь Step в /root, затем поле внутрь шага.')`;
- вставляемый `Step`, а `kind !== 'steps'` → `fail('INVALID_PARENT', 'Шаг можно вставить только в мастер.')`.
Роль известна до создания узла (`entry.role`, `insert-node.ts:82`), для `move_node` проверяется сам перемещаемый узел.
*Чинит:* E (поле молча стало шагом), D и F (шаг вне мастера) — то есть ровно то, чего не даёт ни одна правка каталога или валидатора.
*Критично про формулировку правила:* НЕ «элемент `steps` обязан быть `$component(Step)`» — реальная форма `projects/react-playground/src/pages/examples/builder-tests/test-02/form.json` держит в `steps` два `$component(Box)`. Правило = «контейнер, принимающий детей» (`kindOf === 'container' && canAcceptChildren`), тот же идиом, что `Inspector.tsx:402`.
*Риск:* канвас/DnD и raw-JSON остаются не покрыты — но там человек видит результат в превью сразу. `duplicate_node`/`group_nodes` слот не меняют.
*Проверка:* `write-tools.test.ts` — `insert_node(FIELD, parent='/root')` на `sampleSchema()` → `INVALID_PARENT`, схема не изменилась; `insert_node('Step', parent=<Box>)` → `INVALID_PARENT`; существующий кейс `:88-94` («в мастер вставка идёт в шаги», вставляется `Step`) остаётся зелёным; `move_node` поля в визард → та же ошибка.

**D3. `validate_form` отвечает в диалекте, который можно скормить обратно в инструмент.**
Файл: `agent/core/tools/validate-form.ts:24-36`. Сейчас печатаются сырые строки валидатора в dotted-нотации (`root.children[0].componentProps has unknown property "labl"`), тогда как ВСЕ write-инструменты адресуют JSON Pointer'ом (`node-ref.ts:42`, `REF_PROP` в `params.ts:13-16`). Модель получает диагноз по одному адресу, а чинить обязана по другому.
*Правка:* прогонять сообщение через `parseErrorPath` (`io/error-path.ts:55-61`) и печатать `nodeRef(segments)`; при неудаче резолва — исходную строку; рядом печатать каталожное имя узла (`componentOf`) — ровно то, что нужно для параметра `expect`; разделять «Ошибки»/«Предупреждения» (после C3) и заканчивать императивом. `MAX_ERRORS` (:15) снизить с 10 до 5, как в гейте (`gate.ts:23`).
*Риск:* не превращать подсказку `fix` в псевдо-вызов инструмента с выдуманными именами параметров — это даст `INVALID_PARAMS` и сожжённый шаг. Если добавлять — генерировать из `inputSchema` и покрыть тестом соответствия.
*Проверка:* `tools.test.ts` — ответ содержит `/root/children/0` и НЕ содержит `root.children[0]`; `refToPath(<адрес из ответа>)` резолвится в тот узел, к которому относится ошибка.

**D4. `expect` принимает `null`. (2 строки)**
Файл: `agent/core/tools/params.ts:26-29` — `component`/`model` объявлены `{type:'string'}`, модель шлёт `model: null` и получает `Аргументы remove_node неверны: /expect/model must be string` (`registry.ts:100-101`). Соседний инструмент уже пользуется нужной идиомой: `set-node-prop.ts:29-31` — `type: ['string','number','boolean','null']`. Сделать `type: ['string','null']`.
*Чинит:* два сожжённых шага из 24 в живом прогоне.
*Проверка:* `tools.test.ts`/`registry.test.ts` — `remove_node` с `expect: {model: null}` не даёт `INVALID_PARAMS`.

**D5. Переименование вкладки/подписи — через уже принятое решение Инспектора.**
Файл: `agent/core/tools/set-node-prop.ts`, `run` (:39-53). Подпись `TabsTrigger` живёт текстовой частью в `children`, а `set_node_prop` пишет только в `componentProps`. В модели всё есть: `setTextChild`/`textChildIndex` (`mutate.ts:109-135`), Инспектор их зовёт (`Inspector.tsx:186`). Минимальная правка: при `key === 'text'` и предикате `kindOf(node) === 'container' && !isLeafComponent(node)` (дословно `Inspector.tsx:402`) маршрутизировать в `setTextChild`.
*Почему это не магия:* Инспектор УЖЕ прячет проп `text` из props-схемы именно потому, что `componentProps.text` — не то место, «рендерер оттуда содержимое не берёт» (`Inspector.tsx:410-417`). Мы просто распространяем принятое решение на агента.
*Почему не 14-й инструмент:* лишний элемент словаря, который модель должна выучить, ради операции, уже выражаемой существующим.
*Проверка:* `write-tools.test.ts` — `set_node_prop(ref=<TabsTrigger>, key='text', value='Личные данные')` меняет текстовую часть `children`, а не `componentProps`.

---

### Слой E — промпт

**E1. Три строки в `agent/core/prompt.ts` (:21-28, секция Hard rules).** Формулировать кит-агностично, без имён `Wizard`/`Tabs` (промпт не должен знать кит):
- «A container may own a typed slot. `insert_node` may create a whole skeleton of parts — read its answer: it lists what was created and at which addresses. Never re-create a part the answer already lists.»
- «If a tool answers INVALID_PARENT, do not retry the same call — call `get_form_outline` or `describe_component` and choose a different parent.»
- «Call `validate_form` before finishing; a form that answers with errors is not done.»
*Чинит:* усиливает D1/D2 (сигнал есть — модель должна его читать). Сам по себе не чинит ничего: подпись «часть Tabs» не помешала бы модели вставить `TabsList` внутрь `Tabs`.
*Риск:* промпт намеренно короткий и английский (`prompt.ts:1-9`) — не раздувать, три строки максимум.

---

### Слой F — рантайм хода и UI

**F1. `'tool-calls'` в `BROKEN_FINISH`. (3 строки)**
Файл: `agent/providers/ai-sdk.ts:35-41`. `stopWhen: stepCountIs(req.maxSteps)` (:79) завершает ход с `finishReason: 'tool-calls'`, а `BROKEN_FINISH` знает только `length` и `content-filter`. Текст должен называть причину и путь: «Ход остановлен на пределе шагов (24): модель не успела закончить. Разбейте задачу или продолжите следующим сообщением». Флаг `retryable` — по аналогии с `length`, `false` (повтор упрётся в тот же предел).
*Чинит:* оба сгоревших прогона выглядели как штатное завершение.
*Проверка:* тест провайдера/`loop.test.ts` — поток с `finish{finishReason:'tool-calls'}` даёт событие `error` и `done: 'error'`.

**F2. `historyFor` не теряет молчаливые ходы. (1-2 строки)**
Файл: `agent/run.ts:28-34`. Фильтр `e.text.trim().length > 0` выбрасывает реплику ассистента, состоявшую только из вызовов инструментов (`ChatEntry.tools` живёт отдельно от `text`, `session.ts:36-42`). Второй ход идёт вслепую.
*Правка:* пропускать запись, если непустой `text` ИЛИ непустой `tools`; для второго случая синтезировать компактный текст из `tools` (`name` + `summary`/`error`) — это ровно то, что видит пользователь в панели.
*Риск:* рост контекста; ограничен `HISTORY_LIMIT = 10` (:25) и краткостью `summary`.
*Проверка:* новый кейс в тестах сессии/`run` — после хода без текста, но с двумя успешными инструментами, `historyFor()` возвращает непустую запись ассистента.

---

## 3. Приоритеты (эффект на единицу работы)

**Одна-две строки, делать первыми:**

| # | Правка | Файл | Что чинит |
|---|---|---|---|
| 1 | `'tool-calls'` в `BROKEN_FINISH` | `agent/providers/ai-sdk.ts:35-41` | тихо сгоревший ход |
| 2 | `expect` принимает `null` | `agent/core/tools/params.ts:26-29` | 2 сожжённых шага из 24 |
| 3 | фильтр `historyFor` | `agent/run.ts:31` | слепой второй ход |
| 4 | условие слота `steps` + `STEPS_HOST_NAMES` | `model/node-kind.ts:162` | B, C, самоуничтожение визарда |
| 5 | `slots[0]` вместо `find(children)` ×4 | `slots.ts:25-26`, `reducers.ts:538,613`, `resolve-drop.ts:58` | лечение уже испорченных визардов |
| 6 | скрыть части из `list_components` | `catalog-digest.ts:59-62` | «0 полей» в обоих прогонах |

**Малые правки с максимальной отдачей (P1):** D1 (отчёт о поддереве в `gate.ts` — один кусок чинит три инструмента и весь сбой №1), D2 (правило слота в `insert_node`/`move_node` — чинит D/E/F, чего не даёт ни каталог, ни валидатор), B2 (`describe_component` со скелетом и частями), D3 (`validate_form` в JSON Pointer).

**Средние (P2):** C1 (мультимножество в гейте — обязательно ДО любых новых структурных сообщений), C3 (реляционные предупреждения Tabs), C2 (узкая валидация `steps`), A3/A4, D5, E1, C5.

**Низкие (P3):** C4 (`required` value + посев — цепочка из трёх файлов в двух пакетах), B3, пометка листьев в списке компонентов.

**Порядок обязателен в двух местах:** A1 без A2 и D2 создаёт НОВЫЕ пути «поле молча стало шагом» (у голого визарда появляются drop-зона и цель для `⌘→`). C1 обязана предшествовать C2/C3/C4 — иначе первая же структурная ошибка со сдвигом индекса начнёт отвергать невиновные правки.

---

## 4. Что НЕ делать

1. **Не строить «карту структурных правил» обходом `COMPOUND_TEMPLATES`.** Шаблонов 15 на 42 compound-корня, засеяно ~49 частей из 250; выведенные «родители» неверны для `*Group`-частей (`AvatarGroup`/`ItemGroup`/`MessageGroup` — обёртки НАД корнем, а не дети), `TableRow` не увидит законный `TableFooter`; B/C/E этим не чинятся вовсе. Плюс `COMPOUND_TEMPLATES` кит может подменить целиком (`make-node.ts:318` — `descriptor.compoundTemplates ?? COMPOUND_TEMPLATES`), а `Wizard`/`Step` — синтетика билдера (`synthetic-entries.ts:86-97`).
2. **Не ставить `compoundParent: 'Wizard'` записи `Step`.** В репозитории живут ОБА имени корня — `$component(Wizard)` и `$component(RendererFormWizard)` (последний — корень штатной фикстуры `model/__fixtures__/sample-schema.ts:12` и поставляемых примеров playground), поэтому правило «предок обязан называться Wizard» ложно срабатывает на исправных формах. Плюс: ломается снапшот `kits/__snapshots__/catalog-equivalence.test.ts.snap` (`compoundParent` — 6-е поле фингерпринта, `catalog-equivalence.test.ts:50`), `Step` уходит из общего списка `PalettePanel.tsx:112`, а Инспектор начинает предлагать «Содержимое — в частях: Step» (`Inspector.tsx:405` → `:195-199`), то есть класть шаг в `children` — ровно ту ошибку, которую правка лечит. Размещение шага решается в D2, где известен тип слота, а не по имени в каталоге.
3. **Не добавлять `steps` в `wizardPropsSchema`** (`synthetic-entries.ts:39-44`). `toInspectorProps` (`catalog/widgets.ts:17-51`) отдаёт все `properties` в Инспектор без фильтра, `inferWidget` на свободном типе даст `'text'`, `PropRow` (`Inspector.tsx:298-305`) отрендерит `<Input value={String(value)}>` — первый же символ затрёт массив шагов строкой. Модели про слот рассказывает B2 (скелет), а не props-схема.
4. **Не класть структурные правила в `packages/reformer-renderer-json`.** Пакет кит-агностичен (`dependencies = {ajv}`), каталога не видит, а новая `error` там подменяет форму панелью `SchemaErrorPanel` в DEV (`json-form-renderer.tsx:279-281`) у семи примеров playground, у сгенерированного билдером кода и у MCP.
5. **Не делать реляционные проверки уровня `error` в общем `validateSchema`.** Он питает и `commitMutation` (`gate.ts:61`), и ручное сохранение (`app/save-actions.ts:552-557` делает `return` при `!valid`). Ошибка «нет пары trigger↔content» сделает невозможными `insert_node(TabsTrigger)`, `duplicate_node` вкладки и `remove_node` одной вкладки: промежуточные состояния сборки закономерно неполны.
6. **Не подписывать части в общем списке `list_components`** («TabsList (container, часть Tabs)»): окно видимости сжимается с 56 до ~39 записей, полей там как не было, так и нет, а подпись ничего не запрещает.
7. **Не заводить второй механизм создания узлов и второй словарь размещения.** `insert_node` уже ходит через `makeNodeFor` — ту же фабрику, что палитра (`insert-node.ts:1-8`); `childSlots` объявлен единственным местом правил размещения (`node-kind.ts:1-14`). Любое новое правило должно жить в одном из них либо в вызывающем их инструменте.
8. **Не вводить инкрементальную валидацию «только изменённого поддерева»** — требует знать корень compound'а выше точки правки, разводит гейт с `validate_form` и экономит доли миллисекунды после C5.
9. **Не заводить 14-й инструмент под текстовое содержимое** — D5 переиспользует решение, уже принятое Инспектором.
10. **Не убирать `.some(isNodeLike)` из `node-kind.ts:162` без гейта по имени** — в ките `FormWizard` и `StepIndicator` несут проп `steps` из НЕ-узлов (обе `palette:false`, в каталог билдера не попадают, но в чужой схеме встречаются).
11. **Не менять `op.summary`** при правке D1: список изменений в UI (`changeset.ts:58-60`) должен остаться однострочным; поддерево уходит только в `text`, который читает модель.

---

## 5. Регрессионные тесты (по существующим файлам, новых не заводить кроме одного)

**`src/model/wizard-node.test.ts`** (сейчас 3 теста, фиксирует «у визарда нет `children`»):
- визард с `componentProps.steps: []` → ровно один слот `kind:'steps'`, `entries: []`, `length: 0`;
- визард без ключа `steps` (`{component:'$component(Wizard)'}`) → слот `steps`;
- `$component(RendererFormWizard)` без `steps` → слот `steps`;
- негатив: узел со `steps` из НЕ-узлов и именем вне `STEPS_HOST_NAMES` → слота нет;
- после `removeNode` последнего шага `insertSlotOf(wizard)` === `['root','componentProps','steps']`;
- переписать докстринг файла (:3-4) — он фиксирует старый инвариант.

**`src/model/node-kind.test.ts`** (16 тестов): порядок слотов у визарда с обоими слотами — `steps` первым.

**`src/dnd/resolve-drop.test.ts`** (13 тестов):
- `into` визарда с пустыми `steps` → `{slotPath: …/steps, index: 0}` (сегодня отклоняется);
- визард со `steps:[]` И `children:[X]`, `into` → `steps`, не `children`.

**`src/store/reducers.test.ts`**: `addComponent` при выделенном опустевшем визарде кладёт в `steps`, а не создаёт `root.children`; `⌘→` (moveIn) в визард — то же.

**`src/agent/core/tools/write-tools.test.ts`** (22 теста, уже держит визард-кейсы `:88-94`):
- `insert_node('Tabs','/root')` → в `res.text` есть `TabsList` и адрес хотя бы одного `TabsTrigger`; нет `(ответ обрезан)`;
- `insert_node('Wizard','/root')` → в `text` есть `componentProps/steps/0` и `Step`;
- `insert_node('Input','/root')` → `text` строго `Готово: … Адрес узла: ….` (регресс массового пути);
- `duplicate_node` контейнера с двумя детьми → два адреса-потомка в тексте; `group_nodes` двух полей → новые адреса обоих;
- `insert_node(FIELD, parent='/root')` на `sampleSchema()` → `INVALID_PARENT`, `res.schema === undefined`;
- `insert_node('Step', parent=<Box>)` → `INVALID_PARENT` с упоминанием мастера;
- существующий `:88-94` (Step в мастер → `/root/componentProps/steps/2`) остаётся зелёным;
- `remove_node(последний шаг)` → `insert_node('Step','/root')` → outline содержит `/root/componentProps/steps/0` и НЕ содержит `/root/children/0`;
- `group_nodes` по двум шагам → `INVALID_PARENT`, схема не изменилась; группировка двух полей ВНУТРИ шага работает;
- `move_node` с `ref` на `item/$template` → `INVALID_PARENT` с текстом про шаблон массива;
- гейт: база с ошибкой в `children[0]`, `insert_node index=0` → `ok` (регресс на сдвиг индексов); правка, добавляющая новую ошибку тому же узлу → `SCHEMA_INVALID`;
- `set_node_prop(key='text')` на `TabsTrigger` меняет текстовую часть `children`.

**`src/agent/core/tools/tools.test.ts`**:
- `remove_node` с `expect: {model: null}` не даёт `INVALID_PARAMS`;
- `validate_form` на схеме с известной ошибкой: текст содержит `/root/children/0`, не содержит `root.children[0]`, содержит имя компонента; `refToPath(<адрес из ответа>)` резолвится в тот узел;
- `describe_component('RendererFormWizard')` на `sampleSchema()` → `ok`, текст содержит `steps`; на пустой форме → `UNKNOWN_COMPONENT`.

**`src/agent/core/catalog-digest.test.ts`**:
- `listComponents()` не содержит `TabsList`, `listComponents({query:'tabs'})` — содержит;
- `renderComponentList(listComponents(), 1500)` содержит имя хотя бы одного field-компонента (сегодня падает);
- `describeComponent('TabsTrigger').compoundParent === 'Tabs'`; `describeComponent('Tabs').parts` содержит три части;
- `renderComponentDetail` для части содержит `Tabs`, для `Wizard` — `steps` и `Step`;
- существующий кейс регистронезависимого `query` (`:23-29`, берёт `all[0].name`) должен остаться зелёным.

**`src/io/validate.test.ts`** (7 тестов):
- `{component: 42}` внутри `componentProps.steps` → invalid с путём `componentProps.steps[0]`;
- валидный `Step` в `steps` → valid; `steps` из двух `Box` (как в `builder-tests/test-02/form.json`) → valid;
- Tabs с `defaultValue` в пустоту → `warnings.length > 0`, `valid === true`;
- Tabs из `COMPOUND_TEMPLATES` → ноль предупреждений;
- существующие кейсы `:75-85` (project-specific имена законны через baseline) — без изменений.

**`src/catalog/make-node.test.ts` / `src/catalog/compound.test.ts`**: каждый `COMPOUND_TEMPLATES[root]()` проходит новый пост-проход с нулём предупреждений (шаблон = эталонный экземпляр семейства); `compound.test.ts:67-77` (`errors === []` на каждой композиции) остаётся зелёным.

**`src/agent/core/loop.test.ts`** (или тест провайдера): поток с `finish{finishReason:'tool-calls'}` даёт `error` + `done:'error'`, а не `done:'complete'`.

**Единственный новый файл, если браться за C3 целиком:** `src/io/structure-lint.test.ts` — позитив/негатив на реляционные правила Tabs/Accordion. Всё остальное дописывается в существующие suite.

**Регресс-прогон одной командой:** `cd projects/reformer-builder && npx vitest run src/model src/dnd src/store src/catalog src/io src/agent src/kits`.