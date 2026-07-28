/**
 * Таб-бар открытых схем (стиль VSCode, прототип §4): моно-имя, оранжевая точка при dirty, крестик.
 *
 * @module reformer-builder/canvas/TabBar
 */

import { X } from 'lucide-react';
import { editorActions, isDirty, useActiveTabId, useTab, useTabOrder } from '../store';
import { cn } from '../lib/cn';

function TabItem({ id }: { id: string }) {
  const tab = useTab(id);
  const activeId = useActiveTabId();
  if (!tab) return null;
  const active = id === activeId;
  return (
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
  );
}

export function TabBar() {
  const order = useTabOrder();
  return (
    <div className="flex h-[34px] flex-none items-stretch overflow-x-auto border-b border-border bg-sidebar">
      {order.map((id) => (
        <TabItem key={id} id={id} />
      ))}
    </div>
  );
}
