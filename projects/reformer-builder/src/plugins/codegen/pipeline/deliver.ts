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
 * @module plugins/codegen/pipeline/deliver
 */

import { STEPS_DIR } from '@reformer/builder-stack-reformer/codegen';
import { isGenerated } from '@reformer/builder-toolkit';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { ModuleFile } from './generate';
import type { CodegenHost } from '../host';

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
  /**
   * Папки шагов на диске, которых в модуле больше нет (`steps/<slug>`).
   *
   * Шаг переименовали — у него новый слаг и новая папка, а старая осталась со всем, что человек
   * в ней правил. Удалять её доставка не вправе (там может лежать единственная копия
   * правленной валидации), переносить — не умеет: соответствие «старый слаг → новый» по одной
   * раскладке не восстановить. Поэтому только называет — удалять или переносить решает человек.
   */
  readonly orphans: readonly string[];
  /** Файлы под прежними именами (`renderer.*`), рядом с которыми появился новый. */
  readonly legacy: readonly LegacyFile[];
}

/**
 * Файл под прежним именем, замещённый новым.
 *
 * Старый файл остаётся на месте: доставка не удаляет ничего и никогда, а сгенерированный
 * `index.tsx` его больше не импортирует — то есть лишний файл безвреден, а удалённый
 * по ошибке — нет. Уведомление предлагает удалить его руками.
 */
export interface LegacyFile {
  /** Прежний путь внутри модуля — `renderer.behavior.ts`. */
  readonly path: string;
  /** Новый путь — `form.render.ts`. */
  readonly replacedBy: string;
  /**
   * Перенесено ли СОДЕРЖИМОЕ старого файла под новое имя.
   *
   * `true` — старый был авторским файлом, правленным руками: печать свежего текста выбросила
   * бы эти правки из модуля (новый `index.tsx` импортирует уже новое имя). `false` — старый
   * был нетронутым нашим, и под новым именем напечатан свежий текст.
   */
  readonly carried: boolean;
}

/** Необязательные сведения доставки. */
export interface DeliveryOptions {
  /**
   * Весь модуль, а не только доставляемое.
   *
   * Нужен поиску «сирот»: при записи одной цели (`types.ts` из контекстного меню) среди
   * доставляемых файлов шагов нет вовсе, и без полного состава КАЖДАЯ папка шага выглядела бы
   * брошенной. По умолчанию — сами доставляемые файлы.
   */
  readonly module?: readonly ModuleFile[];
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
  files: readonly ModuleFile[],
  options: DeliveryOptions = {}
): Promise<DeliveryResult> {
  return deliverInto(host, host.resolve(parent, dirName), files, options);
}

/** Папка шага, которой принадлежит путь (`steps/kontakty/validation.ts` → `kontakty`). */
function stepDirOf(path: string): string | null {
  const segments = path.split('/');
  return segments.length > 2 && segments[0] === STEPS_DIR ? (segments[1] ?? null) : null;
}

/**
 * Папки `steps/*` на диске, которых нет среди файлов модуля.
 *
 * Без листинга — пусто: сирота — подсказка, а не условие доставки, и порт без `list`
 * не обязан её давать.
 */
async function orphansOf(
  host: CodegenHost,
  dir: ResourceId,
  module: readonly ModuleFile[]
): Promise<readonly string[]> {
  if (host.list === undefined) return [];
  // Листинг, а не `exists` + листинг: отсутствующий каталог источник отдаёт пустым списком
  // или отказом, и оба ответа здесь значат одно — сирот нет.
  const entries = await host.list(host.resolve(dir, STEPS_DIR)).catch(() => []);
  const current = new Set(
    module.flatMap((file) => {
      const step = stepDirOf(file.path);
      return step === null ? [] : [step];
    })
  );
  return entries
    .filter((entry) => entry.kind === 'directory' && !current.has(entry.name))
    .map((entry) => `${STEPS_DIR}/${entry.name}`)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Файл под прежним именем, если новый ещё не появился.
 *
 * Ищется только при отсутствии нового: если форма уже переехала, старый файл — прошлое,
 * и повторно предлагать перенос на каждом прогоне значило бы переносить устаревшую копию
 * поверх актуальной.
 */
async function legacyOf(
  host: CodegenHost,
  dir: ResourceId,
  file: ModuleFile,
  id: ResourceId
): Promise<{ readonly path: string; readonly text: string } | null> {
  if (file.legacyPaths === undefined || file.legacyPaths.length === 0) return null;
  if (await host.exists(id)) return null;
  for (const path of file.legacyPaths) {
    const legacyId = host.resolve(dir, ...path.split('/'));
    if (!(await host.exists(legacyId))) continue;
    const text = await host.readText(legacyId);
    if (text !== null) return { path, text };
  }
  return null;
}

/**
 * Записать модуль В САМ каталог, без подпапки под ним.
 *
 * Второй вход, а не флаг у первого, потому что вопросы разные. {@link deliverModule} отвечает
 * «рядом с этой схемой заведи модуль формы» — имя каталога там ПРОИЗВОДНОЕ имени формы, и
 * решает его генерация. Здесь каталог НАЗВАН: его выбрал человек, щёлкнув по строке дерева,
 * и выводить внутри него ещё один по имени формы значило бы переспросить то, на что уже
 * ответили — и получить `credit-application/credit-application/`.
 *
 * Всё остальное общее и живёт здесь: право источника на запись, предикат перезаписи,
 * отправка записанного. Разница ровно в одном адресе.
 */
export async function deliverInto(
  host: CodegenHost,
  dir: ResourceId,
  files: readonly ModuleFile[],
  options: DeliveryOptions = {}
): Promise<DeliveryResult> {
  const capabilities = host.sourceOf(dir);
  if (capabilities === null || !capabilities.write) throw new SourceReadOnlyError();

  const written: string[] = [];
  const skipped: { path: string; reason: SkipReason }[] = [];
  const failed: { path: string; message: string }[] = [];
  const legacy: LegacyFile[] = [];
  const touched: ResourceId[] = [];

  for (const file of files) {
    const id = host.resolve(dir, ...file.path.split('/'));
    try {
      const previous = await legacyOf(host, dir, file, id);
      if (previous !== null) {
        // Переносится только авторский файл, правленный руками (маркер не сходится или его
        // нет вовсе): это работа человека, и под новым именем она обязана остаться в модуле.
        // Нетронутый наш файл переносить незачем — свежий текст и есть его новая версия.
        const carried = file.cls === 'user' && !isGenerated(previous.text);
        legacy.push({ path: previous.path, replacedBy: file.path, carried });
        await host.writeText(id, carried ? previous.text : file.content);
        written.push(file.path);
        touched.push(id);
        continue;
      }
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
  const orphans = await orphansOf(host, dir, options.module ?? files);

  return { dir, written, skipped, failed, saved, orphans, legacy };
}
