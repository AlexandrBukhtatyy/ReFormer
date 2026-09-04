/**
 * Чтение сайдкаров формы из рабочей копии.
 *
 * Отделено от компиляции намеренно: чтение асинхронно и ходит в порт, компиляция синхронна
 * по входу и проверяется без него. Одна функция «прочитай и собери» сделала бы компиляцию
 * непроверяемой без рабочей области.
 *
 * ## Имена и адреса
 *
 * Компилятор знает файлы по ИМЕНАМ — каталог формы плоский, и имени достаточно, чтобы
 * `./model` встретился с `model.ts`. Свод диагностик знает файлы по РЕСУРСАМ. Отсюда вторая
 * карта, «имя → ресурс», и {@link attributeProblems}: находка сборки, названная именем файла,
 * получает адрес, под которым её подчеркнёт редактор этого файла.
 *
 * @module plugins/preview/compiling/read
 */

import type { ResourceId } from '@/sdk';
import type { PreviewProblem } from '../contract';
import type { PreviewHost } from '../host';
import { selectSidecars } from './sources';

export interface SidecarSources {
  /** Имя файла (не путь) → исходник. Каталог формы плоский, поэтому имени достаточно. */
  readonly files: ReadonlyMap<string, string>;
  /** Имя файла → его ресурс: адрес, под которым находка сборки уйдёт в свод диагностик. */
  readonly resources: ReadonlyMap<string, ResourceId>;
  readonly problems: readonly PreviewProblem[];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Читает сайдкары каталога формы.
 *
 * Отказ чтения ОДНОГО файла не отменяет остальных: битый или исчезнувший `registry.ts` не должен
 * лишать превью работающей валидации. Отказ листинга отменяет всё — читать больше нечего,
 * и это единственная ошибка, после которой продолжать бессмысленно.
 */
export async function readSidecars(host: PreviewHost, id: ResourceId): Promise<SidecarSources> {
  let refs;
  try {
    refs = await host.siblings(id);
  } catch (error) {
    return {
      files: new Map(),
      resources: new Map(),
      problems: [{ file: '', phase: 'resolve', message: describe(error) }],
    };
  }

  const files = new Map<string, string>();
  const resources = new Map<string, ResourceId>();
  const problems: PreviewProblem[] = [];

  await Promise.all(
    selectSidecars(refs).map(async (ref) => {
      resources.set(ref.name, ref.id);
      try {
        files.set(ref.name, await host.readText(ref.id));
      } catch (error) {
        problems.push({
          file: ref.name,
          phase: 'resolve',
          message: describe(error),
          resource: ref.id,
        });
      }
    })
  );

  return { files, resources, problems };
}

/**
 * Приписывает находкам адрес файла по его имени.
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
