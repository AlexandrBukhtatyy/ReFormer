/**
 * Чтение файлов модуля формы из рабочей копии.
 *
 * Отделено от компиляции намеренно: чтение асинхронно и ходит в порт, компиляция синхронна
 * по входу и проверяется без него. Одна функция «прочитай и собери» сделала бы компиляцию
 * непроверяемой без рабочей области.
 *
 * ## Читается каталог МОДУЛЯ, а не каталог документа
 *
 * Документ формы лежит в папке `schema/` модуля, а код — в соседних папках ролей. Обход идёт от
 * корня модуля (`./module`, {@link locateModule}): от каталога документа набор состоял бы из
 * одной `schema/**`, и ни правила, ни поведение в превью не попали бы. У формы прежней плоской
 * раскладки корень модуля и каталог документа совпадают.
 *
 * Модуль документа со свободным именем (`forms/credit.schema.json`) кодоген заводит подкаталогом
 * рядом с документом (`forms/credit/`). Он ищется первым и ЛИСТИНГОМ каталога документа: адрес
 * ресурса плагину непрозрачен, а отсутствие подкаталога — обычное состояние (код не генерировали),
 * и узнать о нём надо без отказа чтения. Нет подкаталога — читается каталог документа, как раньше.
 *
 * ## Имена и адреса
 *
 * Компилятор знает файлы по ПУТЯМ ОТ КОРНЯ МОДУЛЯ: `validation/form.ts`, `behavior/index.ts`,
 * `schema/steps/kontakty/form.schema.json`. Путь, а не имя, потому что имена в папках ролей
 * повторяются (`index.ts` у `api/` и у `behavior/`), и линковщику нужно, чтобы `../api` из
 * `application/submit.ts` встретился ровно со своим файлом. Свод диагностик знает файлы по
 * РЕСУРСАМ. Отсюда вторая карта, «путь → ресурс», и {@link attributeProblems}: находка сборки,
 * названная путём файла, получает адрес, под которым её подчеркнёт редактор этого файла.
 *
 * ## Обход вглубь — ограниченный
 *
 * Глубина не больше {@link MAX_DEPTH}, без `node_modules`, `.ui_builder` и каталогов с точкой.
 * Самый глубокий файл модуля — схема шага разбитого визарда, `schema/steps/<шаг>/form.schema.json`
 * (три каталога под корнем), а каталог модуля, лежащий, скажем, в корне проекта, без ограничения
 * обошёл бы весь проект. Исполняются при этом только файлы ролей (см. `./module`) — остальное
 * подтягивает линковщик по импортам, поэтому чужой пример в подпапке прочитан, но не исполнен.
 *
 * @module plugins/reformer/render/compiling/read
 */

import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import type { PreviewProblem } from '@reformer/builder-plugin-api';
import type { PreviewHost } from '../host';
import { detachedModuleOf, locateModule, type ModuleLocation } from './module';
import { isExecutableSidecar } from './sources';

/** Сколько уровней каталогов обходится под корнем модуля. */
export const MAX_DEPTH = 3;

/** Каталоги, в которые обход не спускается никогда. */
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', '.ui_builder']);

export interface SidecarSources {
  /** Путь от корня модуля (`validation/form.ts`, `schema/steps/kontakty/form.schema.json`) → исходник. */
  readonly files: ReadonlyMap<string, string>;
  /** Путь от корня модуля → ресурс: адрес, под которым находка уйдёт в свод диагностик. */
  readonly resources: ReadonlyMap<string, ResourceId>;
  readonly problems: readonly PreviewProblem[];
  /**
   * Модуль прочитан из подкаталога документа со свободным именем — оттуда, куда его кладёт
   * кодоген. По этому признаку строится раскладка модуля (`moduleFilesFor`): документ в таком
   * модуле лежит в `schema/`, где бы ни лежал открытый.
   */
  readonly detached: boolean;
}

/** Файлы модуля и то, откуда они прочитаны. */
interface FoundFiles {
  readonly files: readonly Found[];
  readonly detached: boolean;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Файл модуля вместе с путём от его корня. */
interface Found {
  readonly path: string;
  readonly ref: ResourceRef;
}

/** Спускается ли обход в этот каталог. */
function descends(name: string): boolean {
  return !SKIPPED_DIRS.has(name) && !name.startsWith('.');
}

/**
 * Откуда читать модуль: подкаталог, в который кодоген кладёт модуль документа со свободным
 * именем, если он есть; иначе — место по прежнему правилу ({@link locateModule}).
 *
 * Отказ листинга каталога документа здесь не событие: подкаталог просто не найден, а сам отказ
 * назовёт обход — он начнётся с того же каталога либо с его родителя.
 */
async function locate(
  list: NonNullable<PreviewHost['list']>,
  parentOf: NonNullable<PreviewHost['parentOf']>,
  id: ResourceId,
  schemaPath: string
): Promise<ModuleLocation & { readonly detached: boolean }> {
  const detached = detachedModuleOf(schemaPath);
  if (detached !== null) {
    const beside = await list(parentOf(id)).catch((): readonly ResourceRef[] => []);
    const directory = beside.find(
      (entry) => entry.kind === 'directory' && entry.name === detached.directory
    );
    if (directory !== undefined) {
      return { root: directory.id, document: detached.document, detached: true };
    }
  }
  return { ...locateModule(parentOf, id, schemaPath), detached: false };
}

/**
 * Файлы модуля с путями от его корня.
 *
 * С листингом порта — рекурсивно от корня модуля (до {@link MAX_DEPTH}), без него — один уровень
 * соседей документа: этого хватает форме прежней плоской раскладки, а модуль с папками ролей без
 * листинга не читается вовсе. Отказ листинга КОРНЯ бросается (читать нечего), отказ вложенного
 * каталога — находка: без одной папки остальная форма собирается.
 */
async function filesOf(
  host: PreviewHost,
  id: ResourceId,
  schemaPath: string,
  problems: PreviewProblem[]
): Promise<FoundFiles> {
  const { list, parentOf } = host;
  if (list === undefined || parentOf === undefined) {
    const refs = await host.siblings(id);
    return {
      files: refs.filter((ref) => ref.kind === 'file').map((ref) => ({ path: ref.name, ref })),
      detached: false,
    };
  }

  const location = await locate(list, parentOf, id, schemaPath);
  const out: Found[] = [];
  const walk = async (dir: ResourceId, prefix: string, depth: number): Promise<void> => {
    let entries: readonly ResourceRef[];
    try {
      entries = await list(dir);
    } catch (error) {
      if (depth === 0) throw error;
      problems.push({ file: prefix, phase: 'resolve', message: describe(error), resource: dir });
      return;
    }
    const nested: Promise<void>[] = [];
    for (const entry of entries) {
      const path = `${prefix}${entry.name}`;
      if (entry.kind === 'file') {
        // Сам документ в набор не идёт: его превью берёт из модели редактора, а копия из файла
        // от неё отставала бы — буфер модельного документа перерисовывается из модели с задержкой.
        // У модуля документа со свободным именем так же отсекается копия документа в `schema/`.
        if (path !== location.document) out.push({ path, ref: entry });
      } else if (depth < MAX_DEPTH && descends(entry.name)) {
        nested.push(walk(entry.id, `${path}/`, depth + 1));
      }
    }
    await Promise.all(nested);
  };
  await walk(location.root, '', 0);
  // Порядок листинга не обещан, а порядок набора определяет порядок исполнения несвязанных
  // сайдкаров — сортируем, чтобы превью воспроизводилось между запусками.
  return {
    files: out.sort((a, b) => a.path.localeCompare(b.path)),
    detached: location.detached,
  };
}

/**
 * Читает файлы модуля формы.
 *
 * Отказ чтения ОДНОГО файла не отменяет остальных: битый или исчезнувший `schema/registry.ts` не
 * должен лишать превью работающей валидации. Отказ листинга корня отменяет всё — читать больше
 * нечего, и это единственная ошибка, после которой продолжать бессмысленно.
 *
 * @param schemaPath - Путь документа от корня проекта: по нему определяется корень модуля. По
 *   умолчанию берётся у открытого документа.
 */
export async function readSidecars(
  host: PreviewHost,
  id: ResourceId,
  schemaPath: string = host.documentOf(id)?.ref.path ?? ''
): Promise<SidecarSources> {
  const problems: PreviewProblem[] = [];
  let found;
  try {
    found = await filesOf(host, id, schemaPath, problems);
  } catch (error) {
    return {
      files: new Map(),
      resources: new Map(),
      problems: [{ file: '', phase: 'resolve', message: describe(error) }],
      detached: false,
    };
  }

  const selected = found.files.filter((entry) => isExecutableSidecar(entry.path));
  // Читаем параллельно, а раскладываем в порядке отбора: карта помнит порядок вставки.
  const texts = await Promise.all(
    selected.map(async ({ path, ref }) => {
      try {
        return await host.readText(ref.id);
      } catch (error) {
        problems.push({ file: path, phase: 'resolve', message: describe(error), resource: ref.id });
        return null;
      }
    })
  );

  const files = new Map<string, string>();
  const resources = new Map<string, ResourceId>();
  selected.forEach(({ path, ref }, index) => {
    resources.set(path, ref.id);
    const text = texts[index];
    if (text !== null && text !== undefined) files.set(path, text);
  });

  return { files, resources, problems, detached: found.detached };
}

/**
 * Приписывает находкам адрес файла по его пути от корня модуля.
 *
 * Находка с уже названным ресурсом остаётся как есть (фикстура и чтение адрес знают сами),
 * находка без файла — тоже: она относится к документу схемы, и решать это — не здесь.
 * Имя, которого среди сайдкаров нет (синтетическая точка входа), адреса не получает.
 */
export function attributeProblems(
  problems: readonly PreviewProblem[],
  resources: ReadonlyMap<string, ResourceId>
): PreviewProblem[] {
  return problems.map((problem) => {
    if (problem.resource !== undefined || problem.file === '') return problem;
    const resource = resources.get(problem.file);
    return resource === undefined ? problem : { ...problem, resource };
  });
}
