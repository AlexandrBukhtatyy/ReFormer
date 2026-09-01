/**
 * Операции над ресурсами: создать, переименовать, удалить, скопировать.
 *
 * ## Почему это не метод Workspace
 *
 * Так записано в контракте порта источника (`./source`): «он не создаёт каталогов, не удаляет
 * и не переименовывает — эти операции придут отдельными командами поверх полного `Source`».
 * Причина видна на типах: Workspace — рабочий НАБОР, его истина живёт в рабочей копии,
 * а `writeText` пишет в буфер и наружу выходит только через `save`. Удаление файла таким
 * буфером не выражается вовсе: удалять нужно у источника и немедленно, иначе «удалил» значило
 * бы «перестал показывать».
 *
 * Поэтому операции идут К ИСТОЧНИКУ напрямую, а рабочая область узнаёт о последствиях:
 * вкладка исчезнувшего ресурса закрывается ({@link ResourceOperationsDeps.workspace}),
 * прочитанный уровень дерева забывается ({@link ResourceOperationsDeps.invalidate}).
 * Порядок здесь несущий — сначала источник, потом последствия: закрыть вкладку и получить
 * отказ на удалении значило бы потерять несохранённые правки файла, который остался на месте.
 *
 * ## Одиночные операции бросают, пакетные отчитываются
 *
 * Разделение не стилистическое. «Переименовать» — одно решение человека, и его отказ
 * целиком отменяет действие: показать надо ошибку, а не отчёт из одной строки. «Вставить
 * три записи» — три независимых действия, и упавшее второе не отменяет ни первое,
 * ни третье; ровно так же ведёт себя `save` у рабочей области, отдавая списки, а не бросок.
 *
 * ## Цена подбора имени — ноль обращений
 *
 * Имя копии разводится по списку уровня, который читается ОДИН раз на всю вставку
 * (см. `./resource-names`). В v1 тот же подбор стоил до двух тысяч последовательных
 * обращений к файловой системе на одно имя.
 *
 * @module host/workspace/resource-ops
 */

import {
  basename,
  dirname,
  joinPath,
  makeResourceId,
  parseResourceId,
  type ResourceId,
} from '../primitives/resource';
import type { Source } from '../source/types';
import { isInside, uniqueName, validateResourceName, type NameRejection } from './resource-names';

/**
 * Источник в объёме, нужном операциям.
 *
 * `Pick` от настоящего `Source`, а не свой порт: форма обязана совпадать буква в букву,
 * иначе расхождение вскроется на композиции, а не на типах. Необязательные методы остаются
 * необязательными — источник, не умеющий писать, обязан отказать, а не притвориться.
 */
export type OperationsSource = Pick<
  Source,
  | 'id'
  | 'list'
  | 'stat'
  | 'read'
  | 'readBytes'
  | 'write'
  | 'writeBytes'
  | 'mkdir'
  | 'remove'
  | 'move'
>;

/**
 * Рабочая область в объёме последствий.
 *
 * Только закрытие: операции ничего не пишут в рабочую копию и ничего из неё не читают.
 */
export interface OperationsWorkspace {
  openedResources(): readonly ResourceId[];
  close(id: ResourceId): Promise<void>;
}

/** Почему операция не состоялась. Код, а не фраза: текст строит интерфейс на своём языке. */
export type ResourceOperationErrorKind =
  /** Имя не прошло правила `./resource-names`; уточнение — в {@link ResourceOperationError.rejection}. */
  | 'invalid-name'
  /** Такое имя в каталоге уже занято. Перезапись молча — потеря чужой работы. */
  | 'name-taken'
  /** Каталог копируется или переносится внутрь самого себя: обход не завершится. */
  | 'inside-itself'
  /** Источник не умеет нужного действия (нет `mkdir`, `remove`, `move`, `write`). */
  | 'unsupported'
  /** Копирование упёрлось в потолок числа записей. */
  | 'budget'
  /** Корень источника: у него нет ни родителя, ни имени, поэтому его нельзя ни переименовать, ни удалить. */
  | 'root';

/** Отказ операции. Отдельно от `SourceError`: это отказ ПРАВИЛА, а не транспорта. */
export class ResourceOperationError extends Error {
  readonly kind: ResourceOperationErrorKind;
  /** Для `invalid-name` — какое именно правило имени нарушено. */
  readonly rejection?: NameRejection;
  readonly resource?: ResourceId;

  constructor(
    kind: ResourceOperationErrorKind,
    message: string,
    options?: { rejection?: NameRejection; resource?: ResourceId; cause?: unknown }
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ResourceOperationError';
    this.kind = kind;
    this.rejection = options?.rejection;
    this.resource = options?.resource;
  }
}

/** Одна неудача пакетной операции: что не получилось и почему. */
export interface ResourceOperationFailure {
  readonly id: ResourceId;
  readonly error: unknown;
}

/**
 * Итог пакетной операции.
 *
 * `done` — то, что реально изменилось у источника: созданные копии для вставки, удалённые
 * адреса для удаления. Пустой `done` при непустом `failed` — это полный отказ, и интерфейсу
 * различать их обязательно: «вставлено 2 из 3» и «не вставлено ничего» — разные сообщения.
 */
export interface ResourceBatchResult {
  readonly done: readonly ResourceId[];
  readonly failed: readonly ResourceOperationFailure[];
}

export interface ResourceOperationsDeps {
  readonly source: OperationsSource;
  /**
   * Рабочая область — чтобы закрыть вкладку исчезнувшего ресурса.
   *
   * Необязательна: операции обязаны работать и без открытых документов (тест, сценарий
   * до восстановления рабочей области). Без неё вкладка удалённого файла останется висеть,
   * и это видно на глаз — в отличие от порядка «закрыли, потом не удалили».
   */
  readonly workspace?: OperationsWorkspace;
  /**
   * Забыть прочитанный уровень каталога: его содержимое изменилось.
   *
   * Вызывается ПОСЛЕ успеха и для каждого затронутого каталога (у переноса их два).
   * Ошибку обновления операции не считают своей: файл уже создан, и откатывать его
   * из-за неперерисованного дерева было бы хуже.
   */
  readonly invalidate?: (dir: ResourceId) => void | Promise<void>;
  /** Потолок числа записей одного копирования. По умолчанию {@link DEFAULT_COPY_BUDGET}. */
  readonly copyBudget?: number;
}

/**
 * Потолок копирования: столько записей переносит одна вставка.
 *
 * Две тысячи — то же число, что в v1, и оно про защиту от `node_modules`, а не про
 * производительность: каталог такого размера человек не копирует осознанно ни разу.
 */
export const DEFAULT_COPY_BUDGET = 2000;

export interface ResourceOperations {
  /**
   * Создаёт файл с содержимым (по умолчанию пустым) и возвращает его адрес.
   *
   * Существующий файл НЕ перезаписывается: в v1 создание шло через `create: true`, и повтор
   * имени молча обнулял чужой файл.
   */
  createFile(dir: ResourceId, name: string, text?: string): Promise<ResourceId>;
  createDirectory(dir: ResourceId, name: string): Promise<ResourceId>;
  /** Переименование — это перенос в том же каталоге, поэтому оно и выражено переносом. */
  rename(id: ResourceId, name: string): Promise<ResourceId>;
  /** Перенос в другой каталог. Имя сохраняется; занятое имя — отказ, а не разведение. */
  move(id: ResourceId, dir: ResourceId): Promise<ResourceId>;
  /** Удаляет записи (каталоги — со всем содержимым). */
  remove(ids: readonly ResourceId[]): Promise<ResourceBatchResult>;
  /** Копирует записи в каталог, разводя занятые имена номером. */
  copy(ids: readonly ResourceId[], dir: ResourceId): Promise<ResourceBatchResult>;
  /**
   * Забывает прочитанный уровень: содержимое каталога изменилось не нами.
   *
   * Существует ради «Обновить»: наблюдения за файловой системой у File System Access нет
   * вовсе, поэтому правку, сделанную в другом редакторе, показать может только явный
   * пересмотр — и просить за него у человека больше одного нажатия неправильно.
   */
  refresh(dir: ResourceId): Promise<void>;
}

/** Путь ресурса внутри источника. Чужой источник — ошибка композиции, а не ввода. */
function pathOf(id: ResourceId): string {
  return parseResourceId(id).path;
}

/** Адрес по каталогу и имени — в том же источнике, что и каталог. */
function child(dir: ResourceId, name: string): ResourceId {
  const { sourceId, path } = parseResourceId(dir);
  return makeResourceId(sourceId, joinPath(path, name));
}

/** Родительский каталог ресурса как адрес. */
function parentOf(id: ResourceId): ResourceId {
  const { sourceId, path } = parseResourceId(id);
  return makeResourceId(sourceId, dirname(path));
}

function requireName(name: string): void {
  const rejection = validateResourceName(name);
  if (rejection !== null) {
    throw new ResourceOperationError('invalid-name', `имя «${name}» не годится: ${rejection}`, {
      rejection,
    });
  }
}

export function createResourceOperations(deps: ResourceOperationsDeps): ResourceOperations {
  const { source, workspace, invalidate } = deps;
  const budget = deps.copyBudget ?? DEFAULT_COPY_BUDGET;

  /** Имена уровня одним обращением. Отсутствующий каталог — пустой набор: его сейчас создадут. */
  const namesOf = async (dir: ResourceId): Promise<ReadonlySet<string>> => {
    try {
      const entries = await source.list(pathOf(dir));
      return new Set(entries.map((entry) => entry.name));
    } catch {
      return new Set<string>();
    }
  };

  const refresh = async (...dirs: readonly ResourceId[]): Promise<void> => {
    if (invalidate === undefined) return;
    // Один каталог обновляется один раз: перенос внутри каталога даёт два одинаковых адреса.
    for (const dir of new Set(dirs)) {
      try {
        await invalidate(dir);
      } catch (error) {
        console.error(`[workspace] уровень «${dir}» не перечитан`, error);
      }
    }
  };

  /**
   * Закрывает вкладки ресурса и всего, что было внутри него.
   *
   * По ПУТЯМ, а не по совпадению адреса: удалили каталог — исчезли и открытые файлы внутри,
   * и вкладка каждого из них ссылается на то, чего больше нет.
   */
  const closeGone = async (id: ResourceId): Promise<void> => {
    if (workspace === undefined) return;
    const gone = pathOf(id);
    for (const opened of workspace.openedResources()) {
      if (!isInside(pathOf(opened), gone)) continue;
      try {
        await workspace.close(opened);
      } catch (error) {
        console.error(`[workspace] вкладка «${opened}» не закрыта`, error);
      }
    }
  };

  const requireFree = async (dir: ResourceId, name: string): Promise<void> => {
    const taken = await namesOf(dir);
    if (taken.has(name)) {
      throw new ResourceOperationError('name-taken', `в каталоге уже есть «${name}»`, {
        resource: child(dir, name),
      });
    }
  };

  /** Копирует один файл, сохраняя байты, если источник умеет их отдать и принять. */
  const copyFile = async (from: string, to: string): Promise<void> => {
    if (source.write === undefined) {
      throw new ResourceOperationError('unsupported', 'источник не умеет писать');
    }
    if (source.readBytes !== undefined && source.writeBytes !== undefined) {
      const { bytes } = await source.readBytes(from);
      await source.writeBytes(to, bytes);
      return;
    }
    // Текстовый путь — законная деградация: источник, отдающий только текст, и хранит
    // только текст. Портится тут ровно то, чего у него нет.
    const { text } = await source.read(from);
    await source.write(to, text);
  };

  /** Рекурсивное копирование с общим счётчиком: потолок считается на всю вставку, а не на уровень. */
  const copyEntry = async (from: string, to: string, counter: { n: number }): Promise<void> => {
    const stat = await source.stat(from);
    if (stat === null) {
      throw new ResourceOperationError('unsupported', `нечего копировать: нет ${from}`);
    }
    if (++counter.n > budget) {
      throw new ResourceOperationError('budget', `больше ${budget} записей за одно копирование`);
    }
    if (stat.kind === 'file') {
      await copyFile(from, to);
      return;
    }
    if (source.mkdir === undefined) {
      throw new ResourceOperationError('unsupported', 'источник не умеет создавать каталоги');
    }
    await source.mkdir(to);
    for (const entry of await source.list(from)) {
      await copyEntry(entry.path, joinPath(to, entry.name), counter);
    }
  };

  return {
    async createFile(dir, name, text = '') {
      requireName(name);
      if (source.write === undefined) {
        throw new ResourceOperationError('unsupported', 'источник не умеет писать');
      }
      await requireFree(dir, name);
      const id = child(dir, name);
      await source.write(pathOf(id), text);
      await refresh(dir);
      return id;
    },

    async createDirectory(dir, name) {
      requireName(name);
      if (source.mkdir === undefined) {
        throw new ResourceOperationError('unsupported', 'источник не умеет создавать каталоги');
      }
      await requireFree(dir, name);
      const id = child(dir, name);
      await source.mkdir(pathOf(id));
      await refresh(dir);
      return id;
    },

    async rename(id, name) {
      requireName(name);
      const path = pathOf(id);
      if (path === '') {
        throw new ResourceOperationError('root', 'корень источника нельзя переименовать');
      }
      if (basename(path) === name) return id;
      if (source.move === undefined) {
        throw new ResourceOperationError('unsupported', 'источник не умеет переименовывать');
      }
      const dir = parentOf(id);
      await requireFree(dir, name);
      const next = child(dir, name);
      await source.move(path, pathOf(next));
      // Вкладка ссылается на путь, а путь изменился: её содержимое больше не принадлежит
      // этому адресу. Закрываем ПОСЛЕ переноса — иначе отказ источника стоил бы правок.
      await closeGone(id);
      await refresh(dir);
      return next;
    },

    async move(id, dir) {
      const path = pathOf(id);
      if (path === '') {
        throw new ResourceOperationError('root', 'корень источника нельзя переносить');
      }
      if (source.move === undefined) {
        throw new ResourceOperationError('unsupported', 'источник не умеет переносить');
      }
      const name = basename(path);
      const target = child(dir, name);
      if (target === id) return id;
      if (isInside(pathOf(target), path)) {
        throw new ResourceOperationError('inside-itself', 'каталог нельзя перенести внутрь себя', {
          resource: id,
        });
      }
      await requireFree(dir, name);
      await source.move(path, pathOf(target));
      await closeGone(id);
      await refresh(parentOf(id), dir);
      return target;
    },

    async remove(ids) {
      const done: ResourceId[] = [];
      const failed: ResourceOperationFailure[] = [];
      const dirs: ResourceId[] = [];

      for (const id of ids) {
        try {
          if (pathOf(id) === '') {
            throw new ResourceOperationError('root', 'корень источника нельзя удалить');
          }
          if (source.remove === undefined) {
            throw new ResourceOperationError('unsupported', 'источник не умеет удалять');
          }
          await source.remove(pathOf(id));
          await closeGone(id);
          done.push(id);
          dirs.push(parentOf(id));
        } catch (error) {
          // Упавшее удаление не отменяет остальных: три выделенных файла — три решения.
          failed.push({ id, error });
        }
      }

      await refresh(...dirs);
      return { done, failed };
    },

    async copy(ids, dir) {
      const done: ResourceId[] = [];
      const failed: ResourceOperationFailure[] = [];
      // Список уровня читается один раз, но пополняется по ходу: две вставки подряд
      // не должны выбрать одно и то же свободное имя.
      const taken = new Set(await namesOf(dir));

      for (const id of ids) {
        try {
          const from = pathOf(id);
          const targetDir = pathOf(dir);
          if (isInside(targetDir, from)) {
            throw new ResourceOperationError(
              'inside-itself',
              'каталог нельзя скопировать внутрь себя',
              { resource: id }
            );
          }
          const name = uniqueName(taken, basename(from));
          const target = child(dir, name);
          await copyEntry(from, pathOf(target), { n: 0 });
          taken.add(name);
          done.push(target);
        } catch (error) {
          failed.push({ id, error });
        }
      }

      if (done.length > 0) await refresh(dir);
      return { done, failed };
    },

    async refresh(dir) {
      await refresh(dir);
    },
  };
}
