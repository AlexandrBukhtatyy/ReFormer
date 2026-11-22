# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project. The
library guide for agents — where the docs of each package live and how to use the MCP server — is
[AGENTS.md](AGENTS.md).

## File output locations — куда что писать

Никогда не оставляй артефакты в корне репозитория (`.png`, `.json`, `.log`, debug-файлы и т.п.). Два целевых места — оба в `.gitignore`.

### Скриншоты тестов → `projects/react-playground-e2e/screenshots/`

Все скриншоты от playwright (e2e тесты, smoke-проверки, визуальные регрессии) лежат в `projects/react-playground-e2e/screenshots/<context>/<scenario>.png` — подкаталог по фиче или сценарию: `screenshots/<feature-name>/<scenario>.png`.

При вызове `mcp__playwright__browser_take_screenshot` **ВСЕГДА** указывай явный `filename` с абсолютным путём в эту папку. Без `filename` playwright MCP пишет в `<repo-root>/page-*.png` — это утечка в корень, чинить переносом в правильное место.

### Всё остальное временное → `.tmp/`

Всё, что НЕ скриншот теста: debug dumps, intermediate JSON, scratch markdown, черновики, логи dev-серверов. Создавай подкаталоги по контексту: `.tmp/drafts/...`, `.tmp/dev-logs/...`. Если папки нет — `mkdir -p .tmp/<subdir>` перед использованием.

### Auto-scratch (не трогай руками)

- **`.playwright-mcp/`** — playwright MCP сам пишет туда `page-*.yml` snapshots и `console-*.log`. В `.gitignore`. Управляется самим MCP-сервером.

### Что нельзя

- **Никогда** не писать в корень `*.png`, `*.json` debug-дампы, `*.log`, `dev.log`. Если sub-agent или playwright MCP так сделал — **перемести файл в правильное место сразу же**, до следующего шага работы.
- **Никогда** не убирать gitignored папки командой `rm -rf` — там может быть текущая работа sub-agent'а.

## Specs are read-only — strict

**NEVER edit files under `docs/specs/` while doing implementation work.** Specs are the input contract; the implementation must adapt to the spec, not the other way around.

- Это касается ЛЮБОЙ работы: реализации формы, проверки, sub-agent оркестрации, экспериментов. Если спека «недостаточно подробная» для текущей задачи — это сигнал спросить пользователя, а не дописать спеку под себя.
- Под запрет попадают: добавление «canonical user-facing strings» таблиц, добавление «risk matrix», добавление verification-чеклистов, перенос полей между шагами, переименование полей, уточнение типов или единиц измерения. Всё это — артефакты твоей работы, и они должны жить в твоих рабочих заметках, а не в самой спеке.
- Sub-agent'ам дай тот же запрет в их prompt: «спека read-only, всё что нужно вытащить — вытащи в свои заметки».
- Исключение: если пользователь **явно** просит «обнови спеку», «добавь в спеку X», «переформулируй спеку» — тогда можно. Подтверждение работы («продолжай», «ок») НЕ даёт разрешения трогать спеку.
- Если в спеке нашёл фактическую ошибку (опечатка, противоречие, неконсистентность с другими спеками) — не правь молча, **спроси**: «нашёл в спеке X — поправить?».
- Перед началом работы в репозитории: `git status docs/specs/` — там должно быть пусто. Если уже не пусто (например, sub-agent или прошлая сессия что-то дописала) — `git checkout -- docs/specs/<file>` и сообщить пользователю.

## Git commits — strict authorization

**NEVER make a `git commit` (or `git push`) unless the user has explicitly asked for it in the current request.**

- "Explicitly asked" means the user wrote something like "commit", "закоммить", "push", "запушь", "make a commit", or named a specific commit operation. Acknowledgement of completed work ("ok", "good", "продолжай") is NOT a commit request.
- Do NOT auto-push at end of session, do NOT auto-commit after each stage of work, do NOT chain commits speculatively. Leave changes uncommitted in the working tree and surface them in your status update so the user can decide.
- If you believe a commit is appropriate, ASK first ("закоммитить?") and wait for confirmation. Do not stage-and-commit-and-then-ask.
- `git status`, `git diff`, `git log`, `git stash` — these are read-only/non-publishing and may be run freely. The restriction is on commit/push specifically.
- This rule applies even when prior turns in the conversation contained commits — the user's authorization for past commits does NOT carry forward to new changes.

## Git commits — процедура (первая попытка должна проходить)

Секция выше отвечает на вопрос «**можно ли** коммитить». Эта — «**как**», чтобы `git commit` не падал
и не требовал второго захода. Порядок обязателен:

1. **Сообщение пишется в файл инструментом Write**, а не через шелл: `<scratchpad>/commit-msg.txt`.
   Если в сессии доступны два шелла с несовместимым синтаксисом многострочных строк — Bash (heredoc
   `<<'EOF'`) и PowerShell (here-string `@'…'@`), — их легко перепутать, и тогда маркер попадает в
   текст первой строкой → `subject may not be empty` + `type may not be empty`.
2. **Валидация ДО коммита:** `npx --no commitlint < <файл>` — ловит все правила примерно за секунду
   и ничего не меняет на диске. Есть ошибки — правь файл и повторяй, пока не станет чисто.
3. **Коммит файлом:** `git commit -F <файл>`.

`git commit -m` допустим только для однострочного сообщения без кавычек, переносов и спецсимволов.

**Что блокирует коммит** (уровень `error` в [commitlint.config.js](commitlint.config.js)); scope вне
списка — только предупреждение, коммит проходит:

| Правило                | Требование                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `subject-case`         | тема строчными ЦЕЛИКОМ: и `api`/`json`, и имена типов — `form-field`, не `FormField` |
| `subject-full-stop`    | без точки в конце темы                                                               |
| `header-max-length`    | первая строка ≤ 100 символов вместе с `type(scope): `                                |
| `body-max-line-length` | КАЖДАЯ строка тела ≤ 100 символов — русские абзацы переноси вручную                  |
| `type-enum`            | `feat fix docs style refactor perf test build ci chore revert`                       |
| `refs-trailer`         | секция ссылок на задачи — по формату ниже (если она есть)                            |

Scope — из закрытого списка (`reformer`, `reformer-cdk`, …, `docs`, `ci`, `deps`, `repo`); имя =
директория пакета. Таблица и примеры — в [CONTRIBUTING.md](CONTRIBUTING.md).

**Третья секция — ссылки на задачи** (необязательна, последний абзац после тела):

```
Refs: #12
Closes: #12
```

- `Closes:` — только GitHub issue, который коммит закрывает (каждый — и в `Refs`).
- В последнем абзаце только строки `Ключ: значение`; `BREAKING CHANGE:` — отдельным абзацем выше.
- Не писать ID голой строкой в конце тела — правило `refs-trailer` это отвергает. Подробно — в
  разделе «Ссылки на задачи» [CONTRIBUTING.md](CONTRIBUTING.md).

**После коммита:** если `lint-staged` напечатал «Applying modifications from tasks», значит
`eslint --fix`/`prettier --write` могли изменить файлы уже внутри коммита — сверь коммит с
проверенным состоянием и при расхождении прогони тесты и `tsc` затронутого пакета повторно.

## Build & Test

```bash
npm ci
npm run build              # пакеты в порядке зависимостей (scripts/build-packages.mjs)
npm run test -w <пакет>    # тесты пакета
npm run typecheck          # типы пакетов и проектов
npm run lint
npm run format:check
```

`tsc` запускай из каталога пакета (`npm run typecheck`/`build` пакета), не `tsc -b` из корня: корневой
`tsc -b` эмитит `.js` рядом с каждым `.ts`. Набор проверок CI — [.github/workflows/test.yml](.github/workflows/test.yml).
