/**
 * Сниппет для ручной регистрации формы в приложении-хосте. Без автопатча: показывается после
 * генерации и дублируется в `README.md`.
 *
 * @module reformer-builder/lib/codegen/emit/snippet
 */

import type { Names } from '../naming';

export function appSnippet(n: Names): string {
  return [
    '// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.',
    '// Всё остальное (схема, реестр компонентов, модель, поведение) описано записью реестра',
    `// в index.tsx (${n.entryConst}) — билдер перегенерирует её при изменениях.`,
    "import { getFormRegistry } from '@reformer/form-registry';",
    `import { ${n.entryConst} } from './pages/demo/${n.dir}';`,
    '',
    `getFormRegistry().register(${n.entryConst});`,
    '',
    '// Дальше форму можно смонтировать где угодно, зная только её id:',
    `//   <FormOutlet id="${n.exampleId}" />`,
    '',
    '// ── Способ 2: как обычную страницу, если реестр не используется.',
    `import ${n.pageComponent} from './pages/demo/${n.dir}';`,
    '',
    '// пункт в списке примеров:',
    `{ id: '${n.exampleId}', path: '${n.routePath}', title: '${n.title}', description: '' },`,
    '',
    '// маршрут внутри <Routes>:',
    `<Route path="${n.routePath}" element={<${n.pageComponent} />} />`,
  ].join('\n');
}
