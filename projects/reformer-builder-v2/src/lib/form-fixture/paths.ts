/**
 * Где лежит фикстура формы: `fixture.ts` в каталоге самой формы.
 *
 * ## Почему рядом, а не в отдельном дереве
 *
 * Так решил владелец проекта: фикстура — авторский артефакт этой формы, и искать её на другом
 * конце дерева, правя схему, неудобно. Прежняя раскладка (`_generated/reformer/<зеркало пути>`)
 * защищала контракт каталога модуля (`06-form-directory-layout`, где фикстуры нет) — теперь
 * в каталоге формы файлов на один больше, чем перечисляет контракт, и проверка раскладки
 * (`validate_form kind="layout"`) о нём скажет.
 *
 * ## Что при этом обязано соблюдаться
 *
 * Фикстура НЕ сайдкар: она подставляет модули формы (`./api`), и попади она в один граф
 * с сайдкарами — `api.ts` исполнился бы дважды, а форма получила бы два разных объекта под
 * одним именем (см. `plugins/preview/compiling/fixture`). Разделение графов держится на имени
 * файла: отбор сайдкаров исключает {@link FIXTURE_FILE} явно ({@link isFixturePath}).
 *
 * @module lib/form-fixture/paths
 */

/** Имя файла фикстуры внутри каталога формы. */
export const FIXTURE_FILE = 'fixture.ts';

/**
 * Нормализация пути ресурса: разделители к `/`, схлопывание `.` и `..`.
 *
 * Своя, а не платформенная: `lib/` не имеет права импортировать `host/` (проверяется линтером),
 * и это не формальность — раскладка фикстур обязана проверяться там же, где чистые функции,
 * то есть без рабочей области и без OPFS.
 *
 * Возвращает `null`, если путь вылез за корень проекта: `../../secrets` в адресе документа
 * означает отказ, а не промах.
 */
export function normalizeResourcePath(path: string): string | null {
  const out: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

/** Каталог пути. Для файла в корне — пустая строка. */
function dirOf(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}

/**
 * Каталог фикстуры для документа схемы — он же каталог формы.
 *
 * Принимает путь САМОГО документа (`src/forms/credit/schema.json`), а не его каталога: вызывающий
 * знает адрес документа, а арифметику пути пусть делает тот, кто знает раскладку. Форма в корне
 * проекта даёт пустую строку — это адрес корня, а не промах, поэтому склейку с именем файла
 * делает {@link joinFixtureDir}, а не конкатенация на стороне вызывающего.
 *
 * @returns `null`, если путь не нормализуется.
 */
export function fixtureDirOf(schemaPath: string): string | null {
  const normalized = normalizeResourcePath(schemaPath);
  if (normalized === null || normalized === '') return null;
  return dirOf(normalized);
}

/**
 * Склейка каталога фикстур с именем файла.
 *
 * Отдельной функцией, потому что каталог бывает пустым (форма в корне проекта), а `${dir}/${name}`
 * дал бы тогда ведущий слэш — адрес от корня ИСТОЧНИКА, то есть запись не туда.
 */
export function joinFixtureDir(dir: string, fileName: string): string {
  return dir === '' ? fileName : `${dir}/${fileName}`;
}

/**
 * Путь файла фикстуры для документа схемы.
 *
 * `src/forms/credit/schema.json` → `src/forms/credit/fixture.ts`.
 */
export function fixturePathOf(schemaPath: string): string | null {
  const dir = fixtureDirOf(schemaPath);
  return dir === null ? null : joinFixtureDir(dir, FIXTURE_FILE);
}

/**
 * Фикстура ли это — по имени файла, а не по месту.
 *
 * Нужен тому, кто отбирает файлы для исполнения: граф фикстуры и граф формы собираются врозь,
 * и перепутать их источники нельзя. С тех пор как фикстура лежит В каталоге формы, это
 * единственное, что их разделяет: отбор сайдкаров обязан спрашивать здесь.
 */
export function isFixturePath(path: string): boolean {
  const normalized = normalizeResourcePath(path);
  if (normalized === null) return false;
  const dir = dirOf(normalized);
  return normalized.slice(dir === '' ? 0 : dir.length + 1) === FIXTURE_FILE;
}
