import { useKitMessages } from '@/i18n/messages';
import * as React from 'react';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

import { cn } from '@/lib/utils';

// Порт shadcn/ui (new-york-v4) sonner. Правки: снят 'use client', убрана зависимость next-themes
// (useTheme). Тяжёлая dep `sonner` подключается как есть (external в vite → optional peer у
// потребителя). Иконки статусов — из lucide-react.
//
// Расхождения с апстримом:
// - тема по умолчанию — тема приложения: `dark`, если выше по дереву стоит `.dark` или
//   `[data-theme='dark']` (тот же признак, что у варианта `dark:` в theme.css), иначе `light`.
//   `system` смотрел на настройку ОС, и в тёмном приложении на светлой ОС описание и кнопки тоста
//   красились светлой темой sonner поверх тёмного фона;
// - `toastOptions`, `icons` и `style` вызывающего сливаются с настройками кита, а не заменяют их
//   целиком: свой `toastOptions.duration` не должен сбрасывать выравнивание иконки;
// - подписи секции и кнопки закрытия — из словаря кита (`kit.sonner.*`).

/** Признак тёмной темы кита — как `@custom-variant dark` в theme.css. */
const DARK_THEME_SELECTOR = ".dark, [data-theme='dark']";

/** Тема приложения вокруг `element`; следит за сменой класса и `data-theme` у предков. */
function useAppTheme(ref: React.RefObject<HTMLElement | null>, enabled: boolean): 'light' | 'dark' {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  React.useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const read = () => setTheme(element.closest(DARK_THEME_SELECTOR) ? 'dark' : 'light');
    read();
    // Следим только за предками: подписка на всё поддерево документа срабатывала бы на каждую
    // смену класса где угодно в приложении.
    const observer = new MutationObserver(read);
    for (let node = element.parentElement; node; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    }
    return () => observer.disconnect();
  }, [ref, enabled]);
  return theme;
}

/**
 * Область уведомлений: `Toaster` из `sonner` в стилях кита.
 *
 * Тема без `theme` — тема приложения (`.dark`/`[data-theme='dark']` выше по дереву); `theme`
 * задаёт её явно, `'system'` — по настройке ОС. `toastOptions`, `icons` и `style` дополняют
 * настройки кита. Подписи `containerAriaLabel` и `toastOptions.closeButtonAriaLabel` по умолчанию
 * переводятся словарём кита.
 */
const Toaster = ({
  theme,
  toastOptions,
  icons,
  style,
  containerAriaLabel,
  ...props
}: ToasterProps) => {
  const t = useKitMessages();
  const ref = React.useRef<HTMLElement>(null);
  const appTheme = useAppTheme(ref, theme === undefined);

  return (
    <Sonner
      ref={ref}
      theme={theme ?? appTheme}
      className="toaster group"
      containerAriaLabel={containerAriaLabel ?? t('kit.sonner.label')}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        ...icons,
      }}
      toastOptions={{
        closeButtonAriaLabel: t('kit.sonner.close'),
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          // Статус-иконку выравниваем по верхней строке контента, а не по центру всего тоста:
          // sonner ставит `[data-sonner-toast] { align-items: center }`, из-за чего при
          // многострочном title/description иконка уезжает в вертикальную середину. `mt-0.5` —
          // оптическая компенсация к базовой линии первой строки. Класс вызывающего идёт
          // следом и перекрывает конфликтующие (tailwind-merge).
          icon: cn('self-start mt-0.5', toastOptions?.classNames?.icon),
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
