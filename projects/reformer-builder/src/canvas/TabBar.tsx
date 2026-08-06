/**
 * Таб-бар открытых схем (стиль VSCode, прототип §4): моно-имя, оранжевая точка при dirty, крестик.
 * ПКМ по вкладке — контекстное меню закрытия (закрыть / слева / справа / остальные).
 *
 * Закрытие идёт через `app/close-actions`, а не напрямую в стор: у черновиков (вкладок без файла
 * в проекте) закрытие удаляет и локальную копию, поэтому может потребоваться подтверждение.
 *
 * @module reformer-builder/canvas/TabBar
 */

import { X } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@reformer/ui-kit/context-menu';
import { editorActions, isDirty, isDraft, useActiveTabId, useTab, useTabOrder } from '../store';
import { requestClose } from '../app/close-actions';
import { cn } from '../lib/cn';

function TabItem({ id, index, count }: { id: string; index: number; count: number }) {
  const tab = useTab(id);
  const activeId = useActiveTabId();
  if (!tab) return null;
  const active = id === activeId;
  const canCloseLeft = index > 0;
  const canCloseRight = index < count - 1;
  const canCloseOthers = count > 1;
  const draft = isDraft(tab);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => editorActions.setActiveTab(id)}
          // Двойной клик закрепляет временную вкладку за файлом (VSCode: «Keep Open»).
          onDoubleClick={() => editorActions.pinTab(id)}
          className={cn(
            'flex cursor-pointer items-center gap-2 whitespace-nowrap border-r border-border px-3 font-mono text-[11px]',
            active ? 'bg-background text-foreground' : 'bg-sidebar text-muted-foreground'
          )}
        >
          <span className="text-muted-foreground">{'{}'}</span>
          {/* Временная (preview) вкладка — курсивом, как в VSCode: открыта одиночным кликом и будет
              переиспользована под следующий предпросмотр. Двойной клик или первая правка закрепляют
              её — курсив снимается. */}
          <span
            className={cn(tab.preview && 'italic')}
            title={
              tab.preview
                ? `${tab.source.path || tab.source.name} — предпросмотр: двойной клик закрепит вкладку`
                : draft
                  ? `${tab.source.name} — черновик: файла в проекте нет, копия хранится локально`
                  : tab.source.path || tab.source.name
            }
          >
            {tab.source.name}
          </span>
          {isDirty(tab) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              requestClose({ kind: 'one', id });
            }}
            className="ml-1 grid h-4 w-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => requestClose({ kind: 'one', id })}>Закрыть</ContextMenuItem>
        <ContextMenuItem
          disabled={!canCloseLeft}
          onClick={() => requestClose({ kind: 'left', id })}
        >
          Закрыть слева
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!canCloseRight}
          onClick={() => requestClose({ kind: 'right', id })}
        >
          Закрыть справа
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!canCloseOthers}
          onClick={() => requestClose({ kind: 'others', id })}
        >
          Закрыть остальные
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TabBar() {
  const order = useTabOrder();
  return (
    <div className="flex h-[34px] flex-none items-stretch overflow-x-auto border-b border-border bg-sidebar">
      {order.map((id, index) => (
        <TabItem key={id} id={id} index={index} count={order.length} />
      ))}
    </div>
  );
}
