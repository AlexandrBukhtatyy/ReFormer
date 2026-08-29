/**
 * Каркасная поверхность: структура схемы рамками, без исполнения чего-либо.
 *
 * Она не может отказать — ни каталога, ни namespace кита, ни рабочей области ей не нужно.
 * Ровно поэтому она и существует: когда форма не компилируется или кит недоступен, выбор стоит
 * между структурой и пустым прямоугольником с текстом ошибки, и структура полезнее.
 *
 * Выбор кликом здесь работает без класс-токенов: рамку рисуем мы сами, и адрес узла у неё
 * под рукой. Аннотация схемы нужна там, где разметку рисует чужой компонент.
 *
 * @module plugins/preview/skeleton/SkeletonView
 */

import { useMemo, type MouseEvent, type ReactNode } from 'react';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { NodeId } from '@/sdk';
import type { PreviewContext } from '../contract';
import type { PreviewHost } from '../host';
import { Notice } from '../ui/Notice';
import { usePreviewSchema, usePreviewSelection } from '../ui/hooks';
import { buildSkeleton, type SkeletonNode } from './tree';

/** Идентификатор поверхности. Он же имя источника находок. */
export const SKELETON_SURFACE_ID = 'preview.skeleton';

export interface SkeletonViewProps {
  readonly ctx: PreviewContext;
  readonly host: PreviewHost;
}

export function SkeletonView({ ctx, host }: SkeletonViewProps): ReactNode {
  const t = host.useTranslate();
  const schema = usePreviewSchema(ctx);
  const selection = usePreviewSelection(ctx);
  const leaves = host.kit()?.leafComponents;

  const tree = useMemo(
    () => (schema === null ? null : buildSkeleton(schema, leaves)),
    [schema, leaves]
  );

  if (tree === null) {
    return <Notice title={t('empty.no-schema')} detail={t('empty.no-schema.detail')} />;
  }

  const selected = new Set(selection);
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <Frame node={tree} selected={selected} onSelect={(id) => ctx.select([id])} />
      </div>
    </ScrollArea>
  );
}

interface FrameProps {
  readonly node: SkeletonNode;
  readonly selected: ReadonlySet<NodeId>;
  readonly onSelect: (id: NodeId) => void;
}

/** Цвет рамки по виду узла: поле, список, контейнер — три разные вещи, и это видно сразу. */
const BORDER_BY_KIND: Readonly<Record<string, string>> = {
  field: 'border-sky-400/50',
  array: 'border-violet-400/50',
  container: 'border-border',
};

function Frame({ node, selected, onSelect }: FrameProps): ReactNode {
  const isSelected = node.id !== null && selected.has(node.id);
  const click = (event: MouseEvent<HTMLDivElement>): void => {
    // Останов всплытия: клик по вложенной рамке выбирает ЕЁ, а не всех её предков подряд.
    event.stopPropagation();
    if (node.id !== null) onSelect(node.id);
  };

  return (
    <div
      onClick={click}
      className={[
        'rounded-md border border-dashed p-2',
        BORDER_BY_KIND[node.kind] ?? 'border-border',
        isSelected ? 'ring-ring ring-2' : '',
        node.id === null ? 'opacity-60' : '',
      ]
        .filter((part) => part !== '')
        .join(' ')}
    >
      <div className="flex items-baseline gap-2 text-[12px]">
        <span className="text-foreground font-medium">{node.title}</span>
        {node.component === null ? null : (
          <span className="text-muted-foreground font-mono text-[11px]">{node.component}</span>
        )}
        {node.binding === null ? null : (
          <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
            {node.binding}
          </span>
        )}
      </div>
      {node.children.length === 0 ? null : (
        <div className="mt-2 flex flex-col gap-2">
          {node.children.map((child, index) => (
            <Frame
              // Адрес узла как ключ; у узла без адреса ключом остаётся позиция — она
              // единственное, чем он отличается от соседа.
              key={child.id ?? `${node.id ?? 'root'}#${index}`}
              node={child}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
