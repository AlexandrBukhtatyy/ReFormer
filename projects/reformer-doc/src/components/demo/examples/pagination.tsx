import { useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Pagination — не поле формы: разметка перехода по страницам (nav / ul / li / a). Текущую
 * страницу и переходы ведёте вы. Variants — виды, Examples — страница в состоянии компонента,
 * API — таблица props. Ссылки в демо — якоря `#…`, чтобы щелчок не уводил со страницы документации.
 */

function ControlledPagination() {
  const total = 5;
  const [page, setPage] = useState(2);
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={page === 1}
            className={page === 1 ? 'pointer-events-none opacity-50' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setPage((p) => Math.max(1, p - 1));
            }}
          />
        </PaginationItem>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <PaginationItem key={n}>
            <PaginationLink
              href="#"
              isActive={n === page}
              onClick={(e) => {
                e.preventDefault();
                setPage(n);
              }}
            >
              {n}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={page === total}
            className={page === total ? 'pointer-events-none opacity-50' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setPage((p) => Math.min(total, p + 1));
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export const paginationDocConfig: ComponentDocConfig = {
  name: 'Pagination',
  importFrom: '@reformer/ui-kit',
  description:
    'Переход по страницам списка: «Назад», номера, «Вперёд». Текущую страницу и адреса ссылок задаёте вы.',
  variants: [
    {
      id: 'default',
      title: 'Номера страниц',
      description:
        '«Назад», номера, многоточие и «Вперёд». isActive отмечает текущую страницу рамкой.',
      render: () => (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#page-1" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#page-1">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#page-2" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#page-3">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#page-3" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ),
      code: `<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="#page-1" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#page-1">1</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#page-2" isActive>
        2
      </PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#page-3">3</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationEllipsis />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="#page-3" />
    </PaginationItem>
  </PaginationContent>
</Pagination>`,
    },
    {
      id: 'prev-next',
      title: 'Только «Назад» и «Вперёд»',
      description:
        'Без номеров — для ленты, где важен только шаг. На узком экране подписи скрываются, остаются стрелки.',
      render: () => (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#page-1" />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#page-3" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ),
      code: `<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="#page-1" />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="#page-3" />
    </PaginationItem>
  </PaginationContent>
</Pagination>`,
    },
  ],
  examples: [
    {
      id: 'controlled',
      title: 'Страница в состоянии компонента',
      description:
        'Текущая страница хранится в useState. href="#" и preventDefault — чтобы щелчок не менял адрес; на краях «Назад» и «Вперёд» помечены aria-disabled.',
      render: ControlledPagination,
      code: `const total = 5;
const [page, setPage] = useState(2);

<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious
        href="#"
        aria-disabled={page === 1}
        className={page === 1 ? 'pointer-events-none opacity-50' : undefined}
        onClick={(e) => {
          e.preventDefault();
          setPage((p) => Math.max(1, p - 1));
        }}
      />
    </PaginationItem>
    {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
      <PaginationItem key={n}>
        <PaginationLink
          href="#"
          isActive={n === page}
          onClick={(e) => {
            e.preventDefault();
            setPage(n);
          }}
        >
          {n}
        </PaginationLink>
      </PaginationItem>
    ))}
    <PaginationItem>
      <PaginationNext
        href="#"
        aria-disabled={page === total}
        className={page === total ? 'pointer-events-none opacity-50' : undefined}
        onClick={(e) => {
          e.preventDefault();
          setPage((p) => Math.min(total, p + 1));
        }}
      />
    </PaginationItem>
  </PaginationContent>
</Pagination>`,
    },
  ],
  props: [
    {
      name: 'aria-label',
      type: 'string',
      default: "'Pagination'",
      description:
        'Подпись области навигации у Pagination. По умолчанию — строка kit.pagination.label из локали; проп её заменяет.',
    },
    {
      name: 'PaginationLink.href',
      type: 'string',
      description:
        'Адрес страницы. Обязателен даже при переходе через onClick: ссылка без href не получает фокус с клавиатуры.',
    },
    {
      name: 'PaginationLink.isActive',
      type: 'boolean',
      default: 'false',
      description: 'Текущая страница: рамка вместо прозрачного фона и aria-current="page".',
    },
    {
      name: 'PaginationLink.size',
      type: "'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'",
      default: "'icon'",
      description: 'Размер из Button. Номера — квадратные (icon), «Назад» и «Вперёд» — default.',
    },
    {
      name: 'PaginationLink.onClick',
      type: '(event: MouseEvent) => void',
      description:
        'Переход без смены адреса: вызовите event.preventDefault() и поменяйте страницу в своём состоянии.',
    },
    {
      name: 'PaginationPrevious.aria-label',
      type: 'string',
      default: "'Go to previous page'",
      description:
        'Подпись кнопки для скринридера. То же у PaginationNext ("Go to next page"). По умолчанию — из локали.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
