/**
 * Каталог сценариев: чтение `scenario.json` и сборка эталонного решения.
 *
 * Эталон собирается тем же путём, что и решение агента (с 7.0 он один): intent в
 * `<каталог>/form.intent.json`, затем `form_build`. Intent берётся из `reference`: это либо файл
 * относительно каталога сценария, либо `plan_form` — черновик сервер пишет сам по спеке сценария.
 * Раньше эталон печатал `generate_form`, и стенд мерил агентов по пути, которым они не шли.
 */

import {
  copyFileSync,
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

/**
 * Каталоги сценариев. Сценарий — каталог со `scenario.json`; каталог без него — группа (форма и её
 * операции: `registration/create`, `registration/edit`), обходится вглубь. `_*` и скрытые — служебные.
 */
function scenarioDirectories(directory, split) {
  return readdirSync(directory)
    .filter((name) => !/^[_.]/.test(name) && name !== 'node_modules')
    .filter((name) => statSync(path.join(directory, name)).isDirectory())
    .flatMap((name) => {
      const full = path.join(directory, name);
      if (existsSync(path.join(full, 'scenario.json'))) return [{ full, split }];
      return scenarioDirectories(full, name === 'holdout' ? 'holdout' : split);
    });
}

/**
 * Затравка правки: `seed` — id сценария, эталон которого стенд собирает в `form/` до старта агента.
 * Источник обязан существовать, иметь эталон и сам с чистого листа: цепочка затравок сделала бы
 * старт правки зависимым от двух эталонов сразу.
 */
function resolveSeeds(scenarios) {
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  for (const scenario of scenarios) {
    if (!scenario.seed) continue;
    const source = byId.get(scenario.seed);
    if (!source) throw new Error(`${scenario.id}: seed «${scenario.seed}» — нет такого сценария`);
    if (source.seed) throw new Error(`${scenario.id}: seed ${source.id} сам начинается с затравки`);
    if (!source.reference || source.reference === 'plan_form') {
      throw new Error(`${scenario.id}: у seed ${source.id} нет эталонного intent`);
    }
    scenario.seedScenario = source;
  }
  return scenarios;
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
 * @returns {Array<object>} сценарии по порядку уровней, внутри уровня — по операциям
 */
export function loadScenarios({ pattern = '*', includeHoldout = false } = {}) {
  const all = scenarioDirectories(scenariosDirectory, 'tuned').map(({ full, split }) => {
    const scenario = JSON.parse(readFileSync(path.join(full, 'scenario.json'), 'utf8'));
    return {
      ...scenario,
      split: scenario.split ?? split,
      directory: full,
      promptFile: path.join(full, scenario.prompt ?? 'prompt.md'),
      contractFile: path.join(full, scenario.contract ?? 'contract.json'),
      specFile: scenario.spec ? path.join(repoRoot, scenario.spec) : null,
    };
  });
  return resolveSeeds(all)
    .filter((scenario) => includeHoldout || scenario.split !== 'holdout')
    .filter((scenario) => matchesPattern(scenario.id, pattern))
    .sort(
      (first, second) =>
        first.level - second.level ||
        operationRank(first) - operationRank(second) ||
        first.id.localeCompare(second.id)
    );
}

/** Порядок операций над одной формой: сначала создание, потом то, что начинается с готовой. */
const OPERATIONS = ['create', 'split', 'edit', 'delete'];
const operationRank = (scenario) => {
  const rank = OPERATIONS.indexOf(scenario.operation ?? 'create');
  return rank < 0 ? OPERATIONS.length : rank;
};

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

/**
 * Положить в каталог форму, с которой начинается правка: эталон сценария-затравки, собранный тем же
 * путём. Сценарий без затравки начинается с пустого каталога — функция ничего не делает.
 */
export async function writeSeedBundle({ scenario, target, directory, client }) {
  if (!scenario.seedScenario) return null;
  return writeReferenceBundle({ scenario: scenario.seedScenario, target, directory, client });
}

/** Собрать эталонный модуль сценария через сервер: intent на диск, затем `form_build`. */
export async function writeReferenceBundle({ scenario, target, directory, client }) {
  mkdirSync(directory, { recursive: true });
  await writeReferenceIntent({ scenario, target, directory, client });
  // Файлы, которые агент пишет руками (тела своих операторов): сборка их не трогает, только проверяет
  // типы. Путь источника — от каталога сценария.
  for (const [file, source] of Object.entries(scenario.referenceFiles ?? {})) {
    copyFileSync(path.resolve(scenario.directory, source), path.join(directory, file));
  }
  const { text } = await client.callTool('form_build', { dir: directory }, 180000);
  // Префикс ответа — контракт `form_build` (тест «ответ — контракт стендов», tests/form-build.test.ts).
  if (!text.startsWith('✓ form_build')) {
    throw new Error(`${scenario.id}/${target}: form_build —\n${text.slice(0, 2000)}`);
  }
  if (target === 'core') drawCoreForm(path.join(directory, 'index.tsx'));
  return { status: 'ok', text };
}
