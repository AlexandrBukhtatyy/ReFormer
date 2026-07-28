/**
 * Верхнее меню приложения в стиле VSCode: Файл / Правка / Вид. На базе @reformer/ui-kit `menubar`
 * (radix Menubar сам переключает соседние меню по наведению, когда одно уже открыто). Пункты
 * вызывают существующие `editorActions` и `save-actions`; шорткаты дублируют горячие клавиши
 * canvas (см. EditorLayout). Чекбоксы/радио секции «Вид» отражают флаги `ui`.
 *
 * @module reformer-builder/app/AppMenuBar
 */

import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
} from '@reformer/ui-kit/menubar';
import {
  editorActions,
  editorStore,
  useActiveTab,
  useActiveTabId,
  useSelectionPath,
  useUi,
} from '../store';
import type { PreviewMode } from '../store';
import { emptySchema } from '../model';
import { openProject, triggerSave } from './save-actions';

/** Новая пустая форма — имя без коллизий с уже открытыми вкладками. */
function newForm() {
  const used = new Set(editorStore.getState().order);
  let n = 1;
  let name = `new-form-${n}.json`;
  while (used.has(name)) name = `new-form-${++n}.json`;
  editorActions.openTab(name, { kind: 'new', name }, emptySchema());
}

const TRIGGER = 'px-2 py-1 text-[12.5px] font-normal';

export function AppMenuBar() {
  const ui = useUi();
  const tab = useActiveTab();
  const activeId = useActiveTabId();
  const hasSel = useSelectionPath() != null;
  const canUndo = (tab?.past.length ?? 0) > 0;
  const canRedo = (tab?.future.length ?? 0) > 0;

  return (
    <Menubar className="h-7 gap-0.5 border-0 bg-transparent p-0 shadow-none">
      <MenubarMenu>
        <MenubarTrigger className={TRIGGER}>Файл</MenubarTrigger>
        <MenubarContent align="start">
          <MenubarItem onClick={newForm}>Новая форма</MenubarItem>
          <MenubarItem onClick={() => void openProject()}>Открыть проект…</MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!tab} onClick={() => tab && void triggerSave(tab)}>
            Сохранить / Экспорт
            <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem
            disabled={!activeId}
            onClick={() => activeId && editorActions.closeTab(activeId)}
          >
            Закрыть вкладку
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className={TRIGGER}>Правка</MenubarTrigger>
        <MenubarContent align="start">
          <MenubarItem disabled={!canUndo} onClick={() => editorActions.undo()}>
            Отменить
            <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled={!canRedo} onClick={() => editorActions.redo()}>
            Вернуть
            <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!tab} onClick={() => editorActions.openQuickAdd()}>
            Добавить компонент…
            <MenubarShortcut>↵</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled={!hasSel} onClick={() => editorActions.duplicateSelection()}>
            Дублировать
            <MenubarShortcut>⌘D</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled={!hasSel} onClick={() => editorActions.deleteSelection()}>
            Удалить
            <MenubarShortcut>⌫</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled={!hasSel} onClick={() => editorActions.groupSelection()}>
            Сгруппировать
            <MenubarShortcut>⌘G</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled={!hasSel} onClick={() => editorActions.ungroupSelection()}>
            Разгруппировать
            <MenubarShortcut>⇧⌘G</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled={!hasSel} onClick={() => editorActions.flipSelection()}>
            Сменить раскладку
            <MenubarShortcut>⇧⌘L</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className={TRIGGER}>Вид</MenubarTrigger>
        <MenubarContent align="start">
          <MenubarLabel>Предпросмотр</MenubarLabel>
          <MenubarRadioGroup
            value={ui.preview}
            onValueChange={(v) => editorActions.setPreview(v as PreviewMode)}
          >
            <MenubarRadioItem value="wire">
              Схематичный
              <MenubarShortcut>⌥⌘1</MenubarShortcut>
            </MenubarRadioItem>
            <MenubarRadioItem value="runtime">
              Renderer
              <MenubarShortcut>⌥⌘2</MenubarShortcut>
            </MenubarRadioItem>
            <MenubarRadioItem value="code">
              Код
              <MenubarShortcut>⌥⌘3</MenubarShortcut>
            </MenubarRadioItem>
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarItem onClick={() => editorActions.toggleLeftPanel()}>
            Боковая панель
            <MenubarShortcut>⌘B</MenubarShortcut>
          </MenubarItem>
          <MenubarCheckboxItem
            checked={ui.leftPanel === 'files'}
            onCheckedChange={() =>
              editorActions.setLeftPanel(ui.leftPanel === 'files' ? null : 'files')
            }
          >
            Файлы
            <MenubarShortcut>⇧⌘E</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={ui.leftPanel === 'palette'}
            onCheckedChange={() =>
              editorActions.setLeftPanel(ui.leftPanel === 'palette' ? null : 'palette')
            }
          >
            Палитра
            <MenubarShortcut>⇧⌘B</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={ui.rightOpen}
            onCheckedChange={() => editorActions.toggleRight()}
          >
            Свойства
            <MenubarShortcut>⌥⌘B</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={ui.rawJsonOpen}
            onCheckedChange={() => editorActions.toggleRawJson()}
          >
            Нижняя панель
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={ui.hideDivWrappers}
            onCheckedChange={() => editorActions.toggleHideDivWrappers()}
          >
            Скрывать div-контейнеры
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarCheckboxItem
            checked={ui.theme === 'dark'}
            onCheckedChange={() => editorActions.setTheme(ui.theme === 'dark' ? 'light' : 'dark')}
          >
            Тёмная тема
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
