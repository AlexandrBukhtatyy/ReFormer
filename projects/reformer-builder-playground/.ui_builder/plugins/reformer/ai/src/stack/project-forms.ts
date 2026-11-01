/**
 * Формы проекта и форма файла — для выбора формы хода.
 *
 * Ход ассистента раньше знал только форму активной вкладки. Открыт файл правил, шаг визарда,
 * `create.ts` — и ход уходил в создание новой формы. Здесь два ответа, которых для этого не
 * хватало: какой форме принадлежит файл модуля ({@link formPathOf}) и какие формы есть в проекте
 * ({@link projectFormPaths}).
 *
 * Только пути от корня проекта и три вопроса к файлам — `list`, `exists`, `read`: адреса знает
 * рабочая область (`./workspace`), а правила раскладки — `core/codegen/layout`. Поэтому функции
 * проверяются на списке путей, без источника.
 *
 * @module plugins/reformer/ai/stack/project-forms
 */

import {
  LEGACY_SCHEMA_FILE,
  SCHEMA_DIR,
  SCHEMA_FILE,
  STEP_SCHEMAS_DIR,
  isCanonicalSchemaName,
} from '../../../core/codegen/layout';

/** Файлы проекта в объёме поиска форм; пути от корня проекта, корень — `''`. */
export interface ProjectFilesView {
  /** Один уровень каталога; нет каталога — пусто. */
  list(dir: string): Promise<readonly { readonly name: string; readonly kind: string }[]>;
  exists(path: string): Promise<boolean>;
  /** Текст файла; `null` — не прочитан. */
  read(path: string): Promise<string | null>;
}

/**
 * На сколько каталогов вверх искать документ формы от файла. Самый глубокий файл модуля — шаг
 * визарда: `schema/steps/<шаг>/form.schema.json`, от него до корня модуля — четыре уровня.
 */
const OWNER_DEPTH = 4;

/** Глубина обхода проекта: `forms/<модуль>/schema/…` и формы во вложенных папках приложения. */
const SCAN_DEPTH = 5;

/**
 * Предел форм в списке. Список уходит человеку карточкой и в панель выбора; сотня форм — уже не
 * выбор глазами, а поиск, и обход такого проекта стоил бы заметного времени.
 */
export const MAX_PROJECT_FORMS = 50;

/** Предел просмотренных каталогов — страховка обхода от огромного дерева. */
const MAX_SCANNED_DIRS = 400;

/** Каталоги, где форм не бывает, а файлов много. */
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', 'build', 'coverage']);

const parentOf = (path: string): string => {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
};
const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const join = (dir: string, name: string): string => (dir === '' ? name : `${dir}/${name}`);

/** Каталог шага разбитого визарда (`…/steps/<шаг>`): его `form.schema.json` — шаг, не форма. */
const isStepDir = (dir: string): boolean => baseOf(parentOf(dir)) === STEP_SCHEMAS_DIR;

/** Документ формы в каталоге модуля: вложенная раскладка, затем плоская; имена — новое и прежнее. */
function ownerCandidates(dir: string): readonly string[] {
  const nested = [SCHEMA_FILE, LEGACY_SCHEMA_FILE].map((name) => join(join(dir, SCHEMA_DIR), name));
  if (isStepDir(dir)) return nested;
  return [...nested, ...[SCHEMA_FILE, LEGACY_SCHEMA_FILE].map((name) => join(dir, name))];
}

/**
 * Документ формы, которой принадлежит файл: файл правил, шага, кода, страницы → корень схемы
 * модуля. `null` — файл ни одной форме не принадлежит.
 *
 * Подъём от каталога файла: на каждом уровне — `schema/form.schema.json` и `form.schema.json`
 * (плоская раскладка). Каталог шага плоской проверки не проходит: его `form.schema.json` — сам
 * шаг, и файл шага обязан вести к корню формы, а не к себе.
 */
export async function formPathOf(
  path: string,
  view: Pick<ProjectFilesView, 'exists'>
): Promise<string | null> {
  const own = baseOf(path);
  if (isCanonicalSchemaName(own) && !isStepDir(parentOf(path))) return path;
  let dir = parentOf(path);
  for (let level = 0; level < OWNER_DEPTH; level++) {
    for (const candidate of ownerCandidates(dir)) {
      if (await view.exists(candidate)) return candidate;
    }
    if (dir === '') break;
    dir = parentOf(dir);
  }
  return null;
}

/**
 * Документы форм проекта, по пути: обход от корня, глубина {@link SCAN_DEPTH}, не больше
 * {@link MAX_PROJECT_FORMS}.
 *
 * Кандидат — файл с каноническим именем не в каталоге шага и документ со свободным именем
 * (`credit.schema.json`, `loan.form.json`). Каждый проверяется `recognizes` — тем же разбором, по
 * которому ход берётся за документ: JSON-схема пакета с похожим именем формой не станет. В модуль
 * с найденной формой обход не спускается: внутри модуля — его файлы, а не другие формы.
 * Скрытые каталоги и {@link SKIPPED_DIRS} пропускаются.
 */
export async function projectFormPaths(
  view: ProjectFilesView,
  recognizes: (text: string) => boolean
): Promise<readonly string[]> {
  const found: string[] = [];
  const accept = async (path: string): Promise<boolean> => {
    const text = await view.read(path);
    if (text === null || !recognizes(text)) return false;
    found.push(path);
    return true;
  };

  let level: readonly string[] = [''];
  let scanned = 0;
  for (let depth = 0; depth <= SCAN_DEPTH && level.length > 0; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      if (found.length >= MAX_PROJECT_FORMS || scanned >= MAX_SCANNED_DIRS) break;
      scanned += 1;
      const entries = await view.list(dir);
      const files = entries.filter((entry) => entry.kind !== 'directory').map((e) => e.name);
      const dirs = entries.filter((entry) => entry.kind === 'directory').map((e) => e.name);

      let module = false;
      if (dirs.includes(SCHEMA_DIR)) {
        for (const name of [SCHEMA_FILE, LEGACY_SCHEMA_FILE]) {
          const candidate = join(join(dir, SCHEMA_DIR), name);
          if ((await view.exists(candidate)) && (await accept(candidate))) {
            module = true;
            break;
          }
        }
      }
      if (!module && !isStepDir(dir)) {
        for (const name of [SCHEMA_FILE, LEGACY_SCHEMA_FILE]) {
          if (files.includes(name) && (await accept(join(dir, name)))) {
            module = true;
            break;
          }
        }
      }
      if (module) continue;
      if (!isStepDir(dir)) {
        for (const name of files) {
          if (found.length >= MAX_PROJECT_FORMS) break;
          if (isCanonicalSchemaName(name)) continue;
          if (name.endsWith('.schema.json') || name.endsWith('.form.json')) {
            await accept(join(dir, name));
          }
        }
      }
      for (const name of dirs) {
        if (name.startsWith('.') || SKIPPED_DIRS.has(name)) continue;
        next.push(join(dir, name));
      }
    }
    level = next;
  }
  return [...found].sort();
}
