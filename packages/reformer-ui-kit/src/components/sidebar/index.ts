// base — pure shadcn Sidebar (крупный layout-компонент: SidebarProvider управляет состоянием
// (expanded/collapsed, cookie-персист, Cmd/Ctrl+B, mobile через Sheet) и раздаёт его через
// контекст useSidebar). Не form-control — реэкспорт всех под-компонентов + хука useSidebar.
// Тяжёлый (вне главного barrel) — только свой subpath `@reformer/ui-kit/sidebar`.
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './variants/base/sidebar-base';
