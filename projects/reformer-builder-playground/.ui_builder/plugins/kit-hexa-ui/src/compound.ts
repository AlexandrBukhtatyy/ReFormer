/**
 * Плоские имена статик составных компонентов HexaUI.
 *
 * Схема формы адресует компонент ИМЕНЕМ (`$component(TabPane)`), а кодоген печатает его импортом
 * из входа кита. Статика (`Tabs.TabPane`, `Button.Group`) ни тем, ни другим не адресуется — поэтому
 * части, которые имеет смысл ставить узлом схемы, кит отдаёт плоскими экспортами. Остальные статики
 * (пункты `Dropdown` и `Toolbar`, пространства CodeMirror у `CodeViewer`, варианты сырых контролов
 * полей) намеренно не выносятся: их собирает сам компонент-хозяин из своих пропсов.
 *
 * `Grid.Item` и `Tabs.TabPaneHead` HexaUI уже экспортирует плоско (`GridItem`, `TabPaneHead`);
 * `FieldSet.KeyValueMapper` — в `./heavy`, вместе с `FieldSet`.
 *
 * @module reformer/kit-hexa-ui/compound
 */

import { Button } from '@kaspersky/hexa-ui/button';
import { Status } from '@kaspersky/hexa-ui/status';
import { GroupTabs, Tabs } from '@kaspersky/hexa-ui/tabs';
import { Tag } from '@kaspersky/hexa-ui/tag';

/** Вкладка `Tabs` (antd `Tabs.TabPane`). */
export const TabPane = Tabs.TabPane;

/** Заголовок вкладки `GroupTabs`. */
export const TabPaneHeader = GroupTabs.TabPaneHeader;

/** Группа кнопок: `Button.Group`. */
export const ButtonGroup = Button.Group;

/** Кнопка с выпадающим списком действий: `Button.SplitButton`. */
export const SplitButton = Button.SplitButton;

/** Группа тегов: `Tag.Group`. */
export const TagGroup = Tag.Group;

/** Группа статусов: `Status.Group`. */
export const StatusGroup = Status.Group;
