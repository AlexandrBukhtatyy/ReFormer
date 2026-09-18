/**
 * Правка записей проекта и открытие каталога — то, чем рабочую область МЕНЯЮТ снаружи.
 *
 * ## Почему отдельно от `workspace-files`
 *
 * Соседняя служба (`./workspace-files`) отвечает на вопросы «что в рабочей области есть и где»
 * и не умеет менять ничего — это записано в её шапке как решение: «две службы с разными
 * правами лучше одной, которую придётся охранять по методу». Эта служба и есть вторая
 * половина того деления: создать, переименовать, перенести, удалить, скопировать, открыть
 * другой каталог проекта.
 *
 * ## Почему привилегированная
 *
 * Потому что каждая из этих операций правит то, что человек видит в своём файловом менеджере,
 * и отменить их нашими силами нельзя: удалённый файл мы не вернём, а переименованный не
 * помним под старым именем. Это то же свойство, по которому право получило сохранение
 * (`./workspace-save`): действие выходит НАРУЖУ, за пределы рабочей копии в браузере.
 * Поэтому служба отдаётся только тому, кто объявил право `workspace.resources` в манифесте
 * и кому человек его подтвердил.
 *
 * ## Без проекта
 *
 * Все операции отказывают: менять нечего. Отказ — отклонённый промис, а не `null`-ответ,
 * потому что вызов без проекта — это ошибка вызывающего, а не пустой результат. «Есть ли
 * проект» спрашивают не здесь, а у `WorkspaceFilesService.projectRoot()`, и спрашивают ДО
 * того, как предложить человеку кнопку.
 *
 * @module @reformer/builder-plugin-api/services/workspace-resources
 */

import { defineCapability, type Capability } from '../primitives/capability.js';
import type { ResourceId } from '../primitives/resource.js';

/**
 * Итог пакетной операции: что получилось и что нет.
 *
 * Пакетные операции НЕ всё-или-ничего: удаление десяти файлов, где один занят чужим
 * процессом, обязано удалить девять и назвать десятый. Откатить уже удалённое всё равно
 * нечем, а отказ целиком заставил бы человека повторять то, что уже сделано.
 */
export interface WorkspaceBatchResult {
  readonly done: readonly ResourceId[];
  readonly failed: readonly { readonly id: ResourceId; readonly error: unknown }[];
}

export interface WorkspaceResourcesService {
  /**
   * Умеет ли движок выбрать каталог вообще.
   *
   * Ответ не меняется за время жизни вкладки: это про браузер (File System Access),
   * а не про состояние. Спрашивают его, чтобы не показывать кнопку, которая ничего не делает.
   */
  canOpenProject(): boolean;
  /** Показывает человеку выбор каталога и открывает проект. `false` — не выбрали. */
  openProject(): Promise<boolean>;

  createFile(dir: ResourceId, name: string, text?: string): Promise<ResourceId>;
  createDirectory(dir: ResourceId, name: string): Promise<ResourceId>;
  rename(id: ResourceId, name: string): Promise<ResourceId>;
  move(id: ResourceId, dir: ResourceId): Promise<ResourceId>;
  remove(ids: readonly ResourceId[]): Promise<WorkspaceBatchResult>;
  copy(ids: readonly ResourceId[], dir: ResourceId): Promise<WorkspaceBatchResult>;
}

/**
 * Возможность «правка записей проекта».
 *
 * Провайдер — оболочка. Версия `1.0.0` — исходная; растит её тот, кто меняет интерфейс.
 */
export const WorkspaceResourcesCapability: Capability<WorkspaceResourcesService> =
  defineCapability<WorkspaceResourcesService>({
    id: 'reformer.workspace.resources',
    version: '1.0.0',
  });

/** Токен службы — ТОТ ЖЕ объект: возможность расширяет токен, второго реестра нет. */
export const WorkspaceResourcesServiceToken = WorkspaceResourcesCapability;
