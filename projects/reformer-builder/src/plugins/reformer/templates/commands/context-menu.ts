/**
 * Шаблоны в контекстном меню дерева: подменю «Шаблоны», его пункты и команды за ними.
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
 * @module plugins/reformer/templates/commands/context-menu
 */

import {
  RESOURCE_CONTEXT_MENU,
  argsOfResource,
  asResourceTarget,
  validateResourceName,
  whenResource,
  type CommandContribution,
  type Disposable,
  type MenuContribution,
  type MenuDynamicItem,
  type NotificationsService,
  type PromptService,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { canSave, TEMPLATES_PLUGIN_ID, type FormTemplate, type TemplateStore } from '../contract';
import type { TemplatesHost } from '../host';
import {
  createTemplateFromDirectory,
  generateFormFromTemplate,
  listTemplates,
} from '../content/operations';
import { pluginMessageKey } from '@reformer/builder-plugin-api';

/** Создать шаблон из каталога, по которому щёлкнули. */
export const CREATE_TEMPLATE_COMMAND_ID = 'templates.createFromDirectory';

/** Разложить шаблон в каталог, по которому щёлкнули. */
export const GENERATE_FORM_COMMAND_ID = 'templates.generateIntoDirectory';

/**
 * Адрес подменю «Шаблоны»: всё, что дерево умеет про шаблоны, лежит под одним заголовком.
 *
 * Один пункт в корне меню, а не два: «собрать шаблон» и «разложить шаблон» — две стороны
 * одного дела, и порознь они занимали в меню дерева две строки там, где человек ищет одно слово.
 */
export const TEMPLATES_CONTEXT_SUBMENU = 'resource/context/templates';

/**
 * Адрес подменю «Создать по шаблону» — списка шаблонов внутри «Шаблонов».
 *
 * Подменю, а не пункт с диалогом выбора: выбор из списка — это и есть список, и рисовать его
 * второй раз в модальном окне значило бы завести диалог там, где меню уже умеет всё нужное.
 * Заодно у службы запросов не появляется третьего вида («выбери из списка»), которого у неё
 * сегодня нет и который понадобился бы ровно здесь.
 */
export const TEMPLATES_APPLY_SUBMENU = `${TEMPLATES_CONTEXT_SUBMENU}/apply`;

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

/** Идентификатор шаблона из аргументов команды. Проверяется, а не приводится: см. `directoryOf`. */
function templateIdOf(args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null;
  const id = (args as { templateId?: unknown }).templateId;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Снимок списка шаблонов для меню.
 *
 * ## Почему снимок, а не чтение по требованию
 *
 * `items` динамической группы обязана быть чистой и дешёвой — её зовут на каждую сборку меню,
 * а сборка происходит в момент щелчка правой кнопкой. Хранилища же отвечают ОБЕЩАНИЕМ
 * (`store.list()` асинхронен: проектное читает каталоги, локальное — IndexedDB), и дождаться
 * их внутри `items` нельзя никак.
 *
 * Поэтому список держится готовым, а перечитывается по событиям, от которых он и зависит:
 * смена кита (встроенные шаблоны — вывод кодогена под активный кит) и собственные записи
 * плагина. Пока первое чтение не пришло, подменю пустое и потому не рисуется — это честнее
 * заголовка, который открывается в пустоту.
 */
export interface TemplateSnapshot {
  /** Готовый список. Ссылка стабильна между обновлениями — её читает сборка меню. */
  list(): readonly FormTemplate[];
  /** Перечитать хранилища. Ничего не ждёт: результат приедет в {@link TemplateSnapshot.list}. */
  refresh(): void;
  /** Список сменился: меню обязано пересобраться. */
  onDidChange(cb: () => void): Disposable;
}

const NO_TEMPLATES: readonly FormTemplate[] = Object.freeze([]);

export function createTemplateSnapshot(
  stores: () => readonly TemplateStore[],
  load: (stores: readonly TemplateStore[]) => Promise<readonly FormTemplate[]> = listTemplates
): TemplateSnapshot {
  let current: readonly FormTemplate[] = NO_TEMPLATES;
  const listeners = new Set<() => void>();

  return {
    list: () => current,
    refresh: () => {
      void load(stores()).then((next) => {
        current = next;
        for (const listener of listeners) listener();
      });
    },
    onDidChange: (cb) => {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
  };
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

/** Команда: спросить имя и собрать шаблон из каталога; и обратная ей — разложить шаблон. */
export function templatesMenuCommands(
  deps: TemplatesMenuDeps,
  snapshot?: TemplateSnapshot
): readonly CommandContribution[] {
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
          pluginId: TEMPLATES_PLUGIN_ID,
        });
        if (name === null) return false;

        const result = await createTemplateFromDirectory(deps.host, store, dir, { name });
        // Ключи отказов принадлежат словарю плагина, а уведомления переводит словарь Host,
        // поэтому сообщение собирается здесь: показываем один общий текст, а подробность
        // остаётся в панели шаблонов, где ей и место.
        if (result.ok)
          deps.notifications?.success(pluginMessageKey(TEMPLATES_PLUGIN_ID, 'notify.created'));
        else deps.notifications?.error(pluginMessageKey(TEMPLATES_PLUGIN_ID, 'notify.failed'));
        // Свой же шаблон в списке меню появится только после перечитывания: снимок обновляют
        // события, а запись — как раз одно из них.
        snapshot?.refresh();
        return result.ok;
      },
    },
    {
      id: GENERATE_FORM_COMMAND_ID,
      titleKey: 'command.generateIntoDirectory',
      // `enabled` спрашивает только про то, что видно из контекста применимости: спросить имя
      // нечем — команда бессмысленна. «В каталог ли щёлкнули» — вопрос про ЦЕЛЬ, и его задаёт
      // `enabledWhen` вклада меню (см. `host/ui/menu`).
      enabled: () => deps.prompt != null,
      async run(args) {
        const dir = directoryOf(args);
        const templateId = templateIdOf(args);
        if (dir === null || templateId === null || deps.prompt == null) return false;

        const template = (snapshot?.list() ?? NO_TEMPLATES).find((item) => item.id === templateId);
        // Шаблон исчез между открытием меню и щелчком (его удалили, сменили кит) — законное
        // состояние, а не поломка: снимок на то и снимок.
        if (template === undefined) {
          deps.notifications?.error(pluginMessageKey(TEMPLATES_PLUGIN_ID, 'notify.gone'));
          snapshot?.refresh();
          return false;
        }

        const formName = await deps.prompt.input({
          titleKey: 'menu.createForm.title',
          descriptionKey: 'menu.createForm.description',
          labelKey: 'form.name',
          // Умолчание оболочки — «Готово», и оно здесь беднее того, что кнопка делает:
          // запрос заканчивается созданием каталога формы, а не просто закрытием окна.
          confirmKey: 'action.generate',
          // То же правило, что у имени шаблона: из имени формы выводятся имя каталога, тип
          // и импорты, и негодное лучше отклонить в поле, чем в середине раскладки.
          validate: (value) => (validateResourceName(value) === null ? null : 'form.name.invalid'),
          pluginId: TEMPLATES_PLUGIN_ID,
        });
        if (formName === null) return false;

        const result = await generateFormFromTemplate(
          deps.host,
          dir,
          formName,
          template,
          // Все файлы шаблона: выбор подмножества — работа панели, где под него есть место
          // со списком и зависимостями. Пункт меню — быстрый путь, и половина модуля из него
          // была бы худшим из двух.
          template.files.map((file) => file.path)
        );

        if (result.ok)
          deps.notifications?.success(pluginMessageKey(TEMPLATES_PLUGIN_ID, 'notify.generated'));
        else
          deps.notifications?.error(
            pluginMessageKey(TEMPLATES_PLUGIN_ID, 'notify.generate-failed')
          );
        if (result.ok && result.openId !== null) deps.host.openResource?.(result.openId);
        return result.ok;
      },
    },
  ];
}

/**
 * Подменю «Шаблоны»: собрать шаблон из каталога и разложить шаблон в каталог.
 *
 * Оба пункта про каталог, поэтому на файле ГАСНЕТ сам заголовок: человек, увидевший «Шаблоны»
 * на папке и не нашедший их на файле, решил бы, что возможность пропала, — а открывать подменю
 * ради единственной серой строки незачем.
 *
 * «Создать шаблон» сверх того СКРЫВАЕТСЯ везде, кроме каталога. Пустое место панели считается
 * каталогом (цель дерева подставляет корень показа), и разложить форму в корень законно, но
 * шаблон формы — это каталог формы, и на пустом месте пункт не про эту цель вовсе: серый
 * обещал бы, что когда-нибудь станет доступен.
 */
export function templatesContextMenuItems(snapshot?: TemplateSnapshot): readonly {
  readonly id: string;
  readonly value: MenuContribution;
}[] {
  const overDirectory = whenResource(
    (target) => target.ref === null || target.ref.kind === 'directory'
  );

  return [
    {
      id: 'templates.context.submenu',
      value: {
        kind: 'submenu',
        menu: RESOURCE_CONTEXT_MENU,
        submenu: TEMPLATES_CONTEXT_SUBMENU,
        titleKey: 'menu.templates',
        // Группа отдельная от файловых: «сделать из этого заготовку» — не правка записи,
        // и линия между ними появится сама.
        group: '5_templates',
        enabledWhen: overDirectory,
      },
    },
    {
      id: 'templates.context.createFromDirectory',
      value: {
        kind: 'item',
        menu: TEMPLATES_CONTEXT_SUBMENU,
        command: CREATE_TEMPLATE_COMMAND_ID,
        // Короче заголовка команды: «из каталога» в палитре объясняет, откуда шаблон, а здесь
        // каталог уже назван щелчком.
        titleKey: 'menu.templates.create',
        order: 10,
        when: whenResource((target) => target.ref?.kind === 'directory'),
        argsOf: argsOfResource((target) => ({ dir: target.ref?.id })),
      },
    },
    {
      id: 'templates.context.applySubmenu',
      value: {
        kind: 'submenu',
        menu: TEMPLATES_CONTEXT_SUBMENU,
        submenu: TEMPLATES_APPLY_SUBMENU,
        titleKey: 'menu.templates.apply',
        // Порядок назван числом: создание шаблона идёт первым, список — за ним.
        order: 20,
        onDidChange: snapshot === undefined ? undefined : (cb) => snapshot.onDidChange(cb),
      },
    },
    {
      id: 'templates.context.templates',
      value: {
        kind: 'dynamic',
        menu: TEMPLATES_APPLY_SUBMENU,
        items: (_ctx, menuTarget): readonly MenuDynamicItem[] => {
          const resource = asResourceTarget(menuTarget);
          if (resource === null || snapshot === undefined) return [];
          return snapshot.list().map((template) => ({
            id: template.id,
            command: GENERATE_FORM_COMMAND_ID,
            args: { dir: resource.dir, templateId: template.id },
            // Готовая строка, а не ключ: имена шаблонов придумывает человек, и переводить
            // их нечем и незачем.
            title: template.name,
          }));
        },
        onDidChange: snapshot === undefined ? undefined : (cb) => snapshot.onDidChange(cb),
      },
    },
  ];
}
