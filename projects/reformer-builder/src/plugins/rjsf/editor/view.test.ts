/**
 * Переключатель «структура / форма / исходник»: стор вида, команды и кнопки полосы вкладок.
 *
 * Проверяется то, из-за чего кнопка врёт: применимость (над чем работает и когда доступна),
 * нажатое положение и то, что без поверхности вида «форма» нет нигде сразу — ни кнопки, ни
 * команды, ни запомненного состояния. Отрисовка ряда — забота оболочки и сквозного теста
 * (`shell/boot/integration/rjsf-view.browser.test`); здесь нет ни DOM, ни React.
 *
 * @module plugins/rjsf/editor/view.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { MenuItemContribution, ResourceId, WhenContext } from '@reformer/builder-plugin-api';
import {
  RJSF_CODE_ITEM_ID,
  RJSF_EDITOR_ID,
  RJSF_FORM_ITEM_ID,
  RJSF_SHOW_CODE_COMMAND_ID,
  RJSF_SHOW_FORM_COMMAND_ID,
  RJSF_SHOW_STRUCTURE_COMMAND_ID,
  RJSF_STRUCTURE_ITEM_ID,
} from './contract';
import { createFakeViewSettings } from './testing';
import {
  createRjsfViewStore,
  readRjsfView,
  RJSF_VIEW_SETTING,
  rjsfViewCommands,
  rjsfViewMenuItems,
  type RjsfViewDeps,
} from './view';

const FORM_ID: ResourceId = 'mem:contact.rjsf.json';

function context(): WhenContext {
  return {
    focus: 'none',
    activeEditorId: FORM_ID,
    activeResourceKind: 'rjsf.form',
    hasSelection: false,
    previewMode: null,
  };
}

function target(editorId: string | null = RJSF_EDITOR_ID) {
  return {
    documentId: FORM_ID,
    ref: {
      id: FORM_ID,
      sourceId: 'mem',
      path: 'contact.rjsf.json',
      name: 'contact.rjsf.json',
      kind: 'file' as const,
      mediaType: 'application/json',
    },
    editorId,
  };
}

/** Зависимости кнопок с настоящим стором: его состояние и есть предмет проверки. */
function deps(options: { withLive?: boolean; activeIsRjsf?: boolean } = {}) {
  const state = { live: options.withLive !== false, active: options.activeIsRjsf !== false };
  const hasLive = (): boolean => state.live;
  const result: RjsfViewDeps = {
    view: createRjsfViewStore({ hasLive }),
    hasLive,
    activeIsRjsf: () => state.active,
  };
  return { deps: result, state };
}

function commandOf(d: RjsfViewDeps, id: string) {
  const found = rjsfViewCommands(d).find((command) => command.id === id);
  if (found === undefined) throw new Error(`нет команды ${id}`);
  return found;
}

function itemOf(d: RjsfViewDeps, id: string): MenuItemContribution {
  const found = rjsfViewMenuItems(d).find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет пункта ${id}`);
  if (found.value.kind !== 'item') throw new Error('ожидался пункт-действие');
  return found.value;
}

/** Какая кнопка нажата: обязана быть ровно одна. */
function pressed(d: RjsfViewDeps): string {
  const items = rjsfViewMenuItems(d).filter(
    (item) => item.value.kind === 'item' && item.value.toggled?.(context(), target()) === true
  );
  if (items.length !== 1) throw new Error(`нажатых кнопок ${items.length}, а должна быть одна`);
  return items[0]?.id ?? '';
}

describe('стор вида', () => {
  it('по умолчанию — структура; мусор в настройке трактуется как умолчание', () => {
    expect(createRjsfViewStore({ hasLive: () => true }).view()).toBe('structure');
    expect(readRjsfView('split')).toBe('structure');
    expect(readRjsfView(undefined)).toBe('structure');
    expect(readRjsfView('form')).toBe('form');
  });

  it('читает запомненное и запоминает выбранное, сообщая подписчикам один раз', () => {
    const settings = createFakeViewSettings({ [RJSF_VIEW_SETTING]: 'form' });
    const store = createRjsfViewStore({ settings, hasLive: () => true });
    const changed = vi.fn();
    store.subscribe(changed);

    expect(store.view()).toBe('form');

    store.setView('structure');
    expect(store.view()).toBe('structure');
    expect(settings.values.get(RJSF_VIEW_SETTING)).toBe('structure');
    expect(changed).toHaveBeenCalledTimes(1);

    // Повтор того же положения — не смена: подписчиков не будят.
    store.setView('structure');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('запомненная «форма» без поверхности читается как «структура» — и возвращается с ней', () => {
    let live = false;
    const settings = createFakeViewSettings({ [RJSF_VIEW_SETTING]: 'form' });
    const store = createRjsfViewStore({ settings, hasLive: () => live });

    // Иначе вкладка осталась бы с пустым телом и без кнопки, которой из него выходят.
    expect(store.view()).toBe('structure');
    // Предпочтение при этом не переписано: поверхность вернулась — вернулась и форма.
    expect(settings.values.get(RJSF_VIEW_SETTING)).toBe('form');
    live = true;
    expect(store.view()).toBe('form');
  });

  it('«структура», выбранная без поверхности, остаётся выбором и после её возврата', () => {
    let live = false;
    const settings = createFakeViewSettings({ [RJSF_VIEW_SETTING]: 'form' });
    const store = createRjsfViewStore({ settings, hasLive: () => live });

    store.setView('structure');
    live = true;

    expect(store.view()).toBe('structure');
    expect(settings.values.get(RJSF_VIEW_SETTING)).toBe('structure');
  });

  it('отказ хранилища не мешает переключению', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createRjsfViewStore({
      settings: { get: () => undefined, set: () => Promise.reject(new Error('диск полон')) },
      hasLive: () => true,
    });

    store.setView('form');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.view()).toBe('form');
    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it('снятый стор подписчиков не держит', () => {
    const store = createRjsfViewStore({ hasLive: () => true });
    const changed = vi.fn();
    store.subscribe(changed);

    store.dispose();
    store.setView('form');

    expect(changed).not.toHaveBeenCalled();
  });
});

describe('команды переключателя', () => {
  it('ведут в оба положения и не спорят сами с собой при повторе', () => {
    const { deps: d } = deps();

    expect(commandOf(d, RJSF_SHOW_FORM_COMMAND_ID).run()).toBe(true);
    expect(pressed(d)).toBe(RJSF_FORM_ITEM_ID);
    // Второй раз — то же положение: команда доступна и оставляет как есть, а не отказывает.
    expect(commandOf(d, RJSF_SHOW_FORM_COMMAND_ID).run()).toBe(true);
    expect(pressed(d)).toBe(RJSF_FORM_ITEM_ID);

    expect(commandOf(d, RJSF_SHOW_STRUCTURE_COMMAND_ID).run()).toBe(true);
    expect(pressed(d)).toBe(RJSF_STRUCTURE_ITEM_ID);
  });

  it('без поверхности форма недоступна, а структура — на месте', () => {
    const { deps: d } = deps({ withLive: false });
    const form = commandOf(d, RJSF_SHOW_FORM_COMMAND_ID);

    expect(form.enabled?.(context())).toBe(false);
    // Отказ, а не молчаливая структура: подмена вида ответила бы на другой вопрос.
    expect(form.run()).toBe(false);
    expect(d.view.view()).toBe('structure');
    expect(commandOf(d, RJSF_SHOW_STRUCTURE_COMMAND_ID).enabled?.(context())).toBe(true);
  });

  it('на чужой вкладке недоступны и ничего не меняют', () => {
    const { deps: d } = deps({ activeIsRjsf: false });
    const form = commandOf(d, RJSF_SHOW_FORM_COMMAND_ID);

    expect(form.enabled?.(context())).toBe(false);
    expect(form.run()).toBe(false);
    expect(d.view.view()).toBe('structure');
  });
});

describe('кнопки в полосе вкладок', () => {
  it('видны обе, нажата ровно одна', () => {
    const { deps: d } = deps();

    for (const id of [RJSF_STRUCTURE_ITEM_ID, RJSF_FORM_ITEM_ID]) {
      expect(itemOf(d, id).when?.(context(), target())).toBe(true);
    }
    expect(pressed(d)).toBe(RJSF_STRUCTURE_ITEM_ID);

    d.view.setView('form');
    expect(pressed(d)).toBe(RJSF_FORM_ITEM_ID);
    // И обе по-прежнему на месте: полоса отвечает «где я», а не «куда можно».
    for (const id of [RJSF_STRUCTURE_ITEM_ID, RJSF_FORM_ITEM_ID]) {
      expect(itemOf(d, id).when?.(context(), target())).toBe(true);
    }
  });

  it('над чужим редактором кнопок нет: форма, открытая текстом, видов не имеет', () => {
    const { deps: d } = deps();

    for (const id of [RJSF_STRUCTURE_ITEM_ID, RJSF_FORM_ITEM_ID]) {
      expect(itemOf(d, id).when?.(context(), target('editor.monaco'))).toBe(false);
      expect(itemOf(d, id).when?.(context(), target(null))).toBe(false);
      // Цель не документ вовсе — пункт спросили в чужом меню.
      expect(itemOf(d, id).when?.(context(), undefined)).toBe(false);
    }
  });

  it('без поверхности пропадают ОБЕ: одна кнопка из двух переключателем не является', () => {
    const { deps: d, state } = deps();
    d.view.setView('form');
    state.live = false;

    for (const id of [RJSF_STRUCTURE_ITEM_ID, RJSF_FORM_ITEM_ID]) {
      expect(itemOf(d, id).when?.(context(), target())).toBe(false);
    }
    // Тело вкладки при этом показывает структуру — тем же ответом стора.
    expect(d.view.view()).toBe('structure');
  });

  it('у обеих есть значок — иначе оболочка уберёт их под «…»', () => {
    const { deps: d } = deps();

    expect(itemOf(d, RJSF_STRUCTURE_ITEM_ID).icon).toBeDefined();
    expect(itemOf(d, RJSF_FORM_ITEM_ID).icon).toBeDefined();
  });

  it('сигнал перерисовки идёт от стора и снимается вместе с подпиской', () => {
    const { deps: d } = deps();
    let signals = 0;
    const subscription = itemOf(d, RJSF_STRUCTURE_ITEM_ID).onDidChange?.(() => {
      signals += 1;
    });

    d.view.setView('form');
    expect(signals).toBe(1);

    subscription?.dispose();
    d.view.setView('structure');
    expect(signals).toBe(1);
  });
});

describe('положение «исходник»', () => {
  /** Зависимости с редактором кода в составе; поверхность превью — по желанию. */
  function withText(options: { withLive?: boolean } = {}) {
    const state = { live: options.withLive !== false, text: true };
    const hasLive = (): boolean => state.live;
    const hasTextEditor = (): boolean => state.text;
    const result: RjsfViewDeps = {
      view: createRjsfViewStore({ hasLive, hasTextEditor }),
      hasLive,
      hasTextEditor,
      activeIsRjsf: () => true,
    };
    return { deps: result, state };
  }

  it('команда ведёт в исходник, и нажата его кнопка', () => {
    const { deps: d } = withText();

    expect(commandOf(d, RJSF_SHOW_CODE_COMMAND_ID).run()).toBe(true);
    expect(d.view.view()).toBe('code');
    expect(pressed(d)).toBe(RJSF_CODE_ITEM_ID);
    for (const id of [RJSF_STRUCTURE_ITEM_ID, RJSF_FORM_ITEM_ID, RJSF_CODE_ITEM_ID]) {
      expect(itemOf(d, id).when?.(context(), target())).toBe(true);
    }
  });

  it('без редактора кода исходника нет нигде: ни кнопки, ни команды, ни запомненного вида', () => {
    const settings = createFakeViewSettings({ [RJSF_VIEW_SETTING]: 'code' });
    const hasLive = (): boolean => true;
    const d: RjsfViewDeps = {
      view: createRjsfViewStore({ settings, hasLive }),
      hasLive,
      activeIsRjsf: () => true,
    };
    const code = commandOf(d, RJSF_SHOW_CODE_COMMAND_ID);

    expect(readRjsfView('code')).toBe('code');
    expect(d.view.view()).toBe('structure');
    expect(code.enabled?.(context())).toBe(false);
    expect(code.run()).toBe(false);
    expect(itemOf(d, RJSF_CODE_ITEM_ID).when?.(context(), target())).toBe(false);
    // Остальные два положения — на месте, как и до появления третьего.
    expect(itemOf(d, RJSF_STRUCTURE_ITEM_ID).when?.(context(), target())).toBe(true);
    expect(itemOf(d, RJSF_FORM_ITEM_ID).when?.(context(), target())).toBe(true);
  });

  it('без поверхности остаются «структура» и «исходник», а «формы» в ряду нет', () => {
    const { deps: d } = withText({ withLive: false });

    expect(itemOf(d, RJSF_STRUCTURE_ITEM_ID).when?.(context(), target())).toBe(true);
    expect(itemOf(d, RJSF_CODE_ITEM_ID).when?.(context(), target())).toBe(true);
    expect(itemOf(d, RJSF_FORM_ITEM_ID).when?.(context(), target())).toBe(false);
  });

  it('редактор кода выключили на ходу — вкладка возвращается к структуре', () => {
    const { deps: d, state } = withText();
    d.view.setView('code');

    state.text = false;

    expect(d.view.view()).toBe('structure');
    expect(pressed(d)).toBe(RJSF_STRUCTURE_ITEM_ID);
  });
});
