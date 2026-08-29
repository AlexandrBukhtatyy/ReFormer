/**
 * Эмиттер `registry.ts` — привязка `$component`/`$dataSource` к реализациям.
 *
 * Все имена, которые сюда попадают, называет КИТ: спецификатор импорта, символ каждого
 * компонента, враппер поля и то, кому нужен шим. Захардкоженного `@reformer/ui-kit` здесь
 * больше нет ни одного — ради этого точка расширения целей и заводилась.
 *
 * @module reformer-builder/lib/codegen/emit/registry
 */

import { resolveComponent, type ComponentResolution } from '../components';
import type { EmitContext } from '../context';
import { STEP_NAME, wizardShimOf } from './wizard';

export function emitRegistry(ctx: EmitContext): string {
  const { collected, kit } = ctx;
  const specifier = kit.kit.codegen.importSpecifier;
  const fieldWrapper = kit.kit.infra.fieldWrapper;
  const shim = wizardShimOf(ctx);
  const shimmed = new Set<string>(
    shim === null ? [] : [...shim.hostNames, ...(shim.hasStep ? [STEP_NAME] : [])]
  );

  const resolutions: ComponentResolution[] = collected.components
    .filter((name) => !shimmed.has(name))
    .map((name) => resolveComponent(name, kit));

  // Имя, которому нужен шим, но шима не будет (кит без адаптера визарда), — заглушка
  // с внятной причиной, а не импорт из чужого пакета.
  const normalized = resolutions.map((r) =>
    r.shim
      ? {
          ...r,
          shim: false,
          placeholder: true,
          reason: `кит «${kit.kit.label}» не поставляет адаптер для этого компонента`,
        }
      : r
  );

  const hasPlaceholder = normalized.some((r) => r.placeholder);
  const kitSymbols = new Set<string>([fieldWrapper]);
  for (const r of normalized) if (r.symbol !== null) kitSymbols.add(r.symbol);

  const dataSourceNames = [
    ...[...collected.ds.optionLike].sort(),
    ...[...collected.ds.scalarLike].sort(),
    ...[...collected.ds.functionLike].sort(),
  ];

  const shimLines =
    shim === null
      ? []
      : [
          '    // Визард и тело шага — из шима renderer.wizard.tsx.',
          ...shim.hostNames.map((name) => `    reg.component('${name}', Wizard);`),
          ...(shim.hasStep ? [`    reg.component('${STEP_NAME}', ${STEP_NAME});`] : []),
        ];

  const componentLines = [
    ...shimLines,
    ...normalized.map((r) =>
      r.placeholder
        ? `    reg.component('${r.name}', Placeholder); // TODO: ${r.reason}`
        : `    reg.component('${r.name}', ${r.symbol});`
    ),
  ].join('\n');

  const dataSourceLines = dataSourceNames
    .map((name) => `    reg.dataSource('${name}', ${name});`)
    .join('\n');

  const reactImport = hasPlaceholder ? `import type { ReactNode } from 'react';\n` : '';
  const kitImport = `import { ${[...kitSymbols].sort().join(', ')} } from '${specifier}';`;
  const dataSourceImport =
    dataSourceNames.length > 0
      ? `import { ${dataSourceNames.join(', ')} } from './data-sources';\n`
      : '';
  const wizardImport =
    shim === null
      ? ''
      : `import { ${shim.hasStep ? `${STEP_NAME}, ` : ''}Wizard } from './renderer.wizard';\n`;
  const placeholderDecl = hasPlaceholder
    ? `\n/** Заглушка для компонента без прямого соответствия в ките (замените реальным). */\nconst Placeholder = ({ children }: { children?: ReactNode }): ReactNode => children ?? null;\n`
    : '';

  return `// registry.ts — привязка $component/$dataSource к реализациям. Регенерируется.

${reactImport}${kitImport}
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
${wizardImport}${dataSourceImport}${placeholderDecl}
export function createRegistry() {
  return defineRegistry((reg) => {
    reg.component(FIELD_WRAPPER, ${fieldWrapper});
${componentLines}
${dataSourceLines === '' ? '' : `\n${dataSourceLines}\n`}  });
}
`;
}
