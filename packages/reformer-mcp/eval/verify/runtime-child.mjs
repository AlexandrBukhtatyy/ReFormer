/**
 * Стадия headless верификатора. Запускается отдельным процессом под `node --import tsx` с таймаутом:
 * код проверяемой формы может зависнуть или упасть при импорте.
 *
 * Аргументы: каталог бандла и файл контракта. Итог — JSON последней строкой stdout.
 */

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkAllRules,
  loadFormModule,
  loadRegistryEntry,
  REGISTRY_ENTRY_FILE,
  tick,
} from '../lib/form-runtime.mjs';
import { readContract } from './contract.mjs';
import {
  bindFields,
  checkStructure,
  modelPaths,
  runProbes,
  schemaLabels,
  schemaSteps,
} from './probes.mjs';

const [bundleDirectory, contractFile] = process.argv.slice(2);
const contract = readContract(contractFile);
const checks = {};

function finish(extra = {}) {
  process.stdout.write(`\n${JSON.stringify({ checks, ...extra })}\n`);
  process.exit(0);
}

const fileNames = readdirSync(bundleDirectory);
// Модуль конструктора — папки ролей и запись реестра форм; модуль MCP — плоский набор файлов.
const builder = existsSync(path.join(bundleDirectory, REGISTRY_ENTRY_FILE));
if (!builder && !fileNames.includes('model.ts')) {
  // Сервер требует канон раскладки; не последовавший ему агент — дефект пути, который сервер предложил.
  checks['runtime.load'] = ['fail', 'nonCanonical: в бандле нет model.ts'];
  finish({ nonCanonical: true });
}

let formModule;
let core;
let validation;
try {
  core = await import('@reformer/core');
  validation = await import('@reformer/core/validation');
  const importFile = (file) => import(pathToFileURL(path.join(bundleDirectory, file)).href);
  formModule = builder
    ? await loadRegistryEntry(importFile)
    : await loadFormModule(importFile, fileNames);
  if (typeof formModule.createFormModel !== 'function') {
    checks['runtime.load'] = [
      'fail',
      builder
        ? `nonCanonical: в записи ${REGISTRY_ENTRY_FILE} нет фабрики модели`
        : 'nonCanonical: model.ts не экспортирует createFormModel',
    ];
    finish({ nonCanonical: true });
  }
  formModule.createFormModel();
  checks['runtime.load'] = 'pass';
} catch (error) {
  checks['runtime.load'] = ['fail', `загрузка: ${error?.message ?? error}`.slice(0, 200)];
  finish();
}

/** Экземпляр формы — такой же сборкой, как в `index.tsx`, включая схему и поток. */
function createInstance() {
  const bundle = core.createForm({
    model: formModule.createFormModel(),
    ...(formModule.formSchema ? { schema: formModule.formSchema } : {}),
    ...(formModule.formBehavior ? { behavior: formModule.formBehavior } : {}),
    ...(formModule.formValidation ? { validation: formModule.formValidation } : {}),
    ...(formModule.formFlow ? { flow: formModule.formFlow } : {}),
    ...(formModule.createRegistry ? { registry: formModule.createRegistry() } : {}),
  });
  return {
    model: bundle.model,
    form: bundle.form,
    // Весь набор правил сразу: и у визарда, где правила разложены по шагам.
    validate: () => checkAllRules(validation.validateModel, bundle.model, formModule.ruleSchemas),
    // Правила одного шага (номер с 1) — то, что проверяет переход «Далее».
    validateStep: (step) => {
      const rules = formModule.formFlow?.steps?.[step - 1]?.rules;
      if (typeof rules !== 'function') throw new Error(`в форме нет шага ${step}`);
      return checkAllRules(validation.validateModel, bundle.model, [rules]);
    },
    dispose: () => bundle.dispose(),
  };
}

try {
  const probeInstance = createInstance();
  await tick();
  const values = JSON.parse(JSON.stringify(probeInstance.model));
  const paths = modelPaths(values);
  const schemaTree =
    typeof formModule.formSchema === 'function'
      ? formModule.formSchema(probeInstance.model)
      : formModule.formSchema;
  const labels = schemaLabels(schemaTree, probeInstance.model);
  const bound = bindFields(contract, paths, labels);
  const steps = schemaSteps(schemaTree, probeInstance.model, formModule.formFlow?.steps);
  Object.assign(
    checks,
    checkStructure(contract, paths, bound, formModule.formFlow?.steps, { labels, steps })
  );
  probeInstance.dispose();
  Object.assign(checks, await runProbes({ contract, bound, createInstance }));
  finish({ bound });
} catch (error) {
  checks['runtime.form'] = ['fail', `сборка формы: ${error?.message ?? error}`.slice(0, 200)];
  finish();
}
