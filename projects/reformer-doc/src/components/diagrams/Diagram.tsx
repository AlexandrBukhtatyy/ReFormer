import { createContext, useContext, useId, type ReactNode } from 'react';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './diagram.module.css';

/**
 * Примитивы нарисованных схем сайта: рамка-фигура, блок, стрелка, группа, подпись и терминал.
 *
 * Цвета — только переменные темы Infima (`--ifm-*`) в `diagram.module.css`, поэтому одна и та же
 * схема верна в светлой и тёмной теме без второго варианта. Подписи передаются строками, а
 * сами схемы берут их из `translate()` — при переводе сайта картинку не перерисовывают.
 *
 * Все схемы сайта — и карты, и ход данных, и состояния — рисуются этими примитивами, а не
 * Mermaid: у Mermaid свои шрифты, заливки и стрелки, и его схема выбивается из соседних.
 * Последовательности сообщений собирает `SequenceDiagram` поверх тех же примитивов.
 */

/** Точка холста `[x, y]`. */
export type Point = readonly [number, number];

/** Высота строки подписи под заголовком блока. */
const SUBTITLE_LINE = 17;
/** Высота строки подписи у стрелки. */
const LABEL_LINE = 15;

/**
 * Строки многострочной подписи: массив или строка с `\n`. Перевод строки внутри `translate()`
 * оставляет перенос переводчику — английская подпись ломается в своём месте.
 */
export function splitLines(text: string | readonly string[]): readonly string[] {
  return typeof text === 'string' ? text.split('\n') : text;
}

/** id маркера-наконечника: у каждой схемы свой, иначе две схемы на странице делят один `<marker>`. */
const MarkerContext = createContext<string>('');

export interface DiagramProps {
  /** Короткое название — читается экранным диктором вместо картинки. */
  title: string;
  /** Подпись под схемой: что на ней главное. */
  caption?: ReactNode;
  /** `viewBox` холста, например `"0 0 760 420"`. */
  viewBox: string;
  /** Минимальная ширина холста в px: уже — схема прокручивается, а не мельчит текст. */
  minWidth?: number;
  children: ReactNode;
}

/** Схема в рамке с подписью. */
export function Diagram({ title, caption, viewBox, minWidth = 560, children }: DiagramProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const markerId = `${id}-arrow`;
  return (
    <figure className={styles.figure}>
      <div className={styles.scroller}>
        <svg
          className={styles.svg}
          viewBox={viewBox}
          role="img"
          aria-labelledby={titleId}
          style={{ minWidth }}
        >
          <title id={titleId}>{title}</title>
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowHead} />
            </marker>
          </defs>
          <MarkerContext.Provider value={markerId}>{children}</MarkerContext.Provider>
        </svg>
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}

export interface BoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Заголовок блока — обычно имя пакета или сущности (моноширинный). */
  title: string;
  /**
   * Пояснение под заголовком. Автопереноса нет: строки разделяет `\n` или массив. Держите
   * коротким; высоту блока под число строк задаёт схема.
   */
  subtitle?: string | readonly string[];
  /** Внутренняя ссылка сайта (`/docs/...`): блок становится кликабельным. */
  to?: string;
  /** `accent` — главный блок схемы, `ghost` — побочный (пунктир). */
  variant?: 'default' | 'accent' | 'ghost';
}

/** Блок с заголовком и пояснением; по `to` — ссылка на страницу. */
export function Box({ x, y, width, height, title, subtitle, to, variant = 'default' }: BoxProps) {
  const href = useBaseUrl(to ?? '/');
  const cx = x + width / 2;
  const lines = subtitle === undefined ? [] : splitLines(subtitle);
  // Заголовок и строки пояснения стоят блоком по центру по вертикали.
  const titleY =
    lines.length === 0
      ? y + height / 2 + 5
      : y + height / 2 - 4 - ((lines.length - 1) * SUBTITLE_LINE) / 2;
  const body = (
    <g className={clsx(styles.box, styles[variant], to && styles.link)}>
      <rect x={x} y={y} width={width} height={height} rx={8} />
      <text x={cx} y={titleY} textAnchor="middle" className={styles.boxTitle}>
        {title}
      </text>
      {lines.map((line, index) => (
        <text
          key={index}
          x={cx}
          y={titleY + 20 + index * SUBTITLE_LINE}
          textAnchor="middle"
          className={styles.boxSubtitle}
        >
          {line}
        </text>
      ))}
    </g>
  );
  return to ? <a href={href}>{body}</a> : body;
}

export interface LabelProps {
  x: number;
  y: number;
  /** Строка (строки разделяет `\n`) или массив строк — первая стоит на `y`, следующие ниже. */
  text: string | readonly string[];
  anchor?: 'start' | 'middle' | 'end';
}

/** Свободная подпись мелким шрифтом: у стрелки, у терминала, над группой блоков. */
export function Label({ x, y, text, anchor = 'start' }: LabelProps) {
  const lines = splitLines(text);
  return (
    <text x={x} y={y} textAnchor={anchor} className={styles.arrowLabel}>
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : LABEL_LINE}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export interface ArrowProps {
  from: Point;
  to: Point;
  /** Точки излома между `from` и `to`: стрелка идёт ломаной со скруглёнными углами. */
  via?: readonly Point[];
  /** Подпись стрелки: строка (строки разделяет `\n`) или массив строк. */
  label?: string | readonly string[];
  /**
   * Где стоит подпись. По умолчанию у прямой стрелки: над серединой горизонтальной, справа от
   * середины вертикальной; у ломаной — справа от середины первого отрезка.
   */
  labelAt?: Point;
  labelAnchor?: 'start' | 'middle' | 'end';
  dashed?: boolean;
  /** `false` — линия без наконечника: ветка шины, которая дальше расходится стрелками. */
  head?: boolean;
}

/** Путь через точки со скруглёнными углами радиуса `r`. */
function roundedPath(points: readonly Point[], r = 10): string {
  const [first, ...rest] = points;
  let d = `M ${first[0]} ${first[1]}`;
  for (let i = 0; i < rest.length; i++) {
    const [x, y] = rest[i];
    const next = rest[i + 1];
    if (!next) {
      d += ` L ${x} ${y}`;
      break;
    }
    const [px, py] = i === 0 ? first : rest[i - 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(next[0] - x, next[1] - y);
    const cut = Math.min(r, inLen / 2, outLen / 2);
    const ax = x - ((x - px) / inLen) * cut;
    const ay = y - ((y - py) / inLen) * cut;
    const bx = x + ((next[0] - x) / outLen) * cut;
    const by = y + ((next[1] - y) / outLen) * cut;
    d += ` L ${ax} ${ay} Q ${x} ${y} ${bx} ${by}`;
  }
  return d;
}

/** Стрелка `from → to`: прямая или ломаная через `via`. */
export function Arrow({
  from,
  to,
  via = [],
  label,
  labelAt,
  labelAnchor,
  dashed,
  head = true,
}: ArrowProps) {
  const markerId = useContext(MarkerContext);
  const points: Point[] = [from, ...via, to];
  const [x1, y1] = points[0];
  const [x2, y2] = points[1];
  const horizontal = via.length === 0 && Math.abs(x2 - x1) > Math.abs(y2 - y1);
  const autoAt: Point = horizontal
    ? [(x1 + x2) / 2, (y1 + y2) / 2 - 8]
    : [(x1 + x2) / 2 + 8, (y1 + y2) / 2 + 4];
  const [lx, ly] = labelAt ?? autoAt;
  const lines = label === undefined ? [] : splitLines(label);
  // Над горизонтальной стрелкой многострочная подпись растёт вверх, чтобы не лечь на линию.
  const shiftUp = !labelAt && horizontal ? (lines.length - 1) * LABEL_LINE : 0;
  return (
    <g>
      <path
        d={roundedPath(points)}
        className={clsx(styles.arrow, dashed && styles.dashed)}
        markerEnd={head ? `url(#${markerId})` : undefined}
      />
      {lines.length > 0 && (
        <Label
          x={lx}
          y={ly - shiftUp}
          text={lines}
          anchor={labelAnchor ?? (horizontal ? 'middle' : 'start')}
        />
      )}
    </g>
  );
}

export interface GroupProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Название группы — в левом углу. */
  title: string;
  /**
   * Где название: сверху (по умолчанию) или снизу — когда сверху в группу входят стрелки и
   * легли бы на текст.
   */
  titleAt?: 'top' | 'bottom';
}

/**
 * Подложка, объединяющая блоки: приложение, повтор шагов, слой. Рисуется до блоков группы,
 * чтобы оказаться под ними; с той стороны, где название, оставьте ~28px.
 */
export function Group({ x, y, width, height, title, titleAt = 'top' }: GroupProps) {
  return (
    <g className={styles.group}>
      <rect x={x} y={y} width={width} height={height} rx={12} />
      <text
        x={x + 12}
        y={titleAt === 'top' ? y + 19 : y + height - 11}
        className={styles.groupTitle}
      >
        {title}
      </text>
    </g>
  );
}

export interface TerminalProps {
  x: number;
  y: number;
  /** `start` — точка входа, `end` — выход (точка в кольце). */
  kind: 'start' | 'end';
}

/** Начало и конец машины состояний. */
export function Terminal({ x, y, kind }: TerminalProps) {
  return kind === 'start' ? (
    <circle cx={x} cy={y} r={7} className={styles.terminalDot} />
  ) : (
    <g>
      <circle cx={x} cy={y} r={10} className={styles.terminalRing} />
      <circle cx={x} cy={y} r={5.5} className={styles.terminalDot} />
    </g>
  );
}
