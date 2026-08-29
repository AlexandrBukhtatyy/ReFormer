/**
 * Шаблоны в контекстном меню дерева: команда «Создать шаблон из каталога» и её пункт.
 *
 * ## Здесь закрывается потеря, названная в `./operations`
 *
 * Там записано прямым текстом: «канал „что выделено в дереве“ в v2 отсутствует — дерево
 * принадлежит Host и своего выделения наружу не отдаёт». Канал появился: контекстное меню
 * передаёт цель щелчка вкладу, поэтому «сделать шаблон вот из этого каталога» выражается
 * без единого нового права у плагина — он по-прежнему не видит ни дерева, ни выделения,
 * ему приносят адрес.
 *
 * ## Почему каталог, а не произвольный набор
 *
 * Как и в {@link createTemplateFromDirectory}: шаблон формы — это каталог формы. Набор
 * файлов из разных мест дерева шаблоном не является, и собирать его «на всякий случай»
 * значило бы обещать сборку, которая потом не разложится обратно.
 *
 * @module plugins/templates/context-menu
 */

import {
  RESOURCE_CONTEXT_MENU,
  argsOfResource,
  validateResourceName,
  whenResource,
  type CommandContribution,
  type MenuContribution,
  type NotificationsService,
  type PromptService,
  type ResourceId,
} from '@/sdk';
import { canSave, type TemplateStore } from './contract';
import type { TemplatesHost } from './host';
import { createTemplateFromDirectory } from './operations';

/** Создать шаблон из каталога, по которому щёлкнули. */
export const CREATE_TEMPLATE_COMMAND_ID = 'templates.createFromDirectory';

export interface TemplatesMenuDeps {
  readonly host: TemplatesHost;
  /** Хранилища шаблонов — читаются лениво: их состав меняется вкладами. */
  readonly stores: () => readonly TemplateStore[];
  readonly prompt?: PromptService | null;
  readonly notifications?: NotificationsService | null;
}

/** Аргументы команды: каталог, из которого собирать шаблон. */
interface CreateTemplateArgs {
  readonly dir?: ResourceId;
}

function directoryOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const dir = (args as CreateTemplateArgs).dir;
  return typeof dir === 'string' ? dir : null;
}

/**
 * Куда сохранять: первое хранилище, умеющее запись.
 *
 * Не спрашиваем у человека выбор хранилища прямо в меню: вопрос «куда» интересен реже, чем
 * «как назвать», а панель шаблонов даёт полный выбор. Пункт меню — быстрый путь, и лишний
 * шаг в нём превратил бы его в ту же панель, только хуже.
 */
export function writableStore(stores: readonly TemplateStore[]): TemplateStore | null {
  return stores.find((store) => canSave(store)) ?? null;
}

/** Команда: спросить имя и собрать шаблон из каталога. */
export function templatesMenuCommands(deps: TemplatesMenuDeps): readonly CommandContribution[] {
  return [
    {
      id: CREATE_TEMPLATE_COMMAND_ID,
      // Заголовок ищется в словаре ВЛАДЕЛЬЦА, и пространство имён — отдельное измерение,
      // а не приставка к ключу: 'templates.command.…' искался бы внутри словаря templates
      // целиком и промахнулся бы мимо него.
      titleKey: 'command.createFromDirectory',
      enabled: () => deps.prompt != null && writableStore(deps.stores()) !== null,
      async run(args) {
        const dir = directoryOf(args);
        const store = writableStore(deps.stores());
        if (dir === null || store === null || deps.prompt == null) return false;

        const name = await deps.prompt.input({
          titleKey: 'menu.createTemplate.title',
          descriptionKey: 'menu.createTemplate.description',
          labelKey: 'menu.createTemplate.label',
          // Имя шаблона проверяется правилами имён записей: у хранилища проекта оно станет
          // именем каталога, и «шаблон, который нельзя сохранить» лучше отклонить в поле.
          validate: (value) => {
            const rejection = validateResourceName(value);
            return rejection === null ? null : 'menu.createTemplate.invalid';
          },
          pluginId: 'templates',
        });
        if (name === null) return false;

        const result = await createTemplateFromDirectory(deps.host, store, dir, { name });
        // Ключи отказов принадлежат словарю плагина, а уведомления переводит словарь Host,
        // поэтому сообщение собирается здесь: показываем один общий текст, а подробность
        // остаётся в панели шаблонов, где ей и место.
        if (result.ok) deps.notifications?.success('templates.notify.created');
        else deps.notifications?.error('templates.notify.failed');
        return result.ok;
      },
    },
  ];
}

/** Пункт меню: виден только на каталоге — шаблон формы это каталог формы. */
export function templatesContextMenuItems(): readonly {
  readonly id: string;
  readonly value: MenuContribution;
}[] {
  return [
    {
      id: 'templates.context.createFromDirectory',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: CREATE_TEMPLATE_COMMAND_ID,
        // Группа отдельная от файловых: «сделать из этого заготовку» — не правка записи,
        // и линия между ними появится сама.
        group: '5_templates',
        when: whenResource((target) => target.ref?.kind === 'directory'),
        argsOf: argsOfResource((target) => ({ dir: target.ref?.id })),
      },
    },
  ];
}
