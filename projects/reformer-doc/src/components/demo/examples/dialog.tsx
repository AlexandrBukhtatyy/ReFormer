import { useState } from 'react';
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
  Input,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Dialog — не поле формы: части на Radix Dialog (Dialog / DialogTrigger / DialogContent /
 * DialogHeader / DialogTitle / DialogDescription / DialogFooter / DialogClose; DialogPortal и
 * DialogOverlay — для своих композиций). Окно рисуется в портале поверх страницы. Variants —
 * базовое окно, Examples — приёмы (управляемое состояние, кнопка закрытия в подвале, без
 * крестика), API — таблица частей.
 */

/** Окно закрывается само, когда «запрос» завершился. Сервер имитируется задержкой. */
function ControlledDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // имитация запроса
    setSaving(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Переименовать проект</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новое название</DialogTitle>
          <DialogDescription>Название видят все участники проекта.</DialogDescription>
        </DialogHeader>
        <Input defaultValue="Кредитная заявка" aria-label="Название проекта" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Отмена</Button>
          </DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export const dialogDocConfig: ComponentDocConfig = {
  name: 'Dialog',
  importFrom: '@reformer/ui-kit',
  description:
    'Модальное окно поверх страницы: заголовок, содержимое, кнопки. Фокус, Esc и aria-атрибуты — от Radix.',
  variants: [
    {
      id: 'basic',
      title: 'Базовый диалог',
      description:
        'Триггер открывает окно с заголовком, описанием и подвалом. Крестик в углу рисует DialogContent (showCloseButton по умолчанию true).',
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
      id: 'controlled',
      title: 'Закрыть после сохранения (open / onOpenChange)',
      description:
        'open и onOpenChange отдают состояние вам: окно закрывается, когда сохранение завершилось, а не сразу по нажатию.',
      render: () => <ControlledDialog />,
      code: `function ControlledDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // имитация запроса
    setSaving(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Переименовать проект</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новое название</DialogTitle>
          <DialogDescription>Название видят все участники проекта.</DialogDescription>
        </DialogHeader>
        <Input defaultValue="Кредитная заявка" aria-label="Название проекта" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Отмена</Button>
          </DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}`,
    },
    {
      id: 'footer-close-button',
      title: 'Подвал со встроенной кнопкой закрытия',
      description:
        'showCloseButton у DialogFooter добавляет кнопку «Закрыть» без ручной разметки. Её подпись — из словаря кита.',
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
        'showCloseButton={false} у DialogContent убирает крестик. Esc и щелчок по фону окно всё равно закрывают.',
      render: () => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Открыть без крестика</Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Требуется решение</DialogTitle>
              <DialogDescription>
                Выберите один из вариантов — крестика у окна нет.
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
        Выберите один из вариантов — крестика у окна нет.
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
        'Корень, хранит открытость: open + onOpenChange или defaultOpen. modal (true) — блокировать страницу под окном.',
    },
    {
      name: 'DialogTrigger',
      type: 'Radix Dialog.Trigger',
      description: 'Открывает окно. asChild — стать своим элементом, например Button.',
    },
    {
      name: 'DialogContent',
      type: 'Radix Dialog.Content',
      default: 'showCloseButton=true',
      description:
        'Окно в портале: затемнение фона, центр экрана, ширина до max-w-lg. showCloseButton — крестик в углу.',
    },
    {
      name: 'DialogHeader',
      type: 'div',
      description: 'Шапка: заголовок и описание столбиком; на узком экране по центру.',
    },
    {
      name: 'DialogTitle',
      type: 'Radix Dialog.Title',
      description:
        'Заголовок. Radix связывает его с окном через aria-labelledby. Обязателен; скрыть можно классом sr-only.',
    },
    {
      name: 'DialogDescription',
      type: 'Radix Dialog.Description',
      description: 'Описание под заголовком. Radix связывает его с окном через aria-describedby.',
    },
    {
      name: 'DialogFooter',
      type: 'div',
      default: 'showCloseButton=false',
      description:
        'Кнопки действий: ряд справа на широком экране, столбик на узком. showCloseButton — кнопка «Закрыть».',
    },
    {
      name: 'DialogClose',
      type: 'Radix Dialog.Close',
      description: 'Закрывает окно. asChild — стать своей кнопкой.',
    },
    {
      name: 'DialogOverlay / DialogPortal',
      type: 'Radix Dialog.Overlay / Portal',
      description:
        'Затемнение фона и портал. DialogContent рисует их сам; отдельно нужны только для своей композиции.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
