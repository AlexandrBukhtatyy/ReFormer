/**
 * Язык fenced-блока markdown → `languageId` Monaco (для `monaco.editor.colorize`).
 *
 * Отдельно от `languageOf()` в `app/save-actions`: та работает по расширению ФАЙЛА, а здесь на входе
 * info-строка блока — причём в том виде, в каком её отдаёт react-markdown, то есть классом
 * `language-ts` на `<code>`. Учитываем и «хвост» info-строки (` ```ts title="a.ts" `), и
 * фигурные скобки (` ```{r} ` в R-Markdown).
 *
 * @module reformer-builder/canvas/markdown/fence-language
 */

/** Псевдонимы языков из info-строк → `languageId` грамматик, зарегистрированных в `monaco-languages`. */
const ALIASES: Record<string, string> = {
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
  html: 'html',
  htm: 'html',
  vue: 'html',
  svg: 'xml',
  xml: 'xml',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
  console: 'shell',
  shellscript: 'shell',
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
  diff: 'plaintext',
  patch: 'plaintext',
  text: 'plaintext',
  txt: 'plaintext',
  plaintext: 'plaintext',
};

/**
 * `languageId` Monaco по info-строке блока или по классу `language-*` от react-markdown.
 * `null` — язык не указан или незнаком: такой блок рисуем без подсветки.
 */
export function fenceLanguage(info: string | null | undefined): string | null {
  if (!info) return null;
  // Первый токен: `ts title="a.ts"` → `ts`; className react-markdown приходит как `language-ts`.
  const token = info.trim().split(/[\s,]+/)[0] ?? '';
  const bare = token.replace(/^language-/i, '').replace(/^\{|\}$/g, '');
  if (!bare) return null;
  return ALIASES[bare.toLowerCase()] ?? null;
}

/** Язык из списка классов `<code>` (react-markdown кладёт туда `language-<id>`). */
export function fenceLanguageFromClass(className: string | null | undefined): string | null {
  if (!className) return null;
  const match = className.split(/\s+/).find((c) => c.toLowerCase().startsWith('language-'));
  return fenceLanguage(match);
}
