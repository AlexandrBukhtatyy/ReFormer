import { Marker, MarkerIcon, MarkerContent } from '@reformer/ui-kit';
import { BookOpen, Brain, ExternalLink, Sparkles } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Marker — не поле формы: служебная строка в ленте чата (Marker / MarkerIcon / MarkerContent).
 * Variants — оформление строки (default / separator / border), Examples — список источников и
 * строка-ссылка, API — таблица props. Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */
export const markerDocConfig: ComponentDocConfig = {
  name: 'Marker',
  importFrom: '@reformer/ui-kit',
  description:
    'Служебная строка в ленте чата: статус, шаг рассуждения, заголовок блока источников. Оформление — variant.',
  variants: [
    {
      id: 'default',
      title: 'Строка со значком (default)',
      description: 'variant="default" — значок слева и приглушённый текст: статус или шаг.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker>
            <MarkerIcon>
              <Sparkles />
            </MarkerIcon>
            <MarkerContent>Ассистент ищет подходящие тарифы</MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker>
  <MarkerIcon>
    <Sparkles />
  </MarkerIcon>
  <MarkerContent>Ассистент ищет подходящие тарифы</MarkerContent>
</Marker>`,
    },
    {
      id: 'separator',
      title: 'Разделитель (separator)',
      description:
        'variant="separator" — текст по центру, по бокам линии. Делит ленту: «Сегодня», «Новый диалог».',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker variant="separator">
            <MarkerContent>Сегодня</MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker variant="separator">
  <MarkerContent>Сегодня</MarkerContent>
</Marker>`,
    },
    {
      id: 'border',
      title: 'С линией снизу (border)',
      description: 'variant="border" — строка с нижней линией. Заголовок блока над списком.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker variant="border">
            <MarkerIcon>
              <Brain />
            </MarkerIcon>
            <MarkerContent>Ход рассуждения</MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker variant="border">
  <MarkerIcon>
    <Brain />
  </MarkerIcon>
  <MarkerContent>Ход рассуждения</MarkerContent>
</Marker>`,
    },
  ],
  examples: [
    {
      id: 'sources-list',
      title: 'Список источников',
      description:
        'Заголовок блока с линией снизу и строки-источники. Ссылки внутри MarkerContent подчёркнуты.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480, display: 'grid', gap: 8 }}>
          <Marker variant="border">
            <MarkerIcon>
              <BookOpen />
            </MarkerIcon>
            <MarkerContent>Источники</MarkerContent>
          </Marker>
          <Marker>
            <MarkerContent>
              <a href="#src-1">Тарифы на потребительский кредит</a>
            </MarkerContent>
          </Marker>
          <Marker>
            <MarkerContent>
              <a href="#src-2">Требования к заёмщику</a>
            </MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker variant="border">
  <MarkerIcon>
    <BookOpen />
  </MarkerIcon>
  <MarkerContent>Источники</MarkerContent>
</Marker>
<Marker>
  <MarkerContent>
    <a href="#src-1">Тарифы на потребительский кредит</a>
  </MarkerContent>
</Marker>
<Marker>
  <MarkerContent>
    <a href="#src-2">Требования к заёмщику</a>
  </MarkerContent>
</Marker>`,
    },
    {
      id: 'as-child',
      title: 'Вся строка — ссылка (asChild)',
      description:
        'asChild отдаёт оформление маркера дочернему элементу: вся строка становится ссылкой <a>.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker asChild>
            <a href="#source">
              <MarkerIcon>
                <ExternalLink />
              </MarkerIcon>
              <MarkerContent>Открыть источник</MarkerContent>
            </a>
          </Marker>
        </div>
      ),
      code: `<Marker asChild>
  <a href="#source">
    <MarkerIcon>
      <ExternalLink />
    </MarkerIcon>
    <MarkerContent>Открыть источник</MarkerContent>
  </a>
</Marker>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'separator' | 'border'",
      default: "'default'",
      description:
        'Оформление строки: обычная, текст между двумя линиями (separator) или линия снизу (border).',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Отдать оформление дочернему элементу вместо <div>, например ссылке <a> — тогда кликабельна вся строка.',
    },
    {
      name: 'MarkerIcon.children',
      type: 'ReactNode',
      description:
        'Значок 16×16 px. Скрыт от скринридера (aria-hidden), поэтому смысл передавайте текстом в MarkerContent.',
    },
    {
      name: 'MarkerContent.children',
      type: 'ReactNode',
      description: 'Текст строки. Ссылки внутри подчёркнуты. В separator текст стоит по центру.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
