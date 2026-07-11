import type { ComponentType, ReactNode } from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './styles.module.css';

const FALLBACK = <span className={styles.fallback}>Загрузка демо…</span>;

/**
 * Лёгкая обёртка: рендерит живой компонент только на клиенте (`<BrowserOnly>`),
 * без рамки-канвы. Используется внутри карточек Variants, где рамку даёт карточка.
 */
export function Live({ render: Render }: { render: ComponentType }) {
  return (
    <div className="reformer-demo">
      <BrowserOnly fallback={FALLBACK}>{() => <Render />}</BrowserOnly>
    </div>
  );
}

/**
 * Живой компонент в оформленной канве (рамка + фон). Для табов Examples/API.
 */
export function LiveCanvas({
  render: Render,
  center,
}: {
  render: ComponentType;
  center?: boolean;
}) {
  return (
    <div className={clsx('reformer-demo', styles.canvas, center && styles.canvasCenter)}>
      <BrowserOnly fallback={FALLBACK}>{() => <Render />}</BrowserOnly>
    </div>
  );
}

/**
 * Публичная канва для инлайнового использования в `.mdx`. Принимает JSX или
 * функцию-рендер; живой контент рендерится только на клиенте.
 */
export function Demo({
  children,
  center,
}: {
  children: ReactNode | (() => ReactNode);
  center?: boolean;
}) {
  return (
    <div className={clsx('reformer-demo', styles.canvas, center && styles.canvasCenter)}>
      <BrowserOnly fallback={FALLBACK}>
        {() => (typeof children === 'function' ? (children as () => ReactNode)() : children)}
      </BrowserOnly>
    </div>
  );
}
