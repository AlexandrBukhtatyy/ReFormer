/**
 * Снимки того, что печатает `generate_form`: три intent разной сложности под три таргета. Код, который
 * сервер кладёт в проекты потребителей, не должен меняться незаметно: любая правка генератора видна в
 * ревью построчно.
 *
 * Осознанная правка: `npx vitest run tests/generate-form-golden.test.ts -u` и разбор диффа.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAssemblyTsx, buildBundle } from '../src/core/generate/builders';
import { intentFromSpec } from '../src/core/generate/from-spec';
import { readIntent, type ReformerTargetStack } from '../src/core/generate/form-intent';

const TARGETS: ReformerTargetStack[] = ['core', 'renderer-react', 'renderer-json'];
const casesDirectory = resolve(__dirname, '../eval/calibration/cases');
const readCase = (name: string) =>
  JSON.parse(readFileSync(resolve(casesDirectory, name, 'intent.json'), 'utf8'));

const SOURCES: Record<string, (target: ReformerTargetStack) => unknown> = {
  loan: (target) =>
    intentFromSpec(
      readFileSync(resolve(__dirname, 'fixtures/spec-loan-request.md'), 'utf8'),
      target
    ),
  registration: (target) => ({ ...readCase('registration'), target }),
  credit: (target) => ({ ...readCase('credit'), target }),
};

describe.each(Object.keys(SOURCES))('снимок generate_form: %s', (name) => {
  it.each(TARGETS)('%s', async (target) => {
    const { intent, problems } = readIntent(SOURCES[name](target));
    expect(problems).toEqual([]);
    const { files } = buildBundle(intent);
    for (const file of files) {
      await expect(file.content).toMatchFileSnapshot(
        `__golden__/generate-form/${name}-${target}/${file.path}.snap`
      );
    }
    await expect(buildAssemblyTsx(intent)).toMatchFileSnapshot(
      `__golden__/generate-form/${name}-${target}/index.tsx.snap`
    );
  });
});
