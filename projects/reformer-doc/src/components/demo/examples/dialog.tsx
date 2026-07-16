import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Button,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Dialog — не form-control: Radix Dialog compound (Dialog / DialogTrigger / DialogPortal /
 * DialogOverlay / DialogClose / DialogContent / DialogHeader / DialogFooter / DialogTitle /
 * DialogDescription). Управляемое состояние open/onOpenChange; контент рендерится в Portal
 * поверх страницы. Таб Variants — готовые композиции модалки, Examples — приёмы (footer с
 * действиями, управляемое состояние), API — таблица частей и общих props.
 */
export const dialogDocConfig: ComponentDocConfig = {
  name: 'Dialog',
  importFrom: '@reformer/ui-kit',
  description:
    'Модальное окно на shadcn / Radix Dialog. Compound: Dialog (корень) + DialogTrigger, DialogContent (в Portal, с оверлеем и кнопкой закрытия), DialogHeader / DialogTitle / DialogDescription, DialogFooter, DialogClose. Доступность (focus trap, Esc, aria) — из Radix.',
  variants: [
    {
      id: 'basic',
      title: 'Базовый диалог',
      description:
        'Триггер открывает модалку с заголовком, описанием и подвалом. Крестик закрытия — встроен в DialogContent (showCloseButton по умолчанию).',
      render: () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Открыть диалог</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Изменить профиль</DialogTitle>
              <DialogDescription>
                Обновите имя и контакты. Изменения сохранятся после подтверждения.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Отмена</Button>
              </DialogClose>
              <Button>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
      code: `<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Открыть диалог</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Изменить профиль</DialogTitle>
      <DialogDescription>
        Обновите имя и контакты. Изменения сохранятся после подтверждения.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Отмена</Button>
      </DialogClose>
      <Button>Сохранить</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
    },
  ],
  examples: [
    {
      id: 'confirm',
      title: 'Подтверждение действия',
      description:
        'Короткая модалка с деструктивным действием: описание последствий + кнопки «Отмена» / «Удалить».',
      render: () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">Удалить аккаунт</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Удалить аккаунт?</DialogTitle>
              <DialogDescription>
                Действие необратимо: все данные будут удалены без возможности восстановления.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Отмена</Button>
              </DialogClose>
              <Button variant="destructive">Удалить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
      code: `<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Удалить аккаунт</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Удалить аккаунт?</DialogTitle>
      <DialogDescription>
        Действие необратимо: все данные будут удалены без возможности восстановления.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Отмена</Button>
      </DialogClose>
      <Button variant="destructive">Удалить</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
    },
    {
      id: 'footer-close-button',
      title: 'Подвал со встроенной кнопкой закрытия',
      description:
        'DialogFooter принимает showCloseButton — добавляет кнопку «Close» (DialogClose) без ручной разметки.',
      render: () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Показать сведения</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Сведения о тарифе</DialogTitle>
              <DialogDescription>
                10 проектов, 5 ГБ хранилища, приоритетная поддержка.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
      ),
      code: `<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Показать сведения</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Сведения о тарифе</DialogTitle>
      <DialogDescription>
        10 проектов, 5 ГБ хранилища, приоритетная поддержка.
      </DialogDescription>
    </DialogHeader>
    {/* showCloseButton сам рендерит DialogClose + Button */}
    <DialogFooter showCloseButton />
  </DialogContent>
</Dialog>`,
    },
    {
      id: 'without-close-icon',
      title: 'Без крестика (showCloseButton={false})',
      description:
        'DialogContent по умолчанию рисует крестик в правом верхнем углу; showCloseButton={false} убирает его — закрытие только через явные кнопки.',
      render: () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Открыть без крестика</Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Требуется решение</DialogTitle>
              <DialogDescription>
                Выберите один из вариантов — закрыть окно крестиком нельзя.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Позже</Button>
              </DialogClose>
              <Button>Продолжить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
      code: `<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Открыть без крестика</Button>
  </DialogTrigger>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Требуется решение</DialogTitle>
      <DialogDescription>
        Выберите один из вариантов — закрыть окно крестиком нельзя.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Позже</Button>
      </DialogClose>
      <Button>Продолжить</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
    },
  ],
  props: [
    {
      name: 'Dialog',
      type: 'Radix Dialog.Root',
      description:
        'Корень. Управляемое состояние: open / onOpenChange (или defaultOpen для неуправляемого). modal (по умолчанию true).',
    },
    {
      name: 'DialogTrigger',
      type: 'Radix Dialog.Trigger',
      description: 'Открывает диалог. asChild — прокинуть на собственный элемент (напр. Button).',
    },
    {
      name: 'DialogContent',
      type: 'Radix Dialog.Content',
      default: 'showCloseButton=true',
      description:
        'Тело модалки в Portal: оверлей, центрирование, анимация. showCloseButton — крестик закрытия в углу.',
    },
    {
      name: 'DialogHeader',
      type: 'div',
      description: 'Шапка: вертикальный стек заголовка и описания (адаптивное выравнивание).',
    },
    {
      name: 'DialogTitle',
      type: 'Radix Dialog.Title',
      description:
        'Заголовок (font-semibold). Связывается с диалогом через aria-labelledby — обязателен для доступности.',
    },
    {
      name: 'DialogDescription',
      type: 'Radix Dialog.Description',
      description: 'Описание (text-sm, muted). Связывается через aria-describedby.',
    },
    {
      name: 'DialogFooter',
      type: 'div',
      default: 'showCloseButton=false',
      description:
        'Подвал для действий (реверс-стек на мобильных, ряд справа на десктопе). showCloseButton — добавить кнопку «Close».',
    },
    {
      name: 'DialogClose',
      type: 'Radix Dialog.Close',
      description: 'Закрывает диалог. asChild — прокинуть на собственную кнопку.',
    },
    {
      name: 'DialogOverlay / DialogPortal',
      type: 'Radix Dialog.Overlay / Portal',
      description:
        'Оверлей-затемнение и Portal-обёртка. Используются внутри DialogContent; экспортируются для кастомных композиций.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
