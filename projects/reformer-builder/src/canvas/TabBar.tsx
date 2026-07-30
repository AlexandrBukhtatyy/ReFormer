/**
 * Таб-бар открытых схем (стиль VSCode, прототип §4): моно-имя, оранжевая точка при dirty, крестик.
 * ПКМ по вкладке — контекстное меню закрытия (закрыть / слева / справа / остальные).
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
import { editorActions, isDirty, useActiveTabId, useTab, useTabOrder } from '../store';
import { cn } from '../lib/cn';

function TabItem({ id, index, count }: { id: string; index: number; count: number }) {
  const tab = useTab(id);
  const activeId = useActiveTabId();
  if (!tab) return null;
  const active = id === activeId;
  const canCloseLeft = index > 0;
  const canCloseRight = index < count - 1;
  const canCloseOthers = count > 1;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => editorActions.setActiveTab(id)}
          className={cn(
            'flex cursor-pointer items-center gap-2 whitespace-nowrap border-r border-border px-3 font-mono text-[11px]',
            active ? 'bg-background text-foreground' : 'bg-sidebar text-muted-foreground'
          )}
        >
          <span className="text-muted-foreground">{'{}'}</span>
          <span>{tab.source.name}</span>
          {isDirty(tab) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              editorActions.closeTab(id);
            }}
            className="ml-1 grid h-4 w-4 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => editorActions.closeTab(id)}>Закрыть</ContextMenuItem>
        <ContextMenuItem disabled={!canCloseLeft} onClick={() => editorActions.closeTabsToLeft(id)}>
          Закрыть слева
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!canCloseRight}
          onClick={() => editorActions.closeTabsToRight(id)}
        >
          Закрыть справа
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!canCloseOthers}
          onClick={() => editorActions.closeOtherTabs(id)}
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
