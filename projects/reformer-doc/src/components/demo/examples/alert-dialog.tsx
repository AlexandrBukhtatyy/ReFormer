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
 * AlertDialog — не form-control: Radix AlertDialog compound (AlertDialog / AlertDialogTrigger /
 * AlertDialogPortal / AlertDialogOverlay / AlertDialogContent / AlertDialogHeader / AlertDialogFooter /
 * AlertDialogTitle / AlertDialogDescription / AlertDialogMedia / AlertDialogAction / AlertDialogCancel).
 * В отличие от Dialog — модальное окно с ролью alertdialog: требует явного решения (нельзя закрыть
 * кликом по оверлею / Esc не всегда закрывает), поэтому нет крестика — только Action / Cancel.
 * Action / Cancel стилизуются через buttonVariants (variant / size прокидываются в <Button asChild>).
 * Таб Variants — базовая композиция, Examples — приёмы (деструктив, компактный размер, иконка), API —
 * таблица частей и общих props.
 */
export const alertDialogDocConfig: ComponentDocConfig = {
  name: 'AlertDialog',
  importFrom: '@reformer/ui-kit',
  description:
    'Модальное окно-подтверждение на shadcn / Radix AlertDialog. Compound: AlertDialog (корень) + AlertDialogTrigger, AlertDialogContent (в Portal, с оверлеем), AlertDialogHeader / AlertDialogTitle / AlertDialogDescription, AlertDialogFooter, AlertDialogAction / AlertDialogCancel. Роль alertdialog, focus-trap и aria — из Radix; Action / Cancel наследуют стили Button (buttonVariants).',
  variants: [
    {
      id: 'basic',
      title: 'Базовое подтверждение',
      description:
        'Триггер открывает окно с заголовком, описанием и подвалом из двух кнопок. Cancel закрывает без действия (variant="outline" по умолчанию), Action подтверждает.',
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
        'Подтверждение необратимого удаления. Action получает variant="destructive" (красная кнопка) — тот же buttonVariants, что и у Button.',
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
      {/* variant прокидывается в Button (buttonVariants) */}
      <AlertDialogAction variant="destructive">Удалить</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`,
    },
    {
      id: 'compact',
      title: 'Компактный размер (size="sm")',
      description:
        'AlertDialogContent принимает size="sm" — узкая карточка (max-w-xs), подвал раскладывает Cancel / Action в две колонки.',
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
        'AlertDialogMedia — квадратный слот для иконки над заголовком; Header перестраивает сетку, чтобы разместить медиа.',
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
        'Корень. Управляемое состояние: open / onOpenChange (или defaultOpen для неуправляемого).',
    },
    {
      name: 'AlertDialogTrigger',
      type: 'Radix AlertDialog.Trigger',
      description: 'Открывает окно. asChild — прокинуть на собственный элемент (напр. Button).',
    },
    {
      name: 'AlertDialogContent',
      type: 'Radix AlertDialog.Content',
      default: 'size="default"',
      description:
        'Тело окна в Portal: оверлей, центрирование, анимация. size="default" | "sm" (узкая карточка + двухколоночный подвал).',
    },
    {
      name: 'AlertDialogHeader',
      type: 'div',
      description:
        'Шапка: сетка заголовка и описания (по центру на мобильных, слева для size="default"; перестраивается при наличии AlertDialogMedia).',
    },
    {
      name: 'AlertDialogTitle',
      type: 'Radix AlertDialog.Title',
      description:
        'Заголовок (font-semibold). Связывается через aria-labelledby — обязателен для доступности.',
    },
    {
      name: 'AlertDialogDescription',
      type: 'Radix AlertDialog.Description',
      description: 'Описание (text-sm, muted). Связывается через aria-describedby.',
    },
    {
      name: 'AlertDialogMedia',
      type: 'div',
      description:
        'Квадратный слот (size-16, bg-muted) для иконки над заголовком. SVG внутри масштабируется до size-8.',
    },
    {
      name: 'AlertDialogFooter',
      type: 'div',
      description:
        'Подвал с действиями (реверс-стек на мобильных, ряд справа на десктопе; две колонки при size="sm").',
    },
    {
      name: 'AlertDialogAction',
      type: 'Radix AlertDialog.Action',
      default: 'variant="default"',
      description:
        'Кнопка подтверждения. Обёрнута в <Button asChild> — принимает variant / size из buttonVariants (напр. variant="destructive"). Закрывает окно.',
    },
    {
      name: 'AlertDialogCancel',
      type: 'Radix AlertDialog.Cancel',
      default: 'variant="outline"',
      description:
        'Кнопка отмены. Обёрнута в <Button asChild> (по умолчанию variant="outline"). Закрывает окно без действия; получает фокус при открытии.',
    },
    {
      name: 'AlertDialogOverlay / AlertDialogPortal',
      type: 'Radix AlertDialog.Overlay / Portal',
      description:
        'Оверлей-затемнение и Portal-обёртка. Используются внутри AlertDialogContent; экспортируются для кастомных композиций.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
