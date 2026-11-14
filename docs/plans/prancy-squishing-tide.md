# Сценарии MCP: три формы × создание, правка, удаление

## Context

Стенд `npm run mcp:scenarios` ([eval/scenarios/](../../packages/reformer-mcp/eval/scenarios/)) держит 16
сценариев (L1–L5 + 5 holdout), и все они про одно: создать форму с нуля в пустом `form/`. Разные лишь
поля. Отсюда два перекоса:

- **избыточность** — L1-feedback, L1-login, L1-callback, L2-*, L4-wizard-3steps и т. д. меряют один и тот
  же путь «intent → `form_build`» на разных наборах полей;
- **неполнота** — нет ни одной правки и ни одного удаления, хотя сервер прямо обещает «create or change a
  form» (`src/platform/cli/server.ts:52`). При этом многие возможности грамматики не покрыты ни одной
  пробой: copyFrom, syncFields, resetWhen, revalidateWhen, disableWhen, exclusiveFlag, aggregateInto,
  `severity: warning`, правило на сам массив, `type: date`, Slider/Switch/SelectMulti, кнопка отправки,
  гейтинг шага, скрытый шаг, своё правило-оператор.

Решения пользователя (2026-11-14):

- новый набор **полностью заменяет** старый (holdout тоже);
- правка начинается с **готовой формы, которую кладёт стенд**;
- мастер проверяется **и созданием с нуля, и правкой** (одностраничную форму разбить на шаги);
- каждая форма гоняется на **трёх стеках** (core, renderer-react, renderer-json);
- капча — поле на 6 символов + **асинхронная проверка-заглушка** (верный код `ABC123`, регистр не
  важен, ответ через 300 мс, без сети);
- сложная форма — **новая спека на ~30 полей** в каталоге сценариев (не в `docs/specs/`);
- старые сценарии удалять **после коммита ReFormer-f2fs.8**. Этапы 1–2 файлов f2fs.8 не трогают и могут
  идти сразу.

## Новый набор: 10 сценариев

| id                      | Затравка (`seed`)  | Задание                                                                                                                                                    |
| ----------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registration-create`   | —                  | Фраза: логин (обяз., 3–20, `^[a-zA-Z0-9_]+$`), email, пароль (≥ 8), повтор пароля, капча (заглушка), кнопка «Зарегистрироваться»                          |
| `registration-edit`     | registration-create | `login` → `username` («Имя пользователя»); пароль ≥ 10 и хотя бы одна цифра; необязательный телефон с маской после email; кнопка → «Создать аккаунт» |
| `registration-delete`   | registration-create | Убрать капчу и повтор пароля вместе с их проверками, остальное не трогать                                                                                  |
| `order-create`          | —                  | «Сделай форму по spec.md»: одностраничное оформление заказа, разделы карточками                                                                            |
| `order-edit`            | order-create       | Переименовать `customerType` → `payerType` (каскад: видимость, `when`, `cross`, disableWhen); скидка до 50 % (правило + Slider); вычисляемая `deliveryCost` и новая формула итога; комментарий обязателен при оплате по счёту |
| `order-delete`          | order-create       | Убрать промокод (async + onChange), скидку (итог = подытог), блок адреса для счёта с галочкой (copyFrom)                                                  |
| `wizard-create`         | —                  | Та же spec.md, но мастер: раздел = шаг; шаг «Компания» только для юрлица; дальше нельзя, пока шаг невалиден; на последнем шаге «Оформить заказ»            |
| `wizard-split`          | order-create       | Готовую одностраничную форму разбить на те же шаги. Контракт тот же, что у `wizard-create`                                                                 |
| `wizard-edit`           | wizard-create      | Переименовать шаг «Оплата» → «Оплата и скидки»; `comment` перенести на «Подтверждение»; новый шаг «Упаковка» (Switch + текст открытки ≤ 200, обязателен при упаковке) |
| `wizard-delete`         | wizard-create      | Удалить шаги «Компания» и «Доставка» со всеми полями и зависимостями (остаётся заглушка оператора ИНН — проверка уборки)                                   |

10 сценариев × 3 стека = 30 ячеек в smoke (было ~19).

### Спека «Оформление заказа» (`scenarios/order/spec.md`)

Формат — как у `docs/specs/*` (таблица полей, раздел поведения, таблица текстов ошибок), ~30 полей. Цель:
**каждая возможность грамматики встречается хотя бы раз и проверяется хотя бы одной пробой**. Разделы
(они же шаги мастера):

1. **Покупатель** — `customerType` (RadioGroup, физлицо/юрлицо, начальное физлицо); группа `contact.*`
   (фамилия/имя, minLength); `email`; `phone` (InputMask); `birthDate` (`type: date`, DatePicker, minAge 18,
   обязательна только для физлица — `when`).
2. **Компания** (виден только для юрлица — `visibility`, в мастере скрытый шаг) — `company.name`,
   `company.inn` (pattern + своё правило-оператор контрольной суммы через `operators`/`call`).
3. **Доставка** — `deliveryMethod` (Select из `dataSources`); группа `deliveryAddress.*` (enableWhen +
   resetOnDisable при самовывозе); `deliveryDate` (futureDate, resetWhen при смене способа);
   `billingSame` (Checkbox) + `billingAddress.*` (copyFrom из адреса доставки).
4. **Товары** — массив `items` (одна пустая строка; maxItems 10; правило `minLength(1)` на сам массив;
   строки: `title`, `quantity` integer 1–99, `price` nonNegative, `lineTotal` — compute в строке
   (`each`)); `subtotal` — aggregateInto, только чтение.
5. **Оплата** — `promoCode` (transformValue в верхний регистр + async-заглушка SALE10/SALE20; onChange:
   смена товаров сбрасывает промокод); `discount` (Slider 0–30, disableWhen для физлица); `total` —
   computeFrom, только чтение; `paymentMethod` (RadioGroup; `cross`: счёт только для юрлица;
   revalidateWhen при смене типа покупателя); предупреждение `severity: warning` при итоге > 100 000;
   `comment` (Textarea ≤ 500).
6. **Подтверждение** — `agreeTerms` (обязательная галочка); `newsletter` (Switch); `sources` (SelectMulti);
   syncFields и exclusiveFlag — подобрать естественное место при написании спеки (проверить по
   `choose_api`); кнопка «Оформить заказ» (`onComponentEvent`).

Не входят, с причиной в README сценариев: FileUpload (файлы в пробах без браузера не задать), InputSuggest,
onInit/onMount/renderEffect, Tabs, вложенные массивы (грамматика их не выражает).

## Этапы

### Этап 1. Приборы: затравка и контракт правки (сразу, файлы f2fs.8 не задеты)

**Затравка** — [run.mjs](../../packages/reformer-mcp/eval/scenarios/run.mjs), [catalog.mjs](../../packages/reformer-mcp/eval/scenarios/catalog.mjs):

- `scenario.json` → `"seed": "<id сценария>"`. `loadScenarios` резолвит его в сценарий-источник (ошибка,
  если источника нет или он сам с затравкой).
- `runCell` после подготовки каталога (`run.mjs:~288`) собирает в `workspace/form` эталон источника тем же
  `writeReferenceBundle` (`catalog.mjs:117`) через `verifyClient`: сборка затравки не попадает в трассу и
  метрики агента. Копия intent затравки → `<прогон>/seed.intent.json`.
- В задание к `_shared/output-convention.md` добавляется блок для правки: «форма уже в `form/`, меняй её;
  файлы не удаляй руками — их уберёт `form_build`».
- `scenarioDirectories` (`catalog.mjs:28`) рекурсивно обходит каталоги без `scenario.json` (кроме `_*`),
  чтобы жила раскладка `<форма>/<операция>/`.
- `runGolden` (`verify/index.mjs:229`) для сценария с затравкой строит сначала затравку, потом эталон в
  том же каталоге: так эталон проверяет и путь пересборки `form_build` (уборку `form.flow.ts` и т. п.).
- Replay менять не нужно: `writeReferenceBundle` поверх затравки уже работает как правка.

**Контракт** — [verify/probes.mjs](../../packages/reformer-mcp/eval/verify/probes.mjs), [verify/index.mjs](../../packages/reformer-mcp/eval/verify/index.mjs), браузер:

- `extends: "<путь к контракту>"` + `drop: { fields, probes }`. Слияние по `id`: поля и пробы правки
  переопределяют базовые. Так контракт правки = контракт создания + дельта, и «остальное не сломано»
  проверяется пробами базы без копипасты.
- `absent[]` (`id`, `bind.paths`, `bind.label`) — гейт `runtime.structure.absent`: ни путь, ни подпись не
  найдены. Подписи передать в `checkStructure` (сейчас считаются в `runtime-child.mjs:92`, но не
  передаются). В браузере — элемента с такой подписью нет.
- `steps[]`: кроме числа — `title` (регулярка) и `fields` (id полей шага) по `formFlow.steps`
  (`probes.mjs:169`).
- Проба `step: <индекс>` — валидирует только поля шага (гейтинг перехода). Видимость шага — проба
  без браузера, если `formFlow` её отдаёт, иначе браузерная проверка индикатора шагов.
- `expect.warnings[]` — у поля предупреждение, при этом форма валидна.
- Браузер: `buttons: [{ name }]` — кнопка с подписью есть (`scenario-contract.spec.ts:126-143`,
  `ManifestProbe`, `browser.mjs:89`).
- Эталон на core рисуется `drawCoreForm` без слоя рендера: видимость и кнопки там снимает
  `intentForTarget`. Браузерные проверки слоя рендера (`hidden`/`visible`/`buttons`) у эталона и
  replay на core получают `skip` с причиной, у живых агентов на core проверяются: агент пишет их в JSX.
  Такое исключение для core уже есть (`verify/index.mjs:66`).

Юнит-тесты — в [tests/eval-harness.test.ts](../../packages/reformer-mcp/tests/eval-harness.test.ts):
слияние `extends`, `absent`, шаги с полями, `step`, `warnings`, резолв `seed`.

### Этап 2. Новые сценарии рядом со старыми (сразу)

```
scenarios/
  registration/{create,edit,delete}/   scenario.json prompt.md contract.json reference.intent.json
  order/spec.md
  order/{create,edit,delete}/
  wizard/{create,split,edit,delete}/   spec → ../../order/spec.md; split: contract extends ../create
```

- Эталоны: `registration-create` и `order-create` писать по грамматике (`form_build {"grammar":"all"}`).
  Эталоны правок — копия эталона источника плюс правка. Прогон — `npm run mcp:verify -- --golden --browser`.
- Пробы: на каждое правило и поведение спеки, на каждый пункт правки. Для правок — «остальное цело»
  через `extends`.
- `scenario.json`: `level` (1 — регистрация, 2 — заказ, 3 — мастер), новое поле `operation`
  (create/edit/delete/split), бюджеты (регистрация — 30 шагов, 10 мин; заказ и мастер — 60–80 шагов,
  20–40 мин), `builder`: для `*-create` — `enabled`, если эталон собирается одним `build_form`, иначе
  `replay: false` с причиной. Для правок — `enabled: false` с причиной «лестница ассистента не кладёт
  затравку» и отдельная задача в bd.
- Негативные фикстуры для новых проверок (`verify/fixtures/negative/`): удалённое поле осталось →
  `absent`; поле не на том шаге → `steps`; правка не сделана (затравка как есть) → пробы правки.

### Этап 3. Замена (после коммита f2fs.8)

- Удалить `L1-*`…`L5-*` и `holdout/*`. `holdout/README.md` переписать: каталог пуст, механизм
  `--include-holdout` остаётся, задания пишет человек (формат — README сценариев).
- Перевести 7 негативных фикстур (`type-error`, `wrong-stack`, `wrong-bound`, `removed-required-rule`,
  `broken-formula`, `renamed-field`, `lost-cross-rule`) на новые сценарии с новыми `find/replace`.
- [tests/eval-harness.test.ts](../../packages/reformer-mcp/tests/eval-harness.test.ts) `:182-193`: вместо
  «≥ 12 сценариев» и «L5-insurance в holdout» — у каждой формы есть create, edit и delete, у каждой
  затравки есть источник.
- Матрицы с явными id: `matrices/guided-weak.json`, `nightly-ollama.json` → новые id. Остальные на `*`.
- `mutations/run.mjs:67,80` → новые шаблоны. `npm run mcp:mutate` должен ловить те же 9 мутантов.
- Лестница ассистента: `assistant-ladder.test.ts:113-121` требует `builder` у каждого сценария
  верхнего уровня. Проверить, что новые сценарии его проходят.
- `runs/history.json`: старые ячейки остаются архивом. Добавить событие «смена набора сценариев»
  (`mcp:history`, вид — правка прибора), чтобы дашборд показал разрыв серий.
- Документы: [docs/mcp-eval/scenarios.md](../mcp-eval/scenarios.md) — разделы «Как устроено» и
  «Команды» под новый набор. Прежние замеры остаются с пометкой «старая лестница L1–L5, до
  2026-11». [scenarios/README.md](../../packages/reformer-mcp/eval/scenarios/README.md) — раскладка,
  `seed`, `operation`, `extends/drop`, `absent`, `steps`, `step`, `warnings`, `buttons`, список
  непокрытого.

### Этап 4. Первый замер

- Без модели: golden (+ браузер), negative, `--matrix smoke` на всех 30 ячейках, `mcp:mutate`.
- С моделью — запускает пользователь, например
  `npm run mcp:scenarios -- --agent claude-code --model sonnet --repeats 3 --browser`.
- Пробелы сервера, которые разбор уже нашёл, заранее **не чинить**. Сначала замер, потом задачи по
  провалам:
  - нет инструкции по правке существующей формы в `docs/llms`;
  - у `form_edit` нет rename и remove-step, и он требует `form_start`;
  - `remove_field` не ищет ссылки в `expr/when/cross`;
  - `form_build` не убирает заглушки `operators.ts`.

## Учёт в bd

Эпик «Сценарии MCP: три формы × создание/правка/удаление» и задачи по этапам 1–4 плюс задача «затравка в
лестнице ассистента». Связать с ReFormer-11oe.8 и f2fs.8. В конце сессии — `bd export -o
.beads/issues.jsonl` по процедуре CLAUDE.md. Коммиты и push — только по просьбе.

## Риски

- **Приёмка 11oe.8.** Матрицы `accept-7.0-*` идут по `*`: после этапа 3 они меряют новый набор, а
  пороги ставились по старой лестнице. Если приёмку нужно снять на старой, это делается до этапа 3.
- **guided на правках.** `form_edit` без `form.plan.json` отказывает, поэтому guided-подходы на edit/delete,
  скорее всего, провалятся. Это находка замера, а не дефект стенда.
- **Стоимость.** `order-*` и `wizard-*` на трёх стеках дороги в живом прогоне. Для частых замеров нужна
  матрица поуже, например `registration-*` × 3 стека + `order-create` на renderer-react.

## Проверка

```bash
cd packages/reformer-mcp
npx vitest run tests/eval-harness.test.ts            # слияние контрактов, absent, steps, seed
npm run mcp:verify -- --golden --browser             # 10 эталонов × 3 стека проходят контракты
npm run mcp:verify -- --negative                     # старые и новые фикстуры падают на своей проверке
npm run mcp:scenarios -- --matrix smoke              # 30 ячеек replay, затравка кладётся и правится
npm run mcp:mutate                                   # мутанты по-прежнему ловятся
npx tsc --noEmit -p .                                 # если правились .ts
```

Отдельно проверить вручную: в каталоге прогона правки есть `seed.intent.json`, а вызовов сборки
затравки нет в `server-trace.jsonl`. И `wizard-delete` у replay убирает лишние шаги из `form.flow.ts`.
