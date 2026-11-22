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
 * Card — не поле формы: набор презентационных блоков (Card / CardHeader / CardTitle /
 * CardDescription / CardAction / CardContent / CardFooter). Variants — готовые композиции,
 * Examples — приёмы, API — таблица частей. Обёртка `<div style>` в render — рамка демо, в `code`
 * её нет.
 */
export const cardDocConfig: ComponentDocConfig = {
  name: 'Card',
  importFrom: '@reformer/ui-kit',
  description:
    'Контейнер с рамкой и тенью: шапка (заголовок, описание, действие), содержимое и подвал.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая карточка',
      description: 'Header (title + description), Content и Footer.',
      render: () => (
        <div style={{ maxWidth: 360 }}>
          <Card>
            <CardHeader>
              <CardTitle>Тариф «Стандарт»</CardTitle>
              <CardDescription>Помесячная оплата, без комиссии.</CardDescription>
            </CardHeader>
            <CardContent>Всё необходимое для старта: 10 проектов, 5 ГБ хранилища.</CardContent>
            <CardFooter>
              <Button>Подключить</Button>
            </CardFooter>
          </Card>
        </div>
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
      description: 'CardAction встаёт в правый край шапки — кнопка или меню рядом с заголовком.',
      render: () => (
        <div style={{ maxWidth: 360 }}>
          <Card>
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
        </div>
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
      description: 'Card годится и как простой контейнер — только CardContent.',
      render: () => (
        <div style={{ maxWidth: 360 }}>
          <Card>
            <CardContent>Короткая заметка без заголовка и подвала.</CardContent>
          </Card>
        </div>
      ),
      code: `<Card>
  <CardContent>Короткая заметка без заголовка и подвала.</CardContent>
</Card>`,
    },
    {
      id: 'bordered-sections',
      title: 'Линии между частями (border-b / border-t)',
      description:
        'Класс border-b на CardHeader или border-t на CardFooter рисует линию, и часть сама добавляет отступ до неё.',
      render: () => (
        <div style={{ maxWidth: 360 }}>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Профиль</CardTitle>
              <CardDescription>Личные данные и контакты.</CardDescription>
            </CardHeader>
            <CardContent>Имя, e-mail, телефон.</CardContent>
            <CardFooter className="border-t">
              <Button variant="outline">Сохранить</Button>
            </CardFooter>
          </Card>
        </div>
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
      description: 'Корень: рамка, скругление, тень, вертикальный стек частей с отступом gap-6.',
    },
    {
      name: 'CardHeader',
      type: 'div',
      description:
        'Шапка: сетка для заголовка и описания; при CardAction добавляет колонку справа под действие.',
    },
    {
      name: 'CardTitle',
      type: 'div',
      description: 'Заголовок карточки. Это <div>, не заголовок документа — см. «Доступность».',
    },
    {
      name: 'CardDescription',
      type: 'div',
      description: 'Описание под заголовком: мелкий приглушённый текст.',
    },
    {
      name: 'CardAction',
      type: 'div',
      description: 'Место для кнопки или меню в правом краю шапки.',
    },
    {
      name: 'CardContent',
      type: 'div',
      description: 'Содержимое: горизонтальные отступы px-6, вертикальный ритм — ваш (space-y-*).',
    },
    {
      name: 'CardFooter',
      type: 'div',
      description: 'Подвал: ряд для кнопок или служебной информации.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
