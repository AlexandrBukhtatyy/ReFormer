import { useState } from 'react';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@reformer/ui-kit/drawer';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Drawer — не поле формы: шторка на vaul (Drawer / DrawerTrigger / DrawerContent / DrawerHeader /
 * DrawerTitle / DrawerDescription / DrawerFooter / DrawerClose), которую можно смахнуть. vaul —
 * необязательная peer-зависимость, поэтому импорт только из `@reformer/ui-kit/drawer`. Variants —
 * шторка снизу, Examples — сбоку и управляемое состояние.
 */

/** Шторка закрывается сама после выбора. */
function ControlledDrawer() {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(5);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">Цель: {goal} км</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Дневная цель</DrawerTitle>
          <DrawerDescription>Сколько километров пройти за день.</DrawerDescription>
        </DrawerHeader>
        <div className="flex justify-center gap-2 p-4">
          {[3, 5, 10].map((km) => (
            <Button
              key={km}
              variant={km === goal ? 'default' : 'outline'}
              onClick={() => {
                setGoal(km);
                setOpen(false);
              }}
            >
              {km} км
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
export const drawerDocConfig: ComponentDocConfig = {
  name: 'Drawer',
  importFrom: '@reformer/ui-kit/drawer',
  description:
    'Шторка снизу (или с другого края), которую смахивают пальцем. Импорт — @reformer/ui-kit/drawer, нужен пакет vaul.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая панель снизу',
      description:
        'Шторка выезжает снизу (direction по умолчанию — bottom), сверху — полоска-ручка. Закрыть: свайп вниз, щелчок по фону, Esc или кнопка.',
      render: () => (
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Открыть панель</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Настройки уведомлений</DrawerTitle>
              <DrawerDescription>
                Выберите, о каких событиях присылать оповещения.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button>Сохранить</Button>
              <DrawerClose asChild>
                <Button variant="outline">Отмена</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ),
      code: `<Drawer>
  <DrawerTrigger asChild>
    <Button variant="outline">Открыть панель</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Настройки уведомлений</DrawerTitle>
      <DrawerDescription>
        Выберите, о каких событиях присылать оповещения.
      </DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <Button>Сохранить</Button>
      <DrawerClose asChild>
        <Button variant="outline">Отмена</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>`,
    },
  ],
  examples: [
    {
      id: 'side-right',
      title: 'Боковая панель справа',
      description:
        'direction="right" — шторка сбоку, смахивается вправо. На десктопе для такой панели обычно берут Sheet.',
      render: () => (
        <Drawer direction="right">
          <DrawerTrigger asChild>
            <Button variant="outline">Детали заказа</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Заказ №1024</DrawerTitle>
              <DrawerDescription>Оформлен 14 июля, ожидает отправки. 3 позиции.</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button>Отметить отправленным</Button>
              <DrawerClose asChild>
                <Button variant="outline">Закрыть</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ),
      code: `<Drawer direction="right">
  <DrawerTrigger asChild>
    <Button variant="outline">Детали заказа</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Заказ №1024</DrawerTitle>
      <DrawerDescription>
        Оформлен 14 июля, ожидает отправки. 3 позиции.
      </DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <Button>Отметить отправленным</Button>
      <DrawerClose asChild>
        <Button variant="outline">Закрыть</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>`,
    },
    {
      id: 'controlled',
      title: 'Закрыть из кода (open / onOpenChange)',
      description:
        'open и onOpenChange отдают состояние вам: шторка закрывается, когда выбор сохранён. Свайп вниз и щелчок по фону по-прежнему работают.',
      render: () => <ControlledDrawer />,
      code: `function ControlledDrawer() {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(5);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">Цель: {goal} км</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Дневная цель</DrawerTitle>
          <DrawerDescription>Сколько километров пройти за день.</DrawerDescription>
        </DrawerHeader>
        <div className="flex justify-center gap-2 p-4">
          {[3, 5, 10].map((km) => (
            <Button
              key={km}
              variant={km === goal ? 'default' : 'outline'}
              onClick={() => {
                setGoal(km);
                setOpen(false);
              }}
            >
              {km} км
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}`,
    },
  ],
  props: [
    {
      name: 'Drawer',
      type: 'vaul Drawer.Root',
      default: 'direction="bottom"',
      description:
        'Корень: open + onOpenChange или defaultOpen. direction — край (bottom | top | left | right). dismissible (true) — закрывать свайпом, щелчком по фону и Esc. handleOnly — тянуть только за ручку.',
    },
    {
      name: 'DrawerTrigger',
      type: 'vaul Drawer.Trigger',
      description: 'Открывает шторку. asChild — стать своим элементом, например Button.',
    },
    {
      name: 'DrawerContent',
      type: 'vaul Drawer.Content',
      description:
        'Шторка в портале с затемнением фона. У нижней — ручка сверху и высота до 80% экрана.',
    },
    {
      name: 'DrawerHeader',
      type: 'div',
      description: 'Шапка: заголовок и описание; у нижней и верхней шторки — по центру.',
    },
    {
      name: 'DrawerTitle',
      type: 'vaul Drawer.Title',
      description: 'Заголовок. Связан со шторкой через aria-labelledby. Обязателен.',
    },
    {
      name: 'DrawerDescription',
      type: 'vaul Drawer.Description',
      description: 'Описание под заголовком, связано через aria-describedby.',
    },
    {
      name: 'DrawerFooter',
      type: 'div',
      description: 'Кнопки внизу шторки, столбиком.',
    },
    {
      name: 'DrawerClose',
      type: 'vaul Drawer.Close',
      description: 'Закрывает шторку. asChild — стать своей кнопкой.',
    },
    {
      name: 'DrawerOverlay / DrawerPortal',
      type: 'vaul Drawer.Overlay / Portal',
      description:
        'Затемнение фона и портал. DrawerContent рисует их сам; отдельно нужны только для своей композиции.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
