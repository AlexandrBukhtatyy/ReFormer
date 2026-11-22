import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
  Button,
  Input,
  Label,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Sheet — не поле формы: Radix Dialog в виде панели у края экрана (Sheet / SheetTrigger /
 * SheetContent / SheetHeader / SheetTitle / SheetDescription / SheetFooter / SheetClose).
 * Край задаёт `side`. Variants — базовая панель и четыре края, Examples — навигация, форма,
 * панель без крестика.
 */
export const sheetDocConfig: ComponentDocConfig = {
  name: 'Sheet',
  importFrom: '@reformer/ui-kit',
  description:
    'Панель, которая выезжает от края экрана: справа, слева, сверху или снизу. Модальная, как Dialog.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая панель',
      description:
        'Панель выезжает справа: заголовок, описание, кнопки внизу. Крестик в углу рисует SheetContent (showCloseButton по умолчанию true).',
      render: () => (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Открыть панель</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Изменить профиль</SheetTitle>
              <SheetDescription>
                Обновите имя и контакты. Изменения сохранятся после подтверждения.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button>Сохранить</Button>
              <SheetClose asChild>
                <Button variant="outline">Отмена</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ),
      code: `<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Открыть панель</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Изменить профиль</SheetTitle>
      <SheetDescription>
        Обновите имя и контакты. Изменения сохранятся после подтверждения.
      </SheetDescription>
    </SheetHeader>
    <SheetFooter>
      <Button>Сохранить</Button>
      <SheetClose asChild>
        <Button variant="outline">Отмена</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>`,
    },
    {
      id: 'sides',
      title: 'Четыре направления (side)',
      description:
        'side — край, от которого выезжает панель: right (по умолчанию), left, top, bottom.',
      render: () => (
        <div className="flex flex-wrap gap-2">
          {(['right', 'left', 'top', 'bottom'] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger asChild>
                <Button variant="outline">{side}</Button>
              </SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Панель: {side}</SheetTitle>
                  <SheetDescription>Панель выезжает от края «{side}».</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          ))}
        </div>
      ),
      code: `<div className="flex flex-wrap gap-2">
  {(['right', 'left', 'top', 'bottom'] as const).map((side) => (
    <Sheet key={side}>
      <SheetTrigger asChild>
        <Button variant="outline">{side}</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Панель: {side}</SheetTitle>
          <SheetDescription>Панель выезжает от края «{side}».</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ))}
</div>`,
    },
  ],
  examples: [
    {
      id: 'navigation',
      title: 'Навигационная панель слева',
      description:
        'side="left" — меню разделов на узком экране. SheetClose вокруг пункта закрывает панель при переходе.',
      render: () => (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Меню</Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Навигация</SheetTitle>
              <SheetDescription>Разделы приложения.</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {['Обзор', 'Проекты', 'Настройки'].map((item) => (
                <SheetClose asChild key={item}>
                  <Button variant="ghost" className="justify-start">
                    {item}
                  </Button>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      ),
      code: `<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Меню</Button>
  </SheetTrigger>
  <SheetContent side="left">
    <SheetHeader>
      <SheetTitle>Навигация</SheetTitle>
      <SheetDescription>Разделы приложения.</SheetDescription>
    </SheetHeader>
    <nav className="flex flex-col gap-1 px-4">
      {['Обзор', 'Проекты', 'Настройки'].map((item) => (
        <SheetClose asChild key={item}>
          <Button variant="ghost" className="justify-start">
            {item}
          </Button>
        </SheetClose>
      ))}
    </nav>
  </SheetContent>
</Sheet>`,
    },
    {
      id: 'form',
      title: 'Форма в панели',
      description:
        'Панель справа с полями — редактирование записи без ухода со страницы. Кнопка «Сохранить» обёрнута в SheetClose и закрывает панель.',
      render: () => (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Изменить контакт</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Контакт</SheetTitle>
              <SheetDescription>Имя и почта для уведомлений.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4">
              <div className="grid gap-2">
                <Label htmlFor="sheet-name">Имя</Label>
                <Input id="sheet-name" defaultValue="Анна Смирнова" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sheet-email">Email</Label>
                <Input id="sheet-email" type="email" defaultValue="anna@example.com" />
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button>Сохранить</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ),
      code: `<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Изменить контакт</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Контакт</SheetTitle>
      <SheetDescription>Имя и почта для уведомлений.</SheetDescription>
    </SheetHeader>
    <div className="grid gap-4 px-4">
      <div className="grid gap-2">
        <Label htmlFor="sheet-name">Имя</Label>
        <Input id="sheet-name" defaultValue="Анна Смирнова" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sheet-email">Email</Label>
        <Input id="sheet-email" type="email" defaultValue="anna@example.com" />
      </div>
    </div>
    <SheetFooter>
      <SheetClose asChild>
        <Button>Сохранить</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>`,
    },
    {
      id: 'without-close-icon',
      title: 'Без крестика (showCloseButton={false})',
      description:
        'showCloseButton={false} убирает крестик. Esc и щелчок по фону панель всё равно закрывают.',
      render: () => (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Открыть без крестика</Button>
          </SheetTrigger>
          <SheetContent showCloseButton={false}>
            <SheetHeader>
              <SheetTitle>Требуется решение</SheetTitle>
              <SheetDescription>
                Выберите один из вариантов — крестика у панели нет.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button>Продолжить</Button>
              <SheetClose asChild>
                <Button variant="outline">Позже</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ),
      code: `<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Открыть без крестика</Button>
  </SheetTrigger>
  <SheetContent showCloseButton={false}>
    <SheetHeader>
      <SheetTitle>Требуется решение</SheetTitle>
      <SheetDescription>
        Выберите один из вариантов — крестика у панели нет.
      </SheetDescription>
    </SheetHeader>
    <SheetFooter>
      <Button>Продолжить</Button>
      <SheetClose asChild>
        <Button variant="outline">Позже</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>`,
    },
  ],
  props: [
    {
      name: 'Sheet',
      type: 'Radix Dialog.Root',
      description:
        'Корень, хранит открытость: open + onOpenChange или defaultOpen. modal (true) — блокировать страницу.',
    },
    {
      name: 'SheetTrigger',
      type: 'Radix Dialog.Trigger',
      description: 'Открывает панель. asChild — стать своим элементом, например Button.',
    },
    {
      name: 'SheetContent',
      type: 'Radix Dialog.Content',
      default: 'side="right", showCloseButton=true',
      description:
        'Панель в портале с затемнением фона. side — край (top / right / bottom / left), showCloseButton — крестик в углу.',
    },
    {
      name: 'SheetHeader',
      type: 'div',
      description: 'Шапка: заголовок и описание столбиком, с отступами 16px.',
    },
    {
      name: 'SheetTitle',
      type: 'Radix Dialog.Title',
      description:
        'Заголовок. Radix связывает его с панелью через aria-labelledby. Обязателен; скрыть можно классом sr-only.',
    },
    {
      name: 'SheetDescription',
      type: 'Radix Dialog.Description',
      description: 'Описание под заголовком. Radix связывает его с панелью через aria-describedby.',
    },
    {
      name: 'SheetFooter',
      type: 'div',
      description: 'Кнопки внизу панели, столбиком. Прижат к нижнему краю.',
    },
    {
      name: 'SheetClose',
      type: 'Radix Dialog.Close',
      description: 'Закрывает панель. asChild — стать своей кнопкой или ссылкой.',
    },
    {
      name: 'SheetOverlay / SheetPortal',
      type: 'Radix Dialog.Overlay / Portal',
      description:
        'Затемнение фона и портал. SheetContent рисует их сам; отдельно нужны только для своей композиции.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
