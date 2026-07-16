// base — pure shadcn AlertDialog (Radix AlertDialog compound: AlertDialog / AlertDialogTrigger /
// AlertDialogPortal / AlertDialogOverlay / AlertDialogContent / AlertDialogHeader / AlertDialogFooter /
// AlertDialogTitle / AlertDialogDescription / AlertDialogMedia / AlertDialogAction / AlertDialogCancel).
// Не form-control — реэкспорт всех под-компонентов. Action/Cancel стилизуются через buttonVariants
// (@/components/button).
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './variants/base/alert-dialog-base';
