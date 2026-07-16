import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  Button,
} from '@reformer/ui-kit';
import { Inbox, Search, FolderPlus } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Empty — не form-control: compound-набор презентационных блоков пустого состояния
 * (Empty / EmptyHeader / EmptyMedia / EmptyTitle / EmptyDescription / EmptyContent).
 * Таб Variants показывает варианты медиа-слота (default / icon), Examples — приёмы
 * (пустое состояние с иконкой и действием, пустой поиск, ссылка в описании), API — таблица частей.
 */
export const emptyDocConfig: ComponentDocConfig = {
  name: 'Empty',
  importFrom: '@reformer/ui-kit',
  description:
    'Пустое состояние на shadcn — центрированный блок с пунктирной рамкой: медиа (иконка/иллюстрация), заголовок, описание и действие. Все части — обычные div со своим data-slot, стиль правится через className.',
  variants: [
    {
      id: 'media-variants',
      title: 'Варианты медиа-слота',
      description:
        'EmptyMedia variant: default (прозрачный контейнер под иллюстрацию) / icon (muted-бокс со скруглением под иконку).',
      render: () => (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Empty style={{ maxWidth: 280 }}>
            <EmptyHeader>
              <EmptyMedia>
                <Inbox size={40} strokeWidth={1.5} />
              </EmptyMedia>
              <EmptyTitle>default</EmptyTitle>
              <EmptyDescription>Прозрачный медиа-слот.</EmptyDescription>
            </EmptyHeader>
          </Empty>
          <Empty style={{ maxWidth: 280 }}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>icon</EmptyTitle>
              <EmptyDescription>Muted-бокс под иконку.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ),
      code: `<Empty>
  <EmptyHeader>
    <EmptyMedia>
      <Inbox size={40} strokeWidth={1.5} />
    </EmptyMedia>
    <EmptyTitle>default</EmptyTitle>
    <EmptyDescription>Прозрачный медиа-слот.</EmptyDescription>
  </EmptyHeader>
</Empty>

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <Inbox />
    </EmptyMedia>
    <EmptyTitle>icon</EmptyTitle>
    <EmptyDescription>Muted-бокс под иконку.</EmptyDescription>
  </EmptyHeader>
</Empty>`,
    },
  ],
  examples: [
    {
      id: 'with-action',
      title: 'Пустое состояние с иконкой и действием',
      description:
        'EmptyMedia variant="icon" под иконку, заголовок с описанием в EmptyHeader и кнопка-действие в EmptyContent.',
      render: () => (
        <Empty style={{ maxWidth: 420 }}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderPlus />
            </EmptyMedia>
            <EmptyTitle>Проектов пока нет</EmptyTitle>
            <EmptyDescription>Создайте первый проект, чтобы начать работу.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>Создать проект</Button>
          </EmptyContent>
        </Empty>
      ),
      code: `import { FolderPlus } from 'lucide-react';

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <FolderPlus />
    </EmptyMedia>
    <EmptyTitle>Проектов пока нет</EmptyTitle>
    <EmptyDescription>
      Создайте первый проект, чтобы начать работу.
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Создать проект</Button>
  </EmptyContent>
</Empty>`,
    },
    {
      id: 'empty-search',
      title: 'Пустой результат поиска',
      description:
        'Тот же паттерн для «ничего не найдено» — иконка поиска, пояснение и ссылка на сброс фильтров в описании.',
      render: () => (
        <Empty style={{ maxWidth: 420 }}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>Ничего не найдено</EmptyTitle>
            <EmptyDescription>
              По запросу нет результатов. <a href="#reset">Сбросить фильтры</a>.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ),
      code: `import { Search } from 'lucide-react';

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <Search />
    </EmptyMedia>
    <EmptyTitle>Ничего не найдено</EmptyTitle>
    <EmptyDescription>
      По запросу нет результатов. <a href="#reset">Сбросить фильтры</a>.
    </EmptyDescription>
  </EmptyHeader>
</Empty>`,
    },
  ],
  props: [
    {
      name: 'Empty',
      type: 'div',
      description:
        'Корневой контейнер: пунктирная рамка, центрирование по обеим осям, вертикальный стек (gap-6), text-balance.',
    },
    {
      name: 'EmptyHeader',
      type: 'div',
      description: 'Шапка: центрированный стек медиа / заголовка / описания (max-w-sm).',
    },
    {
      name: 'EmptyMedia',
      type: 'div',
      description:
        'Слот под иконку или иллюстрацию. variant: default (прозрачный) / icon (muted-бокс size-10, скругление, размер вложенной иконки size-6).',
    },
    {
      name: 'EmptyTitle',
      type: 'div',
      description: 'Заголовок пустого состояния (text-lg, font-medium, tracking-tight).',
    },
    {
      name: 'EmptyDescription',
      type: 'div',
      description:
        'Пояснение (text-sm, muted-foreground). Вложенные <a> получают подчёркивание и hover-цвет.',
    },
    {
      name: 'EmptyContent',
      type: 'div',
      description: 'Слот под действия (кнопки, поле ввода) — центрированный стек max-w-sm.',
    },
    {
      name: 'variant',
      type: "'default' | 'icon'",
      default: 'default',
      description: 'Только у EmptyMedia — стиль медиа-контейнера.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
