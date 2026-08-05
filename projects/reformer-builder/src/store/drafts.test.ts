import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import * as R from './reducers';
import { draftsDelta, draftsOf, toRecord, toTab } from './drafts';
import { emptySchema, appendNode } from '../model';
import type { EditorState, TabSource } from './types';

const newSrc: TabSource = { kind: 'new', name: 'form.json' };
const fileSrc: TabSource = { kind: 'file', name: 'a.form.json', path: 'src/a.form.json' };
const tplSrc: TabSource = { kind: 'template', name: 'Кредитная заявка' };

const field = (m: string): JsonNode =>
  ({ value: `$model(${m})`, component: '$component(Input)' }) as JsonNode;

/** Правка схемы активной вкладки (взводит `touched` и dirty). */
const edit = (s: EditorState): EditorState =>
  R.commit(s, appendNode(R.activeTab(s)!.schema, ['root', 'children'], field('x')));

const ids = (tabs: { id: string }[]) => tabs.map((t) => t.id);

describe('isDraft', () => {
  it('вкладка Mode A — черновик всегда', () => {
    const s = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    expect(R.isDraft(R.activeTab(s)!)).toBe(true);
  });

  it('вкладка файла проекта — не черновик (копия есть на диске)', () => {
    const s = R.openTab(R.initialState(), 'a', fileSrc, emptySchema());
    expect(R.isDraft(R.activeTab(s)!)).toBe(false);
  });

  it('предпросмотр шаблона: до правки — не черновик, после — черновик', () => {
    const s0 = R.openTab(R.initialState(), 'a', tplSrc, emptySchema());
    expect(R.isDraft(R.activeTab(s0)!)).toBe(false);
    expect(R.isDraft(R.activeTab(edit(s0))!)).toBe(true);
  });

  it('code-вкладка — не черновик', () => {
    const s = R.openCodeTab(R.initialState(), 'a', fileSrc, 'text', 'typescript');
    expect(R.isDraft(R.activeTab(s)!)).toBe(false);
  });
});

/** Пустая базовая линия — «в хранилище ещё ничего нет». */
const nothing = () => new Map<string, ReturnType<typeof R.makeTab>>();

describe('draftsDelta', () => {
  it('пустое хранилище — записать все черновики, файловые пропустить', () => {
    let s = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    s = R.openTab(s, 'b', fileSrc, emptySchema());
    const d = draftsDelta(nothing(), s);
    expect(ids(d.save)).toEqual(['a']);
    expect(d.remove).toEqual([]);
  });

  it('вкладка, открытая до подписки, всё равно попадает в save', () => {
    // регрессия: базовая линия — записанные черновики, а не текущее состояние стора
    const s = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    expect(ids(draftsDelta(nothing(), s).save)).toEqual(['a']);
  });

  it('новая вкладка-черновик попадает в save', () => {
    const s0 = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    const s1 = R.openTab(s0, 'b', newSrc, emptySchema());
    expect(ids(draftsDelta(draftsOf(s0), s1).save)).toEqual(['b']);
  });

  it('правка схемы попадает в save', () => {
    const s0 = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    expect(ids(draftsDelta(draftsOf(s0), edit(s0)).save)).toEqual(['a']);
  });

  it('выделение и hover записи не порождают', () => {
    const s0 = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    const s1 = R.setHover(R.select(s0, ['root']), ['root']);
    expect(draftsDelta(draftsOf(s0), s1).save).toEqual([]);
  });

  it('закрытая вкладка-черновик попадает в remove', () => {
    const s0 = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    expect(draftsDelta(draftsOf(s0), R.closeTab(s0, 'a')).remove).toEqual(['a']);
  });

  it('правка предпросмотра шаблона делает его черновиком → save', () => {
    const s0 = R.openTab(R.initialState(), 'a', tplSrc, emptySchema());
    expect(draftsDelta(nothing(), s0).save).toEqual([]);
    expect(ids(draftsDelta(draftsOf(s0), edit(s0)).save)).toEqual(['a']);
  });
});

describe('toRecord / toTab', () => {
  it('round-trip сохраняет схему, dirty, мок-данные и шаг', () => {
    let s = R.openTab(R.initialState(), 'a', newSrc, emptySchema());
    s = edit(s);
    s = R.setMockText(s, 'a', 'model', '{"x":1}');
    s = R.setActiveStep(s, 2);
    const tab = R.activeTab(s)!;

    const back = toTab(toRecord(tab, 100, 200));
    expect(back.id).toBe('a');
    expect(back.schema).toBe(tab.schema);
    expect(back.savedSchema).toBe(tab.savedSchema);
    expect(back.mock).toEqual({ model: '{"x":1}' });
    expect(back.activeStep).toBe(2);
    expect(back.touched).toBe(true);
    expect(R.isDirty(back)).toBe(true);
    expect(R.isDraft(back)).toBe(true);
  });

  it('история не восстанавливается', () => {
    const s = edit(R.openTab(R.initialState(), 'a', newSrc, emptySchema()));
    const back = toTab(toRecord(R.activeTab(s)!, 100, 200));
    expect(back.past).toEqual([]);
    expect(back.future).toEqual([]);
  });
});
