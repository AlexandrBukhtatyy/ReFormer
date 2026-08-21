# Установка beta-пакетов без `--legacy-peer-deps`

## Context

Сейчас установка бет требует флага:

```bash
npm i --legacy-peer-deps @reformer/core@beta @reformer/cdk@beta @reformer/ui-kit@beta \
  @reformer/renderer-react@beta @reformer/renderer-json@beta
```

Без флага npm падает (воспроизведено, `npm 11.6.0` / `node 24.9.0`, чистая папка):

```
npm error ERESOLVE unable to resolve dependency tree
npm error Found: @reformer/core@11.0.0-beta.3
npm error Could not resolve dependency:
npm error peer @reformer/core@">=1.1.0" from @reformer/cdk@11.3.1-beta.1
```

**Причина — правило semver про prerelease, а не «сломанные версии».** Версия с
prerelease-суффиксом удовлетворяет диапазону только если хотя бы один компаратор диапазона имеет
**тот же кортеж major.minor.patch И собственный prerelease-суффикс**. У нас внутренние peer'ы
объявлены как `>=1.1.0` / `>=1.0.0` / `>=6.0.0`, а беты — `11.0.0-beta.3`, `11.3.1-beta.1`,
`13.0.0-beta.1`. Проверено на месте:

| диапазон               | `11.0.0-beta.3` | `11.3.1-beta.1` | `11.4.0` |
| ---------------------- | --------------- | --------------- | -------- |
| `>=1.1.0`              | ❌              | ❌              | ✅       |
| `>=1.1.0-0`            | ❌              | ❌              | ✅       |
| `*`, `x`, `>=0.0.0-0`  | ❌              | ❌              | ✅       |
| `^11.0.0-0`            | ✅              | ❌              | ✅       |
| `>=11.0.0-0 <12.0.0-0` | ✅              | ❌              | ✅       |

Вывод из таблицы: **статического semver-диапазона, принимающего произвольную бету, не существует.**
Ни `^X.0.0-0` (ловит только беты ровно `X.0.0`, а develop выпускает `11.3.1-beta.1`), ни `*`,
ни пиннинг точной версии на publish-шаге (следующая бета соседа снова не подойдёт).

Спасает то, что **npm обрабатывает `*` до semver'а**. В arborist
`lib/dep-valid.js` (проверено в исходниках `@npmcli/arborist` 2.0.0 → npm 7, 6.5.1 → npm 9 и
11.6.0 локально — во всех трёх одинаково):

```js
case 'range':
  if (requested.fetchSpec === '*') {
    return true;
  }
// fallthrough → semver.satisfies(...)
```

`npm-package-arg` резолвит спеки `"*"` и `""` в `type=range, fetchSpec="*"` → короткое замыкание
срабатывает → peer-ребро валидно при **любой** версии, включая prerelease. Для остальных строк
(`"x"`, `">=1.1.0"`) — нет.

Побочные факты, которые надо учесть:

- Корневой [.npmrc](../../.npmrc) содержит `legacy-peer-deps=true`. Добавлен коммитом `35b3cfc`
  (дек. 2025) с формулировкой «fix npm ERESOLVE during semantic-release when @reformer/core is being
  updated … with @reformer/mcp peer dependency» — то есть **ровно этот же баг**, заглушённый вместо
  починки. Из-за него проблема не видна ни локально, ни в CI.
- [docs/guides/release-and-publishing.md:150](../guides/release-and-publishing.md) предписывает держать
  внутренние peer'ы как `^X.0.0` и бампать их при каждом мажоре. Это (а) никогда не выполнялось
  (core на 11.x, peer'ы так и остались `>=1.1.0`), (б) именно тот вид диапазона, который ломает беты.
- [scripts/check-peer-ranges.mjs](../../scripts/check-peer-ranges.mjs) сознательно **исключает**
  `@reformer/*` из проверки — свободное место, чтобы поселить туда новый инвариант.

Цель: `npm i @reformer/*@beta` работает дефолтным npm без флагов, и регресс ловится в CI.

## Изменения

### 1. Внутренние peer-диапазоны → `*` (6 манифестов, 13 строк)

Единственное, что реально меняется в опубликованных пакетах.

| Файл                                                                                       | Что заменить на `"*"`                                       |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [packages/reformer-cdk/package.json:84](../../packages/reformer-cdk/package.json)           | `@reformer/core`                                            |
| [packages/reformer-renderer-react/package.json:56](../../packages/reformer-renderer-react/package.json) | `@reformer/core`                                 |
| [packages/reformer-renderer-json/package.json:61-62](../../packages/reformer-renderer-json/package.json) | `@reformer/core`, `@reformer/renderer-react`     |
| [packages/reformer-ui-kit/package.json:377-378](../../packages/reformer-ui-kit/package.json) | `@reformer/cdk`, `@reformer/core`                           |
| [packages/reformer-mcp/package.json:53-56](../../packages/reformer-mcp/package.json)        | все 4 (`core`, `cdk`, `renderer-react`, `ui-kit`)           |
| [packages/reformer-form-registry/package.json:70-72](../../packages/reformer-form-registry/package.json) | `core`, `renderer-json`, `renderer-react`        |

Внешние peer'ы (`react`, `react-dom`, `recharts`, `cmdk`, …) **не трогаем** — они и так корректны
(`react@19.2.1` проходит `^18.0.0 || ^19.0.0`), и их верхние границы защищены существующим гейтом.

Плюс [packages/reformer-mcp/package.json:50](../../packages/reformer-mcp/package.json) —
`optionalDependencies: { "@reformer/renderer-json": ">=6.0.0" }`. ERESOLVE это не даёт (обычные
зависимости npm вкладывает, а не конфликтует), но рядом с бетой поставится вторая копия
renderer-json из `latest`. Тоже `*` → дедуп в одну.

Что теряем: формально — нижнюю границу. Фактически ничего: `>=1.1.0` при core 11.x не отсекает
ничего, верхней границы у него и не было. Это согласуется с уже записанным в
`check-peer-ranges.mjs` принципом «мажоры внутренних пакетов контролирует сам монорепо».

### 2. CI-гейт: инвариант в `check-peer-ranges.mjs`

[scripts/check-peer-ranges.mjs](../../scripts/check-peer-ranges.mjs) сейчас отфильтровывает
`@reformer/*` (строки 58-60). Вместо фильтрации — разделить на два правила в том же проходе:

- **внешние peer'ы** — существующая проверка верхней границы, без изменений;
- **внутренние `@reformer/*`** — обязаны быть строго `"*"`. Сообщение об ошибке должно объяснять
  причину (prerelease не проходит версионный диапазон → у потребителя ERESOLVE на `@beta`), иначе
  через полгода кто-нибудь «починит» `*` обратно на `^12.0.0`.

Счётчик `checked` и финальная проверка «не найдено ни одного диапазона» должны учитывать оба вида,
чтобы гейт не выродился в no-op.

Отдельный шаг в CI не нужен — скрипт уже вызывается в
[.github/workflows/test.yml:39](../../.github/workflows/test.yml) до всех сборок.

### 3. Регресс-песочница: установка бет дефолтным npm

Манифестного гейта мало: он проверяет строку, а не поведение npm. Нужен тест, который ставит
пакеты **с prerelease-версией** и **без** `legacy-peer-deps`.

Новый `scripts/check-peer-prerelease.mjs` + скрипт `check:peer-prerelease` в корневом
[package.json](../../package.json), по образцу уже существующих песочниц —
[packages/reformer-ui-kit/scripts/check-subpaths.mjs](../../packages/reformer-ui-kit/scripts/check-subpaths.mjs)
и [packages/reformer-mcp/scripts/check-packaging.mjs](../../packages/reformer-mcp/scripts/check-packaging.mjs).
Оттуда переиспользуются готовые решения, а не пишутся заново:

- `run()` — запуск npm через `npm_execpath` (иначе на Windows `execFile` не спавнит `npm.cmd`);
- **`cleanEnv`** — вычистка `npm_config_*` из окружения. Критично: без этого корневой
  `legacy-peer-deps=true` протечёт в песочницу и тест будет зелёным всегда;
- `pack()` — `npm pack --pack-destination`.

Алгоритм:

1. для каждого из 6 публикуемых пакетов скопировать в tmp то, что перечислено в его `files`,
   плюс `package.json`; в копии выставить общую prerelease-версию (например `900.0.0-beta.1`) —
   так тест не зависит от того, какие версии сейчас в репозитории;
2. `npm pack` каждой копии;
3. в чистом потребителе объявить все 6 тарболов + `react`/`react-dom` и выполнить
   `npm install` **без** флагов, с `cleanEnv`;
4. упасть с внятным сообщением, если npm вернул ERESOLVE;
5. защита от «молчаливого» прохождения: после установки убедиться, что в дереве действительно
   лежит `900.0.0-beta.1` (иначе тест мог бы зеленеть, ничего не проверив).

Шаг в [test.yml](../../.github/workflows/test.yml) — после всех `build`-шагов, рядом с
`Subpath smoke @reformer/ui-kit` (нужны собранные `dist/`, иначе `files` пусты).

### 4. Документация

В [docs/guides/release-and-publishing.md](../guides/release-and-publishing.md) раздел
`## peerDependencies` (строки 148-152) переписать: вместо «диапазон `^X.0.0`, обновлять при мажоре» —
инвариант `*` для внутренних, объяснение про prerelease-правило semver, ссылка на гейт. Убрать из
чек-листа перед merge пункт «При breaking — обновлены peerDependencies затронутых пакетов» в части
внутренних пакетов (для внешних он остаётся).

### 5. Корневой `.npmrc`

После фикса — удалить `legacy-peer-deps=true` и прогнать `npm ci` начисто (`rm -rf node_modules`).
Смысл: монорепо должно ставиться тем же резолвером, что и у потребителя, иначе следующий такой
баг снова окажется невидимым.

Если `npm ci` упадёт на **другом** конфликте (не `@reformer/*`) — вернуть файл и дописать в него
комментарий с конкретной парой пакетов, из-за которой он нужен. Молчаливого `legacy-peer-deps`
без объяснения остаться не должно.

## Что делать с уже опубликованными бетами

Манифест опубликованной версии неизменяем — `11.0.0-beta.3` останется сломанной навсегда. Флаг
нужен до следующего релиза. Релиз с develop автоматический
([release.yml](../../.github/workflows/release.yml), триггер `push` в `develop` по путям
`packages/**`), так что новые беты выйдут сразу после merge этой ветки, и `beta`-алиас
переедет на них шагом `Sync dist-tag beta → develop`.

Потребителю на этот промежуток проще всего положить в проект `.npmrc` строку
`legacy-peer-deps=true` (вместо флага в каждой команде) и удалить её после выхода исправленных бет.

## Verification

```bash
# 1. Правило semver и short-circuit npm — на случай, если что-то поменяется в будущем
node -e "const s=require('./node_modules/npm/node_modules/semver'); console.log(s.satisfies('11.0.0-beta.3','>=1.1.0'))"   # false — исходная причина
node -e "const n=require('./node_modules/npm/node_modules/npm-package-arg'); const r=n.resolve('@reformer/core','*'); console.log(r.type, r.fetchSpec)"  # range *

# 2. Манифестный гейт
npm run check:peer-ranges

# 3. Поведенческий гейт (главная проверка — падал бы до фикса)
npm run check:peer-prerelease

# 4. Не сломали существующие песочницы (они подменяют внутренние peer'ы тарболами)
npm run build -w @reformer/core && npm run build -w @reformer/cdk && npm run build -w @reformer/ui-kit
npm run check:subpaths -w @reformer/ui-kit
npm run check:packaging -w @reformer/mcp

# 5. Установка монорепо без legacy-peer-deps
rm -rf node_modules && npm ci
```

Финальная проверка — уже на опубликованных пакетах, после того как CI выпустит новые беты
(вне этой ветки, в пустой папке):

```bash
npm i react@19 react-dom@19 @reformer/core@beta @reformer/cdk@beta @reformer/ui-kit@beta \
  @reformer/renderer-react@beta @reformer/renderer-json@beta     # без --legacy-peer-deps
npm ls @reformer/core                                            # ровно одна копия, версия -beta.N
```
