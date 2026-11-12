/**
 * Каталог сценариев: чтение `scenario.json` и сборка эталонного решения.
 *
 * Эталон собирается тем же путём, что и решение агента (с 7.0 он один): intent в
 * `<каталог>/form.intent.json`, затем `form_build`. Intent берётся из `reference`: это либо файл
 * относительно каталога сценария, либо `plan_form` — черновик сервер пишет сам по спеке сценария.
 * Раньше эталон печатал `generate_form`, и стенд мерил агентов по пути, которым они не шли.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from '../records/record.mjs';
import { intentForTarget } from '../lib/intent-target.mjs';

const INTENT_FILE = 'form.intent.json';

export const scenariosDirectory = path.dirname(fileURLToPath(import.meta.url));

function scenarioDirectories(directory, split) {
  return readdirSync(directory)
    .filter((name) => statSync(path.join(directory, name)).isDirectory())
    .flatMap((name) => {
      const full = path.join(directory, name);
      if (name === 'holdout') return scenarioDirectories(full, 'holdout');
      return existsSync(path.join(full, 'scenario.json')) ? [{ full, split }] : [];
    });
}

/** Шаблон с `*` → проверка идентификатора; несколько шаблонов — через запятую. */
export function matchesPattern(id, pattern) {
  return String(pattern)
    .split(',')
    .some((part) => {
      const regex = part
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(`^${regex}$`).test(id);
    });
}

/**
 * @param {{ pattern?: string, includeHoldout?: boolean }} [options]
 * @returns {Array<object>} сценарии по порядку уровней
 */
export function loadScenarios({ pattern = '*', includeHoldout = false } = {}) {
  return scenarioDirectories(scenariosDirectory, 'tuned')
    .map(({ full, split }) => {
      const scenario = JSON.parse(readFileSync(path.join(full, 'scenario.json'), 'utf8'));
      return {
        ...scenario,
        split: scenario.split ?? split,
        directory: full,
        promptFile: path.join(full, scenario.prompt ?? 'prompt.md'),
        contractFile: path.join(full, scenario.contract ?? 'contract.json'),
        specFile: scenario.spec ? path.join(repoRoot, scenario.spec) : null,
      };
    })
    .filter((scenario) => includeHoldout || scenario.split !== 'holdout')
    .filter((scenario) => matchesPattern(scenario.id, pattern))
    .sort((first, second) => first.level - second.level || first.id.localeCompare(second.id));
}

/** Intent эталона в `<directory>/form.intent.json`: из файла сценария либо черновиком `plan_form`. */
async function writeReferenceIntent({ scenario, target, directory, client }) {
  const intentFile = path.join(directory, INTENT_FILE);
  rmSync(intentFile, { force: true });
  let intent;
  if (scenario.reference === 'plan_form') {
    const { text } = await client.callTool('plan_form', {
      specPath: scenario.specFile,
      dir: directory,
      target,
    });
    if (!existsSync(intentFile)) {
      throw new Error(`${scenario.id}: plan_form не записал черновик — ${text.slice(0, 400)}`);
    }
    intent = JSON.parse(readFileSync(intentFile, 'utf8'));
  } else {
    const file = path.resolve(scenario.directory, scenario.reference);
    intent = JSON.parse(readFileSync(file, 'utf8'));
  }
  writeFileSync(intentFile, `${JSON.stringify(intentForTarget(intent, target), null, 2)}\n`);
}

/**
 * У таргета `core` образец `index.tsx` от сервера не рисует ничего: разметку в JSX пишет агент.
 * Эталону она нужна для браузерной стадии, поэтому он рисует схему рендерером.
 */
function drawCoreForm(indexFile) {
  const source = readFileSync(indexFile, 'utf8');
  if (!source.includes('return null;')) return;
  writeFileSync(
    indexFile,
    [
      "import { FormRenderer } from '@reformer/renderer-react';",
      "import { FormField } from '@reformer/ui-kit';",
      source.replace(
        'return null;',
        'return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;'
      ),
    ].join('\n')
  );
}

/** Собрать эталонный модуль сценария через сервер: intent на диск, затем `form_build`. */
export async function writeReferenceBundle({ scenario, target, directory, client }) {
  mkdirSync(directory, { recursive: true });
  await writeReferenceIntent({ scenario, target, directory, client });
  const { text } = await client.callTool('form_build', { dir: directory }, 180000);
  // Префикс ответа — контракт `form_build` (тест «ответ — контракт стендов», tests/form-build.test.ts).
  if (!text.startsWith('✓ form_build')) {
    throw new Error(`${scenario.id}/${target}: form_build —\n${text.slice(0, 2000)}`);
  }
  if (target === 'core') drawCoreForm(path.join(directory, 'index.tsx'));
  return { status: 'ok', text };
}
