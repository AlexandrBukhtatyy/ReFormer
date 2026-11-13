/**
 * Контракт песочницы Code Mode — общий для всех её реализаций.
 *
 * Скрипт модели обязан вести себя одинаково, где бы он ни исполнялся: под Node (QuickJS-wasm) и
 * в браузере (Worker в изолированном iframe). Иначе стенды, которые меряют Code Mode под Node,
 * говорили бы не о том, что увидит ассистент конструктора.
 *
 * @module reformer-mcp/tests/sandbox-contract
 */

import { describe, expect, it } from 'vitest';
import type { ScriptSandbox } from '../src/core/codemode/run-script';

/**
 * Проверки контракта над песочницей.
 *
 * @param make - Песочница с пределами времени ≈3 с общего и ≈0.5 с непрерывного исполнения.
 */
export function describeSandboxContract(name: string, make: () => ScriptSandbox): void {
  describe(`контракт песочницы: ${name}`, () => {
    const sandbox = make();
    const echo = async (args: unknown) => `echo ${JSON.stringify(args)}`;

    it('TypeScript, вывод и возвращённое значение', async () => {
      const outcome = await sandbox.run(
        'const a: string = await reformer.echo({ x: 1 }); console.log(a); return { n: 2 }',
        { echo }
      );
      expect(outcome.logs).toEqual(['echo {"x":1}']);
      expect(outcome.returned).toContain('"n": 2');
      expect(outcome.error).toBeUndefined();
    });

    it('нет require, process, fetch и таймеров', async () => {
      const outcome = await sandbox.run(
        'console.log(typeof require, typeof process, typeof fetch, typeof setTimeout)',
        {}
      );
      expect(outcome.logs).toEqual(['undefined undefined undefined undefined']);
    });

    it('бесконечный цикл и вечный промис прерываются', async () => {
      expect((await sandbox.run('while (true) {}', {})).error).toMatch(/interrupted/);
      expect((await sandbox.run('await new Promise(() => {})', {})).error).toMatch(
        /did not finish/
      );
    });

    it('исключение скрипта — ошибка со строкой', async () => {
      expect((await sandbox.run('\nthrow new Error("boom")', {})).error).toBe(
        'Error: boom (line 2)'
      );
    });

    it('ошибка функции хоста — исключение, которое скрипт может перехватить', async () => {
      const fail = async () => {
        throw new Error('нет такого символа');
      };
      const outcome = await sandbox.run(
        'try { await reformer.fail({}); } catch (error) { console.log("поймано:", error.message); }',
        { fail }
      );
      expect(outcome.logs).toEqual(['поймано: нет такого символа']);
      expect(outcome.error).toBeUndefined();
    });
  });
}
