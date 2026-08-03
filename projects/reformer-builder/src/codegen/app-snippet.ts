/**
 * Сниппет для ручной вставки примера в роутинг react-playground (`App.tsx`). Без автопатча —
 * показывается в модалке и дублируется в `README.md`.
 *
 * @module reformer-builder/codegen/app-snippet
 */

import type { Names } from './naming';

export function appSnippet(n: Names): string {
  return [
    '// 1) Импорт (рядом с другими примерами):',
    `import ${n.pageComponent} from './pages/examples/${n.dir}';`,
    '',
    '// 2) Пункт в списке примеров (exampleGroups[].items или аналог):',
    `{ id: '${n.exampleId}', path: '${n.routePath}', title: '${n.title}', description: '' },`,
    '',
    '// 3) Маршрут внутри <Routes>:',
    `<Route path="${n.routePath}" element={<${n.pageComponent} />} />`,
  ].join('\n');
}
