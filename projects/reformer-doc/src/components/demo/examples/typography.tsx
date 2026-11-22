import {
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyP,
  TypographyBlockquote,
  TypographyList,
  TypographyInlineCode,
  TypographyLead,
  TypographyLarge,
  TypographySmall,
  TypographyMuted,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Typography — не поле формы: набор обёрток над тегами текста с готовыми классами. Variants —
 * группы (заголовки, текст, списки и цитаты, код), Examples — приёмы (статья, замена класса).
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */
export const typographyDocConfig: ComponentDocConfig = {
  name: 'Typography',
  importFrom: '@reformer/ui-kit',
  description:
    'Заголовки, абзацы, списки, цитаты и код с готовыми размерами и отступами. Каждый компонент — один тег.',
  variants: [
    {
      id: 'headings',
      title: 'Заголовки',
      description: 'TypographyH1–H4 рисуют теги h1–h4 с размером, весом и межбуквенным интервалом.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TypographyH1>Заголовок H1</TypographyH1>
          <TypographyH2>Заголовок H2</TypographyH2>
          <TypographyH3>Заголовок H3</TypographyH3>
          <TypographyH4>Заголовок H4</TypographyH4>
        </div>
      ),
      code: `<TypographyH1>Заголовок H1</TypographyH1>
<TypographyH2>Заголовок H2</TypographyH2>
<TypographyH3>Заголовок H3</TypographyH3>
<TypographyH4>Заголовок H4</TypographyH4>`,
    },
    {
      id: 'text',
      title: 'Текст',
      description:
        'TypographyLead — вводный абзац, TypographyP — обычный, TypographyLarge / Small / Muted — акценты и подписи.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TypographyLead>Лид-абзац — крупный вводный текст под заголовком.</TypographyLead>
          <TypographyP>
            Обычный абзац. Второй и следующие абзацы подряд получают отступ сверху.
          </TypographyP>
          <TypographyLarge>Крупный акцент</TypographyLarge>
          <TypographySmall>Мелкий текст-подпись</TypographySmall>
          <TypographyMuted>Приглушённый вспомогательный текст</TypographyMuted>
        </div>
      ),
      code: `<TypographyLead>Лид-абзац — крупный вводный текст под заголовком.</TypographyLead>
<TypographyP>
  Обычный абзац. Второй и следующие абзацы подряд получают отступ сверху.
</TypographyP>
<TypographyLarge>Крупный акцент</TypographyLarge>
<TypographySmall>Мелкий текст-подпись</TypographySmall>
<TypographyMuted>Приглушённый вспомогательный текст</TypographyMuted>`,
    },
    {
      id: 'list-quote',
      title: 'Список и цитата',
      description:
        'TypographyList — маркированный список ul, TypographyBlockquote — цитата с линией слева.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TypographyList>
            <li>Первый пункт</li>
            <li>Второй пункт</li>
            <li>Третий пункт</li>
          </TypographyList>
          <TypographyBlockquote>
            «Хорошая типографика незаметна, но делает текст читаемым».
          </TypographyBlockquote>
        </div>
      ),
      code: `<TypographyList>
  <li>Первый пункт</li>
  <li>Второй пункт</li>
  <li>Третий пункт</li>
</TypographyList>
<TypographyBlockquote>
  «Хорошая типографика незаметна, но делает текст читаемым».
</TypographyBlockquote>`,
    },
    {
      id: 'code',
      title: 'Код в строке',
      description: 'TypographyInlineCode — моноширинный фрагмент на сером фоне внутри абзаца.',
      render: () => (
        <TypographyP>
          Установите пакет командой{' '}
          <TypographyInlineCode>npm i @reformer/ui-kit</TypographyInlineCode> и импортируйте
          компоненты.
        </TypographyP>
      ),
      code: `<TypographyP>
  Установите пакет командой{' '}
  <TypographyInlineCode>npm i @reformer/ui-kit</TypographyInlineCode> и импортируйте
  компоненты.
</TypographyP>`,
    },
  ],
  examples: [
    {
      id: 'article',
      title: 'Статья',
      description: 'Обёртки складываются в связный текст: заголовок, лид, раздел, список, цитата.',
      render: () => (
        <article>
          <TypographyH1>Начало работы</TypographyH1>
          <TypographyLead>Коротко о том, что внутри раздела и для кого он.</TypographyLead>
          <TypographyH2>Установка</TypographyH2>
          <TypographyP>Добавьте пакет и подключите стили темы.</TypographyP>
          <TypographyList>
            <li>Установить пакет</li>
            <li>Импортировать нужные компоненты</li>
            <li>Обернуть текст</li>
          </TypographyList>
          <TypographyBlockquote>Совет: делите раздел заголовками H2.</TypographyBlockquote>
        </article>
      ),
      code: `<article>
  <TypographyH1>Начало работы</TypographyH1>
  <TypographyLead>Коротко о том, что внутри раздела и для кого он.</TypographyLead>
  <TypographyH2>Установка</TypographyH2>
  <TypographyP>Добавьте пакет и подключите стили темы.</TypographyP>
  <TypographyList>
    <li>Установить пакет</li>
    <li>Импортировать нужные компоненты</li>
    <li>Обернуть текст</li>
  </TypographyList>
  <TypographyBlockquote>Совет: делите раздел заголовками H2.</TypographyBlockquote>
</article>`,
    },
    {
      id: 'class-override',
      title: 'Свой класс поверх готового',
      description:
        'При конфликте Tailwind-классов побеждает ваш: border-b-0 убирает линию под H2, text-2xl заменяет text-3xl.',
      render: () => (
        <TypographyH2 className="border-b-0 text-2xl">Заголовок без линии</TypographyH2>
      ),
      code: `<TypographyH2 className="border-b-0 text-2xl">Заголовок без линии</TypographyH2>`,
    },
  ],
  props: [
    {
      name: 'TypographyH1 … H4',
      type: 'h1 … h4',
      description: 'Заголовки. H2 рисует линию снизу и не берёт отступ сверху, если стоит первым.',
    },
    {
      name: 'TypographyP',
      type: 'p',
      description: 'Абзац с межстрочным интервалом; со второго абзаца подряд — отступ сверху.',
    },
    {
      name: 'TypographyLead',
      type: 'p',
      description: 'Вводный абзац: крупнее и приглушённым цветом.',
    },
    {
      name: 'TypographyLarge / TypographySmall / TypographyMuted',
      type: 'div / small / p',
      description: 'Крупный полужирный текст, мелкая подпись, приглушённый вспомогательный текст.',
    },
    {
      name: 'TypographyList',
      type: 'ul',
      description: 'Маркированный список; пункты — обычные <li>.',
    },
    {
      name: 'TypographyBlockquote',
      type: 'blockquote',
      description: 'Цитата курсивом с линией слева.',
    },
    {
      name: 'TypographyInlineCode',
      type: 'code',
      description: 'Код в строке: моноширинный шрифт на сером фоне.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любого компонента. При конфликте Tailwind-классов побеждает ваш.',
    },
    {
      name: '...props',
      type: 'атрибуты своего тега',
      description: 'Остальные атрибуты тега (id, title, aria-*) передаются как есть.',
    },
  ],
};
