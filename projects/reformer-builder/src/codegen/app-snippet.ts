/**
 * Сниппет для ручной вставки примера в роутинг react-playground (`App.tsx`). Без автопатча —
 * показывается в модалке и дублируется в `README.md`.
 *
 * @module reformer-builder/codegen/app-snippet
 */

import type { Names } from './naming';

export function appSnippet(n: Names): string {
  return [
    '// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.',
    '// Всё остальное (схема, реестр компонентов, модель, поведение) описано в entry.ts,',
    '// который билдер сгенерировал вместе с примером и перегенерирует при изменениях.',
    "import { getFormRegistry } from '@reformer/form-registry';",
    `import { ${n.entryConst} } from './pages/examples/${n.dir}/entry';`,
    '',
    `getFormRegistry().register(${n.entryConst});`,
    '',
    '// Дальше форму можно смонтировать где угодно, зная только её id:',
    `//   <FormOutlet id="${n.exampleId}" />`,
    '',
    '// ── Способ 2: как обычную страницу, если реестр не используется.',
    `import ${n.pageComponent} from './pages/examples/${n.dir}';`,
    '',
    '// пункт в списке примеров:',
    `{ id: '${n.exampleId}', path: '${n.routePath}', title: '${n.title}', description: '' },`,
    '',
    '// маршрут внутри <Routes>:',
    `<Route path="${n.routePath}" element={<${n.pageComponent} />} />`,
  ].join('\n');
}
