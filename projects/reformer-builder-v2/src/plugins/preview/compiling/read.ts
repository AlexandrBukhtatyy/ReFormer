/**
 * Чтение сайдкаров формы из рабочей копии.
 *
 * Отделено от компиляции намеренно: чтение асинхронно и ходит в порт, компиляция синхронна
 * по входу и проверяется без него. Одна функция «прочитай и собери» сделала бы компиляцию
 * непроверяемой без рабочей области.
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
      problems: [{ file: '', phase: 'resolve', message: describe(error) }],
    };
  }

  const files = new Map<string, string>();
  const problems: PreviewProblem[] = [];

  await Promise.all(
    selectSidecars(refs).map(async (ref) => {
      try {
        files.set(ref.name, await host.readText(ref.id));
      } catch (error) {
        problems.push({ file: ref.name, phase: 'resolve', message: describe(error) });
      }
    })
  );

  return { files, problems };
}
