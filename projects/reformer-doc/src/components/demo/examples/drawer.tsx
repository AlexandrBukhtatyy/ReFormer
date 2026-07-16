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
 * Drawer — не form-control: обёртка над vaul (Drawer / DrawerTrigger / DrawerPortal /
 * DrawerOverlay / DrawerClose / DrawerContent / DrawerHeader / DrawerFooter / DrawerTitle /
 * DrawerDescription). Выезжающая панель с жестом перетаскивания; контент рендерится в Portal
 * поверх страницы. direction (bottom | top | left | right) задаёт сторону выезда. Таб Variants —
 * готовые композиции, Examples — приёмы (боковая панель, подтверждение), API — таблица частей.
 */
export const drawerDocConfig: ComponentDocConfig = {
  name: 'Drawer',
  importFrom: '@reformer/ui-kit',
  description:
    'Выезжающая панель на shadcn / vaul. Compound: Drawer (корень, direction) + DrawerTrigger, DrawerContent (в Portal, с оверлеем и «ручкой» перетаскивания), DrawerHeader / DrawerTitle / DrawerDescription, DrawerFooter, DrawerClose. Жест drag-to-dismiss, focus-trap, Esc и aria — из vaul.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая панель снизу',
      description:
        'Триггер открывает панель, выезжающую снизу (direction по умолчанию — bottom). Заголовок, описание, подвал с действиями.',
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
        'direction="right" превращает Drawer в выезжающую сбоку панель — удобно для деталей записи или фильтров.',
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
      id: 'confirm',
      title: 'Подтверждение действия',
      description:
        'Короткая панель с деструктивным действием: описание последствий + кнопки «Отмена» / «Удалить». Закрытие жестом или по кнопке.',
      render: () => (
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="destructive">Удалить проект</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Удалить проект?</DrawerTitle>
              <DrawerDescription>
                Действие необратимо: все задачи и файлы будут удалены.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button variant="destructive">Удалить</Button>
              <DrawerClose asChild>
                <Button variant="outline">Отмена</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ),
      code: `<Drawer>
  <DrawerTrigger asChild>
    <Button variant="destructive">Удалить проект</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Удалить проект?</DrawerTitle>
      <DrawerDescription>
        Действие необратимо: все задачи и файлы будут удалены.
      </DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <Button variant="destructive">Удалить</Button>
      <DrawerClose asChild>
        <Button variant="outline">Отмена</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>`,
    },
  ],
  props: [
    {
      name: 'Drawer',
      type: 'vaul Drawer.Root',
      default: 'direction="bottom"',
      description:
        'Корень. Управляемое состояние: open / onOpenChange (или неуправляемое). direction — сторона выезда (bottom | top | left | right). shouldScaleBackground — масштаб фона под панелью.',
    },
    {
      name: 'DrawerTrigger',
      type: 'vaul Drawer.Trigger',
      description: 'Открывает панель. asChild — прокинуть на собственный элемент (напр. Button).',
    },
    {
      name: 'DrawerContent',
      type: 'vaul Drawer.Content',
      description:
        'Тело панели в Portal: оверлей, «ручка» перетаскивания (для bottom), стили по direction. Жест drag-to-dismiss.',
    },
    {
      name: 'DrawerHeader',
      type: 'div',
      description:
        'Шапка: вертикальный стек заголовка и описания (центрирование для bottom/top, слева для боковых).',
    },
    {
      name: 'DrawerTitle',
      type: 'vaul Drawer.Title',
      description:
        'Заголовок (font-semibold). Связывается с панелью через aria-labelledby — обязателен для доступности.',
    },
    {
      name: 'DrawerDescription',
      type: 'vaul Drawer.Description',
      description: 'Описание (text-sm, muted). Связывается через aria-describedby.',
    },
    {
      name: 'DrawerFooter',
      type: 'div',
      description: 'Подвал для действий (вертикальный стек, прижат к низу через mt-auto).',
    },
    {
      name: 'DrawerClose',
      type: 'vaul Drawer.Close',
      description: 'Закрывает панель. asChild — прокинуть на собственную кнопку.',
    },
    {
      name: 'DrawerOverlay / DrawerPortal',
      type: 'vaul Drawer.Overlay / Portal',
      description:
        'Оверлей-затемнение и Portal-обёртка. Используются внутри DrawerContent; экспортируются для кастомных композиций.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
