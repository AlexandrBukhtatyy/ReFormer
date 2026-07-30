/**
 * Эмиттер `README.md` — шаги интеграции в react-playground (сниппет App.tsx) + чеклист методов,
 * которые пользователь реализует в user-owned файлах.
 *
 * @module reformer-builder/codegen/emit-readme
 */

import { appSnippet } from './app-snippet';
import type { SelectorInfo } from './assign-selectors';
import type { Collected } from './collect';
import type { Names } from './naming';

export function emitReadme(n: Names, sel: SelectorInfo, c: Collected): string {
  const methods = [
    '- `api.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` + успех).',
    ...(sel.sections.length
      ? [
          `- \`renderer.behavior.ts\` → раскомментируйте \`hideWhen\` для секций: ${sel.sections
            .map((s) => `\`${s.selector}\``)
            .join(', ')}.`,
        ]
      : []),
    ...(c.ds.functionLike.size
      ? [
          `- \`data-sources.ts\` → подписи элементов массивов: ${[...c.ds.functionLike]
            .map((x) => `\`${x}\``)
            .join(', ')}.`,
        ]
      : []),
    ...(c.ds.optionLike.size
      ? ['- `data-sources.ts` → замените синтетические опции реальными словарями/загрузчиками.']
      : []),
    '- `validation.ts` → допишите правила (сейчас — только `required`).',
    '- `form.behavior.ts` → вычисляемые поля / условное включение (по желанию).',
  ].join('\n');

  return `# ${n.title}

Сгенерированная форма (renderer-json). Рендерится и работает сразу на синтетических данных —
«доведение» сводится к реализации методов в user-owned файлах.

## Встраивание в react-playground

Скопируйте папку в \`src/pages/examples/${n.dir}/\` и добавьте в \`src/App.tsx\`:

\`\`\`tsx
${appSnippet(n)}
\`\`\`

## Файлы

- **Регенерируемые** (перезаписываются при повторной генерации): \`schema.ts\`, \`types.ts\`, \`model.ts\`, \`registry.ts\`, \`index.tsx\`, \`README.md\`.
- **Ваши** (пишутся один раз, не затираются): \`data-sources.ts\`, \`renderer.behavior.ts\`, \`form.behavior.ts\`, \`validation.ts\`, \`api.ts\`.

## Методы для реализации

${methods}
`;
}
