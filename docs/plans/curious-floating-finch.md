# Третья секция коммита — ссылки на задачи (`Refs:`)

## Context

Сейчас сообщение коммита описано в двух частях: заголовок `type(scope): тема` и тело. Ссылки на
задачи (beads `ReFormer-…`, GitHub issue `#N`) пишутся как получится — в истории два стиля:

- трейлер `Refs: ReFormer-6oj1, ReFormer-e46z` (~22 коммита);
- голая строка с ID последним абзацем (`ReFormer-ahke`, `ReFormer-u880, ReFormer-ffxb`).

Проверено: commitlint строку `Refs: ReFormer-…` за футер **не считает** (парсер видит футер только
при `#N` или `BREAKING CHANGE`), так что формат сейчас ничем не проверяется — опечатка в ID,
`refs:` строчными или ID в середине тела проходят молча.

Цель — формализовать третью, **необязательную** секцию и проверять её формат линтером.

## Формат (согласовано)

```
type(scope): тема

Тело — что и зачем (необязательно).

Refs: ReFormer-3548, ReFormer-um17, #12
Closes: #12
```

- Секция — **последний абзац**, отделённый пустой строкой. Нет задачи — секции нет.
- `Refs:` — ровно одна строка, ID через `, `. **Первый ID — задача, по которой сделан коммит**;
  остальные — задачи, на которые коммит повлиял. Порядок значим.
- ID: beads `ReFormer-<id>` (с вложенностью `.N`, напр. `ReFormer-k152.13`), GitHub `#N` или
  `owner/repo#N`. Дубли запрещены. Строка ≤ 100 символов (уже следит `body-max-line-length`).
- `Closes:` — необязательная строка после `Refs:`, только GitHub issue, каждый из них обязан быть
  в `Refs`. Закрывает issue, когда коммит попадёт в default-ветку (`main`). Форма с двоеточием
  выбрана сознательно: GitHub её понимает (`Closes: #10` — по документации), а `Closes #12` без
  двоеточия ломает разбор трейлеров git (абзац перестаёт считаться блоком трейлеров).
- В том же абзаце допустимы только трейлеры `Key: value` (ещё `Co-authored-by`, `Signed-off-by`).
  `BREAKING CHANGE:` — отдельным абзацем **выше**: в тексте `BREAKING CHANGE` есть пробел, git
  такой ключ за трейлер не считает и весь блок перестаёт читаться
  `git log --format='%(trailers:key=Refs,valueonly)'`. Проверено на парсере release notes: при
  пустой строке между ними текст breaking-заметки не захватывает `Refs`.
- `chore(beads): sync issues jsonl` — без `Refs` (синхронизация не работа по задаче).
- История не переписывается; старые коммиты с голой строкой остаются как есть.

## Реализация

### 1. Правило commitlint `refs-trailer` — новый `scripts/commitlint/refs-trailer.mjs`

Чистая функция-правило commitlint `(parsed, when) => [ok, message]`, работает по `parsed.raw`
(парсер `Refs` не размечает, поэтому разбор свой). Строки-комментарии git (`/^#(\s|$)/`) и всё
после scissors-строки игнорируются. Ошибки (первая найденная, с подсказкой «как правильно»):

1. Нет ни `Refs:`, ни похожих строк → ok (секция необязательна).
2. Опечатка ключа в начале строки — `refs:`, `REFS:`, `Ref:`, `References:`, `Task:`, `Issues:`,
   `Fixes:`/`Resolves:`/`Closes #N` без двоеточия → «используй `Refs:` / `Closes:`».
3. Последний абзац целиком из ID без ключа (старый стиль) → «оформи как `Refs: …`».
4. `Refs:`/`Closes:` не в последнем абзаце (или в абзаце заголовка) → «секция — последний абзац».
5. В последнем абзаце есть строка не вида `Key: value` (напр. `BREAKING CHANGE:` или прозa) →
   «отдели пустой строкой».
6. `Refs:` больше одной / пустая; `Closes:` больше одной, раньше `Refs:` или без `Refs:`.
7. ID не по формату (`Reformer-abc`, `ReFormer-ABC`, `gh-12`), дубль, `Closes` с beads-ID или
   с issue, которого нет в `Refs`.

Префикс beads — константа `ReFormer` с комментарием «синхронно с `issue-prefix` в
`.beads/config.yaml`». Существование задачи в beads не проверяется (bd есть не у всех, хук должен
быть быстрым) — только формат.

### 2. Тесты — `scripts/commitlint/refs-trailer.test.mjs`

`node:test` + `node:assert` (новых зависимостей нет), прогон `node --test scripts/commitlint/`.
Добавить в корневой `package.json` скрипт `"test:commitlint": "node --test scripts/commitlint/"`.
Кейсы: по одному на каждую ветку ошибок выше + проходящие: без секции, только `Refs` с одним ID,
несколько ID разных видов, `Refs`+`Closes`, `Refs`+`Co-authored-by`, заголовок + сразу `Refs`
(без тела), `BREAKING CHANGE` абзацем выше, упоминание ID в прозе тела (не ошибка).

### 3. Подключение — [commitlint.config.js](../../commitlint.config.js)

```js
import { refsTrailer } from './scripts/commitlint/refs-trailer.mjs';
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: { 'refs-trailer': refsTrailer } }], // локальный плагин (load поддерживает объект)
  rules: { /* … */ 'refs-trailer': [2, 'always'] },
};
```

Уровень `error` — ловится хуком `.husky/commit-msg` и dry-run `npx --no commitlint < файл`.

### 4. Документация

- [CONTRIBUTING.md](../../CONTRIBUTING.md), «Commit Messages»: структура из трёх частей вместо
  `[optional footer]`; подраздел «Ссылки на задачи» — формат, смысл порядка, `Closes:`, место
  `BREAKING CHANGE`; строка `refs-trailer` в таблице блокирующих правил; пример с `Refs` в
  «Examples» (проверенный линтером).
- [CLAUDE.md](../../CLAUDE.md), «Git commits — процедура»: строка `refs-trailer` в таблице и
  короткий абзац: коммит по взятой в работу beads-задаче — её ID первым в `Refs:`; задачи,
  на которые повлиял, — следом. Это правило агенты видят в каждой сессии.
- [docs/guides/release-and-publishing.md](../guides/release-and-publishing.md): пример сообщения
  (~стр. 128) дополнить строкой `Refs:`, в чеклист (~стр. 201) — пункт про формат секции.
- `docs/specs/` не трогаем.

### 5. Трекер

Завести beads-задачу на эту работу (`bd create`, claim, по завершении `bd close`) — её ID пойдёт
первым в `Refs:` коммита, как первый пример новой конвенции. Коммит и синхронизацию beads —
только по явной просьбе (scope `repo`).

## Verification

1. `node --test scripts/commitlint/` — все кейсы зелёные.
2. Dry-run на сообщениях через stdin (ничего не пишет на диск):
   - `printf 'feat(reformer): x\n\nтело\n\nRefs: ReFormer-abc, #12\nCloses: #12\n' | npx --no commitlint` → exit 0;
   - `… Refs: Reformer-abc` / `… refs: ReFormer-abc` / голая строка `ReFormer-abc` /
     `BREAKING CHANGE` в одном абзаце с `Refs` → exit 1 с понятным сообщением `refs-trailer`.
3. Прогон по истории: `npx --no commitlint --from HEAD~300 --to HEAD` — все коммиты в стиле
   `Refs: …` проходят (нет ложных срабатываний); падают только коммиты с голой строкой ID —
   ожидаемо, информационно, историю не правим.
4. Git читает секцию нативно:
   `printf '...\n\nRefs: ReFormer-abc, #12\nCloses: #12\n' | git interpret-trailers --parse`
   печатает обе строки.
5. `npx eslint scripts/commitlint commitlint.config.js` и `npx prettier --check` по изменённым
   файлам (включая .md).
