import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';

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
            Модель на сигналах — источник истины. Одна схема связывает поля, валидацию и реактивные
            behaviors. Рендерите вручную, из схемы или из JSON.
          </Translate>
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/">
            <Translate id="homepage.getStarted">Get Started</Translate>
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            style={{ marginLeft: '1rem' }}
            to="/docs/examples/"
          >
            <Translate id="homepage.examples">Примеры</Translate>
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            style={{ marginLeft: '1rem' }}
            href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx"
          >
            <Translate id="homepage.tryPlayground">Try Playground</Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

type PackageCard = {
  name: string;
  icon: string;
  to: string;
  descId: string;
  descDefault: string;
};

const PACKAGES: PackageCard[] = [
  {
    name: '@reformer/core',
    icon: '⚡',
    to: '/docs/',
    descId: 'homepage.pkg.core',
    descDefault: 'Реактивное ядро на сигналах: модель, схема, валидаторы, behaviors, хуки.',
  },
  {
    name: '@reformer/cdk',
    icon: '🧩',
    to: '/docs/cdk/overview',
    descId: 'homepage.pkg.cdk',
    descDefault: 'Headless-компоненты: динамические массивы, визарды, анатомия поля.',
  },
  {
    name: '@reformer/ui-kit',
    icon: '🎨',
    to: '/docs/ui-kit/overview',
    descId: 'homepage.pkg.uikit',
    descDefault: 'Стилизованные контролы (Tailwind + Radix), привязанные к FieldNode.',
  },
  {
    name: '@reformer/renderer-react',
    icon: '🖼️',
    to: '/docs/packages/renderer-react',
    descId: 'homepage.pkg.rrender',
    descDefault: 'Рендер формы из декларативной схемы и реактивной модели.',
  },
  {
    name: '@reformer/renderer-json',
    icon: '📄',
    to: '/docs/packages/renderer-json',
    descId: 'homepage.pkg.jrender',
    descDefault: 'Форма целиком из JSON: операторы $model / $component + реестр.',
  },
  {
    name: '@reformer/mcp',
    icon: '🤖',
    to: '/docs/mcp/overview',
    descId: 'homepage.pkg.mcp',
    descDefault: 'MCP-сервер: документация и генерация форм для AI-ассистентов.',
  },
];

function PackagesSection(): ReactNode {
  return (
    <section className={styles.section}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          <Translate id="homepage.packages.title">Пакеты</Translate>
        </Heading>
        <div className={styles.packageGrid}>
          {PACKAGES.map((pkg) => (
            <Link key={pkg.name} to={pkg.to} className={styles.packageCard}>
              <span className={styles.packageIcon}>{pkg.icon}</span>
              <span className={styles.packageName}>{pkg.name}</span>
              <span className={styles.packageDesc}>
                <Translate id={pkg.descId}>{pkg.descDefault}</Translate>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const QUICK_START = `import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

// 1. Модель — источник истины значений
const model = createModel<{ email: string }>({ email: '' });

// 2. Layout-схема — привязка поля к сигналу + компонент (без валидаторов)
const schema = {
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
};

// 3. Валидация — отдельный слой
const validation = defineValidationSchema<{ email: string }>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

// 4. Форма — узлы поверх сигналов модели
const form = createForm({ model, schema });

// 5. Тонкий JSX — FormField делает всю работу
function ContactForm() {
  const onSubmit = async (e) => {
    e.preventDefault();
    const ok = await validateModel(model, validation); // ошибки сами лягут в поля
    if (ok) console.log(model.get());
  };
  return (
    <form onSubmit={onSubmit}>
      <FormField control={form.email} />
      <Button type="submit">Отправить</Button>
    </form>
  );
}`;

function QuickStartSection(): ReactNode {
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          <Translate id="homepage.quickstart.title">Форма за минуту</Translate>
        </Heading>
        <div className={styles.quickStart}>
          <CodeBlock language="tsx">{QUICK_START}</CodeBlock>
        </div>
      </div>
    </section>
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
        <QuickStartSection />
        <HomepageFeatures />
        <PackagesSection />
      </main>
    </Layout>
  );
}
