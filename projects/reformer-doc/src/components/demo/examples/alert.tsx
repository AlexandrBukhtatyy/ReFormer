import { Alert, AlertTitle, AlertDescription } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Alert — не form-control: compound-компонент (Alert / AlertTitle / AlertDescription).
 * Таб Variants показывает cva-пресеты (default / destructive), Examples — приёмы
 * (заголовок + описание, иконка через `[>svg]`-сетку), API — таблица props.
 */
export const alertDocConfig: ComponentDocConfig = {
  name: 'Alert',
  importFrom: '@reformer/ui-kit',
  description:
    'Информационный блок на shadcn. Compound: Alert (контейнер, role="alert") + AlertTitle + AlertDescription. Вариант стиля — через variant.',
  variants: [
    {
      id: 'variants',
      title: 'Варианты стиля',
      description: 'variant: default / destructive.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert>
            <AlertTitle>Обновление доступно</AlertTitle>
            <AlertDescription>Новая версия готова к установке.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Ошибка платежа</AlertTitle>
            <AlertDescription>Проверьте данные карты и попробуйте снова.</AlertDescription>
          </Alert>
        </div>
      ),
      code: `<Alert>
  <AlertTitle>Обновление доступно</AlertTitle>
  <AlertDescription>Новая версия готова к установке.</AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertTitle>Ошибка платежа</AlertTitle>
  <AlertDescription>Проверьте данные карты и попробуйте снова.</AlertDescription>
</Alert>`,
    },
  ],
  examples: [
    {
      id: 'title-description',
      title: 'Заголовок + описание',
      description:
        'AlertTitle и AlertDescription раскладываются в сетке контейнера — заголовок сверху, описание ниже.',
      render: () => (
        <Alert>
          <AlertTitle>Черновик сохранён</AlertTitle>
          <AlertDescription>Изменения сохранены автоматически минуту назад.</AlertDescription>
        </Alert>
      ),
      code: `<Alert>
  <AlertTitle>Черновик сохранён</AlertTitle>
  <AlertDescription>Изменения сохранены автоматически минуту назад.</AlertDescription>
</Alert>`,
    },
    {
      id: 'with-icon',
      title: 'С иконкой',
      description:
        'SVG-иконка первым потомком включает двухколоночную сетку (`has-[>svg]`): иконка слева, заголовок и описание справа.',
      render: () => (
        <Alert>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <AlertTitle>Требуется подтверждение</AlertTitle>
          <AlertDescription>Подтвердите e-mail, чтобы продолжить.</AlertDescription>
        </Alert>
      ),
      code: `import { CircleAlert } from 'lucide-react';

<Alert>
  <CircleAlert />
  <AlertTitle>Требуется подтверждение</AlertTitle>
  <AlertDescription>Подтвердите e-mail, чтобы продолжить.</AlertDescription>
</Alert>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'destructive'",
      default: 'default',
      description: 'Вариант стиля контейнера Alert.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Содержимое: AlertTitle, AlertDescription и опц. иконка (SVG первым потомком).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы (tailwind-merge — класс вызывающего перекрывает). Есть у всех трёх частей.',
    },
  ],
};
