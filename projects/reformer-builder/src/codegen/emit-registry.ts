/**
 * Эмиттер `registry.ts` — привязка `$component`/`$dataSource` к реализациям. Компоненты резолвятся
 * через {@link resolveComponent} (field → `${name}Field`), неизвестные — под `Placeholder`.
 * `$dataSource`-значения импортируются из `./data-sources`.
 *
 * @module reformer-builder/codegen/emit-registry
 */

import type { Collected } from './collect';
import { resolveComponent } from './ui-kit-imports';

export function emitRegistry(c: Collected): string {
  const resolutions = c.components.map(resolveComponent);
  const hasPlaceholder = resolutions.some((r) => r.placeholder);

  const uiSymbols = new Set<string>(['FormField']);
  for (const r of resolutions) if (r.symbol) uiSymbols.add(r.symbol);

  const opt = [...c.ds.optionLike].sort();
  const scal = [...c.ds.scalarLike].sort();
  const fn = [...c.ds.functionLike].sort();
  const dsNames = [...opt, ...scal, ...fn];

  const compLines = resolutions
    .map((r) =>
      r.placeholder
        ? `    reg.component('${r.name}', Placeholder); // TODO: ${r.reason}`
        : `    reg.component('${r.name}', ${r.symbol});`
    )
    .join('\n');

  const dsLines = dsNames.map((name) => `    reg.dataSource('${name}', ${name});`).join('\n');

  const reactImport = hasPlaceholder ? `import type { ReactNode } from 'react';\n` : '';
  const uiImport = `import { ${[...uiSymbols].sort().join(', ')} } from '@reformer/ui-kit';`;
  const dsImport = dsNames.length
    ? `import { ${dsNames.join(', ')} } from './data-sources';\n`
    : '';
  const placeholderDecl = hasPlaceholder
    ? `\n/** Заглушка для компонента без прямого маппинга в ui-kit (замените реальным). */\nconst Placeholder = ({ children }: { children?: ReactNode }): ReactNode => children ?? null;\n`
    : '';

  return `// registry.ts — привязка $component/$dataSource к реализациям. Регенерируется.

${reactImport}${uiImport}
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
${dsImport}${placeholderDecl}
export function createRegistry() {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
${compLines}
${dsLines ? `\n${dsLines}\n` : ''}  });
}
`;
}
