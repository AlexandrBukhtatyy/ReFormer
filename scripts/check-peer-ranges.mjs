/**
 * Проверка peerDependencies. Два разных правила: для чужих пакетов и для своих.
 *
 * 1. ВНЕШНИЕ peer'ы обязаны иметь ВЕРХНЮЮ ГРАНИЦУ.
 *
 * Диапазон вида ">=8" обещает совместимость с любой будущей мажорной версией — обещание,
 * которое пакет выполнить не может: мажор по определению ломающий. Потребитель, поставивший
 * следующий мажор, получает не внятный peer-warning на установке, а падение в рантайме.
 *
 * Хуже того, открытый диапазон превращает ЧУЖОЙ релиз в поломку нашего CI: smoke-песочница
 * (check-subpaths) ставит peer'ы ПО ОБЪЯВЛЕННОМУ ДИАПАЗОНУ, то есть latest. Так и вышло
 * 2026-08-04: @tanstack/react-table 9.0.0 убрал экспорт getCoreRowModel, peer ">=8" его
 * подтянул — красный релиз без единого коммита в репозиторий.
 *
 * 2. ВНУТРЕННИЕ @reformer/* обязаны быть РОВНО "*" — никаких версий.
 *
 * Требование ровно обратное первому, и причина у него другая: prerelease. По правилам semver
 * версия с суффиксом (`11.0.0-beta.3`) удовлетворяет диапазону, только если хотя бы один его
 * компаратор имеет ТОТ ЖЕ major.minor.patch И собственный prerelease-суффикс. Поэтому бета
 * не проходит ни ">=1.1.0", ни "^11.0.0", ни даже "*"…  — и `npm i @reformer/core@beta
 * @reformer/cdk@beta` у потребителя падает с ERESOLVE, требуя --legacy-peer-deps.
 *
 * …кроме случая, когда диапазон записан именно строкой "*": npm (arborist, lib/dep-valid.js)
 * обрабатывает её ДО semver'а — `if (requested.fetchSpec === '*') return true`. Короткое
 * замыкание есть во всех живых мажорах npm (проверено на arborist 2.0.0 / 6.5.1 / 11.6.0),
 * а `npm-package-arg` резолвит в этот fetchSpec только "*" и "" — "x" и ">=0.0.0-0" уже нет.
 *
 * Так что "*" здесь не лень, а единственный работающий вариант: статического диапазона,
 * принимающего ПРОИЗВОЛЬНУЮ бету соседа, semver не даёт (у develop-бет разъезжаются и minor,
 * и patch: core 11.0.0-beta.3 против cdk 11.3.1-beta.1). Совместимость внутри монорепо держится
 * тем, что все @reformer/* релизятся из одного репозитория одним пайплайном, а не диапазоном
 * в манифесте — который всё равно никто не бампал: core уехал на 11.x, а peer'ы так и стояли
 * ">=1.1.0" с первых версий.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Где искать пакеты: каждый каталог с package.json. */
const ROOTS = ['packages', 'packages/ui-kits', 'projects'];

/** Свои пакеты — правило 2, все остальные — правило 1. */
const isInternal = (name) => name.startsWith('@reformer/');

/** Единственный диапазон, разрешённый для внутренних peer'ов. */
const INTERNAL_RANGE = '*';

/**
 * Есть ли у одной альтернативы диапазона (части между `||`) верхняя граница.
 *
 * Порядок важен: `>=1 <2` начинается с `>`, но ограничено — поэтому явные `<`, `^`, `~`
 * и дефис-диапазон проверяются ДО отсева «голых» `>`/`>=`.
 */
const altHasUpperBound = (alt) => {
  const s = alt.trim();
  if (!s) return false;
  if (s.includes('<')) return true; // >=1 <2, <=3.1.0
  if (/[\^~]/.test(s)) return true; // ^1.2.3, ~1.2
  if (/\s-\s/.test(s)) return true; // 1.0.0 - 2.0.0
  if (/^[><]/.test(s)) return false; // остались только >, >= — открыто
  if (/^[*x]$/i.test(s)) return false; // * — вообще что угодно
  return /^[=v]*\d/.test(s); // 1.2.3, =1.2.3, 1.x, 1.2.x — мажор зафиксирован
};

/** Диапазон ограничен, только если ограничена КАЖДАЯ альтернатива: `^1 || >=2` открыт. */
const hasUpperBound = (range) => {
  const alts = String(range)
    .split('||')
    .map((a) => a.trim())
    .filter(Boolean);
  return alts.length > 0 && alts.every(altHasUpperBound);
};

let failed = false;
let checked = 0;

for (const root of ROOTS) {
  if (!existsSync(root)) continue;
  for (const entry of readdirSync(root)) {
    const manifest = join(root, entry, 'package.json');
    if (!existsSync(manifest)) continue;

    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    const peers = Object.entries(pkg.peerDependencies ?? {});
    if (peers.length === 0) continue;

    const external = peers.filter(([name]) => !isInternal(name));
    const internal = peers.filter(([name]) => isInternal(name));
    checked += peers.length;

    // Правило 1: внешние — с верхней границей.
    const open = external.filter(([, range]) => !hasUpperBound(range));
    if (open.length > 0) {
      failed = true;
      console.error(`✗ ${pkg.name}: ${open.length} внешних peer-диапазон(ов) без верхней границы:`);
      for (const [name, range] of open) {
        console.error(`    ${name} = "${range}"`);
      }
      console.error(
        `    Укажите мажор, против которого пакет реально протестирован (см. devDependencies):\n` +
          `    ">=8" → ">=8 <9". Расширять — осознанно, после проверки нового мажора.`
      );
    }

    // Правило 2: внутренние — ровно "*".
    const versioned = internal.filter(([, range]) => range !== INTERNAL_RANGE);
    if (versioned.length > 0) {
      failed = true;
      console.error(`✗ ${pkg.name}: ${versioned.length} внутренних peer(ов) с версией:`);
      for (const [name, range] of versioned) {
        console.error(`    ${name} = "${range}"  →  "*"`);
      }
      console.error(
        `    Любой ВЕРСИОННЫЙ диапазон отсекает prerelease соседа (правило semver), и\n` +
          `    "npm i @reformer/*@beta" у потребителя падает с ERESOLVE. Работает только "*":\n` +
          `    npm проверяет эту строку до semver'а. Подробности — в шапке этого файла.`
      );
    }

    if (open.length === 0 && versioned.length === 0) {
      console.log(
        `✓ ${pkg.name}: внешних ${external.length} (ограничены сверху), ` +
          `внутренних ${internal.length} (= "*")`
      );
    }
  }
}

if (checked === 0) {
  console.error('✗ не найдено ни одного peer-диапазона — проверка бесполезна, чините её');
  process.exit(1);
}

process.exit(failed ? 1 : 0);
