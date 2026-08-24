/**
 * Эмиттер `registry.ts` — привязка `$component`/`$dataSource` к реализациям. Компоненты резолвятся
 * через {@link resolveComponent} (имя символа берёт каталог), неизвестные — под `Placeholder`.
 * `$dataSource`-значения импортируются из `./data-sources`.
 *
 * @module reformer-builder/codegen/emit-registry
 */

import { isStepsHostName } from '../model';
import type { Collected } from './collect';
import { resolveComponent } from './ui-kit-imports';

/** Имя тела шага в схеме — под ним регистрируется `Step` из шима. */
export const STEP_NAME = 'Step';

export function emitRegistry(c: Collected): string {
  // Wizard и тело шага резолвятся не в ui-kit, а в шим соседнего файла (см. emit-wizard): под
  // `$component(Wizard)` библиотека компонента не даёт вовсе, поэтому `resolveComponent` честно
  // отвечает «нужен shim» — и раньше это доезжало до пользователя как `Placeholder` с TODO.
  const wizardNames = c.components.filter(isStepsHostName);
  const hasWizard = wizardNames.length > 0;
  const hasStepNode = hasWizard && c.components.includes(STEP_NAME);
  const shimmed = new Set<string>(
    hasWizard ? [...wizardNames, ...(hasStepNode ? [STEP_NAME] : [])] : []
  );

  const resolutions = c.components.filter((n) => !shimmed.has(n)).map(resolveComponent);
  const hasPlaceholder = resolutions.some((r) => r.placeholder);

  const uiSymbols = new Set<string>(['FormField']);
  for (const r of resolutions) if (r.symbol) uiSymbols.add(r.symbol);

  const opt = [...c.ds.optionLike].sort();
  const scal = [...c.ds.scalarLike].sort();
  const fn = [...c.ds.functionLike].sort();
  const dsNames = [...opt, ...scal, ...fn];

  const shimLines = [
    ...wizardNames.map((name) => `    reg.component('${name}', Wizard);`),
    ...(hasStepNode ? [`    reg.component('${STEP_NAME}', Step);`] : []),
  ];
  const compLines = [
    ...(shimLines.length
      ? ['    // Визард и тело шага — из шима renderer.wizard.tsx.', ...shimLines]
      : []),
    ...resolutions.map((r) =>
      r.placeholder
        ? `    reg.component('${r.name}', Placeholder); // TODO: ${r.reason}`
        : `    reg.component('${r.name}', ${r.symbol});`
    ),
  ].join('\n');

  const dsLines = dsNames.map((name) => `    reg.dataSource('${name}', ${name});`).join('\n');

  const reactImport = hasPlaceholder ? `import type { ReactNode } from 'react';\n` : '';
  const uiImport = `import { ${[...uiSymbols].sort().join(', ')} } from '@reformer/ui-kit';`;
  const dsImport = dsNames.length
    ? `import { ${dsNames.join(', ')} } from './data-sources';\n`
    : '';
  const wizardImport = hasWizard
    ? `import { ${hasStepNode ? `${STEP_NAME}, ` : ''}Wizard } from './renderer.wizard';\n`
    : '';
  const placeholderDecl = hasPlaceholder
    ? `\n/** Заглушка для компонента без прямого маппинга в ui-kit (замените реальным). */\nconst Placeholder = ({ children }: { children?: ReactNode }): ReactNode => children ?? null;\n`
    : '';

  return `// registry.ts — привязка $component/$dataSource к реализациям. Регенерируется.

${reactImport}${uiImport}
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
${wizardImport}${dsImport}${placeholderDecl}
export function createRegistry() {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, FormField);
${compLines}
${dsLines ? `\n${dsLines}\n` : ''}  });
}
`;
}
