/**
 * Эмиттер `data-sources.ts` — значения `$dataSource`.
 *
 * Классы разложены по способу использования: список опций, скаляр, подпись элемента массива
 * (последней нужна ФУНКЦИЯ, а не массив). Всё — рабочие no-op: форма собирается и работает
 * сразу, реальные данные вписывает человек.
 *
 * Файл авторский (`user`) и регенерации не подлежит: из чего его перевыводить, кодоген не знает.
 *
 * @module reformer-builder/lib/codegen/emit/data-sources
 */

import type { EmitContext } from '../context';

export function emitDataSources(ctx: EmitContext): string {
  const { collected, mock } = ctx;
  const optionLike = [...collected.ds.optionLike].sort();
  const scalarLike = [...collected.ds.scalarLike].sort();
  const functionLike = [...collected.ds.functionLike].sort();

  const optionLines = optionLike.map((name) => {
    const value = mock.dataSources[name];
    const options = Array.isArray(value) ? value : [];
    return `export const ${name}: SelectOption[] = ${JSON.stringify(options, null, 2)};`;
  });
  const scalarLines = scalarLike.map((name) => {
    const value = mock.dataSources[name];
    return `export const ${name} = ${JSON.stringify(value ?? '')};`;
  });
  const functionLines = functionLike.map(
    (name) =>
      `export const ${name} = (_item: unknown, index: number): string =>\n  '#' + (index + 1); // TODO: подпись элемента`
  );

  const importLine =
    optionLike.length > 0 ? `import type { SelectOption } from './types';\n\n` : '';
  const blocks = [
    optionLines.join('\n\n'),
    scalarLines.join('\n'),
    functionLines.join('\n'),
  ].filter((block) => block !== '');

  return `// data-sources.ts — значения $dataSource. МОК: опции из синтеза, замените реальными.
// Пишется один раз и при регенерации не затирается.

${importLine}${blocks.join('\n\n')}
`;
}
