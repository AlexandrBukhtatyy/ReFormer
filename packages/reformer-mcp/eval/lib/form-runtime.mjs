/**
 * Модуль формы (`model.ts`, `form.validation.ts`, `form.flow.ts`, `form.behavior.ts`,
 * `form.schema.ts`, `registry.ts`) как живые значения — без браузера.
 *
 * Общий для `tests/form-from-spec.test.ts` и верификатора. Способ загрузки внедряется: в тесте файлы
 * импортирует vite, в верификаторе — `tsx`.
 */

/** Дать эффектам ядра сработать: реактивные связи применяются не синхронно. */
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Загрузить части модуля. Отсутствующий необязательный файл — `undefined`.
 *
 * @param {(file: string) => Promise<Record<string, any>>} importFile
 * @param {string[]} fileNames - имена файлов каталога модуля
 */
export async function loadFormModule(importFile, fileNames) {
  // Агент вправе написать файл с JSX, и расширение тогда другое: без схемы форма соберётся не той.
  const optional = async (file) => {
    const name = [file, `${file}x`].find((candidate) => fileNames.includes(candidate));
    return name ? importFile(name) : {};
  };

  const { createFormModel } = await importFile('model.ts');
  const { formValidation } = await optional('form.validation.ts');
  const { formFlow } = await optional('form.flow.ts');
  const { formBehavior } = await optional('form.behavior.ts');
  const { formSchema } = await optional('form.schema.ts');
  const { createRegistry } = await optional('registry.ts');
  const flowSteps = formFlow?.steps ?? [];

  return {
    createFormModel,
    formValidation,
    formFlow,
    formBehavior,
    formSchema,
    createRegistry,
    // Спека с шагами даёт визард: правила шагов уходят в поток, а `formValidation` держит только
    // правила вне шагов (`extras`). Форма проверяется целиком — всеми схемами сразу.
    ruleSchemas: [
      ...flowSteps.map((step) => step.rules),
      typeof formValidation === 'function' ? formValidation : formValidation?.extras,
    ].filter((schema) => typeof schema === 'function'),
  };
}

/**
 * Проходит ли модель все правила формы. Схемы гоняются все, без раннего выхода: замечания каждой
 * должны дойти до узлов.
 */
export async function checkAllRules(validateModel, model, ruleSchemas) {
  const results = await Promise.all(ruleSchemas.map((schema) => validateModel(model, schema)));
  return results.every(Boolean);
}
