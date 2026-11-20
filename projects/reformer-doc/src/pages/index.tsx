import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Ecosystem from '@site/src/components/landing/Ecosystem';
import BuilderShowcase from '@site/src/components/landing/BuilderShowcase';
import WhyReformer from '@site/src/components/landing/WhyReformer';
import LandingBenchmark from '@site/src/components/benchmark/LandingBenchmark';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">
          <Translate id="homepage.tagline">Reactive forms library with signals</Translate>
        </p>
        <p className={styles.heroLead}>
          <Translate id="homepage.lead">
            Модель на сигналах — источник истины. Одна схема связывает поля, правила и поведение
            формы. Рисуйте форму вручную, по схеме или из JSON.
          </Translate>
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/">
            <Translate id="homepage.getStarted">Начать</Translate>
          </Link>
          <Link className="button button--outline button--secondary button--lg" to="/docs/examples">
            <Translate id="homepage.examples">Примеры</Translate>
          </Link>
          <Link className="button button--outline button--secondary button--lg" to="/benchmark">
            <Translate id="homepage.benchmark">Бенчмарк</Translate>
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx"
          >
            <Translate id="homepage.tryPlayground">Попробовать</Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  useDocusaurusContext();
  return (
    <Layout
      title={translate({
        id: 'homepage.title',
        message: 'Reactive Forms Library',
      })}
      description="ReFormer - reactive forms library built on Preact Signals with validation, computed fields, and conditional logic"
    >
      <HomepageHeader />
      <main>
        <LandingBenchmark />
        <Ecosystem />
        <WhyReformer />
        <BuilderShowcase />
      </main>
    </Layout>
  );
}
