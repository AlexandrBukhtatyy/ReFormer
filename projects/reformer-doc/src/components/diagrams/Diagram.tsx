import { createContext, useContext, useId, type ReactNode } from 'react';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './diagram.module.css';

/**
 * Примитивы нарисованных схем сайта: рамка-фигура, блок и стрелка.
 *
 * Цвета — только переменные темы Infima (`--ifm-*`) в `diagram.module.css`, поэтому одна и та же
 * схема верна в светлой и тёмной теме без второго варианта. Подписи передаются строками, а
 * сами схемы берут их из `translate()` — при переводе сайта картинку не перерисовывают.
 *
 * Сложные связи (ход данных, последовательности, состояния) рисуются Mermaid прямо в тексте
 * страницы; эти примитивы — для немногих «карт», где важна раскладка, а не порядок.
 */

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
  /** Пояснение строкой ниже. Переносов нет — держите коротким. */
  subtitle?: string;
  /** Внутренняя ссылка сайта (`/docs/...`): блок становится кликабельным. */
  to?: string;
  /** `accent` — главный блок схемы, `ghost` — побочный (пунктир). */
  variant?: 'default' | 'accent' | 'ghost';
}

/** Блок с заголовком и пояснением; по `to` — ссылка на страницу. */
export function Box({ x, y, width, height, title, subtitle, to, variant = 'default' }: BoxProps) {
  const href = useBaseUrl(to ?? '/');
  const cx = x + width / 2;
  const titleY = subtitle ? y + height / 2 - 4 : y + height / 2 + 5;
  const body = (
    <g className={clsx(styles.box, styles[variant], to && styles.link)}>
      <rect x={x} y={y} width={width} height={height} rx={8} />
      <text x={cx} y={titleY} textAnchor="middle" className={styles.boxTitle}>
        {title}
      </text>
      {subtitle && (
        <text x={cx} y={y + height / 2 + 16} textAnchor="middle" className={styles.boxSubtitle}>
          {subtitle}
        </text>
      )}
    </g>
  );
  return to ? <a href={href}>{body}</a> : body;
}

export interface ArrowProps {
  from: [number, number];
  to: [number, number];
  /** Подпись у середины стрелки. */
  label?: string;
  dashed?: boolean;
}

/** Прямая стрелка `from → to`. */
export function Arrow({ from, to, label, dashed }: ArrowProps) {
  const markerId = useContext(MarkerContext);
  const [x1, y1] = from;
  const [x2, y2] = to;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className={clsx(styles.arrow, dashed && styles.dashed)}
        markerEnd={`url(#${markerId})`}
      />
      {label && (
        <text x={(x1 + x2) / 2 + 8} y={(y1 + y2) / 2 + 4} className={styles.arrowLabel}>
          {label}
        </text>
      )}
    </g>
  );
}
