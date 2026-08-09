/**
 * Проверка: у внешних peerDependencies есть верхняя граница.
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
 * Внутренние @reformer/* не проверяем: их мажоры контролирует сам монорепо, а в песочнице
 * они подменяются локальными тарболами, поэтому latest из npm туда не попадает.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Где искать пакеты: каждый каталог с package.json. */
const ROOTS = ['packages', 'projects'];

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
    const peers = Object.entries(pkg.peerDependencies ?? {}).filter(
      ([name]) => !name.startsWith('@reformer/')
    );
    if (peers.length === 0) continue;

    const open = peers.filter(([, range]) => !hasUpperBound(range));
    checked += peers.length;

    if (open.length > 0) {
      failed = true;
      console.error(`✗ ${pkg.name}: ${open.length} peer-диапазон(ов) без верхней границы:`);
      for (const [name, range] of open) {
        console.error(`    ${name} = "${range}"`);
      }
      console.error(
        `    Укажите мажор, против которого пакет реально протестирован (см. devDependencies):\n` +
          `    ">=8" → ">=8 <9". Расширять — осознанно, после проверки нового мажора.`
      );
    } else {
      console.log(`✓ ${pkg.name}: ${peers.length} внешних peer-диапазон(ов) ограничены сверху`);
    }
  }
}

if (checked === 0) {
  console.error('✗ не найдено ни одного внешнего peer-диапазона — проверка бесполезна, чините её');
  process.exit(1);
}

process.exit(failed ? 1 : 0);
