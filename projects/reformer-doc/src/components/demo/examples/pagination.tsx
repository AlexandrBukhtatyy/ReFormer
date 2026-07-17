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
 * Pagination — не form-control: презентационный набор (Pagination / PaginationContent /
 * PaginationItem / PaginationLink / PaginationPrevious / PaginationNext / PaginationEllipsis).
 * Активная страница помечается isActive на PaginationLink. Навигация — через href (ссылки)
 * или onClick (controlled-состояние).
 */

/** Демо controlled-пагинации: текущая страница в локальном состоянии. */
function ControlledPagination() {
  const total = 5;
  const [page, setPage] = useState(2);
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
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
    'Постраничная навигация на shadcn. Набор частей: Pagination / PaginationContent / PaginationItem / PaginationLink / PaginationPrevious / PaginationNext / PaginationEllipsis. Активная страница — через isActive на PaginationLink.',
  variants: [
    {
      id: 'default',
      title: 'Базовая пагинация',
      description:
        'Предыдущая / номера страниц / многоточие / следующая. Активная страница выделяется isActive (стиль outline).',
      render: () => (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ),
      code: `<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="#" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#">1</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#" isActive>
        2
      </PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#">3</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationEllipsis />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="#" />
    </PaginationItem>
  </PaginationContent>
</Pagination>`,
    },
    {
      id: 'prev-next',
      title: 'Только «Назад / Вперёд»',
      description:
        'Минимальный вариант без номеров — для лент и бесконечных списков, где важен только шаг.',
      render: () => (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ),
      code: `<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="#" />
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="#" />
    </PaginationItem>
  </PaginationContent>
</Pagination>`,
    },
  ],
  examples: [
    {
      id: 'controlled',
      title: 'Controlled-режим (состояние страницы + onClick)',
      description:
        'Текущая страница хранится в состоянии; клик по номеру / стрелкам меняет его. href="#" + preventDefault, чтобы не перезагружать страницу.',
      render: ControlledPagination,
      code: `const total = 5;
const [page, setPage] = useState(2);

<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious
        href="#"
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
      name: 'isActive (PaginationLink)',
      type: 'boolean',
      default: 'false',
      description: 'Пометить ссылку как текущую страницу (aria-current="page", стиль outline).',
    },
    {
      name: 'size (PaginationLink)',
      type: "'default' | 'sm' | 'lg' | 'icon' | ...",
      default: 'icon',
      description: 'Размер ссылки (из buttonVariants). Prev/Next используют "default".',
    },
    {
      name: 'href / onClick (PaginationLink)',
      type: 'string / (e) => void',
      description: 'Навигация: ссылка (href) или обработчик клика (controlled-состояние).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
