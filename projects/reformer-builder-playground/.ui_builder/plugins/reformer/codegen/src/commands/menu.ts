/**
 * Подраздел «ReFormer» подменю «Сгенерировать» в дереве: «Весь модуль» и по пункту на цель.
 *
 * Само подменю «Сгенерировать» общее: его заголовок вносит плагин файлов, а стеки кладут в него
 * по подразделу — рядом с этим стоит подраздел RJSF. Так в «Сгенерировать» видно, ЧЕЙ это код,
 * и подменю не пропадает из состава, где кодогена ReFormer нет.
 *
 * ## Почему подраздел вносит стек, а не хозяин генерации
 *
 * Заголовок подраздела и подписи целей — ключи словаря, а ключ пункта меню резолвится словарём
 * ВНЁСШЕГО плагина. Подписи целей ReFormer лежат в словаре стека, и внеси их хозяин — меню
 * показало бы сырые ключи. Команда за пунктами — хозяйская (`codegen.generateInto`): найти форму
 * в каталоге, напечатать и записать — общий путь для любого стека, и аргумент `stack` называет,
 * чей.
 *
 * ## Одна цель печатается в контексте ВСЕГО модуля
 *
 * Печатается всегда весь модуль, а записывается отобранное. Так «Типы» дают ровно тот же
 * `types/<форма>.ts`, что и «Весь модуль», а `README.md` перечисляет настоящий состав, а не себя
 * одного.
 *
 * @module plugins/reformer/codegen/commands/menu
 */

import { SCHEMA_DIR } from '../../../core/codegen';
import {
  argsOfResource,
  asResourceTarget,
  RESOURCE_GENERATE_MENU,
  whenResource,
  type CodegenTarget,
  type MenuContribution,
  type MenuDynamicItem,
  type ResourceRef,
} from '@reformer/builder-plugin-api';
import { CODEGEN_STACK_ID } from '../pipeline/targets';

/**
 * Команда хозяина генерации «сгенерировать в этот каталог».
 *
 * Имя — контракт с хозяином (реестр команд один на приложение): пункт меню зовёт её по
 * идентификатору, не импортируя хозяина.
 */
export const GENERATE_INTO_COMMAND_ID = 'codegen.generateInto';

/**
 * Адрес подраздела «ReFormer» в подменю «Сгенерировать».
 *
 * Путь, а не структура: он и есть точка расширения. Чужой плагин, у которого появилась своя
 * цель модуля ReFormer, вносит пункт сюда тем же вкладом, каким вносил бы его в «Файл», —
 * и оказывается в одном списке с нашими, не притрагиваясь к этому модулю. Другой стек сюда
 * не вносит: у него свой подраздел по соседнему адресу.
 */
export const CODEGEN_CONTEXT_SUBMENU = `${RESOURCE_GENERATE_MENU}/reformer`;

/**
 * Печатать можно только В КАТАЛОГ — и на файле пункт гаснет, а не исчезает.
 *
 * Пустое место панели считается каталогом: цель дерева подставляет туда корень показа, и
 * «сгенерировать в корень проекта» — законное, хотя и редкое, желание.
 */
const overDirectory = whenResource(
  (target) => target.ref === null || target.ref.kind === 'directory'
);

/**
 * Имя каталога как имя формы: щёлкнули по `credit-application/` — форма так и называется.
 *
 * Кроме самой папки `schema/`: она — часть модуля, а не его корень, и форму назвали бы `schema`.
 * Без ответа имя берётся из пути найденного документа — то есть из каталога модуля.
 */
function formNameOfTarget(ref: ResourceRef | null): string | undefined {
  return ref !== null && ref.kind === 'directory' && ref.name !== SCHEMA_DIR ? ref.name : undefined;
}

/**
 * Пункты подраздела.
 *
 * Цели вносятся ДИНАМИЧЕСКОЙ группой, а не списком вкладов, потому что их состав известен
 * только в рантайме: точка расширения открыта, и перечислить пункты заранее — значит показать
 * состав на момент активации плагина. `targets` — цели этого стека без заменённых.
 */
export function codegenContextMenuItems(
  targets: () => readonly CodegenTarget[]
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  return [
    {
      id: 'codegen.context.submenu',
      value: {
        kind: 'submenu',
        // Внутрь общего «Сгенерировать», а не в корень меню дерева: заголовок подменю вносит
        // плагин файлов, стек — только свой подраздел.
        menu: RESOURCE_GENERATE_MENU,
        submenu: CODEGEN_CONTEXT_SUBMENU,
        titleKey: 'menu.generate.reformer',
        // Порядок подразделов назван числом, а не оставлен порядку активации плагинов:
        // иначе «ReFormer» и «RJSF» менялись бы местами от состава.
        order: 10,
        // Гаснет подраздел, а не всё подменю: у соседнего стека своё правило цели.
        enabledWhen: overDirectory,
      },
    },
    {
      id: 'codegen.context.all',
      value: {
        kind: 'item',
        menu: CODEGEN_CONTEXT_SUBMENU,
        command: GENERATE_INTO_COMMAND_ID,
        group: '1_all',
        titleKey: 'menu.generate.all',
        argsOf: argsOfResource((target) => ({
          dir: target.dir,
          formName: formNameOfTarget(target.ref),
          stack: CODEGEN_STACK_ID,
        })),
      },
    },
    {
      id: 'codegen.context.targets',
      value: {
        kind: 'dynamic',
        menu: CODEGEN_CONTEXT_SUBMENU,
        group: '2_targets',
        items: (_ctx, menuTarget): readonly MenuDynamicItem[] => {
          const resource = asResourceTarget(menuTarget);
          if (resource === null) return [];
          const formName = formNameOfTarget(resource.ref);
          return targets().map((target) => ({
            id: target.id,
            command: GENERATE_INTO_COMMAND_ID,
            args: { dir: resource.dir, targetId: target.id, formName, stack: CODEGEN_STACK_ID },
            // Ключ — у наших целей, готовая строка — у чужих: подписать чужую цель нам нечем,
            // а имя файла осмысленно всегда (см. `CodegenTarget.titleKey`).
            titleKey: target.titleKey,
            title: target.titleKey === undefined ? target.path : undefined,
          }));
        },
      },
    },
  ];
}
