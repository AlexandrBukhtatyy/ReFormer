/**
 * Правила markdown, проверяемые без браузера: распознавание файла, пути ссылок, язык блока.
 *
 * Отделено от отрисовки по той же причине, что везде в v2: окружение тестов — `node`, а
 * «куда ведёт `../img/logo.png` из файла в `docs/`» и «что считать markdown» — это решения,
 * а не разметка. Ошибка в них выглядит как пропавшая картинка, и находить её щелчками мыши
 * дороже, чем тестом.
 *
 * @module plugins/editor-markdown/render/markdown
 */

/**
 * Расширения, которые показываем как markdown.
 *
 * `.mdx` в списке намеренно: он рендерится КАК ОБЫЧНЫЙ markdown, потому что JSX внутри
 * предпросмотра не исполняется вовсе. Показать текст без выражений честнее, чем показать
 * файл сырым только из-за буквы «x» в расширении.
 */
const MARKDOWN_EXTENSIONS: readonly string[] = ['.md', '.mdx', '.markdown', '.mdown', '.mkd'];

/** Медиатип, который платформа проставляет markdown-файлам. */
export const MARKDOWN_MEDIA_TYPE = 'text/markdown';

/**
 * Markdown ли это — по медиатипу либо по имени.
 *
 * Две проверки, а не одна: медиатип приходит из таблицы расширений платформы и покрывает
 * `.md`/`.markdown`, но `.mdx` и `.mkd` в ней могут отсутствовать, а показывать их сырыми
 * незачем. Имя здесь — не запасной путь на случай ошибки, а дополнение к таблице.
 */
export function isMarkdown(name: string, mediaType?: string): boolean {
  if (mediaType === MARKDOWN_MEDIA_TYPE) return true;
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Внешний ли URL — такие отдаются браузеру как есть.
 *
 * Схема (`https:`, `data:`, `mailto:`), протокол-относительный `//host/x` и чистый якорь
 * `#heading`: ни один из них не адресует файл проекта, и пытаться прочитать его с диска
 * значило бы искать файл с именем «https».
 */
export function isExternalUrl(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//') || src.startsWith('#');
}

/**
 * Относительный путь из markdown → путь от корня источника.
 *
 * `baseDir` — каталог самого документа (`''` для файла в корне). `null` означает «читать
 * нечего»: путь пуст, ведёт на каталог или выходит за пределы проекта. Последнее — не
 * придирка: оболочка держит доступ к выбранному каталогу, и `../../../etc/passwd` из чужого
 * README не должен превращаться в чтение за его границей.
 *
 * Запрос и якорь отбрасываются: к файловой системе они не относятся.
 */
export function resolveRelativePath(baseDir: string, src: string): string | null {
  const clean = src.split(/[?#]/)[0];
  if (clean === undefined || clean === '' || clean.endsWith('/')) return null;

  // Ведущий `/` в markdown принято читать как «от корня проекта», а не от корня диска.
  const segments = clean.startsWith('/')
    ? clean.slice(1).split('/')
    : [...baseDir.split('/'), ...clean.split('/')];

  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (stack.length === 0) return null; // выход за корень источника
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return stack.length === 0 ? null : stack.join('/');
}

/** Каталог документа по его пути: `docs/plan.md` → `docs`, `README.md` → ``. */
export function directoryOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

/** Ссылка, разложенная на путь и якорь: `../a.md#intro` → `{ path: '../a.md', hash: 'intro' }`. */
export function splitHash(href: string): { readonly path: string; readonly hash: string | null } {
  const at = href.indexOf('#');
  if (at === -1) return { path: href, hash: null };
  const hash = decodeURIComponent(href.slice(at + 1));
  return { path: href.slice(0, at), hash: hash === '' ? null : hash };
}

/**
 * Псевдонимы языков info-строки → имена грамматик подсветки.
 *
 * Список короткий намеренно: он покрывает то, что встречается в документации проекта форм,
 * а незнакомый язык — это не ошибка, а блок без подсветки. Полный набор грамматик стоил бы
 * сотен килобайт в главном чанке ради языков, которых в этих файлах не бывает.
 */
const LANGUAGE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  typescript: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  javascript: 'javascript',
  node: 'javascript',
  json: 'json',
  json5: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  vue: 'xml',
  svg: 'xml',
  xml: 'xml',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',
  console: 'bash',
  shellscript: 'bash',
  py: 'python',
  python: 'python',
  sql: 'sql',
  toml: 'ini',
  ini: 'ini',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  go: 'go',
  rs: 'rust',
  rust: 'rust',
  java: 'java',
  kt: 'kotlin',
  kotlin: 'kotlin',
  php: 'php',
  rb: 'ruby',
  ruby: 'ruby',
  cs: 'csharp',
  csharp: 'csharp',
  graphql: 'graphql',
  gql: 'graphql',
  diff: 'diff',
  patch: 'diff',
});

/**
 * Имя грамматики по info-строке блока или по классу `language-*`.
 *
 * `null` — язык не указан либо незнаком: такой блок рисуется моноширинным, без подсветки.
 * Учитываются хвост info-строки (```` ```ts title="a.ts" ````) и фигурные скобки R-Markdown
 * (```` ```{r} ````) — оба встречаются в реальных README.
 */
export function fenceLanguage(info: string | null | undefined): string | null {
  if (info === null || info === undefined || info === '') return null;
  const token = info.trim().split(/[\s,]+/)[0] ?? '';
  const bare = token.replace(/^language-/i, '').replace(/^\{|\}$/g, '');
  if (bare === '') return null;
  return LANGUAGE_ALIASES[bare.toLowerCase()] ?? null;
}

/** Язык из списка классов `<code>`: react-markdown кладёт туда `language-<id>`. */
export function fenceLanguageFromClass(className: string | null | undefined): string | null {
  if (className === null || className === undefined) return null;
  const match = className.split(/\s+/).find((name) => name.toLowerCase().startsWith('language-'));
  return fenceLanguage(match);
}
