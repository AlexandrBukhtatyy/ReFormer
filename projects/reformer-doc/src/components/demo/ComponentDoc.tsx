import { useEffect, useId, useState } from 'react';
import clsx from 'clsx';
import { Info } from 'lucide-react';
import Heading from '@theme/Heading';
import { VariantGallery } from './VariantGallery';
import { Playground } from './Playground';
import { ApiExplorer } from './ApiExplorer';
import { ApiPreview } from './ApiPreview';
import { DemoLocale } from './DemoLocale';
import { PropsTable } from './PropsTable';
import type { ComponentDocConfig } from './types';
import { demoText } from './messages';
import styles from './styles.module.css';

type TabId = 'variants' | 'examples' | 'api';

const TABS: { id: TabId; label: () => string }[] = [
  { id: 'variants', label: demoText.tabVariants },
  { id: 'examples', label: demoText.tabExamples },
  { id: 'api', label: demoText.tabApi },
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
  const hintId = useId();

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
    <DemoLocale>
      <div className={styles.componentDoc}>
        <div className={styles.tabBar} role="tablist" aria-label={demoText.tabsLabel(config.name)}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              className={clsx(styles.tab, active === t.id && styles.tabActive)}
              onClick={() => onTab(t.id)}
            >
              {t.label()}
            </button>
          ))}

          <div className={styles.hint}>
            <button
              type="button"
              className={styles.hintTrigger}
              aria-label={demoText.tabsHintLabel()}
              aria-describedby={hintId}
            >
              <Info size={16} aria-hidden />
            </button>
            <div role="tooltip" id={hintId} className={styles.tooltip}>
              <p>
                <strong>{demoText.tabVariants()}</strong> — {demoText.tabsHintVariants()}
              </p>
              <p>
                <strong>{demoText.tabExamples()}</strong> — {demoText.tabsHintExamples()}
              </p>
            </div>
          </div>
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
                    minimal
                    showFooter={false}
                    codeFlavors={[
                      { id: 'code', label: demoText.code(), language: ex.language, code: ex.code },
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
            <p>{demoText.noPlayground()}</p>
          ))}
      </div>
    </DemoLocale>
  );
}
