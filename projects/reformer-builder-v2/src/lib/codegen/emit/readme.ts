/**
 * Эмиттер `README.md` — как встроить модуль и что в нём дописать руками.
 *
 * Состав файлов берётся из {@link EmitContext.files}, а не из литерала в тексте: набор решают
 * вклады, и список, набранный руками, разошёлся бы с ним на первой же чужой цели. В v1 так и
 * было — `renderer.wizard.tsx` дописывался в README отдельной веткой условия.
 *
 * @module reformer-builder/lib/codegen/emit/readme
 */

import type { EmitContext } from '../context';
import { appSnippet } from './snippet';

export function emitReadme(ctx: EmitContext): string {
  const { names, selectors, collected } = ctx;

  const methods = [
    '- `api.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` и успех).',
    ...(selectors.sections.length > 0
      ? [
          `- \`renderer.behavior.ts\` → раскомментируйте \`hideWhen\` для секций: ${selectors.sections
            .map((s) => `\`${s.selector}\``)
            .join(', ')}.`,
        ]
      : []),
    ...(collected.ds.functionLike.size > 0
      ? [
          `- \`data-sources.ts\` → подписи элементов массивов: ${[...collected.ds.functionLike]
            .map((x) => `\`${x}\``)
            .join(', ')}.`,
        ]
      : []),
    ...(collected.ds.optionLike.size > 0
      ? ['- `data-sources.ts` → замените синтетические опции реальными словарями или загрузчиками.']
      : []),
    '- `validation.ts` → допишите правила (сейчас — только `required`).',
    '- `form.behavior.ts` → вычисляемые поля и условное включение (по желанию).',
  ].join('\n');

  const list = (cls: 'derived' | 'user'): string =>
    ctx.files
      .filter((f) => f.cls === cls)
      .map((f) => `\`${f.path}\``)
      .join(', ');

  return `# ${names.title}

Сгенерированная форма (renderer-json). Рендерится и работает сразу на синтетических данных —
«доведение» сводится к реализации методов в ваших файлах.

## Встраивание

Скопируйте папку в \`src/pages/demo/${names.dir}/\` и зарегистрируйте форму:

\`\`\`tsx
${appSnippet(names)}
\`\`\`

## Файлы

Набор — канон раскладки renderer-json (\`@reformer/mcp\` docs/llms/06-form-directory-layout.md §1),
плоский: без \`lib/\` и \`components/steps/\`, запись реестра форм — в \`index.tsx\`.

- **Регенерируемые** (перезаписываются при повторной генерации): ${list('derived')}.
- **Ваши** (пишутся один раз, не затираются): ${list('user')}.

Схема лежит в \`renderer.schema.json\` — допустимый вариант канона («схема как данные»), выбранный
ради того, чтобы форма открывалась обратно в билдере. Цена — пути \`$model(...)\` не проверяются на
компиляции: опечатка внутри них останется до рантайма, и никто её не поймает. Нужна проверка —
переложите схему в \`renderer.schema.ts\` литералом \`defineJsonSchema<${names.TypeName}>({ ... })\`;
править её в билдере после этого будет нельзя.

Компоненты импортируются из \`${ctx.kit.kit.codegen.importSpecifier}\` — того кита, который был
активен при генерации (\`${ctx.kit.kit.label}\`).

## Методы для реализации

${methods}
`;
}
