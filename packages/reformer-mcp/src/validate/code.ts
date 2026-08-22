/**
 * Семантическая проверка сгенерированного кода ReFormer.
 *
 * Что она ловит и почему это не делает `tsc`. Компилятор проверяет типы, но не знает
 * архитектуры библиотеки: он спокойно пропустит `validate(...)` вне `defineValidationSchema`
 * (правило просто не зарегистрируется и поле молча не будет валидироваться) или импорт
 * `computeFrom` из `@reformer/core` вместо `@reformer/core/behaviors`. Ровно на этом классе
 * ошибок стоит `scripts/check-mcp-prompts.mjs`: снятый `validateFormModel` компилировался,
 * форма рисовалась и молча отправляла пустые обязательные поля.
 *
 * Почему БЕЗ TypeScript-парсера. `typescript` (23 MB) вынесен из обязательных зависимостей
 * в опциональный peer — тянуть его обратно ради валидации значило бы отменить выигрыш Фазы 2.
 * Импорты и вызовы в TS достаточно регулярны, чтобы разобрать их построчно, а источником
 * истины об именах служит индекс, а не догадки. Ограничения этого подхода названы честно:
 * проверка не понимает переименований при импорте и вложенных фабрик, и об этом сказано в
 * отчёте, а не умалчивается.
 */

import { publicSymbols } from '../index/symbols.js';
import { indexedSymbol } from '../index/loader.js';
import { KNOWN_PACKAGES } from '../utils/docs-parser.js';
import type { Diagnostic } from './codes.js';

/** Один разобранный импорт. */
interface ParsedImport {
  names: Array<{ imported: string; local: string }>;
  from: string;
  line: number;
}

const IMPORT_RE = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;

function parseImports(code: string): ParsedImport[] {
  const out: ParsedImport[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(code)) !== null) {
    const line = code.slice(0, m.index).split('\n').length;
    const names = m[2]
      .split(',')
      .map((raw) => raw.trim().replace(/^type\s+/, ''))
      .filter(Boolean)
      .map((part) => {
        const [imported, local] = part.split(/\s+as\s+/).map((s) => s.trim());
        return { imported, local: local ?? imported };
      })
      .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n.imported));
    out.push({ names, from: m[3], line });
  }
  return out;
}

/** Операторы, которые обязаны вызываться внутри своей схемы. */
const VALIDATION_OPERATORS = ['validate', 'validateAsync', 'validateWhen', 'cross', 'each'];
const BEHAVIOR_OPERATORS = [
  'compute',
  'computeFrom',
  'copyFrom',
  'syncFields',
  'onChange',
  'enableWhen',
  'disableWhen',
  'resetWhen',
  'transformValue',
  'revalidateWhen',
  'applyEach',
  'exclusiveFlag',
  'aggregateInto',
];

/**
 * Диапазоны строк, находящиеся внутри вызова `fnName(`.
 *
 * Считаем по балансу скобок от строки вызова. Этого достаточно для реальных схем (они
 * пишутся одним верхнеуровневым вызовом) и не требует AST. Строки и комментарии со скобками
 * могут сбить баланс — поэтому проверка помечает нарушение как `warning`, а не `error`:
 * ложное срабатывание не должно останавливать работу.
 */
function rangesInside(code: string, fnName: string): Array<[number, number]> {
  const lines = code.split('\n');
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`\\b${fnName}\\s*[<(]`).test(lines[i])) continue;
    let depth = 0;
    let started = false;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '(') {
          depth++;
          started = true;
        } else if (ch === ')') depth--;
      }
      if (started && depth <= 0) {
        ranges.push([i + 1, j + 1]);
        i = j;
        break;
      }
    }
  }
  return ranges;
}

const inAnyRange = (line: number, ranges: Array<[number, number]>) =>
  ranges.some(([from, to]) => line >= from && line <= to);

export interface ValidateCodeOptions {
  /** Целевой стек — влияет на то, какой пакет считается «своим» для импорта. */
  target?: string;
}

/**
 * Проверить фрагмент кода формы.
 *
 * @returns Диагностики и список ограничений разбора — чтобы потребитель не принял
 *          «ошибок нет» за «код верен».
 */
export async function validateCode(
  code: string,
  _options: ValidateCodeOptions = {}
): Promise<{ diagnostics: Diagnostic[]; limitations: string[] }> {
  const diagnostics: Diagnostic[] = [];
  const source = String(code ?? '');
  if (!source.trim()) return { diagnostics, limitations: [] };

  const lines = source.split('\n');
  const imports = parseImports(source);
  const reformerImports = imports.filter((i) => i.from.startsWith('@reformer/'));

  // --- RF002 / RF003 / RF010: имена, импортированные из @reformer/* -----------
  for (const imp of reformerImports) {
    const basePackage = imp.from.split('/').slice(0, 2).join('/');
    for (const { imported } of imp.names) {
      const matches = await findSymbolAnywhere(imported);
      if (matches.length === 0) {
        const suggestions = await suggestNames(imported);
        diagnostics.push({
          code: 'RF002',
          severity: 'error',
          message: `\`${imported}\` не существует ни в одном @reformer/* пакете.`,
          line: imp.line,
          suggestion:
            suggestions.length > 0
              ? `Возможно, имелось в виду: ${suggestions.join(', ')}.`
              : 'Проверьте имя через `search_docs` или `choose_api`.',
          fix: { tool: 'search_docs', arguments: { query: imported } },
        });
        continue;
      }
      if (!matches.some((m) => m.package === basePackage)) {
        diagnostics.push({
          code: 'RF003',
          severity: 'error',
          message: `\`${imported}\` импортируется из \`${imp.from}\`, но живёт в ${matches
            .map((m) => `\`${m.package}\``)
            .join(', ')}.`,
          line: imp.line,
          suggestion: `Импортируйте из \`${matches[0].package}\`.`,
        });
      } else {
        // Пакет верный — проверяем ПОДПУТЬ. Не всё видно из корня: `validate` доступен
        // только из `@reformer/core/validation`, и импорт его из `@reformer/core` соберётся
        // у нас, но упадёт у потребителя. Индекс знает точный список спецификаторов.
        // Обе стороны приводим к одному виду: в `exports` подпуть записан как `./behaviors`,
        // а в импорте — как `/behaviors`. Без нормализации любой корректный импорт из
        // подпути объявлялся ошибкой.
        const subpath = imp.from.slice(basePackage.length); // '' либо '/behaviors'
        const entries = entriesFor(imported, basePackage).map((e) =>
          e === '.' ? '' : e.replace(/^\./, '')
        );
        if (entries.length > 0 && !entries.includes(subpath)) {
          const asImport = (e: string) => `\`${basePackage}${e}\``;
          diagnostics.push({
            code: 'RF003',
            severity: 'error',
            message: `\`${imported}\` не экспортируется из \`${imp.from}\` — он доступен из ${entries
              .map(asImport)
              .join(', ')}.`,
            line: imp.line,
            suggestion: `Импортируйте из ${asImport(entries[0])}.`,
          });
        }
      }
      const deprecated = matches[0].tags.find((t) => t.tag === 'deprecated');
      if (deprecated) {
        diagnostics.push({
          code: 'RF010',
          severity: 'warning',
          message: `\`${imported}\` помечен @deprecated: ${deprecated.text || 'без пояснения'}.`,
          line: imp.line,
          fix: { tool: 'get_symbol_docs', arguments: { symbol: imported } },
        });
      }
    }
  }

  // --- RF004 / RF005: оператор вне своей схемы --------------------------------
  const validationRanges = rangesInside(source, 'defineValidationSchema');
  const behaviorRanges = rangesInside(source, 'defineFormBehavior');
  const importedLocals = new Set(reformerImports.flatMap((i) => i.names.map((n) => n.local)));

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const text = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(text)) continue; // комментарий

    for (const op of VALIDATION_OPERATORS) {
      if (!importedLocals.has(op)) continue;
      if (!new RegExp(`(^|[^.\\w])${op}\\s*\\(`).test(text)) continue;
      if (inAnyRange(lineNo, validationRanges)) continue;
      diagnostics.push({
        code: 'RF004',
        severity: 'warning',
        message: `\`${op}(...)\` вызывается вне \`defineValidationSchema\` — правило не зарегистрируется, и поле молча не будет валидироваться.`,
        line: lineNo,
        suggestion: 'Перенесите вызов внутрь callback `defineValidationSchema`.',
        fix: { tool: 'choose_api', arguments: { requirement: 'объявить схему валидации' } },
      });
    }

    for (const op of BEHAVIOR_OPERATORS) {
      if (!importedLocals.has(op)) continue;
      if (!new RegExp(`(^|[^.\\w])${op}\\s*\\(`).test(text)) continue;
      if (inAnyRange(lineNo, behaviorRanges)) continue;
      diagnostics.push({
        code: 'RF005',
        severity: 'warning',
        message: `\`${op}(...)\` вызывается вне \`defineFormBehavior\` — связь не подпишется на изменения.`,
        line: lineNo,
        suggestion: 'Перенесите вызов внутрь callback `defineFormBehavior`.',
        fix: {
          tool: 'choose_api',
          arguments: { requirement: 'объявить реактивное поведение формы' },
        },
      });
    }
  }

  const limitations = [
    'Разбор построчный, без TypeScript-AST: переименование при импорте (`X as Y`) отслеживается, ' +
      'но вложенные фабрики и динамические вызовы — нет.',
    'Проверка «оператор внутри своей схемы» считает баланс скобок и может ошибиться на коде ' +
      'со скобками в строках — поэтому это warning, а не error.',
  ];
  return { diagnostics, limitations };
}

/** Спецификаторы импорта символа в этом пакете. Пусто — индекса нет, проверку пропускаем. */
function entriesFor(name: string, pkg: string): string[] {
  const hit = indexedSymbol(name, pkg)[0];
  return hit?.entries ?? [];
}

/** Все пакеты, где встречается имя. */
async function findSymbolAnywhere(name: string) {
  const out = [];
  for (const pkg of KNOWN_PACKAGES) {
    const hit = (await publicSymbols(pkg)).find((s) => s.name === name);
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * Похожие имена для неизвестного символа. Расстояние Левенштейна по префиксу индекса —
 * дёшево и достаточно: опечатки и «похожие по смыслу» имена (`validateField` → `validate`,
 * `validateWhen`) попадают в выдачу.
 */
async function suggestNames(name: string): Promise<string[]> {
  const target = name.toLowerCase();
  const all: string[] = [];
  for (const pkg of KNOWN_PACKAGES) all.push(...(await publicSymbols(pkg)).map((s) => s.name));
  return [...new Set(all)]
    .map((candidate) => ({ candidate, d: distance(target, candidate.toLowerCase()) }))
    .filter((x) => x.d <= Math.max(2, Math.floor(target.length / 3)))
    .sort((a, b) => a.d - b.d || a.candidate.localeCompare(b.candidate))
    .slice(0, 3)
    .map((x) => x.candidate);
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 6) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}
