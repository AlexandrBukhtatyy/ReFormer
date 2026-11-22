/**
 * Пункт меню дерева «Прикрепить к ассистенту».
 *
 * Пункт зовёт команду ассистента (`ASSISTANT_ATTACH_COMMAND_ID`), а не прикрепляет сам: плагины
 * друг друга не импортируют, и общий у них только адрес команды. Ассистента может не быть вовсе
 * — тогда пункт не вносится: меню, в котором пункт ведёт к несуществующей команде, сообщает об
 * этом в консоль на каждый показ. Поэтому вклад следит за реестром команд и появляется вместе
 * с командой, а уходит вместе с ней.
 *
 * @module plugins/base/files/assistant/attach-menu
 */

import {
  argsOfResource,
  ASSISTANT_ATTACH_COMMAND_ID,
  MenuPoint,
  RESOURCE_CONTEXT_MENU,
  whenResource,
  type AssistantAttachArgs,
  type Disposable,
  type MenuContribution,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import { uriOfPath } from './source-uri';

/** Идентификатор пункта. */
export const ATTACH_MENU_ITEM_ID = 'files.context.attachToAssistant';

/** Пункт меню: только над файлом — каталог целиком к реплике не прикрепляется. */
export function attachMenuItem(): MenuContribution {
  return {
    kind: 'item',
    menu: RESOURCE_CONTEXT_MENU,
    command: ASSISTANT_ATTACH_COMMAND_ID,
    titleKey: 'context.attachToAssistant',
    group: '4_assistant',
    when: whenResource((target) => target.ref?.kind === 'file'),
    argsOf: argsOfResource((target): AssistantAttachArgs | undefined =>
      target.ref === null ? undefined : { uri: uriOfPath(target.ref.path), name: target.ref.name }
    ),
  };
}

/**
 * Вносить пункт, пока у ассистента есть команда прикрепления.
 *
 * @returns Снять слежку и пункт.
 */
export function contributeAttachMenu(
  ctx: Pick<PluginContext, 'commands' | 'extensions'>
): Disposable {
  let item: Disposable | null = null;
  const sync = (): void => {
    const present = ctx.commands.get(ASSISTANT_ATTACH_COMMAND_ID) !== undefined;
    if (present && item === null) {
      item = ctx.extensions.contribute(MenuPoint, attachMenuItem(), { id: ATTACH_MENU_ITEM_ID });
    } else if (!present && item !== null) {
      item.dispose();
      item = null;
    }
  };
  sync();
  const watch = ctx.commands.onDidChange(sync);
  return {
    dispose() {
      watch.dispose();
      item?.dispose();
      item = null;
    },
  };
}
