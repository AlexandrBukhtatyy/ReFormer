import { Toaster, toast } from '@reformer/ui-kit/sonner';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Sonner — не поле формы: контейнер `Toaster` над пакетом `sonner` и функция `toast`. sonner —
 * необязательная peer-зависимость, поэтому импорт только из `@reformer/ui-kit/sonner`.
 * `toast()` показывает уведомление во всех смонтированных Toaster сразу, поэтому на вкладке
 * Examples Toaster есть только в первом примере — иначе каждое уведомление появилось бы трижды.
 */
export const sonnerDocConfig: ComponentDocConfig = {
  name: 'Toaster (Sonner)',
  importFrom: '@reformer/ui-kit/sonner',
  description:
    'Всплывающие уведомления: один Toaster в корне, вызов toast() откуда угодно. Импорт — @reformer/ui-kit/sonner, нужен пакет sonner.',
  variants: [
    {
      id: 'basic',
      title: 'Базовый тост',
      description:
        'Toaster смонтирован, кнопка вызывает toast(). Уведомление появляется в правом нижнем углу и через 4 секунды исчезает.',
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Toaster />
          <Button variant="outline" onClick={() => toast('Профиль обновлён')}>
            Показать тост
          </Button>
        </div>
      ),
      code: `// Смонтируйте один <Toaster /> в корне приложения
<Toaster />

<Button variant="outline" onClick={() => toast('Профиль обновлён')}>
  Показать тост
</Button>`,
    },
  ],
  examples: [
    {
      id: 'statuses',
      title: 'Статусы',
      description:
        'toast.success / error / warning / info — уведомление со своей иконкой. Здесь же смонтирован Toaster для всей вкладки.',
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Toaster />
          <Button variant="outline" onClick={() => toast.success('Сохранено')}>
            Success
          </Button>
          <Button variant="outline" onClick={() => toast.error('Не удалось сохранить')}>
            Error
          </Button>
          <Button variant="outline" onClick={() => toast.warning('Проверьте данные')}>
            Warning
          </Button>
          <Button variant="outline" onClick={() => toast.info('Синхронизация запущена')}>
            Info
          </Button>
        </div>
      ),
      code: `<Toaster />

<Button variant="outline" onClick={() => toast.success('Сохранено')}>
  Success
</Button>
<Button variant="outline" onClick={() => toast.error('Не удалось сохранить')}>
  Error
</Button>
<Button variant="outline" onClick={() => toast.warning('Проверьте данные')}>
  Warning
</Button>
<Button variant="outline" onClick={() => toast.info('Синхронизация запущена')}>
  Info
</Button>`,
    },
    {
      id: 'description-action',
      title: 'Описание и действие',
      description:
        'Второй аргумент toast(message, options): description — вторая строка, action — кнопка в уведомлении, например «Отменить».',
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              toast('Файл удалён', {
                description: 'document.pdf перемещён в корзину',
                action: {
                  label: 'Отменить',
                  onClick: () => toast.success('Восстановлено'),
                },
              })
            }
          >
            Удалить файл
          </Button>
        </div>
      ),
      code: `// <Toaster /> уже смонтирован один раз в корне приложения
<Button
  variant="outline"
  onClick={() =>
    toast('Файл удалён', {
      description: 'document.pdf перемещён в корзину',
      action: {
        label: 'Отменить',
        onClick: () => toast.success('Восстановлено'),
      },
    })
  }
>
  Удалить файл
</Button>`,
    },
    {
      id: 'promise',
      title: 'Асинхронная операция (toast.promise)',
      description:
        'toast.promise показывает уведомление «загрузка» и сам меняет его на успех или ошибку, когда промис завершится.',
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              toast.promise(new Promise<void>((resolve) => setTimeout(resolve, 1500)), {
                loading: 'Сохраняем изменения…',
                success: 'Изменения сохранены',
                error: 'Не удалось сохранить',
              })
            }
          >
            Сохранить
          </Button>
        </div>
      ),
      code: `// <Toaster /> уже смонтирован один раз в корне приложения
<Button
  variant="outline"
  onClick={() =>
    // запрос к серверу имитирует промис с задержкой
    toast.promise(new Promise<void>((resolve) => setTimeout(resolve, 1500)), {
      loading: 'Сохраняем изменения…',
      success: 'Изменения сохранены',
      error: 'Не удалось сохранить',
    })
  }
>
  Сохранить
</Button>`,
    },
  ],
  props: [
    {
      name: 'Toaster',
      type: 'sonner Toaster',
      description:
        'Контейнер уведомлений. Один на приложение, у корня. Иконки статусов — из lucide-react, цвета — из темы кита.',
    },
    {
      name: 'theme',
      type: "'light' | 'dark' | 'system'",
      default: "'system'",
      description:
        'Тема уведомлений. У кита — system, по настройке ОС; если тема приложения переключается вручную, передайте её сами.',
    },
    {
      name: 'position',
      type: "'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'",
      default: "'bottom-right'",
      description: 'Угол экрана для стопки уведомлений.',
    },
    {
      name: 'richColors',
      type: 'boolean',
      default: 'false',
      description: 'Заливка цветом статуса у success / error / warning / info.',
    },
    {
      name: 'expand',
      type: 'boolean',
      default: 'false',
      description: 'Показывать стопку раскрытой, а не только при наведении.',
    },
    {
      name: 'closeButton',
      type: 'boolean',
      default: 'false',
      description: 'Крестик на каждом уведомлении.',
    },
    {
      name: 'duration',
      type: 'number',
      default: '4000',
      description: 'Сколько миллисекунд уведомление на экране.',
    },
    {
      name: 'containerAriaLabel',
      type: 'string',
      default: "'Notifications'",
      description: 'Имя области уведомлений для скринридера. Кит его не переводит.',
    },
    {
      name: 'toastOptions',
      type: 'ToastOptions',
      description:
        'Общие настройки уведомлений: closeButtonAriaLabel (по умолчанию «Close toast»), classNames, duration. Ваш объект заменяет настройки кита целиком.',
    },
    {
      name: 'toast(message, options?)',
      type: 'function',
      description:
        'Показать уведомление. options: description, action { label, onClick }, duration, id. Возвращает id для toast.dismiss(id).',
    },
    {
      name: 'toast.success / error / warning / info',
      type: 'function',
      description: 'Уведомление со статусом: своя иконка, при richColors — свой цвет.',
    },
    {
      name: 'toast.promise(promise, { loading, success, error })',
      type: 'function',
      description: 'Уведомление «загрузка», которое само сменится на успех или ошибку.',
    },
  ],
};
