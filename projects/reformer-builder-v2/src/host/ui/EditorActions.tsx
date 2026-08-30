/**
 * Ряд действий над открытым документом — справа в строке вкладок.
 *
 * Правила живут в `./menu` и `./editor-menu`, здесь — отрисовка: кнопка на пункт со значком,
 * «…» на всё остальное.
 *
 * ## Значок решает, кнопка это или строка списка
 *
 * Место в полосе вкладок дорогое: каждая кнопка отнимает ширину у имён файлов. Поэтому
 * пункт со значком становится кнопкой, а пункт без значка уходит под «…», где у него есть
 * место для подписи. Правило простое настолько, что вклад может им пользоваться осознанно:
 * «дай значок, если действие нужно в один щелчок».
 *
 * ## Переполнение не считается по ширине
 *
 * Соблазн прятать лишние кнопки по измеренной ширине надо отвергнуть: измерение требует
 * наблюдателя размеров и даёт ряд, который перестраивается на каждое движение разделителя
 * панели. Здесь порог — {@link MAX_INLINE_ACTIONS} кнопок; всё сверх него уходит в «…»
 * в объявленном порядке, поэтому положение кнопки не зависит от ширины окна.
 *
 * @module host/ui/EditorActions
 */

import { useEffect, useReducer, useState, type ReactElement } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@reformer/ui-kit/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@reformer/ui-kit/dropdown-menu';
import { Separator } from '@reformer/ui-kit/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@reformer/ui-kit/tooltip';
import type { CommandRegistry } from '../primitives/command';
import type { ResourceRef } from '../primitives/resource';
import type { RootI18nService } from '../services/i18n/i18n';
import { NEUTRAL_WHEN_CONTEXT, type WhenContext } from '../primitives/when-context';
import { EDITOR_TITLE_MENU } from './editor-menu';
import {
  buildMenu,
  MenuPoint,
  observeMenuEntries,
  type MenuActionNode,
  type MenuEntry,
  type MenuNode,
} from './menu';
import { useContributions, useLocale, type ExtensionReader } from './usePanels';

/** Реестр команд в объёме, нужном ряду: прочитать, спросить применимость, выполнить. */
export type EditorActionsCommands = Pick<CommandRegistry, 'get' | 'isEnabled' | 'execute'>;

export interface EditorActionsProps {
  readonly extensions: ExtensionReader;
  readonly i18n: RootI18nService;
  /** Документ, к которому относятся действия; `null` — открытых вкладок нет. */
  readonly ref: ResourceRef | null;
  /** Редактор, который сейчас рисует документ. */
  readonly editorId?: string | null;
  /** Без реестра команд ряд не рисуется вовсе: кнопке некуда вести. */
  readonly commands?: EditorActionsCommands;
  /** Контекст применимости; читается в момент отрисовки ряда. */
  readonly whenContext?: () => WhenContext;
  /**
   * Встроенные пункты оболочки — то, что относится к любому открытому документу.
   *
   * Отдельным входом, а не вкладом: у корневого реестра `contribute` нет вовсе, и «пункт,
   * который Host внёс сам себе» невыразим по построению. Тот же вход, что у шапки
   * ({@link './MenuBar'}), и по той же причине.
   *
   * Он же делает «…» ПОСТОЯННОЙ кнопкой: пункт без значка уходит под неё, а такой пункт
   * у открытого документа есть всегда — значит, и кнопка стоит на месте всегда, а не
   * появляется от того, какой плагин что внёс. Правило «без пунктов ряда нет вовсе» при этом
   * остаётся в силе: пусто здесь — пусто и на экране.
   */
  readonly builtin?: readonly MenuEntry[];
}

/**
 * Сколько действий помещается кнопками.
 *
 * Четыре — то, что не мешает вкладкам на узком доке и покрывает обычный набор одного
 * редактора (у markdown их три). Пятое действие уже говорит о том, что редактору нужна
 * своя панель, а не ещё одна кнопка в общей полосе.
 */
export const MAX_INLINE_ACTIONS = 4;

/** Плоский список пунктов: разделители в ряду кнопок не рисуются. */
function flattenActions(nodes: readonly MenuNode[]): readonly MenuActionNode[] {
  const items: MenuActionNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'item') items.push(node);
    // Подменю в ряду кнопок не разворачивается: у него нет своего действия, а вкладывать
    // список в список ради полосы вкладок — это уже не панель инструментов.
    else if (node.kind === 'submenu') items.push(...flattenActions(node.items));
  }
  return items;
}

/**
 * Перерисовка ряда по сигналу вклада.
 *
 * `useReducer` вместо `useSyncExternalStore`: у сигнала нет снимка — он не несёт значения
 * вовсе, и подсовывать ему счётчик значило бы заводить состояние ради того, чтобы его не
 * читать. Тот же хук, что у декораций дерева, и ровно по той же причине: без него кнопка,
 * чей значок зависит от состояния плагина, застывает в положении, в котором её отрисовали.
 */
function useMenuRevision(entries: readonly MenuEntry[]): void {
  const [, bump] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    const subscription = observeMenuEntries(entries, bump);
    return () => {
      subscription.dispose();
    };
  }, [entries]);
}

export function EditorActions({
  extensions,
  i18n,
  ref,
  editorId = null,
  commands,
  whenContext,
  builtin,
}: EditorActionsProps): ReactElement | null {
  const contributions = useContributions(extensions, MenuPoint);
  useMenuRevision(contributions);
  useLocale(i18n);
  const [open, setOpen] = useState(false);

  // Без `useMemo`: пересчёт заказывает не список зависимостей, а сигнал вклада, у которого
  // нет значения. Цена мала — десяток записей с дешёвыми предикатами на перерисовку полосы.
  const nodes = ((): readonly MenuNode[] => {
    if (commands === undefined || ref === null) return [];
    return buildMenu(
      {
        entries: [...(builtin ?? []), ...contributions],
        ctx: whenContext?.() ?? NEUTRAL_WHEN_CONTEXT,
        target: { documentId: ref.id, ref, editorId },
        commands,
        translate: (key, owner) =>
          owner?.pluginId === undefined ? i18n.t(key) : i18n.forPlugin(owner.pluginId).t(key),
        execute: (commandId, args) => {
          void commands.execute(commandId, args).catch((error: unknown) => {
            console.error(`[shell] действие «${commandId}» над документом отказало`, error);
          });
        },
        onIssue: (issue) => {
          console.warn(`[shell] ряд действий: «${issue.entryId}» — ${issue.kind}`);
        },
      },
      EDITOR_TITLE_MENU
    );
  })();

  const actions = flattenActions(nodes);
  if (actions.length === 0) return null;

  const inline = actions.filter((item) => item.icon !== undefined).slice(0, MAX_INLINE_ACTIONS);
  const overflow = actions.filter((item) => !inline.includes(item));

  // Провайдер подсказок — ЗДЕСЬ, а не у того, кто ряд разместил.
  //
  // Оболочка оборачивает им только рейл, поэтому `Tooltip` в полосе вкладок бросал бы
  // «must be used within TooltipProvider» и уносил бы с собой весь центр — то есть кнопки
  // не появлялись бы вовсе, а причина была бы в чужом файле. Компонент, приносящий свой
  // контекст, невозможно смонтировать неправильно.
  return (
    <TooltipProvider>
      <div className="flex flex-none items-center gap-0.5">
        {inline.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={item.title}
                  // Нажатое состояние переключателя видно и без галочки: у кнопки для этого
                  // есть фон, а галочка в полосе вкладок не поместилась бы.
                  data-state={item.checked === true ? 'on' : undefined}
                  className={item.checked === true ? 'bg-accent text-accent-foreground' : undefined}
                  disabled={!item.enabled}
                  onClick={item.run}
                >
                  {Icon !== undefined && <Icon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{item.title}</TooltipContent>
            </Tooltip>
          );
        })}

        {overflow.length > 0 && (
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={i18n.t('shell.editor.actions.more')}
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {overflow.map((item) => (
                <DropdownMenuItem key={item.id} disabled={!item.enabled} onSelect={item.run}>
                  {item.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Линия отделяет действия документа от выбора редактора: они про разное, и слитный
            ряд из пяти значков читается как один набор. */}
        <Separator orientation="vertical" className="mx-1 h-4" />
      </div>
    </TooltipProvider>
  );
}
