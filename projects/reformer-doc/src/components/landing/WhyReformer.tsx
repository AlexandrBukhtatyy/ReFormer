import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import { useBenchText } from '@site/src/components/benchmark/i18n';
import { proseNumber } from '@site/src/components/mcp-benchmark/format';
import { MCP_HEADLINE } from '@site/src/components/mcp-benchmark/headline';

import styles from './landing.module.css';

/** Строка карточки; `values` — числа из данных для плейсхолдеров `{…}` в `message`. */
type Msg = { id: string; message: string; values?: Record<string, string | number> };

type WhyCard = {
  /** Якорь раздела на странице `/docs/why-reformer` — одинаковый в русской и английской версии. */
  anchor: string;
  role: Msg;
  title: Msg;
  points: Msg[];
  /** Главная карточка — мысль «один стандарт → следствия», остальные — роли. */
  root?: boolean;
};

const CARDS: WhyCard[] = [
  {
    anchor: 'one-standard',
    root: true,
    role: { id: 'homepage.why.standard.role', message: 'Главное' },
    title: { id: 'homepage.why.standard.title', message: 'Один стандарт — много следствий' },
    points: [
      {
        id: 'homepage.why.standard.p1',
        message: 'Любая форма пишется одинаково: модель, схема, правила, поведение',
      },
      {
        id: 'homepage.why.standard.p2',
        message: 'Отсюда читаемость, меньше когнитивной нагрузки и ревью без проблем',
      },
      {
        id: 'homepage.why.standard.p3',
        message: 'По тому же стандарту пишут MCP-сервер и билдер',
      },
    ],
  },
  {
    anchor: 'developer',
    role: { id: 'homepage.why.developer.role', message: 'Разработчику' },
    title: {
      id: 'homepage.why.developer.title',
      message: 'Без цепочек useEffect и лишних перерисовок',
    },
    points: [
      { id: 'homepage.why.developer.p1', message: 'Ввод перерисовывает только своё поле' },
      {
        id: 'homepage.why.developer.p2',
        message: 'Правила, расчёты, массивы и шаги — декларативно',
      },
      {
        id: 'homepage.why.developer.p3',
        message: 'Типизированные поля и тесты логики без React',
      },
    ],
  },
  {
    anchor: 'team',
    role: { id: 'homepage.why.team.role', message: 'Тимлиду и ревьюеру' },
    title: { id: 'homepage.why.team.title', message: 'Все формы проекта устроены одинаково' },
    points: [
      { id: 'homepage.why.team.p1', message: 'Файл формы находится по имени, а не поиском' },
      { id: 'homepage.why.team.p2', message: 'Правка правила — дифф одного файла' },
      { id: 'homepage.why.team.p3', message: 'Чужую форму читают как свою' },
    ],
  },
  {
    anchor: 'ai',
    role: { id: 'homepage.why.ai.role', message: 'С ИИ-ассистентом' },
    title: { id: 'homepage.why.ai.title', message: 'Код от ИИ, который можно ревьюить' },
    points: [
      { id: 'homepage.why.ai.p1', message: 'MCP-сервер пишет по тому же стандарту' },
      {
        id: 'homepage.why.ai.p2',
        message: '«Готово» — только после сборки и проверки типов',
      },
      {
        id: 'homepage.why.ai.p3',
        // Числа — из замеров MCP (/benchmark/mcp), те же, что в секции замеров выше.
        message:
          '{withMcp}% прогонов проходят проверки против {noMcp}% без MCP, в {cost} раза дешевле',
        values: {
          withMcp: MCP_HEADLINE.quality.dsl,
          noMcp: MCP_HEADLINE.quality.none,
          cost: MCP_HEADLINE.costRatio,
        },
      },
    ],
  },
  {
    anchor: 'builder',
    role: { id: 'homepage.why.builder.role', message: 'Продукту и аналитику' },
    title: {
      id: 'homepage.why.builder.title',
      message: 'Форма в редакторе, код — в репозитории',
    },
    points: [
      {
        id: 'homepage.why.builder.p1',
        message: 'Собрать мышью или просьбой обычным текстом',
      },
      {
        id: 'homepage.why.builder.p2',
        message: 'Экспорт — обычный модуль ReFormer, без привязки к редактору',
      },
      { id: 'homepage.why.builder.p3', message: 'Свой UI-кит и своя модель ИИ' },
    ],
  },
  {
    anchor: 'platform',
    role: { id: 'homepage.why.platform.role', message: 'Архитектору' },
    title: {
      id: 'homepage.why.platform.title',
      message: 'Формы между командами и с сервера',
    },
    points: [
      {
        id: 'homepage.why.platform.p1',
        message: 'Микрофронтенды: одна команда регистрирует форму, другая монтирует',
      },
      {
        id: 'homepage.why.platform.p2',
        message: 'Форма из JSON-документа — в бенчмарке в 3,5 раза легче RJSF',
      },
      {
        id: 'homepage.why.platform.p3',
        message: 'Своя дизайн-система поверх headless-компонентов',
      },
    ],
  },
];

/** Лендинг: какие задачи решает ReFormer — главная мысль и выжимка по ролям со ссылками на страницу. */
export default function WhyReformer(): ReactNode {
  const { isEn } = useBenchText();
  // Дроби из данных — по правилам языка страницы («в 4,3 раза» / «4.3 times»).
  const valuesOf = (point: Msg) =>
    point.values &&
    Object.fromEntries(
      Object.entries(point.values).map(([key, value]) => [key, proseNumber(value, isEn)])
    );
  return (
    <section className={`${styles.section} ${styles.sectionAlt}`}>
      <div className="container">
        <p className={styles.kicker}>
          <Translate id="homepage.why.kicker">Какие задачи решает</Translate>
        </p>
        <Heading as="h2" className={styles.title}>
          <Translate id="homepage.why.title">Один стандарт для всех форм проекта</Translate>
        </Heading>
        <p className={styles.lead}>
          <Translate id="homepage.why.lead">
            Форма — это значения, правила, реакции на ввод, шаги и отправка. ReFormer задаёт для них
            один способ записи. Отсюда читаемый код, простое ревью и сопровождение — кто бы форму ни
            написал: человек, ИИ-ассистент или билдер.
          </Translate>
        </p>
        <div className={styles.whyGrid}>
          {CARDS.map((card) => (
            <article
              key={card.anchor}
              className={clsx(styles.pkgCard, card.root && styles.whyCardRoot)}
            >
              <span className={styles.pkgRole}>{translate(card.role)}</span>
              <Heading as="h3" className={styles.pkgTitle}>
                {translate(card.title)}
              </Heading>
              <ul className={styles.points}>
                {card.points.map((point) => (
                  <li key={point.id}>{translate(point, valuesOf(point))}</li>
                ))}
              </ul>
              <Link className={styles.pkgLink} to={`/docs/why-reformer#${card.anchor}`}>
                <Translate id="homepage.why.more">Подробнее →</Translate>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
