// base — pure shadcn Command (cmdk wrapper). Не form-control — реэкспорт всех под-компонентов:
// Command (корень) / CommandDialog (обёртка в Dialog) / CommandInput / CommandList / CommandEmpty /
// CommandGroup / CommandItem / CommandShortcut / CommandSeparator. Тяжёлая dep — cmdk (optional peer).
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './variants/base/command-base';
