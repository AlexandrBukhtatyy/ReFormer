import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Card — не form-control: compound-набор презентационных блоков (Card / CardHeader / CardTitle /
 * CardDescription / CardAction / CardContent / CardFooter). Таб Variants показывает готовые
 * композиции, Examples — приёмы (header с action-слотом), API — таблица частей и общих props.
 */
export const cardDocConfig: ComponentDocConfig = {
  name: 'Card',
  importFrom: '@reformer/ui-kit',
  description:
    'Карточка на shadcn — контейнер с шапкой (заголовок / описание / действие), контентом и подвалом. Все части — обычные div со своим data-slot, стиль правится через className.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая карточка',
      description: 'Header (title + description), Content и Footer.',
      render: () => (
        <Card style={{ maxWidth: 360 }}>
          <CardHeader>
            <CardTitle>Тариф «Стандарт»</CardTitle>
            <CardDescription>Помесячная оплата, без комиссии.</CardDescription>
          </CardHeader>
          <CardContent>Всё необходимое для старта: 10 проектов, 5 ГБ хранилища.</CardContent>
          <CardFooter>
            <Button>Подключить</Button>
          </CardFooter>
        </Card>
      ),
      code: `<Card>
  <CardHeader>
    <CardTitle>Тариф «Стандарт»</CardTitle>
    <CardDescription>Помесячная оплата, без комиссии.</CardDescription>
  </CardHeader>
  <CardContent>Всё необходимое для старта: 10 проектов, 5 ГБ хранилища.</CardContent>
  <CardFooter>
    <Button>Подключить</Button>
  </CardFooter>
</Card>`,
    },
    {
      id: 'with-action',
      title: 'Шапка с действием (CardAction)',
      description:
        'CardAction встаёт в правый край шапки (grid-слот) — кнопка/меню рядом с заголовком.',
      render: () => (
        <Card style={{ maxWidth: 360 }}>
          <CardHeader>
            <CardTitle>Уведомления</CardTitle>
            <CardDescription>Настройте, что приходит на почту.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm">
                Изменить
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>Сейчас включены: счета, статус доставки, безопасность.</CardContent>
        </Card>
      ),
      code: `<Card>
  <CardHeader>
    <CardTitle>Уведомления</CardTitle>
    <CardDescription>Настройте, что приходит на почту.</CardDescription>
    <CardAction>
      <Button variant="ghost" size="sm">Изменить</Button>
    </CardAction>
  </CardHeader>
  <CardContent>Сейчас включены: счета, статус доставки, безопасность.</CardContent>
</Card>`,
    },
  ],
  examples: [
    {
      id: 'content-only',
      title: 'Карточка без шапки',
      description: 'Card можно использовать как простой контейнер — только CardContent.',
      render: () => (
        <Card style={{ maxWidth: 360 }}>
          <CardContent>Короткая заметка без заголовка и подвала.</CardContent>
        </Card>
      ),
      code: `<Card>
  <CardContent>Короткая заметка без заголовка и подвала.</CardContent>
</Card>`,
    },
    {
      id: 'bordered-sections',
      title: 'Разделители секций (border)',
      description:
        'Утилита border-b на CardHeader (или border-t на CardFooter) включает встроенный отступ ([.border-b]:pb-6 / [.border-t]:pt-6).',
      render: () => (
        <Card style={{ maxWidth: 360 }}>
          <CardHeader className="border-b">
            <CardTitle>Профиль</CardTitle>
            <CardDescription>Личные данные и контакты.</CardDescription>
          </CardHeader>
          <CardContent>Имя, e-mail, телефон.</CardContent>
          <CardFooter className="border-t">
            <Button variant="outline">Сохранить</Button>
          </CardFooter>
        </Card>
      ),
      code: `<Card>
  <CardHeader className="border-b">
    <CardTitle>Профиль</CardTitle>
    <CardDescription>Личные данные и контакты.</CardDescription>
  </CardHeader>
  <CardContent>Имя, e-mail, телефон.</CardContent>
  <CardFooter className="border-t">
    <Button variant="outline">Сохранить</Button>
  </CardFooter>
</Card>`,
    },
  ],
  props: [
    {
      name: 'Card',
      type: 'div',
      description: 'Корневой контейнер: рамка, скругление, тень, вертикальный стек секций (gap-6).',
    },
    {
      name: 'CardHeader',
      type: 'div',
      description:
        'Шапка: grid для title / description; при наличии CardAction добавляет колонку под действие.',
    },
    {
      name: 'CardTitle',
      type: 'div',
      description: 'Заголовок карточки (font-semibold, leading-none).',
    },
    {
      name: 'CardDescription',
      type: 'div',
      description: 'Подзаголовок / описание (text-sm, muted-foreground).',
    },
    {
      name: 'CardAction',
      type: 'div',
      description: 'Слот действия в правом краю шапки (кнопка, меню).',
    },
    {
      name: 'CardContent',
      type: 'div',
      description: 'Основное тело карточки (горизонтальные отступы px-6).',
    },
    {
      name: 'CardFooter',
      type: 'div',
      description: 'Подвал: flex-ряд для кнопок/мета-информации.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
