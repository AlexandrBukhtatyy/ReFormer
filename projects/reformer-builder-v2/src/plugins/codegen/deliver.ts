/**
 * Доставка модуля формы в рабочую область.
 *
 * ## Чем это отличается от v1
 *
 * Там `deliver.ts` звал СВОЙ `showDirectoryPicker()` и писал файлы в выбранный каталог — мимо
 * рабочей копии и мимо источника. Здесь ни диалога, ни файловых ручек нет вовсе: адреса строит
 * порт, запись идёт через рабочую область, а куда именно — решает открытый источник. Отказ
 * источника от записи — законный ответ, а не исключение.
 *
 * ## Предикат перезаписи — маркер, а не факт существования
 *
 * Существующий авторский файл перезаписывается, только если он наш и его не правили. Иначе
 * пропускается, и пропуск ОБЯЗАН доехать до человека: в v1 это был молчаливый skip-if-exists,
 * из-за которого агент менял правила, отчитывался об этом, а `validation.ts` на диске оставался
 * прежним.
 *
 * @module plugins/codegen/deliver
 */

import { isGenerated } from '@/lib/codegen';
import type { ResourceId } from '@/sdk';
import type { ModuleFile } from './generate';
import type { CodegenHost } from './host';

/** Почему файл не записан. */
export type SkipReason =
  /** Авторский файл: перевыводить его не из чего, и правки в нём — работа человека. */
  | 'authored'
  /** Файл наш, но его правили руками: маркер не сходится с телом. */
  | 'edited';

export interface DeliveryResult {
  /** Каталог модуля в рабочей области. */
  readonly dir: ResourceId;
  readonly written: readonly string[];
  readonly skipped: readonly { readonly path: string; readonly reason: SkipReason }[];
  readonly failed: readonly { readonly path: string; readonly message: string }[];
  /**
   * Отправлено ли записанное в источник: `null` — композиция не дала `save`, и файлы остались
   * несохранённой рабочей копией.
   */
  readonly saved: boolean | null;
}

/** Источник не принимает запись — доставка не начинается. */
export class SourceReadOnlyError extends Error {
  constructor() {
    super('источник не принимает запись');
    this.name = 'SourceReadOnlyError';
  }
}

/**
 * Записать модуль в каталог `<parent>/<dir>`.
 *
 * Каталог не создаётся отдельным шагом: рабочая область адресует ресурсы путями, и запись
 * по адресу внутри несуществующего каталога создаёт его сама. Отдельный `mkdir` был бы вторым
 * способом сказать то же самое — и разошёлся бы с первым на источнике, у которого каталогов нет.
 */
export async function deliverModule(
  host: CodegenHost,
  parent: ResourceId,
  dirName: string,
  files: readonly ModuleFile[]
): Promise<DeliveryResult> {
  const capabilities = host.sourceOf(parent);
  if (capabilities === null || !capabilities.write) throw new SourceReadOnlyError();

  const dir = host.resolve(parent, dirName);
  const written: string[] = [];
  const skipped: { path: string; reason: SkipReason }[] = [];
  const failed: { path: string; message: string }[] = [];
  const touched: ResourceId[] = [];

  for (const file of files) {
    const id = host.resolve(dir, ...file.path.split('/'));
    try {
      if (file.cls === 'user' && (await host.exists(id))) {
        if (!file.regenerable) {
          skipped.push({ path: file.path, reason: 'authored' });
          continue;
        }
        const current = await host.readText(id);
        if (!isGenerated(current)) {
          skipped.push({ path: file.path, reason: 'edited' });
          continue;
        }
      }
      await host.writeText(id, file.content);
      written.push(file.path);
      touched.push(id);
    } catch (error) {
      failed.push({
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const saved = host.save === undefined || touched.length === 0 ? null : await host.save(touched);

  return { dir, written, skipped, failed, saved };
}
