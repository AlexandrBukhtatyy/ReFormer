/**
 * Стадия headless верификатора. Запускается отдельным процессом под `node --import tsx` с таймаутом:
 * код проверяемой формы может зависнуть или упасть при импорте.
 *
 * Аргументы: каталог бандла и файл контракта. Итог — JSON последней строкой stdout.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkAllRules, loadFormModule, tick } from '../lib/form-runtime.mjs';
import { bindFields, checkStructure, modelPaths, runProbes, schemaLabels } from './probes.mjs';

const [bundleDirectory, contractFile] = process.argv.slice(2);
const contract = JSON.parse(readFileSync(contractFile, 'utf8'));
const checks = {};

function finish(extra = {}) {
  process.stdout.write(`\n${JSON.stringify({ checks, ...extra })}\n`);
  process.exit(0);
}

const fileNames = readdirSync(bundleDirectory);
if (!fileNames.includes('model.ts')) {
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
  formModule = await loadFormModule(
    (file) => import(pathToFileURL(path.join(bundleDirectory, file)).href),
    fileNames
  );
  if (typeof formModule.createFormModel !== 'function') {
    checks['runtime.load'] = ['fail', 'nonCanonical: model.ts не экспортирует createFormModel'];
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
  const bound = bindFields(contract, paths, schemaLabels(schemaTree, probeInstance.model));
  Object.assign(checks, checkStructure(contract, paths, bound, formModule.formFlow?.steps));
  probeInstance.dispose();
  Object.assign(checks, await runProbes({ contract, bound, createInstance }));
  finish({ bound });
} catch (error) {
  checks['runtime.form'] = ['fail', `сборка формы: ${error?.message ?? error}`.slice(0, 200)];
  finish();
}
