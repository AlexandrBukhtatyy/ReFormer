/**
 * Единая точка доступа к публичным символам: индекс, а при его отсутствии — разбор AST.
 *
 * Зачем прослойка. Индекс (`llms-index.json`) публикуется каждым пакетом начиная с этой
 * версии, но у потребителя рядом может стоять СТАРЫЙ `@reformer/core` — без индекса. Ронять
 * из-за этого `get_symbol_docs` нельзя, поэтому такой пакет докладывается прежним путём.
 * Всё остальное — включая массовый случай — идёт через индекс, и именно это позволяет
 * держать `typescript` (23 MB) в optionalDependencies, а не в обязательных: разбор AST
 * подгружается динамически и только когда действительно понадобился.
 *
 * Контракт `PublicSymbol` сохранён без изменений: потребители (`get_symbol_docs`,
 * `list_symbols`, `find_recipe`) не знают, откуда пришли данные.
 */

import { KNOWN_PACKAGES, type ReformerPackage } from '../utils/docs-parser.js';
import type { PublicSymbol, SymbolTag } from '../utils/symbols-parser.js';
import { getMergedIndex } from './loader.js';
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

/**
 * Разбор AST — только как фолбэк для пакета без индекса. Динамический импорт: модуль тянет
 * `typescript`, и грузить его на старте ради случая, которого обычно нет, незачем.
 */
async function parseSymbolsFallback(pkg: string): Promise<PublicSymbol[]> {
  try {
    const mod = await import('../utils/symbols-parser.js');
    return mod.getPublicSymbols(pkg);
  } catch {
    // `typescript` не установлен (optionalDependency) — тогда у пакета без индекса
    // символов просто нет. Это честнее, чем падать: остальная документация работает.
    return [];
  }
}

const fallbackCache = new Map<string, PublicSymbol[]>();

/** Публичные символы одного пакета. */
export async function publicSymbols(pkg: string): Promise<PublicSymbol[]> {
  const merged = getMergedIndex();
  if (!merged.withoutIndex.includes(pkg)) {
    return merged.symbols.filter((s) => s.package === pkg).map(toPublicSymbol);
  }
  const cached = fallbackCache.get(pkg);
  if (cached) return cached;
  const parsed = await parseSymbolsFallback(pkg);
  fallbackCache.set(pkg, parsed);
  return parsed;
}

/**
 * Все варианты символа с этим именем (не более одного на пакет), в порядке `KNOWN_PACKAGES`.
 * Порядок важен: при коллизии (`FormField` есть и в cdk, и в ui-kit) первым обязан идти тот
 * же вариант, что возвращал прежний `findAllSymbols`.
 */
export async function findSymbols(name: string, pkg = '*'): Promise<PublicSymbol[]> {
  const targets: ReformerPackage[] = pkg === '*' ? [...KNOWN_PACKAGES] : [pkg as ReformerPackage];
  const out: PublicSymbol[] = [];
  for (const target of targets) {
    const hit = (await publicSymbols(target)).find((s) => s.name === name);
    if (hit) out.push(hit);
  }
  return out;
}

/** Первый вариант символа, либо `null`. */
export async function findOneSymbol(name: string, pkg = '*'): Promise<PublicSymbol | null> {
  return (await findSymbols(name, pkg))[0] ?? null;
}

/**
 * Предупреждение о пакетах без индекса — чтобы деградация была ВИДИМОЙ.
 *
 * Молчаливая деградация здесь опаснее ошибки: агент получил бы неполный список API и решил,
 * что символа не существует. Возвращает пустую строку, когда всё в порядке, иначе — строку
 * для добавления в ответ tool'а.
 */
export function indexCoverageWarning(): string {
  const { withoutIndex } = getMergedIndex();
  if (withoutIndex.length === 0) return '';
  return (
    `\n\n> ⚠️ No \`llms-index.json\` in ${withoutIndex.join(', ')} — these packages predate the ` +
    `build-time index. Their symbols are read by parsing TypeScript at runtime, which needs ` +
    `\`typescript\` installed (optional peer); without it their API surface is not listed here. ` +
    `Upgrade those packages for complete and cheaper results.`
  );
}

/** Только для тестов — сбросить кэш фолбэка. */
export function __resetSymbolFallbackCache(): void {
  fallbackCache.clear();
}
