import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';

import styles from './landing.module.css';

type Msg = { id: string; message: string };

/** Какой слой стека подсвечивает значок карточки; `ai` — MCP, который знает все три. */
type Layer = 'core' | 'cdk' | 'ui-kit' | 'ai';

type PackageCard = {
  name: string;
  to: string;
  layer: Layer;
  role: Msg;
  title: Msg;
  points: Msg[];
};

const PACKAGES: PackageCard[] = [
  {
    name: '@reformer/core',
    to: '/docs/',
    layer: 'core',
    role: { id: 'homepage.ecosystem.core.role', message: 'Ядро' },
    title: {
      id: 'homepage.ecosystem.core.title',
      message: 'Модель на сигналах и одна сборка формы',
    },
    points: [
      { id: 'homepage.ecosystem.core.p1', message: 'Точечная реактивность на сигналах' },
      { id: 'homepage.ecosystem.core.p2', message: 'Типобезопасность' },
      { id: 'homepage.ecosystem.core.p3', message: 'Фреймворк-агностик' },
      { id: 'homepage.ecosystem.core.p4', message: 'Декларативная валидация и поведение' },
      { id: 'homepage.ecosystem.core.p5', message: 'Массивы, вложенность, визарды' },
    ],
  },
  {
    name: '@reformer/cdk',
    to: '/docs/cdk/overview',
    layer: 'cdk',
    role: { id: 'homepage.ecosystem.cdk.role', message: 'Headless' },
    title: {
      id: 'homepage.ecosystem.cdk.title',
      message: 'Логика и доступность — вёрстка ваша',
    },
    points: [
      {
        id: 'homepage.ecosystem.cdk.p1',
        message: 'Состояние, aria-атрибуты и клавиатура уже внутри',
      },
      {
        id: 'homepage.ecosystem.cdk.p2',
        message: 'FormField, FormWizard, FieldArray, Autocomplete, FileUpload',
      },
      {
        id: 'homepage.ecosystem.cdk.p3',
        message: 'Ни строчки CSS: под дизайн-систему вашей компании',
      },
    ],
  },
  {
    name: '@reformer/ui-kit',
    to: '/docs/ui-kit/overview',
    layer: 'ui-kit',
    role: { id: 'homepage.ecosystem.uikit.role', message: 'Готовый UI' },
    title: {
      id: 'homepage.ecosystem.uikit.title',
      message: 'Больше 70 компонентов в стиле shadcn/ui',
    },
    points: [
      { id: 'homepage.ecosystem.uikit.p1', message: 'Tailwind CSS v4 и Radix UI' },
      {
        id: 'homepage.ecosystem.uikit.p2',
        message: 'Маски, коды OTP, даты, комбобокс, загрузка файлов, мастер шагов и массивы',
      },
      {
        id: 'homepage.ecosystem.uikit.p3',
        message: 'Поле кладётся в схему как есть, а на экран — одной строкой',
      },
    ],
  },
  {
    name: '@reformer/mcp',
    to: '/docs/mcp/overview',
    layer: 'ai',
    role: { id: 'homepage.ecosystem.mcp.role', message: 'Для ИИ' },
    title: {
      id: 'homepage.ecosystem.mcp.title',
      message: 'ИИ-ассистент пишет формы по документации, а не наугад',
    },
    points: [
      {
        id: 'homepage.ecosystem.mcp.p1',
        message:
          'Claude Code, Cursor и другие MCP-клиенты получают документацию и примеры прямо в диалоге',
      },
    ],
  },
];

/**
 * Значок слоя: пирамида core → cdk → ui-kit, подсвечен слой пакета. У MCP подсвечены все три
 * бледно и горит искра — ассистент знает весь стек.
 */
function LayerGlyph({ layer }: { layer: Layer }): ReactNode {
  const bar = (own: Layer) =>
    layer === own ? styles.barOn : layer === 'ai' ? styles.barSoft : styles.bar;
  return (
    <svg className={styles.glyph} viewBox="0 0 44 30" aria-hidden="true">
      <rect className={bar('ui-kit')} x="8" y="2" width="24" height="6" rx="2" />
      <rect className={bar('cdk')} x="4" y="12" width="32" height="6" rx="2" />
      <rect className={bar('core')} x="0" y="22" width="40" height="6" rx="2" />
      {layer === 'ai' && (
        <path
          className={styles.spark}
          d="M39 0.5 L40.5 4.5 L44 6 L40.5 7.5 L39 11.5 L37.5 7.5 L34 6 L37.5 4.5 Z"
        />
      )}
    </svg>
  );
}

export default function Ecosystem(): ReactNode {
  return (
    <section className={`${styles.section} ${styles.sectionAlt}`}>
      <div className="container">
        <p className={styles.kicker}>
          <Translate id="homepage.ecosystem.kicker">Экосистема</Translate>
        </p>
        <Heading as="h2" className={styles.title}>
          <Translate id="homepage.ecosystem.title">
            Всё для форм — от ядра до ИИ-ассистента
          </Translate>
        </Heading>
        <p className={styles.lead}>
          <Translate id="homepage.ecosystem.lead">
            Пакеты складываются слоями — берите ровно то, что нужно: готовый вид из ui-kit, свою
            дизайн-систему поверх cdk или только логику из core. MCP учит всему этому ИИ-ассистента.
          </Translate>
        </p>
        <div className={styles.pkgGrid}>
          {PACKAGES.map((pkg) => (
            <article key={pkg.name} className={styles.pkgCard}>
              <div className={styles.pkgHead}>
                <LayerGlyph layer={pkg.layer} />
                <span className={styles.pkgRole}>{translate(pkg.role)}</span>
              </div>
              <span className={styles.pkgName}>{pkg.name}</span>
              <Heading as="h3" className={styles.pkgTitle}>
                {translate(pkg.title)}
              </Heading>
              <ul className={styles.points}>
                {pkg.points.map((point) => (
                  <li key={point.id}>{translate(point)}</li>
                ))}
              </ul>
              <Link className={styles.pkgLink} to={pkg.to}>
                <Translate id="homepage.ecosystem.docs">Документация →</Translate>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
