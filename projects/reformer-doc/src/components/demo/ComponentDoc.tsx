import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
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

type TabId = 'description' | 'variants' | 'examples' | 'api';

const TABS: { id: TabId; label: () => string }[] = [
  { id: 'description', label: demoText.tabDescription },
  { id: 'variants', label: demoText.tabVariants },
  { id: 'examples', label: demoText.tabExamples },
  { id: 'api', label: demoText.tabApi },
];

function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

/** Якорь из адреса без `#`. Кириллические id заголовков браузер хранит в адресе закодированными. */
function readHash(): string {
  const raw = window.location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

interface ComponentDocProps {
  config: ComponentDocConfig;
  /**
   * Текст страницы — вкладка «Описание», она открыта по умолчанию. На странице `.mdx` это
   * всё, что стоит между открывающим и закрывающим тегом: обычный markdown с заголовками.
   * Без детей вкладки «Описание» нет и первой открывается «Варианты».
   */
  children?: ReactNode;
}

/**
 * Оболочка страницы компонента: вкладки Описание | Варианты | Примеры | API.
 *
 * Открытая вкладка живёт в адресе: `#variants`, `#examples`, `#api`; у «Описания» адрес без
 * якоря. Ссылка на заголовок другой вкладки — пункт оглавления справа или ссылка с соседней
 * страницы — сама открывает нужную вкладку и докручивает до заголовка.
 */
export function ComponentDoc({ config, children }: ComponentDocProps) {
  const hasDescription = children != null;
  const tabs = hasDescription ? TABS : TABS.filter((t) => t.id !== 'description');
  const defaultTab = tabs[0].id;

  // Сервер и первый рендер всегда отдают вкладку по умолчанию — иначе гидрация разойдётся с
  // разметкой. Вкладку из адреса подхватывает эффект ниже.
  const [active, setActive] = useState<TabId>(defaultTab);
  const hintId = useId();
  const baseId = useId();
  // Заголовок, до которого докрутить после смены вкладки: пока вкладка закрыта, его нет в
  // разметке, и браузеру некуда прокручивать.
  const pendingAnchor = useRef<string | null>(null);

  useEffect(() => {
    const syncWithHash = () => {
      const id = readHash();
      if (!id) return;
      if (isTabId(id)) {
        if (id !== 'description' || hasDescription) setActive(id);
        return;
      }
      // Заголовок открытой вкладки уже в разметке — до него браузер докрутит сам.
      if (document.getElementById(id)) return;
      // Закрыта вкладка, где этот заголовок. В «Примерах» заголовки — id примеров из конфига;
      // остальные якоря страницы (оглавление, ссылки на разделы) ведут в «Описание».
      const target = config.examples.some((ex) => ex.id === id)
        ? 'examples'
        : hasDescription
          ? 'description'
          : null;
      if (!target) return;
      pendingAnchor.current = id;
      setActive(target);
    };
    // Вкладку из адреса можно узнать только после маунта.
    syncWithHash();
    window.addEventListener('hashchange', syncWithHash);
    return () => window.removeEventListener('hashchange', syncWithHash);
  }, [config.examples, hasDescription]);

  useEffect(() => {
    const id = pendingAnchor.current;
    if (!id) return;
    pendingAnchor.current = null;
    document.getElementById(id)?.scrollIntoView();
  }, [active]);

  const onTab = (id: TabId) => {
    setActive(id);
    const { pathname, search } = window.location;
    const url = id === defaultTab ? `${pathname}${search}` : `#${id}`;
    window.history.replaceState(window.history.state, '', url);
  };

  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  return (
    <div className={styles.componentDoc}>
      <div className={styles.tabBar} role="tablist" aria-label={demoText.tabsLabel(config.name)}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            // Панель в разметке одна — у открытой вкладки.
            aria-controls={active === t.id ? panelId(t.id) : undefined}
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

      <div role="tabpanel" id={panelId(active)} aria-labelledby={tabId(active)}>
        {/* Описание — вне DemoLocale: провайдер с загрузкой словаря ничего не рисует, пока
            словарь не пришёл, и текст страницы не попал бы в серверную разметку — ни в поиск,
            ни в проверку якорей при сборке. Живым демо в тексте язык даёт сам LiveExample. */}
        {active === 'description' ? (
          children
        ) : (
          <DemoLocale>
            <DemoTab tab={active} config={config} />
          </DemoLocale>
        )}
      </div>
    </div>
  );
}

/** Содержимое вкладок с живыми демо: «Варианты», «Примеры», «API». */
function DemoTab({
  tab,
  config,
}: {
  tab: Exclude<TabId, 'description'>;
  config: ComponentDocConfig;
}) {
  if (tab === 'variants') return <VariantGallery variants={config.variants} />;

  if (tab === 'examples') {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
      {config.apiNote && <p className={styles.apiNote}>{config.apiNote}</p>}
      {config.api ? (
        <ApiExplorer api={config.api} />
      ) : config.playground ? (
        <Playground playground={config.playground} props={config.props} />
      ) : config.props && config.props.length > 0 ? (
        <div className={styles.propsTableWrap}>
          <PropsTable rows={config.props} />
        </div>
      ) : (
        <p>{demoText.noPlayground()}</p>
      )}
    </>
  );
}
