import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Breadcrumb — не form-control: презентационный compound-набор семантической разметки
 * (nav / ol / li / a / span), не Radix-примитив. Рендерится инлайн (без Portal).
 * Набор: Breadcrumb / BreadcrumbList / BreadcrumbItem / BreadcrumbLink / BreadcrumbPage /
 * BreadcrumbSeparator / BreadcrumbEllipsis.
 */
export const breadcrumbDocConfig: ComponentDocConfig = {
  name: 'Breadcrumb',
  importFrom: '@reformer/ui-kit',
  description:
    'Хлебные крошки на shadcn/ui. Compound-набор: Breadcrumb / BreadcrumbList / BreadcrumbItem / BreadcrumbLink / BreadcrumbPage / BreadcrumbSeparator / BreadcrumbEllipsis. Ссылки — BreadcrumbLink, текущая (неактивная) страница — BreadcrumbPage. Разделитель по умолчанию — ChevronRight.',
  variants: [
    {
      id: 'default',
      title: 'Базовые крошки',
      description:
        'Путь из ссылок (BreadcrumbLink) и текущей страницы (BreadcrumbPage). Между элементами — BreadcrumbSeparator с дефолтной иконкой-шевроном.',
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Главная</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Каталог</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Товар</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ),
      code: `<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Главная</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/catalog">Каталог</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Товар</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>`,
    },
    {
      id: 'custom-separator',
      title: 'Кастомный разделитель',
      description:
        'BreadcrumbSeparator принимает произвольный children — например, слэш вместо шеврона.',
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Главная</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Документы</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Отчёт</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ),
      code: `<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Главная</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator>/</BreadcrumbSeparator>
    <BreadcrumbItem>
      <BreadcrumbLink href="/docs">Документы</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator>/</BreadcrumbSeparator>
    <BreadcrumbItem>
      <BreadcrumbPage>Отчёт</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>`,
    },
    {
      id: 'with-ellipsis',
      title: 'Свёрнутый путь (многоточие)',
      description:
        'BreadcrumbEllipsis сворачивает промежуточные уровни в «...» — полезно при длинном пути.',
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Главная</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Настройки</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Профиль</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ),
      code: `<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Главная</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbEllipsis />
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/settings">Настройки</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Профиль</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>`,
    },
  ],
  examples: [
    {
      id: 'as-child-router',
      title: 'Интеграция с роутером (asChild)',
      description:
        'BreadcrumbLink с asChild схлопывается в переданный элемент — так крошку можно связать со ссылкой роутера (напр. <Link> из react-router), сохранив стили и data-slot.',
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <a href="#">Дашборд</a>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <a href="#">Проекты</a>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Задача #42</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ),
      code: `import { Link } from 'react-router-dom';

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link to="/">Дашборд</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link to="/projects">Проекты</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Задача #42</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>`,
    },
  ],
  props: [
    {
      name: 'Breadcrumb',
      type: 'React.ComponentProps<"nav">',
      description: 'Корневой <nav aria-label="breadcrumb">. Обёртка всего пути.',
    },
    {
      name: 'BreadcrumbList',
      type: 'React.ComponentProps<"ol">',
      description: 'Упорядоченный список (<ol>) элементов пути.',
    },
    {
      name: 'BreadcrumbItem',
      type: 'React.ComponentProps<"li">',
      description:
        'Один уровень пути (<li>): содержит ссылку, страницу, многоточие или разделитель.',
    },
    {
      name: 'BreadcrumbLink',
      type: 'React.ComponentProps<"a"> & { asChild?: boolean }',
      description:
        'Кликабельная ссылка на предыдущий уровень. asChild — рендер через дочерний элемент (Slot) для интеграции с роутером.',
    },
    {
      name: 'BreadcrumbPage',
      type: 'React.ComponentProps<"span">',
      description: 'Текущая (неактивная) страница: <span role="link" aria-current="page">.',
    },
    {
      name: 'BreadcrumbSeparator',
      type: 'React.ComponentProps<"li">',
      description:
        'Разделитель между уровнями. По умолчанию — иконка-шеврон; children переопределяет её.',
    },
    {
      name: 'BreadcrumbEllipsis',
      type: 'React.ComponentProps<"span">',
      description: 'Многоточие для свёрнутых промежуточных уровней (с sr-only подписью).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы для любой части (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
