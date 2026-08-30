/**
 * Переключатель «дерево / схема / исходник»: команды и кнопки полосы вкладок.
 *
 * Проверяется то, из-за чего кнопка врёт: применимость (над чем работает и когда доступна),
 * нажатое положение и то, что оно складывается из ДВУХ хранилищ. Отрисовка ряда — забота
 * оболочки и её теста; здесь нет ни DOM, ни React.
 *
 * @module plugins/editor-schema/canvas-actions.test
 */

import { describe, expect, it } from 'vitest';

import type { MenuItemContribution, ResourceId, WhenContext } from '@/sdk';
import {
  canvasViewCommands,
  canvasViewMenuItems,
  SHOW_CODE_COMMAND_ID,
  SHOW_LIVE_COMMAND_ID,
  SHOW_SCHEMATIC_COMMAND_ID,
  SHOW_TREE_COMMAND_ID,
  type CanvasActionDeps,
} from './canvas-actions';
import { createCanvasPrefs } from './canvas-prefs';
import { createSchemaViewStore } from './view-mode';

const SCHEMA_ID: ResourceId = 'fs:forms/credit/schema.json';
const TEXT_ID: ResourceId = 'fs:notes.txt';
/** Идентификатор редактора схемы: по нему кнопки и узнают свою вкладку. */
const SCHEMA_EDITOR = 'editor-schema.canvas';

function context(): WhenContext {
  return {
    focus: 'canvas',
    activeEditorId: SCHEMA_EDITOR,
    activeResourceKind: 'form.schema',
    hasSelection: false,
    previewMode: null,
  };
}

function target(documentId: ResourceId, editorId = SCHEMA_EDITOR) {
  return {
    documentId,
    ref: {
      id: documentId,
      sourceId: 'fs',
      path: documentId.slice(3),
      name: documentId.slice(documentId.lastIndexOf('/') + 1),
      kind: 'file' as const,
      mediaType: 'application/json',
    },
    editorId,
  };
}

/** Зависимости кнопок с настоящими хранилищами: их состояние и есть предмет проверки. */
function deps(
  options: { active?: ResourceId; withTextEditor?: boolean; withLive?: boolean } = {}
): CanvasActionDeps {
  const hasTextEditor = options.withTextEditor !== false;
  const hasLive = options.withLive !== false;
  return {
    prefs: createCanvasPrefs(),
    views: createSchemaViewStore({ settings: null, hasTextEditor: () => hasTextEditor }),
    isSchema: (id) => id === SCHEMA_ID,
    editorId: SCHEMA_EDITOR,
    hasTextEditor: () => hasTextEditor,
    hasLive: () => hasLive,
    activeDocument: () => options.active ?? SCHEMA_ID,
  };
}

function commandOf(d: CanvasActionDeps, id: string) {
  const found = canvasViewCommands(d).find((command) => command.id === id);
  if (found === undefined) throw new Error(`нет команды ${id}`);
  return found;
}

function itemOf(d: CanvasActionDeps, id: string): MenuItemContribution {
  const found = canvasViewMenuItems(d).find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет пункта ${id}`);
  if (found.value.kind !== 'item') throw new Error('ожидался пункт-действие');
  return found.value;
}

/** Что показано сейчас: то же, что подсвечивает нажатую кнопку. */
function shown(d: CanvasActionDeps): string {
  const items = canvasViewMenuItems(d).filter((item) => {
    if (item.value.kind !== 'item') return false;
    return item.value.toggled?.(context(), target(SCHEMA_ID)) === true;
  });
  if (items.length !== 1) throw new Error(`нажатых кнопок ${items.length}, а должна быть одна`);
  return items[0]?.id ?? '';
}

describe('команды переключателя', () => {
  it('ведут в каждое из положений и не спорят сами с собой при повторе', () => {
    const d = deps();

    expect(commandOf(d, SHOW_SCHEMATIC_COMMAND_ID).run()).toBe(true);
    expect(shown(d)).toBe('schema.title.canvasSchematic');
    // Второй раз — то же положение: команда доступна и оставляет как есть, а не отказывает.
    expect(commandOf(d, SHOW_SCHEMATIC_COMMAND_ID).run()).toBe(true);
    expect(shown(d)).toBe('schema.title.canvasSchematic');

    expect(commandOf(d, SHOW_CODE_COMMAND_ID).run()).toBe(true);
    expect(shown(d)).toBe('schema.title.showCode');

    expect(commandOf(d, SHOW_LIVE_COMMAND_ID).run()).toBe(true);
    expect(shown(d)).toBe('schema.title.canvasLive');

    expect(commandOf(d, SHOW_TREE_COMMAND_ID).run()).toBe(true);
    expect(shown(d)).toBe('schema.title.canvasTree');
  });

  it('форма тоже возвращает из исходника: это вид конструктора, а не отдельный режим', () => {
    const d = deps();
    d.views?.set(SCHEMA_ID, 'code');

    expect(commandOf(d, SHOW_LIVE_COMMAND_ID).run()).toBe(true);

    expect(d.views?.get(SCHEMA_ID)).toBe('design');
    expect(d.prefs.view()).toBe('live');
  });

  it('без поверхности форма недоступна: рисовать её нечем', () => {
    const d = deps({ withLive: false });
    const live = commandOf(d, SHOW_LIVE_COMMAND_ID);

    expect(live.enabled?.(context())).toBe(false);
    // Отказ, а не молчаливый переход в дерево: подмена вида ответила бы на другой вопрос.
    expect(live.run()).toBe(false);
    expect(shown(d)).toBe('schema.title.canvasTree');
  });

  it('дерево и схема возвращают из исходника: их нажимают, чтобы туда попасть', () => {
    const d = deps();
    d.views?.set(SCHEMA_ID, 'code');
    d.prefs.setView('schematic');

    expect(commandOf(d, SHOW_TREE_COMMAND_ID).run()).toBe(true);

    expect(d.views?.get(SCHEMA_ID)).toBe('design');
    expect(d.prefs.view()).toBe('tree');
  });

  it('на чужой вкладке недоступны и ничего не меняют', () => {
    const d = deps({ active: TEXT_ID });
    const schematic = commandOf(d, SHOW_SCHEMATIC_COMMAND_ID);

    expect(schematic.enabled?.(context())).toBe(false);
    expect(schematic.run()).toBe(false);
    expect(d.prefs.view()).toBe('tree');
  });

  it('без редактора кода исходник недоступен: показывать его нечем', () => {
    const d = deps({ withTextEditor: false });
    const code = commandOf(d, SHOW_CODE_COMMAND_ID);

    expect(code.enabled?.(context())).toBe(false);
    expect(code.run()).toBe(false);
    expect(shown(d)).toBe('schema.title.canvasTree');
  });
});

describe('кнопки в полосе вкладок', () => {
  it('видны все сразу — полоса отвечает «где я», а не «куда можно»', () => {
    const d = deps();

    for (const id of ['schema.title.canvasTree', 'schema.title.canvasSchematic']) {
      expect(itemOf(d, id).when?.(context(), target(SCHEMA_ID))).toBe(true);
    }
    expect(itemOf(d, 'schema.title.showCode').when?.(context(), target(SCHEMA_ID))).toBe(true);

    // И остаются видны в исходнике: переключатель не должен терять положения при переходе.
    d.views?.set(SCHEMA_ID, 'code');

    for (const id of ['schema.title.canvasTree', 'schema.title.canvasSchematic']) {
      expect(itemOf(d, id).when?.(context(), target(SCHEMA_ID))).toBe(true);
    }
  });

  it('нажата ровно одна, и её выбирают оба хранилища вместе', () => {
    const d = deps();

    expect(shown(d)).toBe('schema.title.canvasTree');

    d.prefs.setView('schematic');
    expect(shown(d)).toBe('schema.title.canvasSchematic');

    // Режим документа перевешивает вид конструктора: исходником показан весь документ.
    d.views?.set(SCHEMA_ID, 'code');
    expect(shown(d)).toBe('schema.title.showCode');

    // А вид конструктора при этом не забыт — возврат отдаёт ту же схему.
    d.views?.set(SCHEMA_ID, 'design');
    expect(shown(d)).toBe('schema.title.canvasSchematic');
  });

  it('над чужой вкладкой кнопок нет вовсе: свою они узнают по редактору', () => {
    const d = deps();

    for (const id of [
      'schema.title.canvasTree',
      'schema.title.canvasSchematic',
      'schema.title.showCode',
    ]) {
      expect(itemOf(d, id).when?.(context(), target(TEXT_ID, 'editor.monaco'))).toBe(false);
    }
  });

  it('видны с первого кадра: редактор известен раньше, чем заведётся сеанс', () => {
    // Сеанса нет вовсе — так выглядит только что открытый файл, тело которого ещё не
    // отработало свой эффект. Кнопки обязаны быть на месте уже сейчас.
    const d = { ...deps(), isSchema: () => false };

    expect(itemOf(d, 'schema.title.canvasTree').when?.(context(), target(SCHEMA_ID))).toBe(true);
    expect(itemOf(d, 'schema.title.canvasTree').toggled?.(context(), target(SCHEMA_ID))).toBe(true);
    // И работают: цель названа аргументом, проверять её догадкой про активную вкладку незачем.
    expect(canvasViewCommands(d)[1]?.run({ documentId: SCHEMA_ID })).toBe(true);
    expect(d.prefs.view()).toBe('schematic');
  });

  it('без редактора кода этого положения нет, а остальные на месте', () => {
    const d = deps({ withTextEditor: false });

    expect(itemOf(d, 'schema.title.showCode').when?.(context(), target(SCHEMA_ID))).toBe(false);
    expect(itemOf(d, 'schema.title.canvasTree').when?.(context(), target(SCHEMA_ID))).toBe(true);
  });

  it('без поверхности кнопки «форма» нет вовсе, а не серая: объяснить её нечем', () => {
    const d = deps({ withLive: false });

    expect(itemOf(d, 'schema.title.canvasLive').when?.(context(), target(SCHEMA_ID))).toBe(false);
    expect(itemOf(d, 'schema.title.canvasSchematic').when?.(context(), target(SCHEMA_ID))).toBe(
      true
    );
  });

  it('называют документ аргументом — цель щелчка важнее активной вкладки', () => {
    const d = deps({ active: TEXT_ID });

    expect(itemOf(d, 'schema.title.canvasTree').argsOf?.(target(SCHEMA_ID))).toEqual({
      documentId: SCHEMA_ID,
    });
  });

  it('сигнал перерисовки идёт и от предпочтений, и от режима документа', () => {
    const d = deps();
    let signals = 0;
    const subscription = itemOf(d, 'schema.title.canvasTree').onDidChange?.(() => {
      signals += 1;
    });

    d.prefs.setView('schematic');
    d.views?.set(SCHEMA_ID, 'code');

    expect(signals).toBe(2);

    subscription?.dispose();
    d.prefs.setView('tree');

    expect(signals).toBe(2);
  });
});
