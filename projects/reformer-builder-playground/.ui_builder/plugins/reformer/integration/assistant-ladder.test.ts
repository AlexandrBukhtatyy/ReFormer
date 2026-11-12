/**
 * Лестница сценариев MCP в ассистенте билдера (фаза 7 аудита, ReFormer-11oe.8).
 *
 * Сценарии — те же, что у терминальных агентов (`packages/reformer-mcp/eval/scenarios`): задание,
 * контракт, эталонный intent. Здесь эталон уходит в `build_form` целым ходом через мост — без модели,
 * сценарием двойника — и доказывает, что каждый сценарий с `builder.enabled` (кроме `replay: false`)
 * ассистент в принципе собирает: сборка проходит, у модуля есть запись реестра форм.
 *
 * `EVAL_LADDER_OUT=<каталог>` кладёт модули на диск (`<каталог>/<сценарий>/`) и отчёт `ladder.json`:
 * их проверяет верификатор MCP теми же контрактами, что формы терминала —
 * `npm run mcp:verify -- --ladder <каталог>`, а в записи прогонов переводит
 * `npm run mcp:import-builder -- <каталог>/verify.json`. `EVAL_LADDER='L1-*,L3-*'` — только эти
 * сценарии.
 *
 * Живая модель — `EVAL_MODEL` (и `EVAL_KIND`, `EVAL_BASE_URL`, `EVAL_API_KEY`, `EVAL_REASONING`, как
 * у `assistant-scenarios-eval.test.ts`): задание сценария (`prompt.md`) уходит ассистенту сообщением
 * пользователя, справка `ask_reformer` — в наборе, как в плагине; `EVAL_REPEATS=3` — повторы,
 * модули по `<сценарий>/r<n>`. Живой прогон — замер: тест не падает, итог — у верификатора.
 *
 * @module plugins/reformer/integration/assistant-ladder.test
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFakeProvider } from '../../forms/ai/src/providers/fake';
import { createByokProvider } from '../../forms/ai/src/providers/byok';
import type { ProviderKind, ReasoningLevel } from '../../forms/ai/src/session/config';
import { createBuiltinReference } from '../ai/src/knowledge/builtin';
import { bridgeTurn } from './bridge-turn';

const SCENARIOS = resolve(__dirname, '../../../../../../packages/reformer-mcp/eval/scenarios');

interface LadderScenario {
  readonly id: string;
  readonly reference?: string;
  /**
   * `enabled` — сценарий идёт в ассистент (живой замер); `replay: false` — его эталон одним вызовом
   * `build_form` не собрать (мастер по шагам, свой код), прогон без модели его пропускает. Причина
   * обязательна у обоих отказов.
   */
  readonly builder?: {
    readonly enabled: boolean;
    readonly replay?: boolean;
    readonly reason?: string;
  };
}

/** Шаблон `L1-*,L3-*` → проверка id. */
function matcher(pattern: string | undefined): (id: string) => boolean {
  if (!pattern) return () => true;
  const parts = pattern
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const regexes = parts.map(
    (part) => new RegExp(`^${part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
  );
  return (id) => regexes.some((regex) => regex.test(id));
}

function loadLadder(): Array<LadderScenario & { dir: string }> {
  const matches = matcher(process.env.EVAL_LADDER);
  return readdirSync(SCENARIOS)
    .map((name) => join(SCENARIOS, name))
    .filter((dir) => existsSync(join(dir, 'scenario.json')))
    .map((dir) => ({
      dir,
      ...(JSON.parse(readFileSync(join(dir, 'scenario.json'), 'utf8')) as LadderScenario),
    }))
    .filter((scenario) => matches(scenario.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const ladder = loadLadder();
const out = process.env.EVAL_LADDER_OUT ? resolve(process.env.EVAL_LADDER_OUT) : null;

/** Живая модель: задание сценария уходит ей сообщением пользователя. Без неё — эталон двойником. */
const MODEL = process.env.EVAL_MODEL;
const KIND = (process.env.EVAL_KIND ?? 'openai-compatible') as ProviderKind;
const REPEATS = Math.max(1, Number(process.env.EVAL_REPEATS ?? 1));
const MAX_STEPS = 24;

const runnable = ladder.filter(
  (scenario) =>
    scenario.builder?.enabled === true && (MODEL !== undefined || scenario.builder.replay !== false)
);
const runs = runnable.flatMap((scenario) =>
  Array.from({ length: MODEL ? REPEATS : 1 }, (_, index) => ({ scenario, repeat: index + 1 }))
);

/** Провайдер прогона: живой канал, как в замере сценариев билдера, либо сценарий двойника. */
function providerFor(scenario: LadderScenario & { dir: string }) {
  if (MODEL) {
    const apiKey =
      process.env.EVAL_API_KEY ?? (KIND === 'openai-compatible' ? 'ollama' : undefined);
    const reasoning = process.env.EVAL_REASONING as ReasoningLevel | undefined;
    return createByokProvider({
      kind: KIND,
      ...(KIND === 'openai-compatible'
        ? { baseUrl: process.env.EVAL_BASE_URL ?? 'http://localhost:11434/v1' }
        : {}),
      model: MODEL,
      ...(apiKey ? { apiKey } : {}),
      ...(reasoning === undefined ? {} : { reasoning }),
    });
  }
  const intent = JSON.parse(readFileSync(join(scenario.dir, scenario.reference!), 'utf8'));
  return createFakeProvider([{ tool: 'build_form', args: { intent } }, { text: 'Готово.' }]);
}

describe('лестница сценариев MCP в ассистенте', () => {
  it('у каждого сценария решено, идёт ли он в ассистент', () => {
    const undecided = ladder.filter((scenario) => typeof scenario.builder?.enabled !== 'boolean');
    expect(undecided.map((scenario) => scenario.id)).toEqual([]);
    const skippedWithoutReason = ladder.filter(
      (scenario) =>
        (scenario.builder?.enabled === false || scenario.builder?.replay === false) &&
        !scenario.builder.reason
    );
    expect(skippedWithoutReason.map((scenario) => scenario.id)).toEqual([]);
  });

  const results: Array<{
    id: string;
    repeat: number;
    dir: string;
    ok: boolean;
    error?: string;
    seconds: number;
    tools: string[];
  }> = [];

  it.each(runs.map((run) => [`${run.scenario.id}.r${run.repeat}`, run] as const))(
    '%s: ассистент собирает форму',
    async (_name, { scenario, repeat }) => {
      const started = Date.now();
      const turn = await bridgeTurn({
        provider: providerFor(scenario),
        ...(MODEL
          ? {
              message: readFileSync(join(scenario.dir, 'prompt.md'), 'utf8').trim(),
              config: { kind: KIND, model: MODEL, maxSteps: MAX_STEPS },
              reference: (() => {
                const reference = createBuiltinReference();
                return () => reference;
              })(),
            }
          : {}),
      });
      const builds = turn.tools.filter((tool) => tool.name === 'build_form');
      const files = turn.moduleFiles();
      const built = files.some((file) => file.path === 'application/entry.ts');
      const dir = REPEATS > 1 && MODEL ? `${scenario.id}/r${repeat}` : scenario.id;
      const lastBuild = builds.at(-1);
      results.push({
        id: scenario.id,
        repeat,
        dir,
        ok: built,
        ...(built
          ? {}
          : { error: String(lastBuild?.detail ?? lastBuild?.error ?? 'модуль не собран') }),
        seconds: Math.round((Date.now() - started) / 1000),
        tools: turn.tools.map((tool) => tool.name),
      });
      if (out && built) {
        for (const file of files) {
          const target = join(out, dir, file.path);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, file.text);
        }
      }
      // Без модели эталон обязан собраться; живая модель — замер, а не проверка: итог в отчёте.
      if (!MODEL) {
        expect(lastBuild?.ok, lastBuild?.detail).toBe(true);
        expect(built).toBe(true);
      }
    },
    MODEL ? 900_000 : 60_000
  );

  it.runIf(out !== null)('отчёт прогона лестницы — ladder.json', () => {
    mkdirSync(out!, { recursive: true });
    writeFileSync(
      join(out!, 'ladder.json'),
      `${JSON.stringify({ agent: MODEL ? 'builder' : 'replay', model: MODEL ?? null, results }, null, 2)}\n`
    );
  });
});
