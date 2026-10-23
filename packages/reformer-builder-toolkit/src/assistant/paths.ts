/**
 * Пути внутри каталога — для того, кто получил АДРЕС ресурса, а знать должен путь от корня модуля
 * формы: запись инструмента плагина, которая может попасть и в модуль, и мимо него.
 *
 * @module @reformer/builder-toolkit/assistant/paths
 */

/**
 * Путь от корня каталога или `null`, если путь вне его. Пути — от корня проекта, без ведущего
 * слэша; корень `''` — весь проект.
 */
export function pathWithin(path: string, root: string): string | null {
  const dir = root.replace(/\/+$/, '');
  if (dir === '') return path;
  return path.startsWith(`${dir}/`) ? path.slice(dir.length + 1) : null;
}
