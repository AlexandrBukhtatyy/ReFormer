/**
 * Модуль формы (`model.ts`, `form.validation.ts`, `form.flow.ts`, `form.behavior.ts`,
 * `form.schema.ts` либо документ `form.schema.json` у renderer-json, `registry.ts`) как живые
 * значения — без браузера. Модуль конструктора (папки ролей, запись реестра форм
 * `application/entry.ts`) читается через {@link loadRegistryEntry} в те же значения.
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
  // renderer-json держит схему данными — документ приходит экспортом по умолчанию.
  const formSchema = fileNames.includes('form.schema.json')
    ? (await importFile('form.schema.json')).default
    : (await optional('form.schema.ts')).formSchema;
  const { createRegistry } = await optional('registry.ts');
  return withRuleSchemas({
    createFormModel,
    formValidation,
    formFlow,
    formBehavior,
    formSchema,
    createRegistry,
  });
}

/**
 * Спека с шагами даёт визард: правила шагов уходят в поток, а `formValidation` держит только
 * правила вне шагов (`extras`). Форма проверяется целиком — всеми схемами сразу.
 *
 * `formValidation` бывает трёх видов: схема-функция (`defineValidation`), правила мастера вне шагов
 * (`{ extras }`) и валидация сборки со стратегией (`{ rules, strategy }` — так её пишет кодоген
 * конструктора).
 */
function withRuleSchemas(parts) {
  const flowSteps = parts.formFlow?.steps ?? [];
  const validation = parts.formValidation;
  return {
    ...parts,
    ruleSchemas: [
      ...flowSteps.map((step) => step.rules),
      typeof validation === 'function' ? validation : (validation?.extras ?? validation?.rules),
    ].filter((schema) => typeof schema === 'function'),
  };
}

/** Файл записи реестра форм в модуле конструктора — его точка входа. */
export const REGISTRY_ENTRY_FILE = 'application/entry.ts';

/**
 * Модуль конструктора как живые значения: запись реестра форм (`FormEntry` из
 * `@reformer/form-registry`) уже держит схему, модель, поведение, валидацию и поток — части,
 * которые модуль MCP раскладывает по файлам. Части записи — `{ kind: 'inline', value }`;
 * поведение — фабрика настроек места монтирования, здесь — без них.
 *
 * @param {(file: string) => Promise<Record<string, any>>} importFile
 */
export async function loadRegistryEntry(importFile) {
  const exported = Object.values(await importFile(REGISTRY_ENTRY_FILE));
  const entry = exported.find(
    (value) => value && typeof value === 'object' && value.schema && value.model
  );
  if (!entry) throw new Error(`${REGISTRY_ENTRY_FILE} не экспортирует запись FormEntry`);
  const inline = (part) => (part?.kind === 'inline' ? part.value : undefined);
  const behavior = inline(entry.behavior);
  const registry = inline(entry.registry);
  return withRuleSchemas({
    createFormModel: inline(entry.model),
    formValidation: inline(entry.validation),
    formFlow: inline(entry.flow),
    formBehavior: typeof behavior === 'function' ? behavior({}) : behavior,
    formSchema: inline(entry.schema),
    createRegistry: registry === undefined ? undefined : () => registry,
  });
}

/**
 * Проходит ли модель все правила формы. Схемы гоняются все, без раннего выхода: замечания каждой
 * должны дойти до узлов.
 */
export async function checkAllRules(validateModel, model, ruleSchemas) {
  const results = await Promise.all(ruleSchemas.map((schema) => validateModel(model, schema)));
  return results.every(Boolean);
}
