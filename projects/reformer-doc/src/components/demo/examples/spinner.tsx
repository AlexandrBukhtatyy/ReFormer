import { Button, Spinner } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Spinner — не поле формы: вращающаяся иконка загрузки (lucide Loader2Icon) с role="status" и
 * подписью из локали кита. Размер и цвет — классами в className. Variants — размеры и цвета,
 * Examples — блок загрузки и кнопка, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо (ряд), в `code` её нет.
 */
export const spinnerDocConfig: ComponentDocConfig = {
  name: 'Spinner',
  importFrom: '@reformer/ui-kit',
  description:
    'Вращающаяся иконка загрузки с role="status". Размер и цвет задают классы size-* и text-*.',
  variants: [
    {
      id: 'sizes',
      title: 'Размеры',
      description: 'По умолчанию size-4 (16px). Крупнее — size-6, size-8.',
      render: () => (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Spinner />
          <Spinner className="size-6" />
          <Spinner className="size-8" />
        </div>
      ),
      code: `<Spinner />
<Spinner className="size-6" />
<Spinner className="size-8" />`,
    },
    {
      id: 'colors',
      title: 'Цвета',
      description: 'Иконка берёт цвет текста: классы text-primary, text-muted-foreground и другие.',
      render: () => (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Spinner className="size-6 text-primary" />
          <Spinner className="size-6 text-muted-foreground" />
          <Spinner className="size-6 text-destructive" />
        </div>
      ),
      code: `<Spinner className="size-6 text-primary" />
<Spinner className="size-6 text-muted-foreground" />
<Spinner className="size-6 text-destructive" />`,
    },
  ],
  examples: [
    {
      id: 'loading-panel',
      title: 'Блок загрузки',
      description:
        'Спиннер с подписью на месте содержимого. Текст виден на экране, поэтому role="status" стоит на блоке, а спиннер скрыт aria-hidden — иначе скринридер прочитал бы подпись дважды.',
      render: () => (
        <div role="status" className="flex h-40 w-full flex-col items-center justify-center gap-3">
          <Spinner className="size-8 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Загрузка данных…</span>
        </div>
      ),
      code: `<div role="status" className="flex h-40 w-full flex-col items-center justify-center gap-3">
  <Spinner className="size-8 text-muted-foreground" aria-hidden="true" />
  <span className="text-sm text-muted-foreground">Загрузка данных…</span>
</div>`,
    },
    {
      id: 'inline-button',
      title: 'Кнопка в состоянии загрузки',
      description:
        'Спиннер рядом с текстом кнопки. Текст уже говорит, что происходит, поэтому спиннер скрыт от скринридера (aria-hidden).',
      render: () => (
        <Button disabled>
          <Spinner aria-hidden="true" />
          Сохранение…
        </Button>
      ),
      code: `<Button disabled>
  <Spinner aria-hidden="true" />
  Сохранение…
</Button>`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'Размер (size-*) и цвет (text-*). Сливаются со встроенными size-4 animate-spin через tailwind-merge.',
    },
    {
      name: 'aria-label',
      type: 'string',
      default: 'kit.spinner.label',
      description:
        'Подпись для скринридера. По умолчанию из локали кита: Loading / Загрузка. Ваше значение важнее.',
    },
    {
      name: '...props',
      type: "ComponentProps<'svg'>",
      description: 'Остальные атрибуты svg: data-testid, aria-hidden, style.',
    },
  ],
};
