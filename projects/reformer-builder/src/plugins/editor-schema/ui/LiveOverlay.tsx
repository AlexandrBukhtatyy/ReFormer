/**
 * Слой поверх живой формы: указатель броска и ручка перетаскивания.
 *
 * ## Рисуется императивно, а не состоянием React
 *
 * `dragover` браузер шлёт непрерывно, десятками событий в секунду, и `mousemove` не отстаёт.
 * Держи мы указатель в состоянии — каждое дрожание мыши перерисовывало бы поддерево, внутри
 * которого лежит ЧУЖОЙ корень React с формой. Поэтому наружу торчит ручка с тремя глаголами,
 * а меняются стили готовых узлов. Тот же довод, что у схематичного вида, только там цена
 * ошибки — перерисовка коробок, а здесь — перерисовка настоящей формы.
 *
 * ## Слой не ловит указатель, ручка — ловит
 *
 * `pointer-events: none` на слое обязателен: иначе он перехватил бы каждый щелчок по форме,
 * и живая форма перестала бы быть живой. Исключение — сама ручка: она наш элемент, её
 * `draggable` и есть источник перетаскивания. Ставить `draggable` на узлы чужого DOM нельзя:
 * протяжка в текстовом поле начала бы тащить узел вместо выделения текста.
 *
 * @module plugins/editor-schema/ui/LiveOverlay
 */

import {
  useImperativeHandle,
  useRef,
  type DragEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import { GripVertical } from 'lucide-react';
import type { NodeId } from '@/sdk';
import type { Indicator } from '../live/live-zone';
import type { Rect } from '../schematic/schematic-zone';

export interface LiveOverlayHandle {
  /** Показать указатель броска; `null` — стереть. */
  showDrop(indicator: Indicator | null): void;
  /** Показать ручку у узла; `null` — спрятать. */
  showGrip(target: { readonly id: NodeId; readonly box: Rect } | null): void;
  /** Стереть всё: бросок закончился, курсор ушёл, форма прокрутилась. */
  clear(): void;
}

export interface LiveOverlayProps {
  readonly api: RefObject<LiveOverlayHandle | null>;
  readonly labels: {
    /** Подпись оси будущей обёртки. */
    readonly row: string;
    readonly column: string;
    readonly grip: string;
  };
  onGripDragStart(event: DragEvent<HTMLElement>, id: NodeId): void;
  onGripDragEnd(): void;
}

/** Прямоугольник → инлайновые стили. Отдельно, чтобы место задавалось ровно в одном виде. */
function place(element: HTMLElement, box: Rect): void {
  element.style.left = `${box.left}px`;
  element.style.top = `${box.top}px`;
  element.style.width = `${box.width}px`;
  element.style.height = `${box.height}px`;
}

export function LiveOverlay({
  api,
  labels,
  onGripDragStart,
  onGripDragEnd,
}: LiveOverlayProps): ReactElement {
  const drop = useRef<HTMLDivElement | null>(null);
  const chip = useRef<HTMLSpanElement | null>(null);
  const grip = useRef<HTMLButtonElement | null>(null);
  /** Узел, за который тащит ручка: обработчик `dragstart` должен знать его в момент жеста. */
  const gripTarget = useRef<NodeId | null>(null);

  useImperativeHandle(
    api,
    (): LiveOverlayHandle => ({
      showDrop(indicator) {
        const element = drop.current;
        const label = chip.current;
        if (element === null || label === null) return;
        if (indicator === null) {
          element.hidden = true;
          label.hidden = true;
          return;
        }
        place(element, indicator.box);
        element.hidden = false;
        // Рамка у «внутрь», сплошная заливка у линии вставки: у них разный смысл, и путать
        // их нельзя — одна говорит «сюда положить», другая «здесь появится».
        element.style.background = indicator.shape === 'line' ? 'var(--color-ring, #6366f1)' : '';
        element.style.border =
          indicator.shape === 'frame' ? '2px solid var(--color-ring, #6366f1)' : '';

        if (indicator.axis === null) {
          label.hidden = true;
          return;
        }
        // Подпись только у обёрточных зон: они единственные создают новый узел, и человек
        // вправе знать это до того, как отпустит кнопку.
        label.textContent = indicator.axis === 'row' ? labels.row : labels.column;
        label.style.left = `${indicator.box.left}px`;
        label.style.top = `${Math.max(0, indicator.box.top - 18)}px`;
        label.hidden = false;
      },

      showGrip(target) {
        const element = grip.current;
        if (element === null) return;
        if (target === null) {
          element.hidden = true;
          gripTarget.current = null;
          return;
        }
        gripTarget.current = target.id;
        place(element, target.box);
        element.hidden = false;
      },

      clear() {
        if (drop.current !== null) drop.current.hidden = true;
        if (chip.current !== null) chip.current.hidden = true;
        if (grip.current !== null) grip.current.hidden = true;
        gripTarget.current = null;
      },
    }),
    [labels]
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div ref={drop} hidden className="absolute rounded-[2px]" />
      <span
        ref={chip}
        hidden
        className="bg-primary text-primary-foreground absolute rounded px-1 text-[10px] leading-4"
      />
      <button
        ref={grip}
        hidden
        type="button"
        draggable
        aria-label={labels.grip}
        className="border-border bg-background text-muted-foreground hover:text-foreground pointer-events-auto absolute flex cursor-grab items-center justify-center rounded border"
        onDragStart={(event) => {
          const id = gripTarget.current;
          if (id === null) return;
          onGripDragStart(event, id);
        }}
        onDragEnd={onGripDragEnd}
      >
        <GripVertical className="size-3" />
      </button>
    </div>
  );
}
