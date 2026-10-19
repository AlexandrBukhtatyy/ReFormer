/**
 * Компоненты HexaUI «как есть» — явный список реэкспортов, а не `export *`.
 *
 * ## Почему список, а не `export *`
 *
 * Вход `@kaspersky/hexa-ui` реэкспортирует всё, включая редакторы и терминал на CodeMirror, slate
 * и xterm. `export *` втянул бы их в каждый, кто импортирует вход кита, — и в пространство имён
 * билдера. Список же точно говорит, что кит отдаёт: палитра — `./palette` (её же берёт
 * пространство имён), тяжёлое — `./heavy`, поля — своими обёртками (`./fields`), плоские имена
 * статик — `./compound`. Значения — с подпутей HexaUI (почему — в `./palette`).
 *
 * ## Чего здесь нет
 *
 * - **Сырых контролов полей** (`Textbox`, `Select`, `Checkbox`, `Toggle`, `Calendar`, `Uploader`,
 *   …): полем их делает обёртка кита со статикой `reformerAdapter`, и под именем записи вход
 *   отдаёт именно её. Сырой `Toggle` к тому же совпал бы с именем записи `Toggle`.
 * - **Сырого `Wizard`**: имя занято синтетикой билдера (хозяин шагов); визард кита — `FormWizard`.
 * - **Функций, хуков, констант и служебных значений** (`openNotification`, `useTableContext`,
 *   контексты, раскладки `Grid`, внутренние styled-узлы): это не компоненты.
 *
 * Группы ниже — роли в каталоге. Палитра идёт в пространство имён билдера; `limited` и служебные —
 * только во вход пакета: превью их всё равно не рисует.
 *
 * @module reformer/kit-hexa-ui/components
 */

// --- Палитра: контейнеры, отображение, действия -------------------------------------------------
export * from './palette';

// --- limited: оверлеи — открываются поверх страницы, в превью формы им не место ---------------
export { Dropdown } from '@kaspersky/hexa-ui/dropdown';
export { LoadingOverlay } from '@kaspersky/hexa-ui/loading-overlay';
export { Modal } from '@kaspersky/hexa-ui/modal';
export { Notification } from '@kaspersky/hexa-ui/notification';
export { Popover } from '@kaspersky/hexa-ui/popover';
export { Sidebar } from '@kaspersky/hexa-ui/sidebar';
export { Tooltip } from '@kaspersky/hexa-ui/tooltip';

// --- limited: навигация и составные контейнеры, читающие части из пропсов детей ---------------
export { Accordion, AccordionPanel } from '@kaspersky/hexa-ui/accordion';
export { Anchor, AnchorLink } from '@kaspersky/hexa-ui/anchor-links';
export { AnchorNavigation, Navigation, NavigationItem } from '@kaspersky/hexa-ui/anchor-navigation';
export { Breadcrumbs, BreadcrumbsItem } from '@kaspersky/hexa-ui/breadcrumbs';
export { DetailsPage } from '@kaspersky/hexa-ui/details-page';
export { HorizontalNav } from '@kaspersky/hexa-ui/horizontal-nav';
export {
  Hamburger,
  Menu,
  Nav,
  NavDivider,
  NavItem,
  ServicesNav,
  UserNav,
} from '@kaspersky/hexa-ui/menu';
export { PageHeader } from '@kaspersky/hexa-ui/page-header';
export { Pagination } from '@kaspersky/hexa-ui/pagination';
export { SegmentedControl, SegmentedControlView } from '@kaspersky/hexa-ui/segmented-control';
export { Submenu } from '@kaspersky/hexa-ui/submenu';
export { GroupTabs, TabPaneHead, Tabs } from '@kaspersky/hexa-ui/tabs';
export { TopNavigation } from '@kaspersky/hexa-ui/top-navigation';

// --- limited: таблицы, деревья, фильтры, галерея — данные, которых у схемы формы нет ---------
export { Gallery } from '@kaspersky/hexa-ui/gallery';
export { QuickFilter } from '@kaspersky/hexa-ui/quick-filter';
export { Repeater } from '@kaspersky/hexa-ui/repeater';
export {
  FilterItem,
  FilterItemValue,
  FilterToolbar,
  Table,
  TableWithoutModules,
} from '@kaspersky/hexa-ui/table';
export { TenantFilter } from '@kaspersky/hexa-ui/tenantFilter';
export { Toolbar } from '@kaspersky/hexa-ui/toolbar';
export { Tree, TreeList, TreeNav } from '@kaspersky/hexa-ui/tree';

// --- Служебные: вне палитры ------------------------------------------------------------------
// `Field` — визуальная база обёртки и рамки поля кита; `Upload` — прежняя загрузка (у HexaUI —
// legacy, поле кита — `FileUpload`); `Locale`, `IconResolver` — помощники локализации и иконок.
// `PopupConfigProvider` есть только у главного входа HexaUI — и только здесь, во входе пакета
// для приложения: в графе пространства имён главного входа быть не должно (см. `./palette`).
export { Field } from '@kaspersky/hexa-ui/field';
export { IconResolver } from '@kaspersky/hexa-ui/icon';
export { Locale } from '@kaspersky/hexa-ui/locale';
export { Upload } from '@kaspersky/hexa-ui/upload';
export { PopupConfigProvider } from '@kaspersky/hexa-ui';
