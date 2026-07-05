import { useEffect, useState } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import { VariantGallery } from './VariantGallery';
import { Playground } from './Playground';
import { ApiExplorer } from './ApiExplorer';
import { ApiPreview } from './ApiPreview';
import { PropsTable } from './PropsTable';
import type { ComponentDocConfig } from './types';
import styles from './styles.module.css';

type TabId = 'variants' | 'examples' | 'api';

const TABS: { id: TabId; label: string }[] = [
  { id: 'variants', label: 'Variants' },
  { id: 'examples', label: 'Examples' },
  { id: 'api', label: 'API' },
];

function isTabId(value: string): value is TabId {
  return value === 'variants' || value === 'examples' || value === 'api';
}

/**
 * Оболочка страницы компонента в стиле TaigaUI: три верхних таба
 * Variants | Examples | API (Variants активен по умолчанию). Deep-link через hash.
 */
export function ComponentDoc({ config }: { config: ComponentDocConfig }) {
  const [active, setActive] = useState<TabId>('variants');

  // Deep-link по hash: на маунте синхронизируем активный таб с URL. setState в
  // эффекте здесь намеренный — сервер/первый рендер дают 'variants' (hydration-
  // safety), после маунта подхватываем hash из адреса.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isTabId(hash)) setActive(hash);
  }, []);

  const onTab = (id: TabId) => {
    setActive(id);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <div className={styles.componentDoc}>
      <div className={styles.tabBar} role="tablist" aria-label={`${config.name} documentation`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={clsx(styles.tab, active === t.id && styles.tabActive)}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'variants' && <VariantGallery variants={config.variants} />}

      {active === 'examples' && (
        <div>
          {config.examples.map((ex) => {
            const Render = ex.render;
            return (
              <section key={ex.id} className={styles.example}>
                <Heading as="h3" id={ex.id} className={styles.exampleTitle}>
                  {ex.title}
                </Heading>
                {ex.description && <p className={styles.exampleDesc}>{ex.description}</p>}
                <ApiPreview
                  showFooter={false}
                  codeFlavors={[
                    { id: 'code', label: 'Code', language: ex.language, code: ex.code },
                  ]}
                >
                  <Render />
                </ApiPreview>
              </section>
            );
          })}
        </div>
      )}

      {active === 'api' &&
        (config.api ? (
          <ApiExplorer api={config.api} />
        ) : config.playground ? (
          <Playground playground={config.playground} props={config.props} />
        ) : config.props && config.props.length > 0 ? (
          <div className={styles.propsTableWrap}>
            <PropsTable rows={config.props} />
          </div>
        ) : (
          <p>Для этого компонента нет интерактивного playground.</p>
        ))}
    </div>
  );
}
