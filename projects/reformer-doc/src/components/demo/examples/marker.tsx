import { Marker, MarkerIcon, MarkerContent } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Marker — не form-control: AI-примитив на shadcn / Radix Slot. Compound-набор
 * (Marker / MarkerIcon / MarkerContent) для маркеров-строк в AI-ответах: источники,
 * шаги рассуждения, статусы. Таб Variants показывает стили строки (default / separator /
 * border), Examples — рецепты (иконка + текст, ссылка), props — таблица.
 */
export const markerDocConfig: ComponentDocConfig = {
  name: 'Marker',
  importFrom: '@reformer/ui-kit',
  description:
    'AI-примитив: строка-маркер на shadcn / Radix Slot. Compound-набор: Marker / MarkerIcon / MarkerContent. Стиль строки — через variant ("default" | "separator" | "border").',
  variants: [
    {
      id: 'default',
      title: 'Обычный маркер (default)',
      description:
        'variant="default" — строка с иконкой слева и содержимым: подпись источника, шаг, метка.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker>
            <MarkerIcon>*</MarkerIcon>
            <MarkerContent>Найдено 3 источника</MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker>
  <MarkerIcon>*</MarkerIcon>
  <MarkerContent>Найдено 3 источника</MarkerContent>
</Marker>`,
    },
    {
      id: 'separator',
      title: 'Разделитель (separator)',
      description:
        'variant="separator" — содержимое по центру, по бокам — горизонтальные линии. Разбивает поток на секции.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker variant="separator">
            <MarkerContent>Источники</MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker variant="separator">
  <MarkerContent>Источники</MarkerContent>
</Marker>`,
    },
    {
      id: 'border',
      title: 'С нижней рамкой (border)',
      description:
        'variant="border" — строка с разделительной линией снизу. Заголовок блока над списком.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker variant="border">
            <MarkerIcon>*</MarkerIcon>
            <MarkerContent>Ход рассуждения</MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker variant="border">
  <MarkerIcon>*</MarkerIcon>
  <MarkerContent>Ход рассуждения</MarkerContent>
</Marker>`,
    },
  ],
  examples: [
    {
      id: 'sources-list',
      title: 'Список источников',
      description:
        'Типовой сценарий AI-ответа: разделитель-заголовок и строки-источники со ссылками.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480, display: 'grid', gap: 8 }}>
          <Marker variant="separator">
            <MarkerContent>Источники</MarkerContent>
          </Marker>
          <Marker>
            <MarkerIcon>1</MarkerIcon>
            <MarkerContent>
              <a href="#src-1">Документация ReFormer</a>
            </MarkerContent>
          </Marker>
          <Marker>
            <MarkerIcon>2</MarkerIcon>
            <MarkerContent>
              <a href="#src-2">shadcn/ui — AI Elements</a>
            </MarkerContent>
          </Marker>
        </div>
      ),
      code: `<Marker variant="separator">
  <MarkerContent>Источники</MarkerContent>
</Marker>
<Marker>
  <MarkerIcon>1</MarkerIcon>
  <MarkerContent>
    <a href="/docs">Документация ReFormer</a>
  </MarkerContent>
</Marker>
<Marker>
  <MarkerIcon>2</MarkerIcon>
  <MarkerContent>
    <a href="/ai-elements">shadcn/ui — AI Elements</a>
  </MarkerContent>
</Marker>`,
    },
    {
      id: 'as-child',
      title: 'asChild — полиморфизм (строка-ссылка)',
      description:
        'asChild сливает props на единственный дочерний элемент вместо <div> — вся строка-маркер становится ссылкой.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Marker asChild>
            <a href="#whole-row">
              <MarkerIcon>&gt;</MarkerIcon>
              <MarkerContent>Перейти к источнику</MarkerContent>
            </a>
          </Marker>
        </div>
      ),
      code: `<Marker asChild>
  <a href="/source">
    <MarkerIcon>&gt;</MarkerIcon>
    <MarkerContent>Перейти к источнику</MarkerContent>
  </a>
</Marker>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'separator' | 'border'",
      default: 'default',
      description:
        'Стиль строки: обычная ("default"), с боковыми линиями ("separator") или нижней рамкой ("border").',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description: 'Слить props на дочерний элемент (Radix Slot) вместо рендера <div>.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
    {
      name: 'className (MarkerIcon)',
      type: 'string',
      description: 'Классы контейнера иконки (span, aria-hidden). Иконка — 4×4 по умолчанию.',
    },
    {
      name: 'className (MarkerContent)',
      type: 'string',
      description: 'Классы контейнера содержимого (span). Ссылки внутри получают подчёркивание.',
    },
  ],
};
