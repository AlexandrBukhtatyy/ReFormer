/**
 * Эмиттер `data-sources.ts` (user-owned) — значения `$dataSource`: optionLike → массив опций из
 * мока; scalarLike → константа; functionLike → рабочая подпись элемента (заглушка). Всё —
 * функциональные no-op, форма работает сразу; реальные данные пользователь вписывает сам.
 *
 * @module reformer-builder/codegen/emit-data-sources
 */

import type { MockData } from '../preview-runtime/mock-synth';
import type { Collected } from './collect';

export function emitDataSources(c: Collected, mock: MockData): string {
  const opt = [...c.ds.optionLike].sort();
  const scal = [...c.ds.scalarLike].sort();
  const fn = [...c.ds.functionLike].sort();

  const optLines = opt.map((name) => {
    const val = mock.dataSources[name];
    const arr = Array.isArray(val) ? val : [];
    return `export const ${name}: SelectOption[] = ${JSON.stringify(arr, null, 2)};`;
  });
  const scalLines = scal.map((name) => {
    const val = mock.dataSources[name];
    return `export const ${name} = ${JSON.stringify(val ?? '')};`;
  });
  const fnLines = fn.map(
    (name) =>
      `export const ${name} = (_item: unknown, index: number): string => '#' + (index + 1); // TODO: подпись элемента`
  );

  const needsSelectOption = opt.length > 0;
  const importLine = needsSelectOption ? `import type { SelectOption } from './types';\n\n` : '';
  const blocks = [optLines.join('\n\n'), scalLines.join('\n'), fnLines.join('\n')].filter(Boolean);

  return `// data-sources.ts — значения $dataSource. МОК: опции из синтеза — замените реальными данными.
// Пишется один раз (не затирается при регенерации).

${importLine}${blocks.join('\n\n')}
`;
}
