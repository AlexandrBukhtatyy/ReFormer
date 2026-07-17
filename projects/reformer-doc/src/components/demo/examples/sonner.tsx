import { Toaster, toast } from '@reformer/ui-kit/sonner';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Sonner — не form-control: обёртка `Toaster` над пакетом `sonner` + императивный `toast`.
 * `Toaster` монтируется один раз (в реальном приложении — в корне), а тосты вызываются
 * из любого места через `toast(...)` / `toast.success|error|warning|info|promise`.
 * В демо каждый превью содержит собственный `<Toaster />`, чтобы работать автономно.
 * Таб Variants — базовый вызов, Examples — статусы, действие в тосте и `toast.promise`,
 * API — таблица частей и ключевых props обёртки.
 */
export const sonnerDocConfig: ComponentDocConfig = {
  name: 'Toaster (Sonner)',
  importFrom: '@reformer/ui-kit',
  description:
    'Тост-уведомления на shadcn / sonner. `Toaster` — контейнер-обёртка (тема статична, иконки статусов из lucide-react), `toast(...)` — императивный API. Монтируйте один `Toaster` в корне приложения и вызывайте `toast` откуда угодно.',
  variants: [
    {
      id: 'basic',
      title: 'Базовый тост',
      description:
        'Смонтированный `Toaster` + кнопка, вызывающая `toast(...)`. Тост появляется в углу и авто-скрывается.',
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
        '`toast.success` / `toast.error` / `toast.warning` / `toast.info` — типизированные тосты со своей иконкой и цветом.',
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

<Button onClick={() => toast.success('Сохранено')}>Success</Button>
<Button onClick={() => toast.error('Не удалось сохранить')}>Error</Button>
<Button onClick={() => toast.warning('Проверьте данные')}>Warning</Button>
<Button onClick={() => toast.info('Синхронизация запущена')}>Info</Button>`,
    },
    {
      id: 'description-action',
      title: 'Описание и действие',
      description:
        'Второй аргумент `toast(message, opts)` — `description` (второй строкой) и `action` (кнопка, напр. «Отмена»).',
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Toaster />
          <Button
            variant="outline"
            onClick={() =>
              toast('Файл удалён', {
                description: 'document.pdf перемещён в корзину',
                action: {
                  label: 'Отмена',
                  onClick: () => toast.success('Восстановлено'),
                },
              })
            }
          >
            Удалить файл
          </Button>
        </div>
      ),
      code: `<Toaster />

<Button
  onClick={() =>
    toast('Файл удалён', {
      description: 'document.pdf перемещён в корзину',
      action: {
        label: 'Отмена',
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
        '`toast.promise` показывает loading-тост и сам переключает его на success/error по завершении промиса.',
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Toaster />
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
      code: `<Toaster />

<Button
  onClick={() =>
    toast.promise(saveChanges(), {
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
        'Контейнер тостов (обёртка). Монтируется один раз в корне приложения. Тема захардкожена в «system» (next-themes убран); иконки статусов — из lucide-react.',
    },
    {
      name: 'Toaster position',
      type: "'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'",
      default: 'bottom-right',
      description: 'Угол экрана, где стопка тостов.',
    },
    {
      name: 'Toaster richColors',
      type: 'boolean',
      default: 'false',
      description: 'Насыщенная заливка по статусу (success/error/...).',
    },
    {
      name: 'Toaster expand',
      type: 'boolean',
      default: 'false',
      description: 'Разворачивать стопку (показывать несколько тостов раскрытыми).',
    },
    {
      name: 'Toaster closeButton',
      type: 'boolean',
      default: 'false',
      description: 'Крестик закрытия на каждом тосте.',
    },
    {
      name: 'Toaster duration',
      type: 'number (ms)',
      default: '4000',
      description: 'Время авто-скрытия тоста.',
    },
    {
      name: 'toast(message, opts?)',
      type: 'function',
      description:
        'Императивный вызов тоста. opts: description, action { label, onClick }, duration, id и др.',
    },
    {
      name: 'toast.success / error / warning / info',
      type: 'function',
      description: 'Типизированные тосты — иконка и цвет по статусу.',
    },
    {
      name: 'toast.promise(promise, { loading, success, error })',
      type: 'function',
      description: 'Loading-тост, автоматически переключаемый по результату промиса.',
    },
  ],
};
