/**
 * Раздел бенчмарка на лендинге: плитки из данных опубликованного отчёта и ссылка на отчёт
 * /benchmark/forms. Берёт только сводный файл (строки «Итога» и бандл), а не полные данные
 * страницы отчёта.
 */
import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import headline from '@site/src/data/forms-benchmark-headline.json';
import { computeTiles } from './highlights';
import { useBenchText } from './i18n';
import { HighlightTile, formatDate } from './parts';
import styles from './LandingBenchmark.module.css';

export default function LandingBenchmark(): ReactNode {
  const t = useBenchText();
  const tiles = computeTiles(headline);
  const cpu = Math.max(...headline.meta.cpuRates);
  return (
    <section className={styles.section}>
      <div className="container">
        <p className={styles.kicker}>
          <Translate
            id="homepage.benchmark.kicker"
            values={{ date: formatDate(headline.meta.generatedAt, t.isEn) }}
          >
            {'Бенчмарк форм · {date}'}
          </Translate>
        </p>
        <Heading as="h2" className={styles.title}>
          <Translate id="homepage.benchmark.title">
            ReFormer против Formik, React Hook Form и RJSF
          </Translate>
        </Heading>
        <p className={styles.lead}>
          <Translate id="homepage.benchmark.lead">
            Две формы из реальных спецификаций — регистрация с капчей и кредитная заявка на шесть
            шагов — на каждой библиотеке. Prod-сборки, одинаковые UI и поведение, замеры в Chromium.
          </Translate>
        </p>
        <div className={styles.tiles}>
          {tiles.map((tile) => (
            <HighlightTile key={tile.id} tile={tile} />
          ))}
        </div>
        <p className={styles.footnote}>
          <Translate
            id="homepage.benchmark.footnote"
            values={{ cpu, runs: headline.meta.iterations }}
          >
            {'CPU {cpu}x, медианы по {runs} прогонам · отчёт показывает и где ReFormer уступает'}
          </Translate>
        </p>
        <div className={styles.cta}>
          <Link className="button button--primary button--lg" to="/benchmark/forms">
            <Translate id="homepage.benchmark.cta">Смотреть отчёт →</Translate>
          </Link>
        </div>
      </div>
    </section>
  );
}
