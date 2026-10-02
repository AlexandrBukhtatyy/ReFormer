# Редактор RJSF: переключатель «Структура ↔ Форма» и свойства поля в правой панели

## Context

Сейчас вкладка формы RJSF показывает всё сразу: слева список полей со встроенным инспектором,
справа отрисованная форма ([RjsfEditor.tsx](../../projects/reformer-builder/src/plugins/rjsf/editor/ui/RjsfEditor.tsx)).
Нужно как у редактора ReFormer: во вкладке — переключатель между редактором структуры и
отрисованной формой, а свойства выбранного поля — в правой панели оболочки.

Как это сделано у ReFormer (и что повторяем):

- переключатель — не компонент внутри вкладки, а кнопки в полосе вкладок: вклады `MenuPoint` в меню
  `EDITOR_TITLE_MENU` ([canvas-actions.ts](../../projects/reformer-builder/src/plugins/reformer/editor/canvas/canvas-actions.ts));
  режим хранит стор плагина, а не тело редактора ([canvas-prefs.ts](../../projects/reformer-builder/src/plugins/reformer/editor/session/canvas-prefs.ts));
- инспектор — вклад `PanelPoint` со слотом `panel.right` и `when` по `activeResourceKind`
  ([plugin.ts:221-246](../../projects/reformer-builder/src/plugins/reformer/editor/plugin.ts#L221-L246));
- выделение живёт в ручке модели платформы (`getSelection` / `setSelection`), операция переносит его
  полем `focus`, отмена восстанавливает из снимка.

Оболочка и plugin-api не меняются. Импортировать код ReFormer из домена `rjsf` нельзя (линтер) —
приёмы повторяются своим кодом.

## Решения и границы

- **Два положения**: «Структура» и «Форма». «Исходник» остаётся через «Открыть другим редактором».
- **Режим один на все формы RJSF** и запоминается (настройка `rjsf.editor.view`, умолчание —
  структура) — как вид конструктора у ReFormer. Без поверхности превью кнопок нет и всегда структура.
- **Правый док по умолчанию закрыт** — это решение оболочки ([boot.ts:470-474](../../projects/reformer-builder/src/shell/boot/boot.ts#L470-L474)),
  как у ReFormer: первый раз панель «Свойства» открывается щелчком по значку справа, дальше выбор
  запомнен. В `rjsf.builder` эта панель справа единственная, поэтому рейл виден только на вкладке
  формы RJSF.
- **В положении «Форма» поле щелчком не выбирается** (поверхность `rjsf.preview` объявляет
  `hitTest: false`). Поле выбирают в «Структуре»; выделение при переключении сохраняется, и правки
  из панели сразу видны на форме.
- «Добавить поле», «Экспорт Form.tsx» и заголовок формы остаются в «Структуре» (в «Форме» —
  команды из палитры).
- Вёрстка полей инспектора переезжает как есть. Вне объёма: перевод на `@reformer/ui-kit`,
  автооткрытие дока, выбор щелчком по форме, демо-стек `plain`.

## Изменения

Все пути — от `projects/reformer-builder/src/plugins/rjsf/`.

1. **`core/ops.ts`** — `RjsfApplyResult.focus?: string`: `add-field` → имя нового поля,
   `rename-field` → новое имя (кроме `name === to`). Провайдер отдаёт результат как есть.
2. **`editor/view.ts`** (новый, по образцу `canvas-prefs.ts` + `canvas-actions.ts`):
   - `createRjsfViewStore({ settings, hasLive })` → `view()` (зажат: `form` без поверхности →
     `structure`), `setView`, `subscribe`, `dispose`;
   - `rjsfViewCommands` — `rjsf.showStructure`, `rjsf.showForm`;
     `enabled: активный документ — RJSF && (mode !== 'form' || hasLive())`;
   - `rjsfViewMenuItems` — `rjsf.title.structure` (значок `List`) и `rjsf.title.form`
     (`SquareMousePointer`): `menu: EDITOR_TITLE_MENU`, `group: '1_view'`,
     `when: whenEditor(t => t.editorId === RJSF_EDITOR_ID) && hasLive()`, `toggled`, `onDidChange` от стора.
3. **`editor/ui/hooks.ts`** (новый) — `useHandle`, `useModel`, `useKitFields` переезжают из
   `RjsfEditor.tsx`; новые `useActiveHandle(services)`, `useSelection(handle)`, `useRjsfView(store)`,
   `selectedFieldOf(form, selection)` (ровно одно имя и `Object.hasOwn`).
4. **`editor/ui/RjsfInspector.tsx`** (новый) — тело правой панели: находит ручку активного документа,
   читает модель и выделение; `Inspector`, `EnumInput` и помощники переезжают сюда без изменения
   логики (`onRenamed` уходит — выделение переносит `focus`). Без своей шапки и прокрутки: их даёт
   оболочка. Пусто — «Выберите поле в структуре формы…».
5. **`editor/ui/RjsfEditor.tsx`** — по режиму рисует `StructureView` (действия, заголовок формы,
   список полей; щелчок по строке → `handle.setSelection([name])`; удаление выбранного снимает
   выделение) либо `LiveForm` на всю вкладку. Локальный `picked` и проп `kits` уходят. Строки списка
   получают `data-testid="rjsf-row-<имя>"` (сейчас `rjsf-field-name` совпадает у строки поля `name`
   и у поля ввода инспектора). В `LiveForm` — `onDidChangeSchema` не срабатывает на смену выделения.
6. **`editor/plugin.ts`** — стор вида (настройки через `SettingsServiceToken`), регистрация команд,
   вклады пунктов меню и панели:
   `{ id: 'rjsf.inspector', slot: 'panel.right', titleKey: 'panel.inspector', icon: SlidersHorizontal, order: 10, when: ctx => ctx.activeResourceKind === RJSF_PROVIDER_ID }`.
   Новые идентификаторы — в `editor/contract.ts` и `editor/index.ts`. Манифест не меняется.
7. **`editor/locales/ru.json`, `en.json`** — `command.showStructure`, `command.showForm`,
   `action.view.structure` («Структура»), `action.view.form` («Форма»), `panel.inspector`
   («Свойства»; ключ `inspector.title` занят подписью поля), правка `inspector.empty`.
8. **Документация** — [project-structure.md:196](../../projects/reformer-builder/docs/project-structure.md#L196)
   и запись в [decisions-log.md](../../projects/reformer-builder/docs/decisions-log.md) (что сделано и
   принятые ограничения из раздела выше).

## Тесты

- `core/rjsf.test.ts` — `focus` у `add-field` и `rename-field`, отсутствие у остальных.
- `editor/view.test.ts` (новый) — стор (умолчание, мусор в настройке, запись, зажим без поверхности),
  команды, пункты меню (`when` по редактору и поверхности, нажата ровно одна, сигнал от стора).
- `editor/plugin.test.ts` — двойники уезжают в `editor/testing.ts`; видимость панели; все новые
  `titleKey` есть в обеих локалях; `addRjsfField` переносит выделение, отмена возвращает.
- `editor/ui/RjsfEditor.browser.test.tsx` (новый, на двойниках) — структура ↔ форма; выбор строки →
  поля в инспекторе; правка из инспектора меняет модель; переименование, удаление, отмена; инспектор
  следует за активной вкладкой.
- `shell/boot/integration/rjsf-profile.test.ts` — владельцы `PanelPoint`, пункты `editor/title`;
  настоящий модельный документ с провайдером RJSF: `focus` двигает выделение, `undo` возвращает.
- `shell/boot/integration/rjsf-view.browser.test.tsx` (новый, по образцу
  [markdown-view.browser.test.tsx](../../projects/reformer-builder/src/shell/boot/integration/markdown-view.browser.test.tsx)) —
  настоящая полоса вкладок: кнопки доступны с первого кадра, нажата «Структура», щелчок по «Форма»
  меняет тело; без превью кнопок нет.

## Verification

Команды — только из `projects/reformer-builder` (корневой `tsc -b` засоряет репозиторий `.js`):

```bash
npm test -- src/plugins/rjsf src/shell/boot/integration/rjsf-profile.test.ts \
  src/shell/boot/integration/i18n-completeness.test.ts src/structure.test.ts
npm run test:browser -- src/plugins/rjsf src/shell/boot/integration/rjsf-view.browser.test.tsx
npm run lint
npx tsc -b
npm test && npm run test:browser   # полный прогон; сверять число тестов, а не только цвет
```

Вживую (dev-сервер с `REFORMER_BUILDER_CONFIG` на конфиг `rjsf.builder`, как в прошлой проверке;
прежний экземпляр остановлен по лимиту времени — поднять заново), через playwright:

1. «Файл» → «Новая форма RJSF»: во вкладке только структура, в полосе вкладок кнопки «Структура»
   и «Форма», нажата «Структура».
2. Значок «Свойства» в правом рейле открывает панель; щелчок по полю показывает его свойства.
3. Правка подписи в панели → «Форма»: форма на всю вкладку, подпись новая, панель на месте.
4. Переход на вкладку другого вида: кнопок и правого рейла нет; возврат — всё на месте.
5. Перезагрузка страницы: режим и состояние дока сохранились.

Скриншоты — в `projects/react-playground-e2e/screenshots/rjsf-builder/`.

Задача ведётся в `bd`; коммит и push — только по отдельной просьбе.
