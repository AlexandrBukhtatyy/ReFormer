import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Heading from '@theme/Heading';

import styles from './landing.module.css';

type Feature = { titleId: string; title: string; textId: string; text: string };

// Шесть пунктов — сетка 3×2 на десктопе: ассистент и модель, без сервера; плагины, настройка, код.
const FEATURES: Feature[] = [
  {
    titleId: 'homepage.builder.ai.title',
    title: 'ИИ-ассистент правит форму по просьбе',
    textId: 'homepage.builder.ai.text',
    text: '«Добавь поле email», «сделай телефон обязательным», «разложи анкету на три шага». Каждый ход отменяется целиком.',
  },
  {
    titleId: 'homepage.builder.model.title',
    title: 'Модель — ваша',
    textId: 'homepage.builder.model.text',
    text: 'Anthropic или OpenAI по ключу API либо локальная: Ollama, LM Studio.',
  },
  {
    titleId: 'homepage.builder.noBackend.title',
    title: 'Без сервера',
    textId: 'homepage.builder.noBackend.text',
    text: 'Билдер целиком работает в браузере: открывает папку проекта прямо с диска и сохраняет в неё же. Запросы к модели тоже идут из браузера — бэкенд разворачивать не нужно.',
  },
  {
    titleId: 'homepage.builder.plugins.title',
    title: 'Расширяется плагинами',
    textId: 'homepage.builder.plugins.text',
    text: 'Дерево файлов, редакторы, превью, генерация кода и ассистент — сами плагины. Свой плагин добавит панель, команду, редактор, кит компонентов или инструмент ассистенту.',
  },
  {
    titleId: 'homepage.builder.config.title',
    title: 'Настраивается под проект',
    textId: 'homepage.builder.config.text',
    text: 'Каталог .ui_builder/ задаёт заголовок, язык и тему, состав плагинов, кит по умолчанию, шаблоны форм и шаблоны печати кода.',
  },
  {
    titleId: 'homepage.builder.code.title',
    title: 'На выходе — код',
    textId: 'homepage.builder.code.text',
    text: 'Экспорт печатает модуль формы на TypeScript: схема, модель, правила, поведение, страница. Правки ложатся в тот же JSON-файл формы, что лежит в репозитории.',
  },
];

function Check(): ReactNode {
  return (
    <span className={styles.check} aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
      </svg>
    </span>
  );
}

export default function BuilderShowcase(): ReactNode {
  const shot = useBaseUrl('/img/builder/assistant-turn.png');
  // Билдер выкладывается один на сайт — в `<baseUrl>/builder/`, без префикса локали. Обычный
  // `pathname:///builder/` в английской версии дал бы `/en/builder/`, а там 404.
  const { i18n } = useDocusaurusContext();
  const builderUrl = `pathname://${i18n.localeConfigs[i18n.defaultLocale].baseUrl}builder/`;
  return (
    <section className={`${styles.section} ${styles.builderSection}`}>
      <div className="container">
        <p className={styles.kicker}>
          <Translate id="homepage.builder.kicker">ReFormer Builder · в разработке</Translate>
        </p>
        <Heading as="h2" className={styles.title}>
          <Translate id="homepage.builder.title">Соберите форму мышью — или попросите ИИ</Translate>
        </Heading>
        <p className={styles.lead}>
          <Translate id="homepage.builder.lead">
            Визуальный конструктор форм: собираете из компонентов кита, сразу видите форму живой и
            выгружаете кодом — готовым модулем для приложения на React.
          </Translate>
        </p>
        <figure className={styles.shot}>
          <div className={styles.shotFrame}>
            <div className={styles.shotBar} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <img
              src={shot}
              width={1440}
              height={900}
              loading="lazy"
              alt={translate({
                id: 'homepage.builder.shotAlt',
                message:
                  'Билдер: дерево формы и панель ассистента — по просьбе «Добавь поле „Телефон“» ассистент добавил поле и обновил код модуля',
              })}
            />
          </div>
          <figcaption>
            <Translate id="homepage.builder.caption">
              Один ход ассистента: поле добавлено, код модуля формы обновлён
            </Translate>
          </figcaption>
        </figure>
        <ul className={styles.featureList}>
          {FEATURES.map((f) => (
            <li key={f.titleId}>
              <Check />
              <div>
                <span className={styles.featureTitle}>
                  {translate({ id: f.titleId, message: f.title })}
                </span>
                <span className={styles.featureText}>
                  {translate({ id: f.textId, message: f.text })}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link
            className="button button--primary button--lg"
            to={builderUrl}
            autoAddBaseUrl={false}
          >
            <Translate id="homepage.builder.open">Открыть билдер ↗</Translate>
          </Link>
          <Link
            className="button button--secondary button--outline button--lg"
            to="/docs/builder/overview"
          >
            <Translate id="homepage.builder.docs">Как он устроен</Translate>
          </Link>
        </div>
        <p className={styles.note}>
          <Translate id="homepage.builder.note">
            Нужен браузер на Chromium: Chrome, Edge, Arc или Brave.
          </Translate>
        </p>
      </div>
    </section>
  );
}
