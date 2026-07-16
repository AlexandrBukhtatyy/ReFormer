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
 * Typography — не form-control и не примитив с Radix, а набор prose-обёрток на Tailwind-классах
 * (в shadcn это guide-страница). Таб Variants показывает категории (заголовки / текст / списки-цитаты /
 * код), Examples — приёмы (статья, override className). Form-bound таба (api) нет.
 */
export const typographyDocConfig: ComponentDocConfig = {
  name: 'Typography',
  importFrom: '@reformer/ui-kit',
  description:
    'Набор типографских обёрток на Tailwind-классах по образцу shadcn/ui. Каждый — тонкий wrapper над нужным тегом с data-slot и мёржем className через cn().',
  variants: [
    {
      id: 'headings',
      title: 'Заголовки',
      description: 'TypographyH1 / H2 / H3 / H4 — scroll-m-20 + размер / вес / tracking.',
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
        'TypographyP (абзац), TypographyLead (лид), TypographyLarge / Small / Muted — акценты и подписи.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TypographyLead>Лид-абзац — крупный вводный текст под заголовком.</TypographyLead>
          <TypographyP>
            Обычный абзац с leading-7. Второй и последующие абзацы получают верхний отступ.
          </TypographyP>
          <TypographyLarge>Крупный акцент</TypographyLarge>
          <TypographySmall>Мелкий текст-подпись</TypographySmall>
          <TypographyMuted>Приглушённый вспомогательный текст</TypographyMuted>
        </div>
      ),
      code: `<TypographyLead>Лид-абзац — крупный вводный текст под заголовком.</TypographyLead>
<TypographyP>Обычный абзац с leading-7…</TypographyP>
<TypographyLarge>Крупный акцент</TypographyLarge>
<TypographySmall>Мелкий текст-подпись</TypographySmall>
<TypographyMuted>Приглушённый вспомогательный текст</TypographyMuted>`,
    },
    {
      id: 'list-quote',
      title: 'Списки и цитаты',
      description:
        'TypographyList (маркированный список) и TypographyBlockquote (цитата с рамкой).',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TypographyList>
            <li>Первый пункт</li>
            <li>Второй пункт</li>
            <li>Третий пункт</li>
          </TypographyList>
          <TypographyBlockquote>
            «Хорошая типографика незаметна, но делает текст читаемым.»
          </TypographyBlockquote>
        </div>
      ),
      code: `<TypographyList>
  <li>Первый пункт</li>
  <li>Второй пункт</li>
</TypographyList>

<TypographyBlockquote>
  «Хорошая типографика незаметна…»
</TypographyBlockquote>`,
    },
    {
      id: 'code',
      title: 'Код',
      description: 'TypographyInlineCode — инлайновый код на фоне muted, моноширинный.',
      render: () => (
        <TypographyP>
          Установите зависимость командой{' '}
          <TypographyInlineCode>npm i @reformer/ui-kit</TypographyInlineCode> и импортируйте
          компоненты.
        </TypographyP>
      ),
      code: `<TypographyP>
  Установите командой <TypographyInlineCode>npm i @reformer/ui-kit</TypographyInlineCode>.
</TypographyP>`,
    },
  ],
  examples: [
    {
      id: 'article',
      title: 'Статья — комбинация обёрток',
      description:
        'Типографские обёртки комбинируются в связный документ: заголовок, лид, абзацы, список, цитата.',
      render: () => (
        <article>
          <TypographyH1>Начало работы</TypographyH1>
          <TypographyLead>
            Короткое введение, объясняющее, о чём раздел, крупным приглушённым текстом.
          </TypographyLead>
          <TypographyH2>Установка</TypographyH2>
          <TypographyP>
            Добавьте пакет и подключите его в проект. Компоненты не требуют дополнительной
            настройки.
          </TypographyP>
          <TypographyList>
            <li>Установить пакет</li>
            <li>Импортировать нужные обёртки</li>
            <li>Обернуть контент</li>
          </TypographyList>
          <TypographyBlockquote>Совет: используйте H2 для основных разделов.</TypographyBlockquote>
        </article>
      ),
      code: `<article>
  <TypographyH1>Начало работы</TypographyH1>
  <TypographyLead>Короткое введение…</TypographyLead>
  <TypographyH2>Установка</TypographyH2>
  <TypographyP>Добавьте пакет и подключите его…</TypographyP>
  <TypographyList>
    <li>Установить пакет</li>
    <li>Импортировать нужные обёртки</li>
  </TypographyList>
  <TypographyBlockquote>Совет: используйте H2…</TypographyBlockquote>
</article>`,
    },
    {
      id: 'class-override',
      title: 'Override className (tailwind-merge)',
      description:
        'className вызывающего перекрывает дефолтные классы обёртки: например, выравнивание заголовка по центру.',
      render: () => <TypographyH2 className="text-center">Заголовок по центру</TypographyH2>,
      code: `<TypographyH2 className="text-center">Заголовок по центру</TypographyH2>`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы (tailwind-merge — класс вызывающего перекрывает конфликтующие дефолтные).',
    },
    {
      name: '...props',
      type: "React.ComponentProps<'…'>",
      description:
        'Любые нативные props соответствующего тега (id, onClick и т.д.) прокидываются как есть.',
    },
  ],
};
