import { Alert, AlertTitle, AlertDescription } from '@reformer/ui-kit';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Alert — не поле формы: Alert / AlertTitle / AlertDescription. Variants — пресеты `variant`,
 * Examples — приёмы (иконка, сообщение после действия), API — таблица props. Обёртка `<div style>` в
 * render — рамка демо, в `code` её нет.
 */
export const alertDocConfig: ComponentDocConfig = {
  name: 'Alert',
  importFrom: '@reformer/ui-kit',
  description: 'Плашка с сообщением: заголовок, описание и необязательная иконка. Вид — variant.',
  variants: [
    {
      id: 'variants',
      title: 'Вид (variant)',
      description: 'default — сведения, destructive — ошибка.',
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
      title: 'Заголовок и описание',
      description: 'AlertTitle — одна строка сверху, AlertDescription — текст под ней.',
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
        'Иконка первым дочерним элементом включает две колонки: иконка слева, заголовок и описание справа.',
      render: () => (
        <Alert>
          <CircleAlert />
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
    {
      id: 'status',
      title: 'Сообщение после действия (role="status")',
      description:
        'У variant="default" живой роли нет: скринридер не объявляет пояснение, которое есть на странице с самого начала. Сообщению, которое появляется в ответ на действие, задайте role="status".',
      render: () => (
        <Alert role="status">
          <CircleCheck />
          <AlertTitle>Заявка отправлена</AlertTitle>
          <AlertDescription>Её рассмотрят в течение двух рабочих дней.</AlertDescription>
        </Alert>
      ),
      code: `import { CircleCheck } from 'lucide-react';

<Alert role="status">
  <CircleCheck />
  <AlertTitle>Заявка отправлена</AlertTitle>
  <AlertDescription>Её рассмотрят в течение двух рабочих дней.</AlertDescription>
</Alert>`,
    },
  ],
  props: [
    {
      name: 'variant',
      type: "'default' | 'destructive'",
      default: "'default'",
      description: 'Вид плашки (проп корня Alert).',
    },
    {
      name: 'role',
      type: 'string',
      description:
        'Роль корня. У destructive по умолчанию alert — скринридер зачитывает плашку сразу; у default роли нет. Проп перекрывает умолчание: "status" — для сообщения после действия.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description:
        'Содержимое: AlertTitle, AlertDescription и необязательная иконка первым элементом.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой из трёх частей. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
