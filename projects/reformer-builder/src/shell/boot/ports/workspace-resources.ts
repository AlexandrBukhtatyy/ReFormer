/**
 * Провайдер возможности «правка записей проекта» — привилегированной.
 *
 * ## Что здесь нового по сравнению с портом
 *
 * Ничего в поведении и всё в адресате. Те же шесть операций и открытие каталога раньше
 * приезжали ПАРАМЕТРОМ в плагин файлов (`shell/boot/ports/files`), то есть существовали
 * только для встроенного: плагину из каталога проекта такой порт не собрал бы никто.
 * Теперь это служба в реестре — её видит любой плагин, объявивший право `workspace.resources`
 * и получивший его подтверждение. Дверь появилась и заперта одним движением: ровно так же
 * заводилось первое право (`./workspace-save`).
 *
 * ## Почему операции читаются из сессии на каждый вызов
 *
 * Проект закрывают и открывают заново, а плагин активируется один раз. Захваченные при
 * активации операции писали бы в источник, которого уже нет, — и писали бы молча, потому
 * что объект жив. Та же причина, что у порта файлов до переезда.
 *
 * @module shell/boot/ports/workspace-resources
 */

import type {
  ResourceId,
  WorkspaceBatchResult,
  WorkspaceResourcesService,
} from '@reformer/builder-plugin-api/internal';
import type { ProjectHost } from '@/shell/boot/project/project';

export interface WorkspaceResourcesDeps {
  /** Держатель проекта: операции и открытие каталога живут у него. */
  readonly project: Pick<ProjectHost, 'get' | 'open' | 'canOpen'>;
}

/**
 * Операции открытого проекта.
 *
 * Функция `async`, хотя ничего не ждёт: отказ обязан приехать ОТКЛОНЁННЫМ промисом, а не
 * броском. Метод объявлен возвращающим промис, и синхронный бросок из такого метода — ловушка
 * для вызывающего: `.catch()` его не поймает, а `await` поймает — то есть поведение зависит
 * от того, как позвали. Поймано собственным тестом на первом же запуске.
 */
async function operationsOf(deps: WorkspaceResourcesDeps) {
  const operations = deps.project.get()?.resources;
  if (operations === undefined) {
    throw new Error('reformer.workspace.resources: проект не открыт, менять нечего');
  }
  return operations;
}

export function createWorkspaceResourcesService(
  deps: WorkspaceResourcesDeps
): WorkspaceResourcesService {
  const operations = () => operationsOf(deps);

  return {
    canOpenProject: () => deps.project.canOpen(),
    openProject: () => deps.project.open(),

    createFile: async (dir: ResourceId, name: string, text?: string) =>
      (await operations()).createFile(dir, name, text),
    createDirectory: async (dir: ResourceId, name: string) =>
      (await operations()).createDirectory(dir, name),
    rename: async (id: ResourceId, name: string) => (await operations()).rename(id, name),
    move: async (id: ResourceId, dir: ResourceId) => (await operations()).move(id, dir),
    remove: async (ids: readonly ResourceId[]): Promise<WorkspaceBatchResult> =>
      (await operations()).remove(ids),
    copy: async (ids: readonly ResourceId[], dir: ResourceId): Promise<WorkspaceBatchResult> =>
      (await operations()).copy(ids, dir),
  };
}
