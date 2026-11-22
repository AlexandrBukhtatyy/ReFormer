/**
 * Расхождение документа с базой хода.
 *
 * @module plugins/forms/ai/session/apply.test
 */

import { describe, expect, it } from 'vitest';
import { isStale } from './apply';
import { createFakeHost } from '../testing';

const RESOURCE = 'form.json';

describe('расхождение спрашивается заранее', () => {
  it('нетронутый буфер расхождением не считается', () => {
    const host = createFakeHost();
    host.openDocument(RESOURCE, '{}');
    expect(isStale({ host }, { resource: RESOURCE, text: '{}' })).toBe(false);
  });

  it('правка снаружи и закрытая вкладка — оба расхождение', () => {
    const host = createFakeHost();
    host.openDocument(RESOURCE, '{}');
    host.editOutside(RESOURCE, '{"x":1}');
    expect(isStale({ host }, { resource: RESOURCE, text: '{}' })).toBe(true);
    host.closeDocument(RESOURCE);
    expect(isStale({ host }, { resource: RESOURCE, text: '{}' })).toBe(true);
  });
});
