/**
 * Резолв ссылок и картинок предпросмотра к файлам открытого проекта.
 *
 * В markdown пути пишутся относительно самого файла (`./img.png`, `../docs/plan.md`), а File System
 * Access API умеет ходить только от корневого handle проекта — значит путь надо привести к
 * проектному (тому же виду, что `TreeEntry.path`) и не дать ему выйти за корень.
 *
 * Здесь чистая часть (нормализация путей); чтение файла и blob-URL — в `MarkdownPreview`.
 *
 * @module reformer-builder/canvas/markdown/resolve-asset
 */

/**
 * Внешний ли URL — такие отдаём браузеру как есть: схема (`https:`, `data:`, `blob:`, `mailto:`),
 * протокол-относительный (`//host/x`) или чистый якорь (`#heading`).
 */
export function isExternalUrl(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//') || src.startsWith('#');
}

/**
 * Относительный путь из markdown → путь от корня проекта.
 *
 * `baseDir` — каталог md-файла (`''` для файла в корне). Возвращает `null`, если путь ведёт за
 * пределы проекта (`../..` из корня) или пуст — такую ссылку показываем неактивной, а не пытаемся
 * читать что-то за границей выданного пользователем каталога.
 *
 * Query и hash отбрасываются: до файловой системы они не относятся (`#anchor` обрабатывается
 * отдельно, до вызова).
 */
export function resolveRelativePath(baseDir: string, src: string): string | null {
  const clean = src.split(/[?#]/)[0];
  // Пусто или ссылка на каталог (`./`, `../img/`) — читать нечего.
  if (!clean || clean.endsWith('/')) return null;

  // Ведущий `/` в markdown принято читать как «от корня проекта», а не от корня диска.
  const segments = clean.startsWith('/')
    ? clean.slice(1).split('/')
    : [...baseDir.split('/'), ...clean.split('/')];

  const stack: string[] = [];
  for (const seg of segments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (!stack.length) return null; // выход за корень проекта
      stack.pop();
      continue;
    }
    stack.push(seg);
  }
  return stack.length ? stack.join('/') : null;
}

/** Разложить ссылку на путь и якорь: `../a.md#intro` → `{ path: '../a.md', hash: 'intro' }`. */
export function splitHash(href: string): { path: string; hash: string | null } {
  const i = href.indexOf('#');
  if (i === -1) return { path: href, hash: null };
  return { path: href.slice(0, i), hash: decodeURIComponent(href.slice(i + 1)) || null };
}
