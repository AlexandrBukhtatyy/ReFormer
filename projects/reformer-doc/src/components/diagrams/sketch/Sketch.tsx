import { useId, type ReactNode } from 'react';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import type { Drawable, Options } from 'roughjs/bin/core';
import { RoughGenerator } from 'roughjs/bin/generator';
import styles from './sketch.module.css';

/**
 * Примитивы рукописных схем — в стиле Excalidraw: линии рисует rough.js (тот же движок, что у
 * Excalidraw), подписи — шрифт Excalifont. Обычные схемы сайта рисуются примитивами `Diagram`;
 * рукописные — там, где схема повторяет эскиз (карта экосистемы на обзоре рендереров).
 *
 * Как и у `Diagram`, цвета — только переменные темы (`sketch.module.css`): схема верна в светлой и
 * тёмной теме, подписи переводятся, блоки — ссылки. Линии считает генератор rough.js без DOM, у
 * каждого элемента постоянное зерно случайности, поэтому сервер и браузер рисуют одно и то же —
 * гидрация не расходится, а картинка не «дрожит» между сборками.
 */

/** Точка холста `[x, y]`. */
export type Point = readonly [number, number];

/**
 * Тон элемента: цвет линии, заливки и подписи. Полосы фреймворков — цветами, как на эскизе;
 * инструменты вокруг — заливкой.
 */
export type Tone = 'ink' | 'reformer' | 'react' | 'vue' | 'angular' | 'mcp' | 'ai' | 'builder';

const generator = new RoughGenerator();

/** Общие настройки «руки»: умеренная неровность, как у Excalidraw по умолчанию. */
const HAND: Options = { roughness: 1, bowing: 1, strokeWidth: 1.6 };

/** Постоянное зерно из ключа (FNV-1a): одна и та же неровность на сервере и в браузере. */
function seedOf(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 || 1;
}

/** Наборы линий rough.js → `<path>`: контур, сплошная заливка или штриховка — своими классами. */
function Rough({ drawable }: { drawable: Drawable }) {
  return (
    <>
      {drawable.sets.map((set, index) => (
        <path
          key={index}
          d={generator.opsToPath(set, 2)}
          className={
            set.type === 'path'
              ? styles.stroke
              : set.type === 'fillPath'
                ? styles.fillSolid
                : styles.fillHatch
          }
        />
      ))}
    </>
  );
}

/** Прямоугольник со скруглёнными углами — путь SVG для rough.js. */
function roundedRect(x: number, y: number, width: number, height: number, r = 14): string {
  const right = x + width;
  const bottom = y + height;
  return [
    `M ${x + r} ${y}`,
    `L ${right - r} ${y} Q ${right} ${y} ${right} ${y + r}`,
    `L ${right} ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom}`,
    `L ${x + r} ${bottom} Q ${x} ${bottom} ${x} ${bottom - r}`,
    `L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`,
  ].join(' ');
}

/** Стиль линии: сплошная, пунктир или точки. */
export type LineStyle = 'solid' | 'dashed' | 'dotted';

/** У пунктира и точек одна обводка: двойная, как у сплошной, рвёт рисунок штрихов. */
const lineOptions = (line: LineStyle): Options =>
  line === 'solid' ? HAND : { ...HAND, disableMultiStroke: true };

export interface SketchCanvasProps {
  /** Короткое название — читается экранным диктором вместо картинки. */
  title: string;
  /** Подпись под схемой — обычным шрифтом сайта. */
  caption?: ReactNode;
  /** `viewBox` холста. */
  viewBox: string;
  /** Минимальная ширина холста в px: уже — схема прокручивается, а не мельчит текст. */
  minWidth?: number;
  children: ReactNode;
}

/** Холст рукописной схемы с подписью. */
export function SketchCanvas({
  title,
  caption,
  viewBox,
  minWidth = 880,
  children,
}: SketchCanvasProps) {
  const titleId = `${useId()}-title`;
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
          {children}
        </svg>
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}

/** Рукописный текст. */
export function SketchText({
  x,
  y,
  children,
  size = 18,
  anchor = 'start',
  tone = 'ink',
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  tone?: Tone;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      className={clsx(styles.hand, styles.text, styles[`tone_${tone}`])}
    >
      {children}
    </text>
  );
}

export interface SketchBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  /** Строка под заголовком — мельче и цветом пометок (оранжевым, как на эскизе). */
  subtitle?: string;
  tone?: Tone;
  /** Пунктирный контур — как у кита на эскизе. */
  dashed?: boolean;
  /** Сколько копий-подложек за блоком: «стопка» — несколько взаимозаменяемых вариантов. */
  stack?: number;
  /** Внутренняя ссылка сайта: блок становится кликабельным. */
  to?: string;
}

/** Блок: скруглённый прямоугольник с заголовком; по `to` — ссылка на страницу. */
export function SketchBox({
  x,
  y,
  width,
  height,
  title,
  subtitle,
  tone = 'ink',
  dashed,
  stack = 0,
  to,
}: SketchBoxProps) {
  const href = useBaseUrl(to ?? '/');
  const line: LineStyle = dashed ? 'dashed' : 'solid';
  const shape = (dx: number, dy: number, key: string) =>
    generator.path(roundedRect(x + dx, y + dy, width, height), {
      ...lineOptions(line),
      fill: 'currentColor',
      fillStyle: 'solid',
      seed: seedOf(`${title}:${key}`),
    });
  const cx = x + width / 2;
  const titleY = subtitle ? y + height / 2 - 2 : y + height / 2 + 7;
  const body = (
    <g
      className={clsx(
        styles.box,
        styles[`tone_${tone}`],
        line !== 'solid' && styles[line],
        to && styles.link
      )}
    >
      {Array.from({ length: stack }, (_, index) => {
        const offset = (stack - index) * 5;
        return <Rough key={index} drawable={shape(-offset, offset, `stack${index}`)} />;
      })}
      <Rough drawable={shape(0, 0, 'front')} />
      <text
        x={cx}
        y={titleY}
        textAnchor="middle"
        fontSize={19}
        className={clsx(styles.hand, styles.title)}
      >
        {title}
      </text>
      {subtitle && (
        <text
          x={cx}
          y={titleY + 20}
          textAnchor="middle"
          fontSize={15}
          className={clsx(styles.hand, styles.subtitle)}
        >
          {subtitle}
        </text>
      )}
    </g>
  );
  return to ? <a href={href}>{body}</a> : body;
}

export interface SketchRegionProps {
  /** Вершины области: прямоугольник — четыре точки, но можно и «Г». */
  points: readonly Point[];
  tone: Tone;
  /** `hatch` — заштрихованная область (как ReFormer на эскизе), `dashed` — пунктирная рамка. */
  kind: 'hatch' | 'dashed' | 'dotted';
  /** Название и где оно стоит. */
  title?: string;
  titleAt?: Point;
  titleAnchor?: 'start' | 'middle' | 'end';
  /** Ключ зерна: иначе берётся название. */
  seed?: string;
}

/** Область под блоками: группа пакетов, полоса фреймворка, рамка всей схемы. */
export function SketchRegion({
  points,
  tone,
  kind,
  title,
  titleAt,
  titleAnchor = 'start',
  seed,
}: SketchRegionProps) {
  const line: LineStyle = kind === 'hatch' ? 'solid' : kind;
  const drawable = generator.polygon(points as [number, number][], {
    ...lineOptions(line),
    roughness: 1.2,
    seed: seedOf(seed ?? title ?? 'region'),
    ...(kind === 'hatch'
      ? { fill: 'currentColor', fillStyle: 'cross-hatch', hachureGap: 9, fillWeight: 0.6 }
      : {}),
  });
  return (
    <g className={clsx(styles.region, styles[`tone_${tone}`], line !== 'solid' && styles[line])}>
      <Rough drawable={drawable} />
      {title && titleAt && (
        <text
          x={titleAt[0]}
          y={titleAt[1]}
          textAnchor={titleAnchor}
          fontSize={19}
          className={clsx(styles.hand, styles.regionTitle)}
        >
          {title}
        </text>
      )}
    </g>
  );
}

export interface SketchArrowProps {
  /** Точки ломаной: от начала к острию. */
  points: readonly Point[];
  line?: LineStyle;
  /** `both` — наконечники с двух сторон: обмен в обе стороны. */
  heads?: 'end' | 'both';
  /** Ключ зерна; по умолчанию — координаты. */
  seed?: string;
}

/** Наконечник: две короткие линии к острию, как у стрелок Excalidraw. */
function headPoints(from: Point, tip: Point, length = 15, spread = 0.45): [number, number][] {
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const wing = (side: number): [number, number] => [
    tip[0] - length * Math.cos(angle + side * spread),
    tip[1] - length * Math.sin(angle + side * spread),
  ];
  return [wing(1), [tip[0], tip[1]], wing(-1)];
}

/** Стрелка: ломаная от первой точки к последней; наконечники — всегда сплошные. */
export function SketchArrow({ points, line = 'solid', heads = 'end', seed }: SketchArrowProps) {
  const key = seed ?? points.map((p) => p.join(',')).join(' ');
  const shaft = generator.linearPath(points as [number, number][], {
    ...lineOptions(line),
    seed: seedOf(key),
  });
  const last = points.length - 1;
  const tips = [headPoints(points[last - 1], points[last])];
  if (heads === 'both') tips.push(headPoints(points[1], points[0]));
  return (
    <g className={styles.arrow}>
      <g className={clsx(line !== 'solid' && styles[line])}>
        <Rough drawable={shaft} />
      </g>
      {tips.map((tip, index) => (
        <Rough
          key={index}
          drawable={generator.linearPath(tip, { ...HAND, seed: seedOf(`${key}:head${index}`) })}
        />
      ))}
    </g>
  );
}

/** Значок документа: лист с загнутым углом и строками. `x`, `y` — левый верхний угол. */
export function DocIcon({ x, y, seed }: { x: number; y: number; seed: string }) {
  const w = 16;
  const h = 21;
  const fold = 5;
  const sheet = generator.path(
    `M ${x} ${y} L ${x + w - fold} ${y} L ${x + w} ${y + fold} L ${x + w} ${y + h} L ${x} ${y + h} Z`,
    {
      ...HAND,
      strokeWidth: 1.2,
      roughness: 0.6,
      fill: 'currentColor',
      fillStyle: 'solid',
      seed: seedOf(seed),
    }
  );
  const lines = [7, 11, 15].map((dy, index) =>
    generator.line(x + 3.5, y + dy, x + w - 3.5, y + dy, {
      ...HAND,
      strokeWidth: 1,
      roughness: 0.5,
      seed: seedOf(`${seed}:${index}`),
    })
  );
  return (
    <g className={clsx(styles.doc, styles.tone_ink)}>
      <Rough drawable={sheet} />
      {lines.map((drawable, index) => (
        <Rough key={index} drawable={drawable} />
      ))}
    </g>
  );
}

/** Человечек: голова и плечи. `cx`, `top` — центр по горизонтали и верх головы. */
export function UserFigure({ cx, top, label }: { cx: number; top: number; label: string }) {
  const head = generator.circle(cx, top + 22, 42, {
    ...HAND,
    fill: 'currentColor',
    fillStyle: 'solid',
    seed: seedOf('user:head'),
  });
  const shoulders = generator.path(
    `M ${cx - 38} ${top + 92} Q ${cx - 38} ${top + 48} ${cx} ${top + 48} Q ${cx + 38} ${top + 48} ${cx + 38} ${top + 92} Z`,
    { ...HAND, fill: 'currentColor', fillStyle: 'solid', seed: seedOf('user:body') }
  );
  return (
    <g className={clsx(styles.box, styles.tone_ink)}>
      <Rough drawable={shoulders} />
      <Rough drawable={head} />
      <text
        x={cx}
        y={top + 116}
        textAnchor="middle"
        fontSize={22}
        className={clsx(styles.hand, styles.title)}
      >
        {label}
      </text>
    </g>
  );
}
