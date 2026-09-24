/**
 * Чтение сайдкаров формы из рабочей копии.
 *
 * Отделено от компиляции намеренно: чтение асинхронно и ходит в порт, компиляция синхронна
 * по входу и проверяется без него. Одна функция «прочитай и собери» сделала бы компиляцию
 * непроверяемой без рабочей области.
 *
 * ## Имена и адреса
 *
 * Компилятор знает файлы по ПУТЯМ ОТ КАТАЛОГА ФОРМЫ: `model.ts` в корне,
 * `steps/kontakty/validation.ts` в папке шага визарда. Путь, а не имя, потому что имена в
 * папках шагов повторяются (у каждого шага свой `validation.ts`), и линковщику нужно, чтобы
 * `./kontakty/validation` из `steps/index.ts` встретился ровно со своим файлом. Свод
 * диагностик знает файлы по РЕСУРСАМ. Отсюда вторая карта, «путь → ресурс», и
 * {@link attributeProblems}: находка сборки, названная путём файла, получает адрес, под которым
 * её подчеркнёт редактор этого файла.
 *
 * ## Обход вглубь — ограниченный
 *
 * Глубина не больше {@link MAX_DEPTH}, без `node_modules`, `.ui_builder` и каталогов с точкой:
 * визарду нужна ровно `steps/<шаг>/` (глубина 2), а каталог схемы, лежащий, скажем, в корне
 * проекта, без ограничения обошёл бы весь проект. Исполняются при этом только корневые файлы
 * (см. `./entry`) — вложенные подтягивает линковщик по импортам, поэтому чужой пример в
 * подпапке прочитан, но не исполнен.
 *
 * @module plugins/preview-runtime/compiling/read
 */

import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import type { PreviewProblem } from '@reformer/builder-plugin-api';
import type { PreviewHost } from '../host';
import { isExecutableSidecar } from './sources';

/** Сколько уровней каталогов обходится под каталогом формы. */
export const MAX_DEPTH = 3;

/** Каталоги, в которые обход не спускается никогда. */
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', '.ui_builder']);

export interface SidecarSources {
  /** Путь от каталога формы (`validation.ts`, `steps/kontakty/validation.ts`) → исходник. */
  readonly files: ReadonlyMap<string, string>;
  /** Путь от каталога формы → ресурс: адрес, под которым находка уйдёт в свод диагностик. */
  readonly resources: ReadonlyMap<string, ResourceId>;
  readonly problems: readonly PreviewProblem[];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Файл каталога формы вместе с путём от него. */
interface Found {
  readonly path: string;
  readonly ref: ResourceRef;
}

/** Спускается ли обход в этот каталог. */
function descends(name: string): boolean {
  return !SKIPPED_DIRS.has(name) && !name.startsWith('.');
}

/**
 * Файлы каталога формы с путями от него.
 *
 * С листингом порта — рекурсивно (до {@link MAX_DEPTH}), без него — один уровень соседей, как
 * раньше. Отказ листинга КОРНЯ бросается (читать нечего), отказ вложенного каталога — находка:
 * без папки одного шага остальная форма собирается.
 */
async function filesOf(
  host: PreviewHost,
  id: ResourceId,
  problems: PreviewProblem[]
): Promise<readonly Found[]> {
  const { list, parentOf } = host;
  if (list === undefined || parentOf === undefined) {
    const refs = await host.siblings(id);
    return refs.filter((ref) => ref.kind === 'file').map((ref) => ({ path: ref.name, ref }));
  }

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
      if (entry.kind === 'file') out.push({ path, ref: entry });
      else if (depth < MAX_DEPTH && descends(entry.name)) {
        nested.push(walk(entry.id, `${path}/`, depth + 1));
      }
    }
    await Promise.all(nested);
  };
  await walk(parentOf(id), '', 0);
  // Порядок листинга не обещан, а порядок набора определяет порядок исполнения несвязанных
  // сайдкаров — сортируем, чтобы превью воспроизводилось между запусками.
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Читает сайдкары каталога формы.
 *
 * Отказ чтения ОДНОГО файла не отменяет остальных: битый или исчезнувший `registry.ts` не должен
 * лишать превью работающей валидации. Отказ листинга корня отменяет всё — читать больше нечего,
 * и это единственная ошибка, после которой продолжать бессмысленно.
 */
export async function readSidecars(host: PreviewHost, id: ResourceId): Promise<SidecarSources> {
  const problems: PreviewProblem[] = [];
  let found;
  try {
    found = await filesOf(host, id, problems);
  } catch (error) {
    return {
      files: new Map(),
      resources: new Map(),
      problems: [{ file: '', phase: 'resolve', message: describe(error) }],
    };
  }

  const selected = found.filter((entry) => isExecutableSidecar(entry.path));
  // Читаем параллельно, а раскладываем в порядке отбора: карта помнит порядок вставки, и от него
  // зависит порядок `require` в энтри.
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

  return { files, resources, problems };
}

/**
 * Приписывает находкам адрес файла по его пути от каталога формы.
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
