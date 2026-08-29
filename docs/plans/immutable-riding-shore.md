# Модуль горячих клавиш: контекстность, слои, аккорды

> Проект: `projects/reformer-builder-v2`. Ветка `ui_builder_v2`.
> После утверждения задачи заводятся узлами в `projects/reformer-builder-v2/docs/work-graph.json`
> (эпик `e5`, ключи `t5-3x-*`, метка `builder-v2`, оценка хвостом описания), решения по ходу —
> записями в `projects/reformer-builder-v2/docs/decisions-log.md`.

## Контекст

Диспетчер клавиш уже сдан (`t5-3`, 125 тестов): один слушатель на `document` в фазе всплытия,
`CommandContribution.keybinding`, `WhenContext` из пяти полей, классификация фокуса по
`data-focus-zone`. Требования «клавиши у хоста» и «плагин регистрирует клавиши» этим закрыты.

Не закрыто третье — контекстность, и это не гипотетический пробел, а **действующий дефект**:

- `delete` зарегистрирован **дважды** — [operations.ts:251](projects/reformer-builder-v2/src/plugins/files/operations.ts#L251) (удалить файл) и [commands.ts:228](projects/reformer-builder-v2/src/plugins/editor-schema/commands.ts#L228) (удалить узел схемы). Разводит их только `enabled` плюс порядок регистрации, а порядок активации плагинов по контракту (`plugin/registry.test.ts`) **ничего не значит**. Кто выиграет — вопрос случайности.
- `mod+c` / `mod+x` / `mod+v` дерева файлов конкурируют с копированием текста, разведены неявно.
- `mod+z` редактора схемы рассматривается на любой вкладке, включая markdown.

Причина одна: условие живёт **функцией** (`enabled(ctx)`), поэтому его нельзя ни сравнить, ни
сериализовать, ни показать человеку. Отсюда следует и всё остальное отсутствующее: приоритетов
нет, конфликты не обнаруживаются, аккордов нет, переназначить клавишу нельзя, плагин не может
описать своё состояние иначе как непрозрачным предикатом.

**Суть работы: правило «какая команда сработает» превращается из функции в данные.**
`KeybindingRule { chord, commandId, when: WhenExpr, layer, allowInEditable, seq }`, разрешение —
сортировка внутри bucket'а нажатой клавиши. Побочный выигрыш: диспетчер станет **дешевле** —
сегодня на каждое похожее на сочетание нажатие обходятся ~40 команд, после будет 0–3 правила.

Ориентир — VS Code (`when`-выражения, слои, снятие через `-id`) и WebStorm (приоритет ближнего
контекста, keymap как данные, обнаружение конфликтов).

## Что не переоткрывается

Записанные решения с тестами — менять их не входит в задачу:

1. Один слушатель на `document`, фаза **всплытия**; редактор выигрывает через `stopPropagation()`.
2. `mod` разрешается только в диспетчере; `normalizeKeybinding` о платформе не знает.
3. `allowInEditable` живёт на `CommandContribution` рядом с `keybinding`.
4. Ввод редактора (стрелки, Escape с тремя смыслами, навигация по дереву) в реестр команд не попадает.
5. Таблица клавиш строится из реестра, не ведётся руками.
6. `WhenContext` остаётся на пяти полях — они становятся **ядром** набора ключей, а не растут.
7. `PanelContribution.when` и `MenuPlacement.when` остаются функциями: у меню `when` видит цель
   щелчка (`MenuTarget`), а цель — не состояние платформы и ключом быть не может.

## Модули

### Новые файлы

| Путь | Что внутри | Почему этот слой |
|---|---|---|
| `src/host/primitives/when-expr.ts` | грамматика, AST, `parseWhen`/`compileWhen`/`evaluateWhen`, `whenSpecificity`, `whenKeys`, `provablyDisjoint` | Чистые функции без DOM и React, как `normalizeKeybinding` рядом. Нужен двоим — `primitives/command.ts` (проверка на регистрации) и `ui/keybindings.ts`; в `ui/` класть нельзя, `primitives` не имеет права импортировать `ui`. |
| `src/host/services/context-keys.ts` | `ContextKeyService`, `ContextKey`, `ContextKeyServiceToken`, `createContextKeyService` | Сервис в точном смысле реестра: один токен — одна реализация, плагин достаёт через `ctx.services`. Соседи — `selection.ts`, `settings.ts`, природа та же. |
| `src/host/ui/scope.ts` | `ScopeStack`, `createScopeStack`, `useScope`, `ScopeStackServiceToken` | Область — понятие оболочки (окно, модалка), как `SlotId`. |
| `src/host/ui/keybinding-rules.ts` | `KeybindingRule`, `KeybindingLayer`, `LAYER_RANK`, `buildKeybindingIndex`, `rulesFromCommands`, `applyRemovals`, `findConflicts` | Чистое правило без React — как `menu.ts`, `palette.ts`, `status.ts`, которые тоже в `ui/` и проверяются в `node`. |
| `src/host/ui/keymap.ts` | `KeymapService`, `KeymapServiceToken`, пользовательский слой, ленивый кэш индекса, `conflicts()` | Владелец источников правил. Токен рядом с модулем — прецедент `DiagnosticsServiceToken`. |
| `src/host/ui/chords.ts` | `ChordState`, `CHORD_TIMEOUT_MS`, `ChordSnapshot` | Состояние ожидания вне React: читателей двое — диспетчер и строка состояния. |
| `src/host/ui/keymap-issues.ts` | `KeymapIssue`, отложенный отчётчик | По образцу `menu-issues.ts` и по той же причине: команды регистрируются после первого кадра. |
| `src/host/ui/keybinding-editor.ts` + `KeybindingsDialog.tsx` | правила экрана (в `node`) и отрисовка | Как `palette.ts` + `CommandPalette.tsx`. |

### Правится

`primitives/command.ts` (`when?: string`, `CommandErrorKind` `'invalid-when'`, `normalizeChord`,
`MAX_CHORD_STEPS`) · `ui/keybindings.ts` (диспетчер на индексе + аккорды; `formatKeybinding`
сохраняет сигнатуру — на неё завязаны четыре файла) · `ui/help.ts` (строит из **действующих**
правил) · `ui/HelpDialogs.tsx` (read-only ветка уходит, `HELP_SHORTCUTS_COMMAND_ID` открывает
редактор) · `ui/menu.ts` + `MenuBar.tsx` + `ResourceTree.tsx` (`chordOf(commandId)` входом,
как `translate` и `execute`) · `ui/StatusBar.tsx` + `status.ts` (индикатор аккорда) ·
`ui/CommandPalette.tsx` (снимок у `ContextKeyService`, пуш области `'palette'`) · `ui/Shell.tsx` ·
`ui/usePanels.ts` (три переходника `useSyncExternalStore`) · `plugin/manifest.ts` +
`plugin/catalog.ts` · `sdk/index.ts` · `app/boot.ts` · `services/i18n/locales/{ru,en}.json`.

**Не трогается:** `primitives/when-context.ts`, `ui/focus.ts`, `ui/when-context-store.tsx`,
`ui/palette.ts`, `diagnostics/*`, `plugin/{types,registry,context}.ts`.

## Ключевые контракты

### `when` — DSL

```
or := and ('||' and)*   ·   and := unary ('&&' unary)*   ·   unary := '!' unary | primary
primary := '(' expr ')' | key (('=='|'!=') literal | '=~' regex | ('in'|'not' 'in') key) | key
```

```ts
export type WhenNode =
  | { kind: 'true' } | { kind: 'key'; key: string }
  | { kind: 'not'; operand: WhenNode }
  | { kind: 'and' | 'or'; operands: readonly WhenNode[] }
  | { kind: 'eq'; key: string; value: WhenLiteral; negated: boolean }
  | { kind: 'match'; key: string; pattern: string; flags: string; negated: boolean }
  | { kind: 'in'; key: string; collection: string; negated: boolean };

export interface WhenExpr {
  readonly source: string;              // как написано — показывается в редакторе
  readonly ast: WhenNode;
  readonly keys: readonly string[];     // читаемые ключи; по ним подписка и диагностика
  readonly specificity: number;         // считается один раз, при разборе
}

export function parseWhen(source: string): WhenParseResult;   // не бросает — для файлов
export function compileWhen(source: string): WhenExpr;        // бросает CommandError — для кода
export function evaluateWhen(expr: WhenExpr, read: (key: string) => unknown): boolean;
export function provablyDisjoint(a: WhenExpr, b: WhenExpr): boolean;
```

Несущие решения:

- **Правая часть `==` — всегда литерал; голое слово там строка.** Читайся оно ключом,
  `activeResourceKind == form.schema` молча сравнивало бы два `undefined` и было бы истинным
  всегда — промах выглядел бы как «клавиша работает везде», худший вид отказа.
- **`negated` полем, а не обёрткой `not`:** `a != b` и `!(a == b)` обязаны давать один AST,
  иначе одинаковые по смыслу правила получат разную специфичность.
- **Неизвестный ключ — ложь, не отказ.** Выражение вправе ссылаться на ключ выключенного плагина.
- Арифметики, вызовов и присваивания в грамматике нет: как только в условии появится вычисление,
  специфичность перестанет быть определимой.

**Специфичность:**

```
weight(key) = 4 для 'scope' · 3 для 'focus' · 2 для activeEditorId|activeResourceKind · 1 иначе
spec(true)=0 · spec(key)=weight · spec(eq|match|in)=weight+1 · spec(!X)=spec(X)
spec(and)=Σ · spec(or)=min
```

`or` берёт **минимум**: возьми мы максимум, `focus == 'tree' || true` встало бы выше
`focus == 'tree'`, совпадая со строго большим числом состояний — то есть «добавь `|| true`»
стало бы способом перебить кого угодно. `not` — тождество: `!hasSelection` ограничивает
дополнением, той же силы. Вес по ключу, а не бонус: `scope` называет **окно**, и клавиша окна
обязана бить глобальную, потому что именно так это видит рука.

### `ContextKeyService` — оборачивает `WhenContextStore`, не заменяет

Копии пяти полей нет вовсе: `read(key)` для зарезервированных имён делегирует порту.

```ts
export interface ContextKeyReader {
  read(key: string): unknown;
  snapshot(): ContextKeySnapshot;                 // ссылка стабильна между изменениями
  subscribe(cb: (changed: ReadonlySet<string>) => void): Disposable;  // несёт ИМЕНА
}
export interface ContextKeySnapshot {
  read(key: string): unknown;
  whenContext(): WhenContext;                     // проекция для CommandRegistry.execute
}
export interface ContextKeyService extends ContextKeyReader {
  createKey<T>(key: string, initial: T): ContextKey<T>;   // ContextKey extends Disposable
  declared(): readonly ContextKeyInfo[];
}
```

Зарезервированы `focus`, `activeEditorId`, `activeResourceKind`, `hasSelection`, `previewMode`,
`scope`, `scopes` — `createKey` с таким именем **бросает**: затени плагин `focus`, и диспетчер
с панелями стали бы отвечать на «куда направлен фокус» по-разному, то есть вернулся бы дефект v1.
Повторное объявление ключа — отказ, а не замена (довод `settings.registerDefault`: иначе значение
зависело бы от порядка активации, который ничего не значит).

Снятие — обычным жизненным циклом: `ctx.subscriptions.push(key)`; после `dispose` ключ читается
как `undefined`, правило перестаёт совпадать. Ключ мимо `subscriptions` переживёт плагин — та же
цена, что у вклада мимо `subscriptions`, контракт её уже признаёт.

**Лавины перерисовок не будет по четырём причинам:** диспетчер не подписан вовсе (читает
`snapshot()` раз на нажатие); `set` того же значения не уведомляет (`Object.is`); уведомление
несёт имена, и подписчик с `WhenExpr.keys` молчит при пустом пересечении; ссылка снимка стабильна.

### Индекс и разрешение

```ts
export type KeybindingLayer = 'host' | 'builtin-plugin' | 'catalog-plugin' | 'user';

// компаратор, применяется ОДИН раз при сборке индекса:
LAYER_RANK[b.layer] - LAYER_RANK[a.layer]      // user выше всех
  || b.when.specificity - a.when.specificity
  || b.seq - a.seq                             // последний зарегистрированный
```

`Map<разрешённая по платформе первая ступень → правила>` + `Set` префиксов аккордов. Ключ разрешён
заранее: платформа в сессии не меняется. Пересборка **ленивая** по метке «грязно» (`commands.onDidChange`,
`keymap.registerRules`, `settings.onDidChange('host.keymap')`) — активация плагина регистрирует до
двадцати команд одним синхронным проходом, и жадность дала бы двадцать полных пересборок за запуск.

Отбор на нажатие: `binding` → кандидаты из bucket'а → **один** снимок контекста → по порядку:
(a) фокус в поле ввода и не `allowInEditable` → пропуск; (b) фокус на управляющем и клавиша из
`CONTROL_KEYS` → пропуск; (c) `when` ложно; (d) команды нет в реестре (+`KeymapIssue`);
(e) `enabled` ложно. Первый выживший — победитель.

`CONTROL_KEYS` остаётся в диспетчере и **невыразим в `when`**: проверка зависит от самого события
(голый пробел, голый Enter), а не от состояния мира; ключа «нажат ли сейчас голый пробел» быть
не должно.

### Аккорды

`normalizeKeybinding` **не меняется** — рядом появляется `normalizeChord(s): readonly string[]`
(`MAX_CHORD_STEPS = 2`). Ловушка, которую надо обойти: существующий тест требует, чтобы
`'  mod + alt + V  '` давало одну ступень, то есть пробел внутри ступени сегодня незначим.
Наивный `split(/\s+/)` это ломает. Правило: **пробел у `+` — украшение, пробел между
завершёнными ступенями — разделитель**, одной строкой
`s.replace(/\s*\+\s*/g, '+').trim().split(/\s+/)`.

- **`preventDefault` на первой ступени обязателен** — иначе `mod+k` уводит фокус в адресную
  строку, а `mod+s` открывает диалог браузера, пока мы ждём вторую клавишу.
- **Таймаут 5000 мс**, планировщик — параметром (окружение тестов `node`, прогон обязан остаться
  7–8-секундным). Отмена: голое Escape, таймаут, `blur` окна — аккорд, переживший alt-tab, ловушка.
- **Непопавшая вторая ступень ничего не выполняет и не переразбирается.** Иначе `mod+k`, затем
  `mod+s` молча сохранил бы файл — человек получил бы действие, которого не просил.
- Индикатор — собственный `chordIndicator(labels)` в `status.ts`, ячейка существует только во
  время ожидания.

### Область (scope)

```ts
export interface ScopeStack {
  top(): ScopeId | null;              // значение ключа `scope`
  all(): readonly ScopeId[];          // значение ключа `scopes`, правая часть `in`
  push(scope: ScopeId): Disposable;   // снимает ИМЕННО эту запись, где бы она ни оказалась
  subscribe(listener: () => void): Disposable;
}
export function useScope(stack: ScopeStack, scope: ScopeId | null): void;
```

Пушат: палитра (`'palette'`), диалоги — `HelpDialogs`, `MergeDialog`, `PromptHost`,
`EditorPicker`, `KeybindingsDialog` (`'dialog'`). Панели **не пушат** — у них уже есть
`data-focus-zone`, то есть ключ `focus`.

Два ограничения, которые важнее самого механизма:

- **Область даёт приоритет, а не исключительность.** Правило без области продолжает срабатывать
  при открытом окне: `mod+shift+p` обязано открывать палитру из диалога. Сделай мы область
  глушителем — получили бы «пока открыт любой диалог, клавиатура мертва».
- **Область не заменяет `stopPropagation`.** Scope отвечает «какая команда выиграет»,
  `stopPropagation` — «дойдёт ли событие вообще». Смешать их значит снова сломать палитру.

### Пользовательский keymap

`SettingsService`, ключ `host.keymap`, область `user` — клавиатура принадлежит человеку, а не проекту.

```jsonc
[
  { "key": "ctrl+shift+u", "command": "editor-schema.ungroup" },
  { "key": "mod+d",        "command": "-editor-schema.duplicate" },  // снять конкретное
  { "key": "f2",           "command": "-" },                          // освободить клавишу
  { "key": "delete",       "command": "files.delete", "when": "focus == 'tree'" }
]
```

Слой `user` выигрывает на первом уровне компаратора **независимо от специфичности**:
переназначение, проигравшее более специфичному правилу плагина, было бы переназначением, которое
не сработало, — объяснить это человеку нечем. Снятие действует на слои строго ниже.

Чтение поэлементное: битый элемент отбрасывается с `KeymapIssue`, остальные применяются — в
хранилище лежит то, что положили прошлые версии. Правило на команду, которой нет, **остаётся
в файле** и помечается `dangling-command`: удаление потеряло бы работу человека при первом же
запуске с выключенным плагином.

### Манифест плагина

`contributes.keybindings` в `PluginManifest`, разбор `parseKeybindings` рядом с `parseStyles` той
же формы (значение либо `PluginProblem('manifest-invalid')`). Неразбираемое `when` — **отказ
манифеста**: условие, которое не разбирается, это клавиша, которая не сработает никогда.

Правила публикуются каталогом в `keymap.registerRules(pluginId, 'catalog-plugin', …)` **на
`refresh`, а не на активации** — иначе таблица врала бы о том, что плагин предлагает, и
переназначить его сочетание до включения было бы нельзя.

## Миграция 16 сочетаний

**Обратная совместимость — одно правило: команда с `keybinding` и без `when` ведёт себя ровно как
сегодня** (`when: WHEN_TRUE`, специфичность 0). Первый этап можно сдать, не тронув ни одной команды.

`when` отвечает на «где и в каком режиме» (состояние платформы, сравнимо и сериализуемо),
`enabled` — на «есть ли чему сработать» (приватное состояние владельца, данными быть не может).
То же разделение, что `menu.ts` уже проводит между «`when` скрывает» и «недоступность гасит».

| Команда | Клавиша | `when` | Остаётся в `enabled` |
|---|---|---|---|
| `files.rename` / `delete` / `copy` / `cut` / `paste` | `f2`, `delete`, `mod+c/x/v` | `focus == 'tree'` | `hasProject`, буфер, prompt |
| `editor-schema.delete` / `duplicate` / `group` | `delete`, `mod+d`, `mod+g` | `focus == 'canvas' && hasSelection` | `removableSelection().length > 0` |
| `editor-schema.ungroup` | `mod+shift+g` | `focus == 'canvas' && hasSelection` | `selection.length === 1` |
| `editor-schema.undo` / `redo` | `mod+z`, `mod+shift+z` | `activeResourceKind == 'form.schema'` | `canUndo` / `canRedo` |
| `files.save` | `mod+s` | `activeEditorId != null` | перепроверка вкладки в `run` |
| палитра, доки, `saveAll` | `mod+shift+p`, `mod+j`, `mod+b`, `mod+alt+s` | — | без изменений |

Что это покупает **немедленно**: коллизия `delete` становится доказуемо непересекающейся и видна
в таблице глазами; `mod+z` перестаёт рассматриваться на markdown-вкладке; `mod+c/x/v` разведены
с копированием текста явно, а не по совпадению.

## Этапы

| # | Этап | Дней | Ценность сама по себе |
|---|---|---|---|
| **1** | **`when` как DSL без нового поведения.** `when-expr.ts`; `when?` на команде; `invalid-when`; `ContextKeyService` над существующим стором (пока пять полей); четвёртая проверка в `shouldDispatch`; миграция 16 сочетаний. | 2 | **Исправление настоящего дефекта, а не подготовка:** `delete` перестаёт зависеть от порядка активации, `mod+z` — от вкладки. |
| 2 | Правила, слои, индекс: `keybinding-rules.ts`, `keymap.ts`, диспетчер на bucket'ах, `help.ts` и меню читают действующие правила. Слой `user` объявлен и пуст. | 2 | Перебор реестра заменён bucket'ом; таблица клавиш перестаёт быть способной соврать. |
| 3 | Расширяемые ключи и область: `createKey` для плагинов, `scope.ts`, `useScope`, пуш в палитре и диалогах, экспорты SDK. | 1.5 | Плагин выражает «узел выделен» условием, а не чтением своего реестра сеансов из `enabled`. |
| 4 | Аккорды: `normalizeChord`, `chords.ts`, ветка ожидания, индикатор. | 1.5 | Пространство сочетаний, которое уже кончалось, открывается заново. |
| 5 | Пользовательский keymap и редактор: формат в настройках, слой `user`, снятие, `keybinding-editor.ts`, `KeybindingsDialog.tsx`, i18n, замена read-only справки. | 2.5 | Требование закрыто целиком. |
| 6 | Манифест и диагностика: `contributes.keybindings`, публикация каталогом до активации, конфликты в панель проблем, отложенный отчётчик. | 1.5 | Плагин каталога объявляет клавиши, и их видно до включения. |

**≈ 11 дней.** Порядок несущий: 2 не встанет без 1 (правило требует условия-данных), 5 — без 2
(слой требует модели слоёв), 6 — без 5. Этапы 3 и 4 независимы и параллелятся при втором исполнителе.

## Тесты

Критерий разделения формулируется один раз: **в браузер уходит только то, чья истинность зависит
от фазы события, порталов или ловушки фокуса.** Разбор, специфичность, слои, сборка индекса,
состояние аккорда — данные, им место в `node` (бюджет прогона 7–8 секунд обязан сохраниться).
Имена тестов — утверждения о правиле по-русски, как в существующих файлах.

**`node`** — `when-expr.test.ts` (самый большой набор; несущий тест всей модели: «специфичность
дизъюнкции — минимум ветвей», мутация `max` роняет разрешение конфликтов) · `command.test.ts`
(«односоставное сочетание после `normalizeChord` пишется так же, как раньше» — все семь
существующих случаев) · `context-keys.test.ts` («объявить зарезервированный ключ нельзя»,
«запись того же значения не уведомляет») · `scope.test.ts` («снятие внутренней не трогает внешнюю
при одинаковом имени») · `keybinding-rules.test.ts` (слой > специфичность > порядок; снятия) ·
`keymap.test.ts` («двадцать регистраций дают одну пересборку» против жадности и «после регистрации
индекс отдаёт правило» против забытого сброса) · `keybindings.test.ts` (**«непопавшая вторая
ступень отменяет аккорд и НЕ выполняет ничего»**) · `keybinding-editor.test.ts` ·
`help.test.ts` (новый — сегодня `help.ts` не покрыт ничем) · `manifest.test.ts` ·
`app/keybindings-wiring.test.ts` — тест-сеть против настоящего `boot()`: «среди зарегистрированных
нет пары с одинаковым аккордом, одним слоем и одинаковой специфичностью».

**Браузер** — `KeybindingsDialog.browser.test.tsx` («запись перехватывает `mod+s`, файл не
сохраняется»; «Escape отменяет запись, а не закрывает окно») · `keybindings-scope.browser.test.tsx`
(«правило палитры выигрывает у одноимённого глобального»; «правило без области продолжает работать
при открытом окне») · `chords.browser.test.tsx` (индикатор) · `Shell.browser.test.tsx` («первая
ступень аккорда не попадает в текст поля ввода»).

## Риски

1. **`focus == 'tree'` и переименование.** `ResourceTree` вешает `data-focus-zone` на контейнер,
   но **элемент ввода побеждает зону**: строка в режиме переименования — `editable`, кнопки внутри
   строки — `control`. Значит `f2` во время переименования отвалится; это правильно, но проверить надо.
2. **Monaco и префикс аккорда.** Monaco везёт свои аккорды на `ctrl+k` и метит обработанное
   `preventDefault`, по которому `plugins/editor-monaco/input.ts` зовёт `stopPropagation`. Механизм
   верен, но перед фиксацией `mod+k mod+s` свериться со списком аккордов `monaco-editor@0.56`.
3. **Radix, порталы, `stopPropagation`** ([CommandPalette.tsx:39-53](projects/reformer-builder-v2/src/host/ui/CommandPalette.tsx#L39-L53)).
   Отмену аккорда — только слушателем на `document` во всплытии; рекордер — слушателем на своём
   элементе в **погружении**, иначе Radix и React заберут клавишу первыми.
4. **Снимок контекста в палитре.** Палитра снимает контекст при открытии, чтобы её собственный
   фокус не гасил команды канваса. С плагинскими ключами обязано работать так же — иначе команда
   с `when: "schemaEditor.nodeSelected"` исчезнет в момент открытия. Решение: `ContextKeySnapshot`
   несёт **обе** проекции, палитра держит один снимок.
5. **Забытый сброс кэша индекса** — отказ молчаливый: клавиша перестаёт работать после включения
   плагина. Ловится парой тестов в `keymap.test.ts`.
6. **Escape получает четвёртый смысл.** Порядок обязан быть: Radix (погружение) → редактор
   (`stopPropagation`) → аккорд (всплытие). Доказуемо только браузерным тестом.
7. **Рост поверхности SDK:** +14 имён на ~60. Файл существует затем, чтобы эта цена была видна
   в diff'е — раздел с обоснованием каждой группы обязателен.

## Верификация

```bash
cd projects/reformer-builder-v2
npm test                 # node-прогон; ОБЯЗАН остаться 7–8 секунд, проверять ЧИСЛО тестов, не только цвет
npm run test:browser     # playwright/chromium
npx tsc -b && npm run lint
npm run dev              # ручной сценарий ниже
```

Ручной сценарий после этапов 1–5, каждый пункт — отдельное наблюдение:

1. Фокус в дереве, `Delete` → удаляется файл. Фокус на канвасе, `Delete` → удаляется узел.
   Сегодня исход этой пары зависит от порядка активации плагинов.
2. `mod+z` на markdown-вкладке ничего не делает; на схеме — отменяет.
3. `mod+k`, затем `mod+s` — открывается редактор клавиш; в строке состояния на время ожидания
   виден индикатор. `mod+k`, затем `mod+p` — ничего не происходит, ожидание снято.
4. Открыть палитру, нажать `mod+s` → файл сохраняется (область не глушит), стрелки ходят по
   списку палитры, а не по дереву.
5. В редакторе клавиш переназначить `mod+d`, перезапустить приложение — назначение сохранилось,
   меню и таблица показывают **новое** сочетание.
6. Выключить плагин схемы — пользовательское правило на его команду остаётся в списке с пометкой
   «команды сейчас нет».
