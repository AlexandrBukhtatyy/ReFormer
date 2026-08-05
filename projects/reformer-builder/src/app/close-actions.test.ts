import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import { closingTabs, losingDrafts } from './close-actions';
import * as R from '../store/reducers';
import { appendNode, emptySchema } from '../model';
import type { EditorState, TabSource } from '../store/types';

const newSrc = (name: string): TabSource => ({ kind: 'new', name });
const fileSrc = (name: string): TabSource => ({ kind: 'file', name, path: 'src/' + name });
const tplSrc: TabSource = { kind: 'template', name: 'Кредитная заявка' };

const field = (m: string): JsonNode =>
  ({ value: `$model(${m})`, component: '$component(Input)' }) as JsonNode;

/** Правка схемы вкладки `id` (взводит `touched` и dirty). */
function edit(state: EditorState, id: string): EditorState {
  const s = R.setActiveTab(state, id);
  return R.commit(s, appendNode(R.activeTab(s)!.schema, ['root', 'children'], field('x')));
}

/** a (new) · b (file) · c (new), активна c. */
function abc(): EditorState {
  let s = R.openTab(R.initialState(), 'a', newSrc('a.json'), emptySchema());
  s = R.openTab(s, 'b', fileSrc('b.form.json'), emptySchema());
  s = R.openTab(s, 'c', newSrc('c.json'), emptySchema());
  return s;
}

describe('closingTabs', () => {
  it('one — только сама вкладка', () => {
    expect(closingTabs(abc(), { kind: 'one', id: 'b' })).toEqual(['b']);
  });

  it('others — все, кроме цели', () => {
    expect(closingTabs(abc(), { kind: 'others', id: 'b' })).toEqual(['a', 'c']);
  });

  it('left / right — по сторонам от цели', () => {
    expect(closingTabs(abc(), { kind: 'left', id: 'c' })).toEqual(['a', 'b']);
    expect(closingTabs(abc(), { kind: 'right', id: 'a' })).toEqual(['b', 'c']);
  });

  it('неизвестная вкладка — ничего не закрываем', () => {
    expect(closingTabs(abc(), { kind: 'one', id: 'zzz' })).toEqual([]);
  });
});

describe('losingDrafts', () => {
  it('нетронутый черновик подтверждения не требует', () => {
    const s = abc();
    expect(losingDrafts(s, ['a', 'b', 'c'])).toEqual([]);
  });

  it('черновик с правками — требует, файл с правками — нет', () => {
    let s = edit(abc(), 'a');
    s = edit(s, 'b');
    expect(losingDrafts(s, ['a', 'b', 'c'])).toEqual([{ id: 'a', name: 'a.json' }]);
  });

  it('правленый предпросмотр шаблона тоже требует подтверждения', () => {
    const s = edit(R.openTab(R.initialState(), 't', tplSrc, emptySchema()), 't');
    expect(losingDrafts(s, ['t'])).toEqual([{ id: 't', name: 'Кредитная заявка' }]);
  });

  it('после экспорта (markSaved) черновик снова безопасен', () => {
    const s = R.markSaved(edit(abc(), 'a'));
    expect(losingDrafts(s, ['a'])).toEqual([]);
  });
});
