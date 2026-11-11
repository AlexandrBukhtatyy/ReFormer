/**
 * Сверка сборки воркера ReFormer с плагинами: расхождение — заметка у сервера в панели MCP.
 *
 * @module plugins/forms/mcp/connection/build-check.test
 */

import { BUILD_ID } from '@reformer/mcp/build-info';
import { describe, expect, it } from 'vitest';
import { createFakeClock, createFakeHost, createFakeOpeners, fakeTool } from '../testing';
import { buildMismatchNote } from './build-check';
import { createMcpManager } from './manager';

describe('buildMismatchNote', () => {
  it('та же метка, чужой сервер, неподключённый сервер и плагин из исходников — без заметки', () => {
    expect(buildMismatchNote({ name: 'reformer-mcp', version: '6.0.0+abc' }, 'abc')).toBeNull();
    expect(buildMismatchNote({ name: 'other', version: '1.0.0+zzz' }, 'abc')).toBeNull();
    expect(buildMismatchNote(undefined, 'abc')).toBeNull();
    expect(buildMismatchNote({ name: 'reformer-mcp', version: '6.0.0+zzz' }, 'dev')).toBeNull();
  });

  it('другая метка или её нет — заметка с обеими метками и командой', () => {
    const other = buildMismatchNote({ name: 'reformer-mcp', version: '6.0.0+zzz' }, 'abc');
    expect(other).toContain('(zzz)');
    expect(other).toContain('(abc)');
    expect(other).toContain('npm run mcp:build && npm run plugins:build');
    expect(buildMismatchNote({ name: 'reformer-mcp', version: '6.0.0' }, 'abc')).toContain(
      'без метки сборки'
    );
  });
});

describe('менеджер показывает расхождение в notes сервера', () => {
  const BUNDLE = '.ui_builder/mcp/reformer/server.js';

  async function notesAfterConnect(version: string) {
    const manager = createMcpManager({
      host: createFakeHost({ [BUNDLE]: 'self.x = 1;' }),
      openers: createFakeOpeners({
        reformer: { tools: [fakeTool('choose_api')], server: { name: 'reformer-mcp', version } },
      }),
      clock: createFakeClock(),
      policy: { maxLive: 3, defaultIdleSeconds: 60 },
    });
    await manager.reload();
    const before = manager.snapshot().servers[0].notes;
    await manager.tools('reformer');
    return { before, after: manager.snapshot().servers[0].notes };
  }

  it.runIf(BUILD_ID !== 'dev')('сборки совпали — заметки нет', async () => {
    const { after } = await notesAfterConnect(`6.0.0+${BUILD_ID}`);
    expect(after).toEqual([]);
  });

  it.runIf(BUILD_ID !== 'dev')('сборки разошлись — заметка после подключения', async () => {
    const { before, after } = await notesAfterConnect('6.0.0+000000000000');
    expect(before).toEqual([]);
    expect(after).toHaveLength(1);
    expect(after[0]).toContain('(000000000000)');
  });
});
