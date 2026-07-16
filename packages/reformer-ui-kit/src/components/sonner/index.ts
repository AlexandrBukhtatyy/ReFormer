// base — shadcn Sonner: обёртка `Toaster` над `sonner` (Toaster из пакета `sonner`,
// иконки статусов из lucide-react). Не form-control. Зависимость next-themes убрана —
// тема статична ('system'). Реэкспортируем `toast` из `sonner` как удобный императивный API.
export { Toaster } from './variants/base/sonner-base';
export { toast, type ToasterProps } from 'sonner';
