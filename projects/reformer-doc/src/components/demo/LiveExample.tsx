import type { ComponentType } from 'react';
import { ApiPreview } from './ApiPreview';
import { DemoLocale } from './DemoLocale';
import { demoText } from './messages';
import styles from './styles.module.css';

export interface LiveExampleProps {
  /** Пример — default-экспорт файла из `src/components/demo/live/`. */
  component: ComponentType;
  /** Исходник ТОГО ЖЕ файла: `import source from '…/example.tsx?raw'`. */
  source: string;
  /** Подпись под примером: что в нём попробовать. */
  caption?: string;
}

/**
 * Живой пример для страниц-руководств: работающая форма и её код в одной карточке.
 *
 * Код не пишется строкой рядом с рендером, как в `ComponentDoc`, а берётся из того же файла
 * через `?raw` (см. `plugins/raw-source-loader.cjs`). Поэтому вкладка «Код» не может разойтись
 * с тем, что работает в превью: поправили пример — поправился и показанный код.
 *
 * Язык примера — язык страницы (`DemoLocale`). В коде примера провайдера нет — это обвязка сайта,
 * а не часть приёма, который пример показывает.
 *
 * @example
 * ```mdx
 * import QuickStart from '@site/src/components/demo/live/getting-started/quick-start';
 * import quickStartSource from '@site/src/components/demo/live/getting-started/quick-start.tsx?raw';
 *
 * <LiveExample component={QuickStart} source={quickStartSource} />
 * ```
 */
export function LiveExample({ component: Example, source, caption }: LiveExampleProps) {
  return (
    <figure className={styles.liveExample}>
      <ApiPreview
        showFooter={false}
        codeFlavors={[{ id: 'tsx', label: demoText.code(), code: source.trimEnd() }]}
      >
        <DemoLocale>
          <Example />
        </DemoLocale>
      </ApiPreview>
      {caption && <figcaption className={styles.liveExampleCaption}>{caption}</figcaption>}
    </figure>
  );
}
