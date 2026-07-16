import { Spinner } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Spinner — не form-control: презентационный индикатор загрузки (lucide Loader2Icon
 * со spin-анимацией). Размер и цвет задаются классами (size-*, text-*) через className;
 * доступность встроена (role="status" + aria-label="Loading").
 * Variants — размеры и цвета, Examples — композиции (панель загрузки, кнопка).
 */
export const spinnerDocConfig: ComponentDocConfig = {
  name: 'Spinner',
  importFrom: '@reformer/ui-kit',
  description:
    'Индикатор загрузки на shadcn поверх lucide Loader2Icon. Крутящаяся иконка с role="status"; размер (size-*) и цвет (text-*) задаёшь классами через className.',
  variants: [
    {
      id: 'sizes',
      title: 'Размеры',
      description: 'Размер — через className (size-*): базовый size-4, крупнее — size-6, size-8.',
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
      description: 'Цвет наследуется от text-* (currentColor): акцент, приглушённый, ошибка.',
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
      title: 'Панель загрузки',
      description: 'Центрированный спиннер с подписью — заглушка контента во время запроса.',
      render: () => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            height: 160,
            width: '100%',
          }}
        >
          <Spinner className="size-8 text-muted-foreground" />
          <span style={{ fontSize: 14, color: 'var(--muted-foreground, #64748b)' }}>
            Загрузка данных…
          </span>
        </div>
      ),
      code: `<div className="flex h-40 w-full flex-col items-center justify-center gap-3">
  <Spinner className="size-8 text-muted-foreground" />
  <span className="text-sm text-muted-foreground">Загрузка данных…</span>
</div>`,
    },
    {
      id: 'inline-button',
      title: 'Кнопка в состоянии загрузки',
      description: 'Спиннер рядом с текстом внутри кнопки — операция выполняется (disabled).',
      render: () => (
        <button
          type="button"
          disabled
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 36,
            padding: '0 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--primary, #0f172a)',
            color: 'var(--primary-foreground, #f8fafc)',
            fontSize: 14,
            opacity: 0.7,
            cursor: 'not-allowed',
          }}
        >
          <Spinner className="size-4" />
          Сохранение…
        </button>
      ),
      code: `<Button disabled>
  <Spinner className="size-4" />
  Сохранение…
</Button>`,
    },
  ],
  props: [
    {
      name: 'className',
      type: 'string',
      description:
        'Классы размера/цвета (size-*, text-*) — мёржатся поверх базовых (size-4 animate-spin) через tailwind-merge.',
    },
    {
      name: '...props',
      type: "React.ComponentProps<'svg'>",
      description:
        'Любые атрибуты <svg> прокидываются на корень. role="status" и aria-label="Loading" встроены; aria-label можно переопределить.',
    },
  ],
};
