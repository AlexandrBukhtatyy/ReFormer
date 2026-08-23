/**
 * Единая точка доступа к публичным символам: индекс, а при его отсутствии — фолбэк платформы.
 *
 * Зачем прослойка. Индекс (`llms-index.json`) публикуется каждым пакетом начиная с этой
 * версии, но у потребителя рядом может стоять СТАРЫЙ `@reformer/core` — без индекса. Ронять
 * из-за этого `get_symbol_docs` нельзя, поэтому такой пакет докладывается прежним путём.
 * Всё остальное — включая массовый случай — идёт через индекс, и именно это позволяет
 * держать `typescript` (23 MB) в optionalDependencies, а не в обязательных.
 *
 * Сам разбор AST сюда не входит: он платформенный и приходит как {@link SymbolsFallback}.
 * В браузере фолбэка нет, и пакет без индекса честно отдаёт пустой список — это лучше, чем
 * тащить компилятор в бандл ради случая, которого там обычно и не бывает.
 *
 * Контракт `PublicSymbol` сохранён без изменений: потребители (`get_symbol_docs`,
 * `list_symbols`, `find_recipe`) не знают, откуда пришли данные.
 *
 * @module reformer-mcp/core/index/symbols
 */

import { KNOWN_PACKAGES, type ReformerPackage } from '../docs/packages.js';
import type { Knowledge } from '../knowledge.js';
import type { PublicSymbol, SymbolTag } from './public-symbol.js';
import type { IndexedSymbol } from './types.js';

/** Индексная запись → прежний контракт `PublicSymbol`. */
function toPublicSymbol(s: IndexedSymbol): PublicSymbol {
  const tags: SymbolTag[] = [];
  for (const [name, text] of s.params ?? []) tags.push({ tag: 'param', name, text });
  if (s.returns) tags.push({ tag: 'returns', text: s.returns });
  if (s.example) tags.push({ tag: 'example', text: s.example });
  if (s.deprecated) tags.push({ tag: 'deprecated', text: s.deprecated });
  for (const r of s.related ?? []) tags.push({ tag: 'see', text: `{@link ${r}}` });
  return {
    name: s.name,
    kind: s.kind as PublicSymbol['kind'],
    signature: s.signature,
    description: s.description ?? s.summary ?? '',
    tags,
    sourcePath: s.sourcePath,
    package: s.package,
  };
}

/** Кэш фолбэка — на экземпляр знания, не на модуль. */
function fallbackCache(k: Knowledge): Map<string, PublicSymbol[]> {
  const existing = k.memo.get('symbols:fallback') as Map<string, PublicSymbol[]> | undefined;
  if (existing) return existing;
  const created = new Map<string, PublicSymbol[]>();
  k.memo.set('symbols:fallback', created);
  return created;
}

/** Публичные символы одного пакета. */
export async function publicSymbols(k: Knowledge, pkg: string): Promise<PublicSymbol[]> {
  if (!k.index.withoutIndex.includes(pkg)) {
    return k.index.symbols.filter((s) => s.package === pkg).map(toPublicSymbol);
  }
  const cache = fallbackCache(k);
  const cached = cache.get(pkg);
  if (cached) return cached;

  let parsed: PublicSymbol[] = [];
  if (k.symbolsFallback) {
    try {
      parsed = await k.symbolsFallback(pkg);
    } catch {
      // Фолбэк недоступен (нет `typescript`, нет исходников) — тогда у пакета без индекса
      // символов просто нет. Это честнее, чем падать: остальная документация работает.
      parsed = [];
    }
  }
  cache.set(pkg, parsed);
  return parsed;
}

/**
 * Все варианты символа с этим именем (не более одного на пакет), в порядке `KNOWN_PACKAGES`.
 * Порядок важен: при коллизии (`FormField` есть и в cdk, и в ui-kit) первым обязан идти тот
 * же вариант, что возвращал прежний `findAllSymbols`.
 */
export async function findSymbols(k: Knowledge, name: string, pkg = '*'): Promise<PublicSymbol[]> {
  const targets: ReformerPackage[] = pkg === '*' ? [...KNOWN_PACKAGES] : [pkg as ReformerPackage];
  const out: PublicSymbol[] = [];
  for (const target of targets) {
    const hit = (await publicSymbols(k, target)).find((s) => s.name === name);
    if (hit) out.push(hit);
  }
  return out;
}

/** Первый вариант символа, либо `null`. */
export async function findOneSymbol(
  k: Knowledge,
  name: string,
  pkg = '*'
): Promise<PublicSymbol | null> {
  return (await findSymbols(k, name, pkg))[0] ?? null;
}

/**
 * Предупреждение о пакетах без индекса — чтобы деградация была ВИДИМОЙ.
 *
 * Молчаливая деградация здесь опаснее ошибки: агент получил бы неполный список API и решил,
 * что символа не существует. Возвращает пустую строку, когда всё в порядке, иначе — строку
 * для добавления в ответ tool'а.
 */
export function indexCoverageWarning(k: Knowledge): string {
  const { withoutIndex } = k.index;
  if (withoutIndex.length === 0) return '';
  return (
    `\n\n> ⚠️ No \`llms-index.json\` in ${withoutIndex.join(', ')} — these packages predate the ` +
    `build-time index. Their symbols are read by parsing TypeScript at runtime, which needs ` +
    `\`typescript\` installed (optional peer); without it their API surface is not listed here. ` +
    `Upgrade those packages for complete and cheaper results.`
  );
}
