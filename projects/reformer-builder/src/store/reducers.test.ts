import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import * as R from './reducers';
import { emptySchema, appendNode, setComponentProp } from '../model';
import type { TabSource } from './types';

const src: TabSource = { kind: 'new', name: 'form.json' };
const field = (m: string): JsonNode =>
  ({ value: `$model(${m})`, component: '$component(Input)' }) as JsonNode;

const opened = () => R.openTab(R.initialState(), 't1', src, emptySchema());

describe('вкладки', () => {
  it('openTab создаёт активную вкладку', () => {
    const s = opened();
    expect(s.activeTabId).toBe('t1');
    expect(s.order).toEqual(['t1']);
    expect(R.activeTab(s)?.source.name).toBe('form.json');
  });

  it('openTab с тем же id — только активация, без дубля', () => {
    const s = R.openTab(opened(), 't1', src, emptySchema());
    expect(s.order).toEqual(['t1']);
  });

  it('closeTab: активной становится соседняя', () => {
    let s = R.openTab(R.initialState(), 'a', src, emptySchema());
    s = R.openTab(s, 'b', src, emptySchema());
    s = R.openTab(s, 'c', src, emptySchema());
    s = R.setActiveTab(s, 'b');
    s = R.closeTab(s, 'b');
    expect(s.order).toEqual(['a', 'c']);
    expect(s.activeTabId).toBe('c');
  });
});

describe('правки и история', () => {
  it('commit: снимок в историю, выделение = newPath, dirty', () => {
    const s0 = opened();
    const t0 = R.activeTab(s0)!;
    const s1 = R.commit(s0, appendNode(t0.schema, ['root', 'children'], field('x')));
    const t1 = R.activeTab(s1)!;
    expect(t1.selectionPath).toEqual(['root', 'children', 0]);
    expect(t1.past).toHaveLength(1);
    expect(R.isDirty(t1)).toBe(true);
  });

  it('undo/redo восстанавливают схему и выделение', () => {
    const s0 = opened();
    const t0 = R.activeTab(s0)!;
    const s1 = R.commit(s0, appendNode(t0.schema, ['root', 'children'], field('x')));
    const s2 = R.undo(s1);
    const t2 = R.activeTab(s2)!;
    expect(t2.schema).toBe(t0.schema);
    expect(t2.selectionPath).toEqual(['root']);
    const s3 = R.redo(s2);
    expect(R.activeTab(s3)!.selectionPath).toEqual(['root', 'children', 0]);
  });

  it('коалесинг: серия с одним ключом = одна запись истории', () => {
    const s0 = opened();
    const t0 = R.activeTab(s0)!;
    const s1 = R.commit(s0, appendNode(t0.schema, ['root', 'children'], field('x')));
    const t1 = R.activeTab(s1)!;
    const path = ['root', 'children', 0];
    const key = 'label@' + path.join('.');
    const s2 = R.commit(s1, setComponentProp(t1.schema, path, 'label', 'A'), { coalesceKey: key });
    const t2 = R.activeTab(s2)!;
    const s3 = R.commit(s2, setComponentProp(t2.schema, path, 'label', 'AB'), { coalesceKey: key });
    const t3 = R.activeTab(s3)!;
    expect(t3.past).toHaveLength(2); // append + первый label; второй — коалесинг
    // один undo откатывает обе правки label к состоянию после append
    expect(R.activeTab(R.undo(s3))!.schema).toBe(t1.schema);
  });

  it('markSaved снимает dirty', () => {
    const s0 = opened();
    const t0 = R.activeTab(s0)!;
    const s1 = R.commit(s0, appendNode(t0.schema, ['root', 'children'], field('x')));
    expect(R.isDirty(R.activeTab(s1)!)).toBe(true);
    expect(R.isDirty(R.activeTab(R.markSaved(s1))!)).toBe(false);
  });
});

describe('выделение / навигация', () => {
  it('select / setActiveStep', () => {
    let s = opened();
    s = R.select(s, ['root', 'children', 2]);
    expect(R.activeTab(s)!.selectionPath).toEqual(['root', 'children', 2]);
    s = R.setActiveStep(s, 3);
    expect(R.activeTab(s)!.activeStep).toBe(3);
  });
});

describe('ui', () => {
  it('переключатели', () => {
    let s = R.initialState();
    expect(s.ui.preview).toBe('wire');
    s = R.setPreview(s, 'runtime');
    expect(s.ui.preview).toBe('runtime');
    expect(s.ui.hideDivWrappers).toBe(false);
    s = R.toggleHideDivWrappers(s);
    expect(s.ui.hideDivWrappers).toBe(true);
    s = R.toggleRawJson(s);
    expect(s.ui.rawJsonOpen).toBe(false);
    s = R.setLeftPanel(s, null);
    expect(s.ui.leftPanel).toBeNull();
    s = R.toggleRight(s);
    expect(s.ui.rightOpen).toBe(false);
    s = R.setTheme(s, 'dark');
    expect(s.ui.theme).toBe('dark');
  });
});
