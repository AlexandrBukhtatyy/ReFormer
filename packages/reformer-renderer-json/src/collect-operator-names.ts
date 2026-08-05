/**
 * Сбор имён операторов из ВСЕГО дерева схемы — включая `componentProps`, `item.$template`
 * и вложенные узлы внутри пропсов.
 *
 * Зачем: `convertJsonToM1Tree` синхронный и бросает на первом же незарегистрированном имени
 * (`Component "X" not found in registry`). Чтобы дать вменяемую диагностику ДО сборки формы —
 * а для схемы, пришедшей по сети, это основной режим отказа, — нужно заранее знать, какие имена
 * схема требует, и сверить их с реестром.
 *
 * `$model(...)` намеренно игнорируется: пути динамичны, их сверяют не с реестром, а с моделью.
 * `$html(...)` тоже не собирается — список тегов статичен и проверяется whitelist'ом.
 *
 * React-free и без ajv: вызывается в node, в тестах и в preflight.
 *
 * @module reformer/renderer-json/collect-operator-names
 */

import { parseOperator } from './operators';
import type { JsonFormSchema } from './types/json-schema';

/** Имена, к которым схема обращается через операторы. */
export interface OperatorNames {
  /** Имена из `$component(...)`. */
  components: string[];
  /** Имена из `$dataSource(...)`. */
  dataSources: string[];
  /** Имена из `$fn(...)`. */
  fns: string[];
  /** Ключи из `$locale(...)`. */
  locales: string[];
}

/**
 * Собирает имена операторов из схемы формы.
 *
 * @param schema - JSON-схема формы.
 * @returns {@link OperatorNames} — четыре списка без дубликатов.
 *
 * @example
 * ```typescript
 * const used = collectOperatorNames(schema);
 * const missing = used.components.filter((n) => !registry.has(n));
 * if (missing.length) throw new Error(`Не зарегистрированы: ${missing.join(', ')}`);
 * ```
 */
export function collectOperatorNames(schema: JsonFormSchema): OperatorNames {
  const components = new Set<string>();
  const dataSources = new Set<string>();
  const fns = new Set<string>();
  const locales = new Set<string>();

  // Обход намеренно over-inclusive: операторы встречаются не только на структурных позициях,
  // но и в произвольном componentProps (напр. RendererFormWizard.steps), который JSON Schema
  // видит как opaque object.
  const scan = (v: unknown): void => {
    if (typeof v === 'string') {
      const p = parseOperator(v);
      if (!p) return;
      if (p.op === 'component') components.add(p.arg);
      else if (p.op === 'dataSource') dataSources.add(p.arg);
      else if (p.op === 'fn') fns.add(p.arg);
      else if (p.op === 'locale') locales.add(p.arg);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(scan);
      return;
    }
    if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) scan(val);
    }
  };

  scan(schema.root);

  return {
    components: [...components],
    dataSources: [...dataSources],
    fns: [...fns],
    locales: [...locales],
  };
}
