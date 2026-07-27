import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import * as R from './reducers';
import { emptySchema, appendNode, setComponentProp, getAt } from '../model';
import { sampleSchema, P } from '../model/__fixtures__/sample-schema';
import type { EditorState, TabSource } from './types';

const src: TabSource = { kind: 'new', name: 'form.json' };
const field = (m: string): JsonNode =>
  ({ value: `$model(${m})`, component: '$component(Input)' }) as JsonNode;

const opened = () => R.openTab(R.initialState(), 't1', src, emptySchema());
const openedSample = () => R.openTab(R.initialState(), 't1', src, sampleSchema());
const kidsOf = (s: EditorState, path: readonly (string | number)[]) =>
  getAt(R.activeTab(s)!.schema, path) as Array<{ value?: string }>;

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
    expect(s.ui.quickAddOpen).toBe(false);
    s = R.setQuickAdd(s, true);
    expect(s.ui.quickAddOpen).toBe(true);
    s = R.toggleRawJson(s);
    expect(s.ui.rawJsonOpen).toBe(false);
    s = R.setLeftPanel(s, null);
    expect(s.ui.leftPanel).toBeNull();
    s = R.toggleRight(s);
    expect(s.ui.rightOpen).toBe(false);
    s = R.setTheme(s, 'dark');
    expect(s.ui.theme).toBe('dark');
  });

  it('toggleLeftPanel — свернуть и восстановить последнюю панель', () => {
    let s = R.initialState();
    expect(s.ui.leftPanel).toBe('files');

    // свернуть → null, но последняя запомнена
    s = R.toggleLeftPanel(s);
    expect(s.ui.leftPanel).toBeNull();
    expect(s.ui.lastLeftPanel).toBe('files');

    // развернуть → восстановилась 'files'
    s = R.toggleLeftPanel(s);
    expect(s.ui.leftPanel).toBe('files');

    // выбрать палитру через setLeftPanel → она становится последней
    s = R.setLeftPanel(s, 'palette');
    expect(s.ui.lastLeftPanel).toBe('palette');

    // свернуть/развернуть тоглом → восстановится именно палитра
    s = R.toggleLeftPanel(s);
    expect(s.ui.leftPanel).toBeNull();
    s = R.toggleLeftPanel(s);
    expect(s.ui.leftPanel).toBe('palette');

    // setLeftPanel(null) не затирает память последней панели
    s = R.setLeftPanel(s, null);
    expect(s.ui.lastLeftPanel).toBe('palette');
  });
});

describe('горячие клавиши (навигация/выделение/перемещение/удаление)', () => {
  it('navigate: одиночная навигация up/down/left/right', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down');
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0field1]);
    expect(R.activeTab(s)!.selectionPaths).toEqual([[...P.step0field1]]);
    s = R.navigate(s, 'left');
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0]);
    s = R.navigate(s, 'right');
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0field0]);
    s = R.navigate(s, 'up'); // первый сосед — некуда
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0field0]);
  });

  it('navigate extend (Shift): смежный диапазон соседей + якорь', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down', true);
    const t = R.activeTab(s)!;
    expect(t.selectionPath).toEqual([...P.step0field1]);
    expect(t.selectionPaths).toEqual([[...P.step0field0], [...P.step0field1]]);
    expect(t.anchorPath).toEqual([...P.step0field0]);
  });

  it('moveSelection: реордер одиночного среди соседей, курсор следует', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.moveSelection(s, 'down');
    expect(kidsOf(s, P.step0children).map((c) => c.value)).toEqual([
      '$model(loanAmount)',
      '$model(loanType)',
    ]);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0children, 1]);
  });

  it('moveSelection: на границе — без изменений', () => {
    const s0 = R.select(openedSample(), P.step0field0);
    const s1 = R.moveSelection(s0, 'up'); // уже первый
    expect(R.activeTab(s1)!.schema).toBe(R.activeTab(s0)!.schema);
  });

  it('deleteSelection: удаляет узел, выделение → сосед', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.deleteSelection(s);
    expect(kidsOf(s, P.step0children)).toHaveLength(1);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0children, 0]);
  });

  it('deleteSelection группы: пустой слот → владелец', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down', true); // выделены оба поля
    s = R.deleteSelection(s);
    expect(kidsOf(s, P.step0children)).toHaveLength(0);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0]);
  });

  it('duplicateSelection: копия после оригинала', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.duplicateSelection(s);
    expect(kidsOf(s, P.step0children)).toHaveLength(3);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0children, 1]);
  });

  it('duplicateSelection up: копия перед оригиналом (⇧⌥↑), выделение на копии', () => {
    let s = R.select(openedSample(), P.step0field1); // второе поле (index 1)
    s = R.duplicateSelection(s, 'up');
    expect(kidsOf(s, P.step0children).map((c) => c.value)).toEqual([
      '$model(loanType)',
      '$model(loanAmount)', // копия, вставлена перед оригиналом
      '$model(loanAmount)', // оригинал уехал вниз
    ]);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0children, 1]);
  });

  it('duplicateSelection: группа соседей дублируется блоком вниз', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down', true); // выделены оба поля (блок из 2)
    s = R.duplicateSelection(s, 'down');
    expect(kidsOf(s, P.step0children)).toHaveLength(4);
    expect(R.activeTab(s)!.selectionPaths).toEqual([
      [...P.step0children, 2],
      [...P.step0children, 3],
    ]);
  });

  it('collapseSelection: мульти → активный, затем → родитель', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down', true);
    s = R.collapseSelection(s);
    expect(R.activeTab(s)!.selectionPaths).toHaveLength(1);
    s = R.collapseSelection(s);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0]);
  });
});

describe('группировка / флип / мульти-выбор мышью', () => {
  const cls = (s: EditorState, path: readonly (string | number)[]) =>
    getAt(R.activeTab(s)!.schema, [...path, 'componentProps', 'className']);

  it('groupSelection: смежные поля → вертикальный div, выделен div', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down', true); // оба поля
    s = R.groupSelection(s);
    expect(kidsOf(s, P.step0children)).toHaveLength(1);
    expect(getAt(R.activeTab(s)!.schema, [...P.step0children, 0, 'component'])).toBe('$html(div)');
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0children, 0]);
  });

  it('ungroupSelection возвращает детей div', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down', true);
    s = R.groupSelection(s); // выделен div
    s = R.ungroupSelection(s);
    expect(kidsOf(s, P.step0children).map((c) => c.value)).toEqual([
      '$model(loanType)',
      '$model(loanAmount)',
    ]);
  });

  it('flipSelection меняет раскладку div; не-div → no-op', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.navigate(s, 'down', true);
    s = R.groupSelection(s);
    expect(cls(s, [...P.step0children, 0])).toBe('flex flex-col gap-4');
    s = R.flipSelection(s);
    expect(cls(s, [...P.step0children, 0])).toBe('flex gap-4');
    const s2 = R.select(openedSample(), P.step0field0);
    expect(R.activeTab(R.flipSelection(s2))!.schema).toBe(R.activeTab(s2)!.schema);
  });

  it('extendSelectionTo (Shift+клик): смежный диапазон до узла', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.extendSelectionTo(s, P.step0field1);
    expect(R.activeTab(s)!.selectionPaths).toEqual([[...P.step0field0], [...P.step0field1]]);
  });

  it('toggleSelectionAt (⌘+клик): несмежный выбор, удаление обоих', () => {
    const s3 = R.openTab(
      R.initialState(),
      't1',
      src,
      appendNode(sampleSchema(), P.step0children, field('third')).schema
    );
    let s = R.select(s3, P.step0field0); // [0]
    s = R.toggleSelectionAt(s, [...P.step0children, 2]); // + [2] → несмежно [0,2]
    expect(R.activeTab(s)!.selectionPaths).toEqual([[...P.step0field0], [...P.step0children, 2]]);
    s = R.deleteSelection(s); // удалить оба несмежных
    expect(kidsOf(s, P.step0children).map((c) => c.value)).toEqual(['$model(loanAmount)']);
  });
});

describe('addComponent (быстрое добавление, умно по контексту)', () => {
  it('в выделенный контейнер — в конец детей', () => {
    let s = R.select(openedSample(), P.step0); // шаг-контейнер
    s = R.addComponent(s, field('x'));
    expect(kidsOf(s, P.step0children)).toHaveLength(3);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0children, 2]);
  });

  it('после выделенного листа — соседом', () => {
    let s = R.select(openedSample(), P.step0field0);
    s = R.addComponent(s, field('x'));
    expect(kidsOf(s, P.step0children).map((c) => c.value)).toEqual([
      '$model(loanType)',
      '$model(x)',
      '$model(loanAmount)',
    ]);
    expect(R.activeTab(s)!.selectionPath).toEqual([...P.step0children, 1]);
  });

  it('без выделения — в корневой слот', () => {
    let s = R.select(openedSample(), null);
    s = R.addComponent(s, field('x'));
    expect(getAt(R.activeTab(s)!.schema, P.steps) as unknown[]).toHaveLength(3);
  });
});
