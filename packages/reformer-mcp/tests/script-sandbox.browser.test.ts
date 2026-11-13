/**
 * Браузерная песочница Code Mode в настоящих браузерах (ReFormer-m7zg).
 *
 * Контракт — тот же, что у QuickJS под Node (`./sandbox-contract`). Сверх него — граница:
 * изнутри скрипта не дотянуться ни до сети, ни до хранилищ страницы. Граница проверяется с
 * ОСТАВЛЕННЫМИ глобалами (`keepGlobals`): закрывать её обязаны origin и CSP, а не то, что имён
 * `fetch` и `indexedDB` в глобале нет.
 *
 * @module reformer-mcp/tests/script-sandbox.browser.test
 */

import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createBrowserSandbox } from '../src/platform/browser/script-sandbox';
import { describeSandboxContract } from './sandbox-contract';

/** Снятие типов — как `stripTypes` Node-песочницы, только без `createRequire`. */
function stripTypes(code: string): string {
  return ts.transpileModule(`async function __reformer_main__() {\n${code}\n}`, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
    },
    reportDiagnostics: false,
  }).outputText;
}

describeSandboxContract('браузер — Worker в изолированном iframe', () =>
  createBrowserSandbox({ timeoutMs: 3000, cpuSliceMs: 500, stripTypes })
);

describe('граница браузерной песочницы', () => {
  const open = createBrowserSandbox({ timeoutMs: 5000, cpuSliceMs: 2000, keepGlobals: true });
  const own = `${location.origin}/?leak=1`;
  const socket = `${location.origin.replace(/^http/, 'ws')}/`;

  it('контроль: тот же запрос со страницы уходит — закрывает его именно песочница', async () => {
    await expect(fetch(own, { mode: 'no-cors' })).resolves.toBeDefined();
  });

  it.each([
    {
      name: 'fetch на свой же хост',
      body: `try { await fetch(${JSON.stringify(own)}, { mode: 'no-cors' }); return 'OPEN'; } catch (e) { return 'blocked'; }`,
    },
    {
      name: 'XMLHttpRequest',
      body: `try { const x = new XMLHttpRequest(); x.open('GET', ${JSON.stringify(own)}, false); x.send(); return 'OPEN'; } catch (e) { return 'blocked'; }`,
    },
    {
      name: 'WebSocket',
      body: `try { const ws = new WebSocket(${JSON.stringify(socket)}); return await new Promise((done) => { ws.onopen = () => done('OPEN'); ws.onerror = () => done('blocked'); ws.onclose = () => done('blocked'); }); } catch (e) { return 'blocked'; }`,
    },
    {
      name: 'importScripts чужого кода',
      body: `try { importScripts('data:text/javascript,self.__probe = 1'); return 'OPEN'; } catch (e) { return 'blocked'; }`,
    },
    {
      name: 'динамический import чужого кода',
      body: `try { await import('data:text/javascript,export default 1'); return 'OPEN'; } catch (e) { return 'blocked'; }`,
    },
    {
      name: 'IndexedDB страницы',
      body: `try { const r = indexedDB.open('probe'); return await new Promise((done) => { r.onsuccess = () => done('OPEN'); r.onerror = () => done('blocked'); }); } catch (e) { return 'blocked'; }`,
    },
    {
      name: 'OPFS страницы',
      body: `try { await navigator.storage.getDirectory(); return 'OPEN'; } catch (e) { return 'blocked'; }`,
    },
  ])('$name — закрыто', async ({ body }) => {
    const outcome = await open.run(body, {});
    expect(outcome.error).toBeUndefined();
    expect(outcome.returned).toBe('blocked');
  });

  it('без keepGlobals сети, хранилищ и таймеров нет и по имени — как у QuickJS', async () => {
    const outcome = await createBrowserSandbox({ timeoutMs: 3000 }).run(
      'return [typeof XMLHttpRequest, typeof WebSocket, typeof importScripts, typeof indexedDB, typeof navigator, typeof setInterval].join(" ")',
      {}
    );
    expect(outcome.returned).toBe('undefined undefined undefined undefined undefined undefined');
  });
});

describe('страница вокруг песочницы', () => {
  it('скрипт крутит бесконечный цикл, а страница живёт: её таймеры срабатывают', async () => {
    const sandbox = createBrowserSandbox({ timeoutMs: 3000, cpuSliceMs: 500 });
    const running = sandbox.run('while (true) {}', {});

    const ticked = await Promise.race([
      new Promise<'alive'>((resolve) => setTimeout(() => resolve('alive'), 50)),
      running.then(() => 'finished' as const),
    ]);

    expect(ticked).toBe('alive');
    expect((await running).error).toMatch(/interrupted/);
  });

  it('после исполнения iframe песочницы не остаётся', async () => {
    const before = document.querySelectorAll('iframe').length;

    await createBrowserSandbox({ timeoutMs: 3000 }).run('return 1', {});
    await createBrowserSandbox({ timeoutMs: 3000, cpuSliceMs: 300 }).run('while (true) {}', {});

    expect(document.querySelectorAll('iframe').length).toBe(before);
  });
});
