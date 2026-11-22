/**
 * Пометка формы идущего хода: только во время хода и только на его форме; сигнал — при смене формы.
 *
 * @module plugins/forms/ai/ui/turn-form-decoration.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { ResourceRef } from '@reformer/builder-plugin-api';
import { createAiSession } from '../session/session';
import { turnFormDecoration } from './turn-form-decoration';

const ref = (id: string): ResourceRef => ({
  id,
  sourceId: 'fake',
  path: id,
  name: id,
  kind: 'file',
  mediaType: 'application/json',
});

const unreadable = { text: () => Promise.reject(new Error('не нужно')) };

describe('пометка формы хода', () => {
  it('видна только на форме идущего хода, сигнал — при смене формы, а не на каждый кусок', () => {
    const session = createAiSession();
    const decoration = turnFormDecoration(session);
    const changed = vi.fn();
    const subscription = decoration.onDidChange?.(changed);

    expect(decoration.decorate(ref('forms/a.json'), unreadable)).toBeNull();

    session.startTurn('добавь поле', {
      mode: 'files',
      resource: 'forms/a.json',
      path: 'forms/a.json',
      txId: 't1',
    });
    expect(decoration.decorate(ref('forms/a.json'), unreadable)).toMatchObject({
      tone: 'accent',
      tooltipKey: 'decoration.turnForm',
    });
    expect(decoration.decorate(ref('forms/b.json'), unreadable)).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);

    session.appendText('Готово');
    session.appendText(' — поле добавлено.');
    expect(changed).toHaveBeenCalledTimes(1);

    session.finishTurn(null);
    expect(decoration.decorate(ref('forms/a.json'), unreadable)).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2);
    subscription?.dispose();
  });
});
