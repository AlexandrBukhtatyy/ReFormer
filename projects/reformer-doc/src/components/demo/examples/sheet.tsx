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
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Sheet — не form-control: Radix Dialog, оформленный как выезжающая сбоку панель
 * (Sheet / SheetTrigger / SheetPortal / SheetOverlay / SheetContent / SheetHeader /
 * SheetFooter / SheetTitle / SheetDescription / SheetClose). Контент рендерится в
 * Portal поверх страницы, направление выезда задаёт `side` (top | right | bottom |
 * left). Таб Variants — готовые композиции панели, Examples — приёмы (навигация,
 * подтверждение действий, без крестика), API — таблица частей и общих props.
 */
export const sheetDocConfig: ComponentDocConfig = {
  name: 'Sheet',
  importFrom: '@reformer/ui-kit',
  description:
    'Боковая панель на shadcn / Radix Dialog. Compound: Sheet (корень) + SheetTrigger, SheetContent (в Portal, с оверлеем и крестиком закрытия), SheetHeader / SheetTitle / SheetDescription, SheetFooter, SheetClose. Направление выезда — prop side (top / right / bottom / left). Доступность (focus trap, Esc, aria) — из Radix.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая панель',
      description:
        'Триггер выдвигает панель справа с заголовком, описанием и подвалом. Крестик закрытия встроен в SheetContent (showCloseButton по умолчанию).',
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
        'Prop side управляет краем, от которого выезжает панель: right (по умолчанию), left, top, bottom.',
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
      code: `{(['right', 'left', 'top', 'bottom'] as const).map((side) => (
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
))}`,
    },
  ],
  examples: [
    {
      id: 'navigation',
      title: 'Навигационная панель слева',
      description:
        'side="left" — типичный мобильный «бургер»-навигатор. SheetClose оборачивает пункты, чтобы клик закрывал панель.',
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
      id: 'confirm',
      title: 'Подтверждение действия',
      description:
        'Панель с деструктивным действием: описание последствий + кнопки «Отмена» / «Удалить» в подвале.',
      render: () => (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="destructive">Удалить аккаунт</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Удалить аккаунт?</SheetTitle>
              <SheetDescription>
                Действие необратимо: все данные будут удалены без возможности восстановления.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button variant="destructive">Удалить</Button>
              <SheetClose asChild>
                <Button variant="outline">Отмена</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ),
      code: `<Sheet>
  <SheetTrigger asChild>
    <Button variant="destructive">Удалить аккаунт</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Удалить аккаунт?</SheetTitle>
      <SheetDescription>
        Действие необратимо: все данные будут удалены без возможности восстановления.
      </SheetDescription>
    </SheetHeader>
    <SheetFooter>
      <Button variant="destructive">Удалить</Button>
      <SheetClose asChild>
        <Button variant="outline">Отмена</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>`,
    },
    {
      id: 'without-close-icon',
      title: 'Без крестика (showCloseButton={false})',
      description:
        'SheetContent по умолчанию рисует крестик в правом верхнем углу; showCloseButton={false} убирает его — закрытие только через явные кнопки.',
      render: () => (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Открыть без крестика</Button>
          </SheetTrigger>
          <SheetContent showCloseButton={false}>
            <SheetHeader>
              <SheetTitle>Требуется решение</SheetTitle>
              <SheetDescription>
                Выберите один из вариантов — закрыть панель крестиком нельзя.
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
        Выберите один из вариантов — закрыть панель крестиком нельзя.
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
        'Корень. Управляемое состояние: open / onOpenChange (или defaultOpen для неуправляемого). modal (по умолчанию true).',
    },
    {
      name: 'SheetTrigger',
      type: 'Radix Dialog.Trigger',
      description: 'Открывает панель. asChild — прокинуть на собственный элемент (напр. Button).',
    },
    {
      name: 'SheetContent',
      type: 'Radix Dialog.Content',
      default: 'side="right", showCloseButton=true',
      description:
        'Тело панели в Portal: оверлей, выезд от края, анимация. side — край выезда (top / right / bottom / left). showCloseButton — крестик закрытия в углу.',
    },
    {
      name: 'SheetHeader',
      type: 'div',
      description: 'Шапка: вертикальный стек заголовка и описания с отступами.',
    },
    {
      name: 'SheetTitle',
      type: 'Radix Dialog.Title',
      description:
        'Заголовок (font-semibold). Связывается с панелью через aria-labelledby — обязателен для доступности.',
    },
    {
      name: 'SheetDescription',
      type: 'Radix Dialog.Description',
      description: 'Описание (text-sm, muted). Связывается через aria-describedby.',
    },
    {
      name: 'SheetFooter',
      type: 'div',
      description:
        'Подвал для действий (вертикальный стек с отступами, прижат к низу через mt-auto).',
    },
    {
      name: 'SheetClose',
      type: 'Radix Dialog.Close',
      description: 'Закрывает панель. asChild — прокинуть на собственную кнопку.',
    },
    {
      name: 'SheetOverlay / SheetPortal',
      type: 'Radix Dialog.Overlay / Portal',
      description:
        'Оверлей-затемнение и Portal-обёртка. Используются внутри SheetContent; экспортируются для кастомных композиций.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
