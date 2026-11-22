import type { ComponentProps } from 'react';
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
 * Breadcrumb — не поле формы: семантическая разметка пути (nav / ol / li / a / span), не Radix.
 * Variants — виды пути, Examples — связка со ссылкой роутера, API — таблица props.
 * Ссылки в демо — якоря `#…`, чтобы щелчок не уводил со страницы документации.
 */

/**
 * Заглушка ссылки роутера для демо: в приложении её место займёт `Link` из вашего роутера.
 * Рисует обычный `<a>` с якорем, чтобы демо не уходило со страницы.
 */
function Link({ to, ...props }: ComponentProps<'a'> & { to: string }) {
  return <a href={`#${to}`} {...props} />;
}

export const breadcrumbDocConfig: ComponentDocConfig = {
  name: 'Breadcrumb',
  importFrom: '@reformer/ui-kit',
  description:
    'Путь к текущей странице: ссылки на предыдущие уровни и название текущего. Разделитель по умолчанию — шеврон.',
  variants: [
    {
      id: 'default',
      title: 'Путь из ссылок',
      description:
        'BreadcrumbLink — предыдущие уровни, BreadcrumbPage — текущая страница. Между ними BreadcrumbSeparator со стрелкой.',
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#home">Главная</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#catalog">Каталог</BreadcrumbLink>
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
      <BreadcrumbLink href="#home">Главная</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="#catalog">Каталог</BreadcrumbLink>
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
      title: 'Свой разделитель',
      description: 'children у BreadcrumbSeparator заменяют стрелку — например, на косую черту.',
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#home">Главная</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink href="#documents">Документы</BreadcrumbLink>
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
      <BreadcrumbLink href="#home">Главная</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator>/</BreadcrumbSeparator>
    <BreadcrumbItem>
      <BreadcrumbLink href="#documents">Документы</BreadcrumbLink>
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
        'BreadcrumbEllipsis заменяет промежуточные уровни значком «…», когда путь не помещается.',
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#home">Главная</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#settings">Настройки</BreadcrumbLink>
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
      <BreadcrumbLink href="#home">Главная</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbEllipsis />
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="#settings">Настройки</BreadcrumbLink>
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
      title: 'Ссылки роутера (asChild)',
      description:
        'asChild у BreadcrumbLink отдаёт стили ссылке роутера — переход идёт без перезагрузки страницы. В демо Link — заглушка, рисующая обычный <a>.',
      render: () => (
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
      name: 'aria-label',
      type: 'string',
      default: "'Breadcrumb'",
      description:
        'Подпись области навигации. По умолчанию — строка kit.breadcrumb.label из локали; проп её заменяет.',
    },
    {
      name: 'BreadcrumbLink.href',
      type: 'string',
      description: 'Адрес предыдущего уровня. BreadcrumbLink — обычная ссылка <a>.',
    },
    {
      name: 'BreadcrumbLink.asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Не рисовать свой <a>, а передать стили дочернему элементу — например, ссылке роутера.',
    },
    {
      name: 'BreadcrumbSeparator.children',
      type: 'ReactNode',
      default: '<ChevronRightIcon />',
      description: 'Значок разделителя. По умолчанию — стрелка вправо.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
