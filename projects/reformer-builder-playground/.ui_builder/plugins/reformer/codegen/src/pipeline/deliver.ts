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
 * из-за которого агент менял правила, отчитывался об этом, а файл валидации на диске оставался
 * прежним.
 *
 * ## Доставка ничего не удаляет
 *
 * Единственный перенос — **прежнее имя файла** (`legacyPaths` цели): файл под новым именем
 * печатается заново, правленный руками авторский — переносится, старый остаётся. Всё остальное,
 * чего в модуле нет, знает стек: до записи он вправе отказать (`CodegenModule.check` — модуль на
 * диске напечатан другим китом), после — назвать заметками (`CodegenModule.inspect` — сироты
 * шагов, файлы прежней раскладки). Удалять их доставка не вправе: там может лежать единственная
 * копия правленного файла.
 *
 * @module plugins/reformer/codegen/pipeline/deliver
 */

import { isGenerated } from '@reformer/builder-toolkit';
import type {
  CodegenFile,
  CodegenModule,
  CodegenNote,
  CodegenRefusal,
  ResourceId,
} from '@reformer/builder-plugin-api';
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
  /** Файлы под прежним именем, рядом с которыми появились новые. */
  readonly legacy: readonly LegacyFile[];
  /**
   * Заметки стека о модуле на диске после записи: файлы, которых в модуле нет (сироты шагов,
   * файлы прежней раскладки). Тексты — ключами словаря стека.
   */
  readonly notes: readonly CodegenNote[];
}

/**
 * Файл под прежним именем, замещённый новым.
 *
 * Старый файл остаётся на месте: доставка не удаляет ничего и никогда, а сгенерированный
 * модуль его больше не импортирует — то есть лишний файл безвреден, а удалённый по ошибке — нет.
 * Уведомление предлагает удалить его руками.
 */
export interface LegacyFile {
  /** Прежний путь внутри модуля — `renderer.schema.json`. */
  readonly path: string;
  /** Новый путь — `form.schema.json`. */
  readonly replacedBy: string;
  /**
   * Перенесено ли СОДЕРЖИМОЕ старого файла под новое имя.
   *
   * `true` — старый был авторским файлом, правленным руками: печать свежего текста выбросила
   * бы эти правки из модуля. `false` — под новым именем напечатан свежий текст (так всегда у
   * производного файла, каким является документ формы).
   */
  readonly carried: boolean;
}

/** Что доставке знать о модуле сверх файлов: проверку стека до записи и его заметки после. */
export type DeliveryOptions = Pick<CodegenModule, 'check' | 'inspect'>;

/** Источник не принимает запись — доставка не начинается. */
export class SourceReadOnlyError extends Error {
  constructor() {
    super('источник не принимает запись');
    this.name = 'SourceReadOnlyError';
  }
}

/**
 * Стек отказал записи (`CodegenModule.check`) — доставка не начинается.
 *
 * Отказ честнее частичной записи: модуль, переписанный наполовину под другой кит, не собрался бы.
 */
export class DeliveryRefusedError extends Error {
  constructor(readonly refusal: CodegenRefusal) {
    super(refusal.refusal.key);
    this.name = 'DeliveryRefusedError';
  }
}

/** Адрес файла модуля по его пути от корня. */
function at(host: CodegenHost, dir: ResourceId, path: string): ResourceId {
  return host.resolve(dir, ...path.split('/'));
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
  file: CodegenFile,
  id: ResourceId
): Promise<{ readonly path: string; readonly text: string } | null> {
  if (file.legacyPaths === undefined || file.legacyPaths.length === 0) return null;
  if (await host.exists(id)) return null;
  for (const path of file.legacyPaths) {
    const legacyId = at(host, dir, path);
    if (!(await host.exists(legacyId))) continue;
    const text = await host.readText(legacyId);
    if (text !== null) return { path, text };
  }
  return null;
}

/**
 * Записать модуль В каталог корня модуля.
 *
 * Каталог называет стек (`CodegenForm.root`): место модуля — функция адреса документа либо
 * каталог, выбранный щелчком в дереве. Каталог не создаётся отдельным шагом: рабочая область
 * адресует ресурсы путями, и запись по адресу внутри несуществующего каталога создаёт его сама.
 *
 * @throws {@link SourceReadOnlyError} источник не принимает запись.
 * @throws {@link DeliveryRefusedError} стек отказал записи.
 */
export async function deliverInto(
  host: CodegenHost,
  dir: ResourceId,
  files: readonly CodegenFile[],
  options: DeliveryOptions = {}
): Promise<DeliveryResult> {
  const capabilities = host.sourceOf(dir);
  if (capabilities === null || !capabilities.write) throw new SourceReadOnlyError();
  const refusal = (await options.check?.()) ?? null;
  if (refusal !== null) throw new DeliveryRefusedError(refusal);

  const written: string[] = [];
  const skipped: { path: string; reason: SkipReason }[] = [];
  const failed: { path: string; message: string }[] = [];
  const legacy: LegacyFile[] = [];
  const touched: ResourceId[] = [];

  for (const file of files) {
    const id = at(host, dir, file.path);
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
  const notes = (await options.inspect?.()) ?? [];

  return { dir, written, skipped, failed, saved, legacy, notes };
}
