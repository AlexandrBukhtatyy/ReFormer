// @ts-check
/**
 * Конфиг генератора каталога кита HexaUI — `npm run catalog` пишет по нему `catalog.json`,
 * `npm run catalog:check` (и тест `src/catalog.test.ts`) сверяет файл с типами.
 *
 * Пропсы записей выводятся из TypeScript-типов входа пакета (`src/index.ts`) — из того символа,
 * который импортирует кодоген и рисует превью. Здесь — только то, чего типы не знают: тип
 * значения полей, роли записей, разделы палитры, переименования, части составных компонентов.
 * Формат — README `@reformer/builder-plugin-cli`, раздел `catalog`.
 *
 * Имена записей держат паритет с `@reformer/ui-kit` (`Input`, `Select`, `Separator`, `Spinner`…):
 * на них стоят одна схема формы на двух китах, вид значения поля и затравки шаблонов билдера.
 */
import { defineKitCatalog } from '@reformer/builder-plugin-cli/catalog-config';

/** Причины ограниченного превью: запись в палитре есть, превью рисует её подписанной заглушкой. */
const OVERLAY = 'оверлей — нужен триггер/портал';
const NAVIGATION = 'навигация приложения — переходы и пункты живут вне формы';
const COMPOUND = 'составной компонент — части читаются из пропсов детей';
const DATA = 'нужны данные (строки, узлы, фильтры), которых у схемы формы нет';
const HEAVY = 'тяжёлый движок — только во входе пакета, не в пространстве имён билдера';

/** @param {readonly string[]} names @param {string} reason */
const withReason = (names, reason) => Object.fromEntries(names.map((name) => [name, reason]));

/** @param {readonly string[]} statics */
const ignore = (statics) => withReason(statics, 'ignore');

export default defineKitCatalog({
  entry: './src/index.ts',
  schemaRef:
    '../../../../../packages/reformer-builder-plugin-api/src/kits/component-catalog.schema.json',
  version: '3.0',
  unclassified: 'refuse',

  kit: {
    id: 'hexa-ui',
    label: 'Kaspersky HexaUI',
    package: '@kaspersky/hexa-ui',
    version: '6.387.4',
    peerRanges: { react: '16.x || 17.x || 18.x' },
    infra: { fieldWrapper: 'FormField', fieldFrame: 'FieldFrame' },
    adapters: {
      wizard: { symbol: 'FormWizard' },
      step: null,
      provider: { symbol: 'KitProvider' },
    },
    styles: {
      mode: 'standalone',
      href: '@kaspersky/hexa-ui/design-system/global-style/styles.css',
    },
    codegen: { importSpecifier: '@reformer/kit-hexa-ui' },
  },

  ownership: { packages: ['@kaspersky/hexa-ui', '@kaspersky/hexa-ui-core'] },
  fieldWrapper: 'reformer',

  // Поля — экспорты кита со статикой `reformerAdapter`; имя записи — как у ui-kit.
  fields: {
    Input: { value: 'string | null', variantGroup: 'Input', variant: 'Текст' },
    InputPassword: { value: 'string | null', variantGroup: 'Input', variant: 'Пароль' },
    InputNumber: { value: 'number | null', variantGroup: 'Input', variant: 'Число' },
    InputMask: { value: 'string | null', variantGroup: 'Input', variant: 'Маска' },
    InputSearch: { value: 'string | null', variantGroup: 'Input', variant: 'Поиск' },
    Textarea: { value: 'string | null' },
    TimeInput: { value: 'string | null', variantGroup: 'TimeInput', variant: 'Время' },
    TimeRange: { value: '[string, string] | null', variantGroup: 'TimeInput', variant: 'Период' },
    CodeEditor: { value: 'string | null' },
    RichTextEditor: { value: 'unknown[] | null' },
    WeeklySchedule: { value: 'Record<string, number[]> | null' },
    DatePicker: { value: 'Date | null', variantGroup: 'DatePicker', variant: 'Одна дата' },
    DatePickerRange: {
      value: '[Date, Date] | null',
      variantGroup: 'DatePicker',
      variant: 'Период',
    },
    FileUpload: { value: 'File[] | null', variantGroup: 'FileUpload', variant: 'Файлы' },
    FileUploadDropzone: { value: 'File[] | null', variantGroup: 'FileUpload', variant: 'Зона' },

    Select: { value: 'string | null', variantGroup: 'Select', variant: 'Один' },
    SelectMulti: { value: 'string[] | null', variantGroup: 'Select', variant: 'Несколько' },
    Combobox: { value: 'string | null', variantGroup: 'Combobox', variant: 'Один' },
    ComboboxMulti: { value: 'string[] | null', variantGroup: 'Combobox', variant: 'Несколько' },
    ComboboxTree: { value: 'string | null', variantGroup: 'Combobox', variant: 'Дерево' },
    ComboboxTreeMulti: {
      value: 'string[] | null',
      variantGroup: 'Combobox',
      variant: 'Дерево, несколько',
    },
    RadioGroup: { value: 'string | null' },
    CheckboxGroup: { value: 'string[] | null' },
    ToggleGroup: { value: 'string | null', variantGroup: 'ToggleGroup', variant: 'Один' },
    ToggleGroupMulti: {
      value: 'string[] | null',
      variantGroup: 'ToggleGroup',
      variant: 'Несколько',
    },
    ToggleButtonGroup: { value: 'string[] | null' },
    Checkbox: { exportName: 'CheckboxWithLabel', value: 'boolean', seam: ['checked'] },
    Switch: { exportName: 'SwitchWithLabel', value: 'boolean', seam: ['checked'] },
    Toggle: { exportName: 'ToggleButton', value: 'boolean' },
  },

  // Имена записей прежнего ручного каталога — каноничные имена ReFormer поверх имён HexaUI.
  records: {
    Separator: { exportName: 'Divider' },
    Spinner: { exportName: 'Loader' },
    Progress: { exportName: 'ProgressBar' },
  },

  // Статики экспортов: плоский экспорт кита (`./src/compound.ts`, `./src/heavy.ts`) либо `ignore` —
  // их собирает сам компонент-хозяин из своих пропсов.
  statics: {
    'Button.Group': 'ButtonGroup',
    'Button.SplitButton': 'SplitButton',
    'Tag.Group': 'TagGroup',
    'Status.Group': 'StatusGroup',
    'Tabs.TabPane': 'TabPane',
    'Tabs.TabPaneHead': 'TabPaneHead',
    'GroupTabs.TabPaneHeader': 'TabPaneHeader',
    'FieldSet.KeyValueMapper': 'KeyValueMapper',
    'Grid.Item': 'GridItem',
    // Пункты меню `Dropdown` и `Toolbar` хозяин строит из своих пропсов (`overlay`, `left`/`right`).
    ...ignore([
      'Dropdown.GroupTitle',
      'Dropdown.InnerActions',
      'Dropdown.Menu',
      'Dropdown.MenuDivider',
      'Dropdown.MenuItem',
      'Dropdown.SubMenu',
      'Dropdown.Toggle',
      'Toolbar.Button',
      'Toolbar.CollapsibleSearch',
      'Toolbar.Divider',
      'Toolbar.ExportItem',
      'Toolbar.FilterActiveItem',
      'Toolbar.FilterItem',
      'Toolbar.FilterSidebar',
      'Toolbar.ImportExportItem',
      'Toolbar.ImportItem',
      'Toolbar.ScaleItem',
      'Toolbar.Search',
      'Toolbar.SettingsItem',
    ]),
    // Варианты прежней загрузки: поле кита — `FileUpload`, сам `Upload` служебный.
    ...ignore(['Upload.UploadCustom', 'Upload.Url']),
  },

  // Части составных компонентов: раздел палитры — от корня.
  parts: {
    TabPane: 'Tabs',
    TabPaneHead: 'Tabs',
    TabPaneHeader: 'GroupTabs',
    AccordionPanel: 'Accordion',
    GridItem: 'Grid',
    BreadcrumbsItem: 'Breadcrumbs',
    NavigationItem: 'Navigation',
    KeyValueMapper: 'FieldSet',
  },

  // Разделы палитры — те же, что у ui-kit, где смысл совпадает. Поля здесь тоже: раздел
  // назначается по имени записи.
  categories: {
    'Поля ввода': [
      'Input',
      'InputPassword',
      'InputNumber',
      'InputMask',
      'InputSearch',
      'Textarea',
      'DatePicker',
      'DatePickerRange',
      'TimeInput',
      'TimeRange',
      'FileUpload',
      'FileUploadDropzone',
      'WeeklySchedule',
      'RichTextEditor',
      'CodeEditor',
    ],
    'Выбор и переключатели': [
      'Select',
      'SelectMulti',
      'Combobox',
      'ComboboxMulti',
      'ComboboxTree',
      'ComboboxTreeMulti',
      'RadioGroup',
      'Checkbox',
      'CheckboxGroup',
      'Switch',
      'Toggle',
      'ToggleGroup',
      'ToggleGroupMulti',
      'ToggleButtonGroup',
    ],
    Контейнеры: [
      'Box',
      'Section',
      'Card',
      'Panel',
      'Space',
      'Grid',
      'FormGrid',
      'FieldSet',
      'Expand',
      'ExpandableText',
      'Scrollbar',
      'LockGroup',
      'Accordion',
      'Tabs',
      'GroupTabs',
      'ButtonGroup',
    ],
    Действия: ['Button', 'SplitButton', 'ActionButton', 'FormTrigger', 'Toolbar'],
    Отображение: [
      'Alert',
      'Badge',
      'Chip',
      'Separator',
      'Label',
      'FormLabel',
      'Heading',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'Text',
      'P',
      'HelpMessage',
      'Indicator',
      'InformationCard',
      'LicenseCard',
      'Link',
      'Spinner',
      'Markdown',
      'Placeholder',
      'Progress',
      'SectionMessage',
      'Severity',
      'Skeleton',
      'SkeletonTemplate',
      'Status',
      'StatusGroup',
      'StatusCard',
      'Tag',
      'TagGroup',
      'TagReductionGroup',
      'TextDiff',
      'Table',
      'TableWithoutModules',
      'FilterToolbar',
      'FilterItem',
      'FilterItemValue',
      'QuickFilter',
      'TenantFilter',
      'TreeList',
      'CodeViewer',
      'CodeCompare',
      'Terminal',
      'Gallery',
      'Repeater',
    ],
    Оверлеи: [
      'Dropdown',
      'LoadingOverlay',
      'Modal',
      'Notification',
      'Popover',
      'Sidebar',
      'Tooltip',
    ],
    Навигация: [
      'Menu',
      'Nav',
      'NavItem',
      'NavDivider',
      'Hamburger',
      'ServicesNav',
      'UserNav',
      'Submenu',
      'TopNavigation',
      'HorizontalNav',
      'TreeNav',
      'Breadcrumbs',
      'Pagination',
      'AnchorNavigation',
      'Navigation',
      'PageHeader',
      'DetailsPage',
      'SegmentedControl',
      'SegmentedControlView',
    ],
  },

  limited: {
    ...withReason(
      ['Dropdown', 'LoadingOverlay', 'Modal', 'Notification', 'Popover', 'Sidebar', 'Tooltip'],
      OVERLAY
    ),
    ...withReason(
      [
        'AnchorNavigation',
        'Breadcrumbs',
        'BreadcrumbsItem',
        'DetailsPage',
        'Hamburger',
        'HorizontalNav',
        'Menu',
        'Nav',
        'NavDivider',
        'NavItem',
        'Navigation',
        'NavigationItem',
        'PageHeader',
        'Pagination',
        'SegmentedControl',
        'SegmentedControlView',
        'ServicesNav',
        'Submenu',
        'TopNavigation',
        'UserNav',
      ],
      NAVIGATION
    ),
    ...withReason(
      [
        'Accordion',
        'AccordionPanel',
        'GroupTabs',
        'TabPane',
        'TabPaneHead',
        'TabPaneHeader',
        'Tabs',
      ],
      COMPOUND
    ),
    ...withReason(
      [
        'FilterItem',
        'FilterItemValue',
        'FilterToolbar',
        'Gallery',
        'QuickFilter',
        'Repeater',
        'Table',
        'TableWithoutModules',
        'TenantFilter',
        'Toolbar',
        'TreeList',
        'TreeNav',
      ],
      DATA
    ),
    ...withReason(
      ['CodeCompare', 'CodeViewer', 'FieldSet', 'KeyValueMapper', 'LicenseCard', 'Terminal'],
      HEAVY
    ),
  },

  // Служебные: в каталоге ради пропсов и символов `kit.infra`/`kit.adapters`, не узлы палитры.
  service: [
    'FormField',
    'FieldFrame',
    'KitProvider',
    'FormWizard',
    'Field',
    'PopupConfigProvider',
    'Upload',
    'Locale',
    'IconResolver',
    // Помечены @deprecated в HexaUI: в каталоге остаются ради старых схем, в палитре их нет.
    'Anchor',
    'AnchorLink',
    'Icon',
    'KeyValue',
    'KeyWithIcon',
    'Tree',
  ],

  // Листья — узлы без детей: не цель перетаскивания, вставляются без `children`. Это записи, в
  // типе пропсов которых `children` нет вовсе (содержимое — из пропсов).
  leaves: [
    // Отображение и действия
    'Badge',
    'Chip',
    'FormTrigger',
    'HelpMessage',
    'Indicator',
    'Markdown',
    'Placeholder',
    'Progress',
    'Separator',
    'Skeleton',
    'Spinner',
    'Status',
    'StatusGroup',
    'TagGroup',
    'TagReductionGroup',
    'TextDiff',
    // limited: части и данные — из пропсов
    'Breadcrumbs',
    'BreadcrumbsItem',
    'CodeCompare',
    'CodeViewer',
    'FieldSet',
    'FilterItem',
    'FilterItemValue',
    'FilterToolbar',
    'Gallery',
    'Hamburger',
    'HorizontalNav',
    'KeyValueMapper',
    'LoadingOverlay',
    'Modal',
    'Nav',
    'NavItem',
    'Navigation',
    'NavigationItem',
    'Notification',
    'PageHeader',
    'Pagination',
    'QuickFilter',
    'Repeater',
    'SegmentedControl',
    'SegmentedControlView',
    'Submenu',
    'TabPaneHead',
    'TenantFilter',
    'TopNavigation',
    'TreeList',
    'TreeNav',
    'UserNav',
  ],

  props: {
    // Пропсы, которые пишут схемы ui-kit и которые обёртки HexaUI пропускают в контрол, хотя
    // объявлены они HTML-атрибутами (`@types/react`) или чужим пакетом (antd, rc-*): одна схема
    // формы на два кита должна проходить строгую проверку пропсов и здесь.
    pick: {
      Input: ['placeholder', 'type'],
      InputPassword: ['placeholder'],
      InputNumber: ['placeholder', 'step'],
      InputMask: ['placeholder'],
      InputSearch: ['placeholder'],
      Textarea: ['placeholder', 'rows'],
      DatePicker: ['placeholder'],
      DatePickerRange: ['placeholder'],
      ComboboxTree: ['placeholder'],
      ComboboxTreeMulti: ['placeholder'],
      FileUpload: ['accept'],
      FileUploadDropzone: ['accept'],
    },
    // Поле получает их от формы либо они противоречат шву: состояние ошибки ставит `FormField`.
    omit: {
      '@field': ['validationStatus', 'invalid', 'theme', 'componentType', 'dependentElement'],
    },
  },
});
