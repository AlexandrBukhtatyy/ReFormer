import * as React from 'react';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Дословный порт shadcn/ui (new-york-v4) sonner. Правки только: снят 'use client',
// убрана зависимость next-themes (useTheme) — тема жёстко 'system' (caller может
// переопределить через {...props}). Тяжёлая dep `sonner` подключается как есть
// (external в vite → optional peer у потребителя). Иконки статусов — из lucide-react.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      // Статус-иконку выравниваем по верхней строке контента, а не по центру всего тоста:
      // sonner ставит `[data-sonner-toast] { align-items: center }`, из-за чего при многострочном
      // title/description иконка уезжает в вертикальную середину. `mt-0.5` — оптическая
      // компенсация к базовой линии первой строки. Идёт до {...props} → caller может переопределить.
      toastOptions={{ classNames: { icon: 'self-start mt-0.5' } }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
