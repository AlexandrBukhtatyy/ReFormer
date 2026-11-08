import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogMedia,
  AlertDialogAction,
  AlertDialogCancel,
  Button,
} from '@reformer/ui-kit';
import { TriangleAlertIcon } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * AlertDialog — не поле формы: части на Radix AlertDialog. В отличие от Dialog — окно с ролью
 * alertdialog: щелчок по фону его не закрывает, крестика нет, ответ — AlertDialogAction или
 * AlertDialogCancel (Esc равен отмене). Action / Cancel — это Button: принимают variant / size.
 * Variants — базовое подтверждение, Examples — опасное действие, компактный размер, иконка.
 */
export const alertDialogDocConfig: ComponentDocConfig = {
  name: 'AlertDialog',
  importFrom: '@reformer/ui-kit',
  description:
    'Окно-подтверждение: вопрос и две кнопки. Щелчок по фону не закрывает, фокус сразу на «Отмене».',
  variants: [
    {
      id: 'basic',
      title: 'Базовое подтверждение',
      description:
        'Заголовок-вопрос, последствия и две кнопки. AlertDialogCancel закрывает без действия, AlertDialogAction подтверждает и тоже закрывает окно.',
      render: () => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Показать подтверждение</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы абсолютно уверены?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Данные сессии будут очищены на всех устройствах.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction>Продолжить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
      code: `<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline">Показать подтверждение</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Вы абсолютно уверены?</AlertDialogTitle>
      <AlertDialogDescription>
        Это действие нельзя отменить. Данные сессии будут очищены на всех устройствах.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Отмена</AlertDialogCancel>
      <AlertDialogAction>Продолжить</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`,
    },
  ],
  examples: [
    {
      id: 'destructive',
      title: 'Деструктивное действие',
      description:
        'Подтверждение необратимого удаления. AlertDialogAction принимает variant как Button — здесь destructive.',
      render: () => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Удалить аккаунт</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>
              <AlertDialogDescription>
                Действие необратимо: профиль, проекты и история будут удалены без возможности
                восстановления.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction variant="destructive">Удалить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
      code: `<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Удалить аккаунт</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>
      <AlertDialogDescription>
        Действие необратимо: профиль, проекты и история будут удалены без возможности восстановления.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Отмена</AlertDialogCancel>
      <AlertDialogAction variant="destructive">Удалить</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`,
    },
    {
      id: 'compact',
      title: 'Компактный размер (size="sm")',
      description:
        'size="sm" у AlertDialogContent — узкое окно (max-w-xs), текст по центру, кнопки в две равные колонки.',
      render: () => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Отписаться</Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Отписаться от рассылки?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы перестанете получать письма о новых возможностях.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Остаться</AlertDialogCancel>
              <AlertDialogAction>Отписаться</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
      code: `<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline">Отписаться</Button>
  </AlertDialogTrigger>
  <AlertDialogContent size="sm">
    <AlertDialogHeader>
      <AlertDialogTitle>Отписаться от рассылки?</AlertDialogTitle>
      <AlertDialogDescription>
        Вы перестанете получать письма о новых возможностях.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Остаться</AlertDialogCancel>
      <AlertDialogAction>Отписаться</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`,
    },
    {
      id: 'with-media',
      title: 'С иконкой (AlertDialogMedia)',
      description:
        'AlertDialogMedia — квадрат с иконкой над заголовком (в широком окне — слева от него).',
      render: () => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Сбросить настройки</Button>
          </AlertDialogTrigger>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <TriangleAlertIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Сбросить настройки?</AlertDialogTitle>
              <AlertDialogDescription>
                Все параметры вернутся к значениям по умолчанию.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction>Сбросить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
      code: `<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline">Сбросить настройки</Button>
  </AlertDialogTrigger>
  <AlertDialogContent size="sm">
    <AlertDialogHeader>
      <AlertDialogMedia>
        <TriangleAlertIcon />
      </AlertDialogMedia>
      <AlertDialogTitle>Сбросить настройки?</AlertDialogTitle>
      <AlertDialogDescription>
        Все параметры вернутся к значениям по умолчанию.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Отмена</AlertDialogCancel>
      <AlertDialogAction>Сбросить</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`,
    },
  ],
  props: [
    {
      name: 'AlertDialog',
      type: 'Radix AlertDialog.Root',
      description:
        'Корень, хранит открытость: open + onOpenChange или defaultOpen. Всегда модальный.',
    },
    {
      name: 'AlertDialogTrigger',
      type: 'Radix AlertDialog.Trigger',
      description: 'Открывает окно. asChild — стать своим элементом, например Button.',
    },
    {
      name: 'AlertDialogContent',
      type: 'Radix AlertDialog.Content',
      default: 'size="default"',
      description:
        'Окно в портале с затемнением фона. size: "default" | "sm" (узкое окно, кнопки в две колонки).',
    },
    {
      name: 'AlertDialogHeader',
      type: 'div',
      description:
        'Шапка: заголовок и описание; по центру на узком экране и при size="sm", иначе слева.',
    },
    {
      name: 'AlertDialogTitle',
      type: 'Radix AlertDialog.Title',
      description:
        'Заголовок-вопрос. Radix связывает его с окном через aria-labelledby. Обязателен.',
    },
    {
      name: 'AlertDialogDescription',
      type: 'Radix AlertDialog.Description',
      description:
        'Последствия действия. Radix связывает описание с окном через aria-describedby — скринридер прочтёт его сразу.',
    },
    {
      name: 'AlertDialogMedia',
      type: 'div',
      description: 'Квадрат 64px для иконки; иконка внутри получает размер 32px.',
    },
    {
      name: 'AlertDialogFooter',
      type: 'div',
      description:
        'Кнопки: ряд справа на широком экране, столбик на узком, две колонки при size="sm".',
    },
    {
      name: 'AlertDialogAction',
      type: 'Radix AlertDialog.Action',
      default: 'variant="default"',
      description:
        'Кнопка подтверждения — это Button: принимает variant и size. Нажатие закрывает окно; onClick — ваше действие.',
    },
    {
      name: 'AlertDialogCancel',
      type: 'Radix AlertDialog.Cancel',
      default: 'variant="outline"',
      description:
        'Кнопка отмены — Button с variant="outline". Закрывает окно без действия и получает фокус при открытии.',
    },
    {
      name: 'AlertDialogOverlay / AlertDialogPortal',
      type: 'Radix AlertDialog.Overlay / Portal',
      description:
        'Затемнение фона и портал. AlertDialogContent рисует их сам; отдельно нужны только для своей композиции.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
