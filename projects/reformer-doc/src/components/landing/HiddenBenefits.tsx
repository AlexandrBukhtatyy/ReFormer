import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';

import styles from './landing.module.css';

type Msg = { id: string; message: string };

type Benefit = {
  /** Якорь подраздела «Чего не видно в списке возможностей» на странице `/docs/why-reformer`. */
  anchor: string;
  title: Msg;
  text: Msg;
};

const BENEFITS: Benefit[] = [
  {
    anchor: 'review',
    title: { id: 'homepage.hidden.review.title', message: 'Ревью быстрее и без споров' },
    text: {
      id: 'homepage.hidden.review.text',
      message:
        'Как раскладывать форму, решено заранее. На ревью обсуждают смысл правки, а не стиль, и читают дифф одного файла.',
    },
  },
  {
    anchor: 'architecture',
    title: { id: 'homepage.hidden.architecture.title', message: 'Архитектура — из коробки' },
    text: {
      id: 'homepage.hidden.architecture.text',
      message:
        'Модель — единственный источник истины; данные, правила, реакции и вид разделены. Это держит библиотека, а не дисциплина команды.',
    },
  },
  {
    anchor: 'flexibility',
    title: {
      id: 'homepage.hidden.flexibility.title',
      message: 'Три способа отрисовки — одна логика',
    },
    text: {
      id: 'homepage.hidden.flexibility.text',
      message:
        'JSX руками, по схеме или из JSON. Модель, правила и поведение одни и те же, способ выбирают под каждую форму.',
    },
  },
  {
    anchor: 'tokens',
    title: { id: 'homepage.hidden.tokens.title', message: 'Экономия токенов' },
    text: {
      id: 'homepage.hidden.tokens.text',
      message:
        'С MCP создание формы тратит примерно в 6 раз меньше токенов. Код формы короче в 2–2,5 раза — модели меньше читать и писать.',
    },
  },
  {
    anchor: 'fewer-bugs',
    title: { id: 'homepage.hidden.bugs.title', message: 'Меньше багов по устройству' },
    text: {
      id: 'homepage.hidden.bugs.text',
      message:
        'Копии значений не расходятся, расчёты не зацикливаются, устаревшая проверка отменяется. Эти ошибки не нужно ловить тестами.',
    },
  },
  {
    anchor: 'merge',
    title: { id: 'homepage.hidden.merge.title', message: 'Меньше конфликтов слияния' },
    text: {
      id: 'homepage.hidden.merge.text',
      message:
        'Разметка, правила и поведение — в разных файлах. Вид, правила и поля одной формы правят параллельно.',
    },
  },
  {
    anchor: 'growth',
    title: { id: 'homepage.hidden.growth.title', message: 'Нет тупиков, когда форма растёт' },
    text: {
      id: 'homepage.hidden.growth.text',
      message:
        'Начните с полей в JSX, подключите рендерер, вынесите схему в JSON или в другой бандл — правила и поведение остаются.',
    },
  },
  {
    anchor: 'knowledge',
    title: { id: 'homepage.hidden.knowledge.title', message: 'Знания не уходят с автором' },
    text: {
      id: 'homepage.hidden.knowledge.text',
      message:
        'Разобрался в одной форме — понимаешь все. Форму, автор которой ушёл, сопровождает любой в команде.',
    },
  },
  {
    anchor: 'beyond-forms',
    title: { id: 'homepage.hidden.beyond.title', message: 'Не только формы' },
    text: {
      id: 'homepage.hidden.beyond.text',
      message:
        'Модель на сигналах — это и стор приложения. Форма собирается над его частью, значения не переносят туда-обратно.',
    },
  },
];

/** Лендинг: выгоды, которых нет в списке API, — следствия стандарта и архитектуры. */
export default function HiddenBenefits(): ReactNode {
  return (
    <section className={styles.section}>
      <div className="container">
        <p className={styles.kicker}>
          <Translate id="homepage.hidden.kicker">Неочевидные выгоды</Translate>
        </p>
        <Heading as="h2" className={styles.title}>
          <Translate id="homepage.hidden.title">Чего не видно в списке возможностей</Translate>
        </Heading>
        <p className={styles.lead}>
          <Translate id="homepage.hidden.lead">
            Этого не найти в API: выгоды следуют из стандарта и архитектуры. При выборе библиотеки
            их проще всего пропустить, а в жизни проекта именно они копятся.
          </Translate>
        </p>
        <div className={styles.whyGrid}>
          {BENEFITS.map((benefit) => (
            <article key={benefit.anchor} className={styles.pkgCard}>
              <Heading as="h3" className={styles.pkgTitle}>
                {translate(benefit.title)}
              </Heading>
              <p className={styles.benefitText}>{translate(benefit.text)}</p>
              <Link className={styles.pkgLink} to={`/docs/why-reformer#${benefit.anchor}`}>
                <Translate id="homepage.hidden.more">Подробнее →</Translate>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
