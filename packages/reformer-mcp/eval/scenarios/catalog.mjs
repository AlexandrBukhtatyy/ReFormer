/**
 * Каталог сценариев: чтение `scenario.json` и сборка эталонного решения.
 *
 * Эталон — результат `generate_form` по `reference`: это либо файл intent относительно каталога
 * сценария, либо `plan_form` — intent сервер строит сам из спеки сценария.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractIntent, parseGenerateForm, writeBundle } from '../calibration/lib/bundle.mjs';
import { repoRoot } from '../records/record.mjs';

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

async function referenceIntent({ scenario, target, client }) {
  if (scenario.reference === 'plan_form') {
    const { text } = await client.callTool('plan_form', { specPath: scenario.specFile, target });
    const intent = extractIntent(text);
    if (!intent) throw new Error(`${scenario.id}: plan_form не вернул intent`);
    return intent;
  }
  const file = path.resolve(scenario.directory, scenario.reference);
  return JSON.parse(readFileSync(file, 'utf8'));
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

/** Собрать эталонный модуль сценария через сервер и записать в каталог. */
export async function writeReferenceBundle({ scenario, target, directory, client }) {
  const intent = await referenceIntent({ scenario, target, client });
  const { text } = await client.callTool('generate_form', { intent: { ...intent, target } });
  const parsed = parseGenerateForm(text);
  if (parsed.status !== 'ok') {
    throw new Error(
      `${scenario.id}/${target}: generate_form — ${parsed.errors.join('; ') || parsed.status}`
    );
  }
  writeBundle(directory, parsed);
  if (target === 'core') drawCoreForm(path.join(directory, 'index.tsx'));
  // Файлы, которые манифест велит создать самому: без них раскладка не канонична.
  for (const [, file] of text.matchAll(/^\| `([^`]+)` \|.*\*\*создайте сами\*\*/gm)) {
    const ownFile = path.join(directory, file);
    if (existsSync(ownFile)) continue;
    mkdirSync(path.dirname(ownFile), { recursive: true });
    writeFileSync(ownFile, 'export {};\n');
  }
  return parsed;
}
