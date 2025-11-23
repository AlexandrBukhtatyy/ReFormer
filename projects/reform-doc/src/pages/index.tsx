import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

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
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs">
            <Translate id="homepage.getStarted">Get Started</Translate>
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            style={{ marginLeft: '1rem' }}
            href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-examples?file=projects/react-examples/src/App.tsx"
          >
            <Translate id="homepage.tryPlayground">Try Playground</Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  titleId: string;
  titleDefault: string;
  descriptionId: string;
  descriptionDefault: string;
  icon: string;
};

const FeatureList: FeatureItem[] = [
  {
    titleId: 'homepage.feature.reactive.title',
    titleDefault: 'Reactive by Design',
    descriptionId: 'homepage.feature.reactive.description',
    descriptionDefault:
      'Built on Preact Signals for fine-grained reactivity. Only components using changed values re-render.',
    icon: '⚡',
  },
  {
    titleId: 'homepage.feature.typeSafe.title',
    titleDefault: 'Type-Safe Forms',
    descriptionId: 'homepage.feature.typeSafe.description',
    descriptionDefault:
      'Full TypeScript support with automatic type inference. Catch errors at compile time, not runtime.',
    icon: '🛡️',
  },
  {
    titleId: 'homepage.feature.validation.title',
    titleDefault: 'Declarative Validation',
    descriptionId: 'homepage.feature.validation.description',
    descriptionDefault:
      '14 built-in validators, async validation, and easy custom validators. Define validation rules once, apply everywhere.',
    icon: '✅',
  },
  {
    titleId: 'homepage.feature.behaviors.title',
    titleDefault: 'Smart Behaviors',
    descriptionId: 'homepage.feature.behaviors.description',
    descriptionDefault:
      'Computed fields, conditional visibility, field synchronization. Complex form logic made simple.',
    icon: '🔄',
  },
  {
    titleId: 'homepage.feature.nested.title',
    titleDefault: 'Nested Structures',
    descriptionId: 'homepage.feature.nested.description',
    descriptionDefault:
      'Support for deeply nested objects and dynamic arrays. Build any form structure you need.',
    icon: '📦',
  },
  {
    titleId: 'homepage.feature.agnostic.title',
    titleDefault: 'Framework Agnostic',
    descriptionId: 'homepage.feature.agnostic.description',
    descriptionDefault:
      'Core library works anywhere. React bindings included, with more frameworks coming soon.',
    icon: '🔌',
  },
  {
    titleId: 'homepage.feature.aiFriendly.title',
    titleDefault: 'AI-Friendly',
    descriptionId: 'homepage.feature.aiFriendly.description',
    descriptionDefault:
      'Well-documented API with clear patterns. AI assistants can easily understand and generate code using ReFormer.',
    icon: '🤖',
  },
];

function Feature({ titleId, titleDefault, descriptionId, descriptionDefault, icon }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md padding-vert--md">
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
        <Heading as="h3">
          <Translate id={titleId}>{titleDefault}</Translate>
        </Heading>
        <p>
          <Translate id={descriptionId}>{descriptionDefault}</Translate>
        </p>
      </div>
    </div>
  );
}

function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
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
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
