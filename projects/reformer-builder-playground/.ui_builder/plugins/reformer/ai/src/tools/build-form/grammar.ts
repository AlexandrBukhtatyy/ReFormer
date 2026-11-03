/**
 * Грамматика intent `build_form` — её отдаёт вызов без `intent`.
 *
 * Строки примеров берутся из {@link BUILD_FORM_EXAMPLE}, а тест собирает этот intent настоящим
 * `build_form` на каждом ките: текст-образец без такой проверки уже подводил в MCP — правдоподобный
 * пример `copyFrom` на группу ронял каждый прогон (план mcp-misty-graham, фаза 0).
 *
 * По-английски — как промпт и описания инструментов. Имена полей кита подставляются из каталога:
 * грамматика, называющая чужие имена, хуже молчащей.
 *
 * @module plugins/reformer/ai/tools/build-form/grammar
 */

import { arrayName, listComponents, type Catalog } from '../../model/catalog-digest';

/** Рабочая форма, на которой показана вся грамматика. Имена компонентов есть в обоих китах. */
export const BUILD_FORM_EXAMPLE = {
  fields: [
    { name: 'email', component: 'Input', label: 'Email', required: true },
    { name: 'kind', component: 'Select', label: 'Client type', optionsSource: 'KINDS' },
    { name: 'inn', component: 'Input', label: 'INN' },
    { name: 'sameEmail', component: 'Checkbox', label: 'Send the invoice to the same email' },
    { name: 'billingEmail', component: 'Input', label: 'Invoice email' },
    { name: 'price', component: 'InputNumber', label: 'Price' },
    { name: 'qty', component: 'InputNumber', label: 'Quantity' },
    { name: 'total', component: 'InputNumber', label: 'Total' },
  ],
  arrays: [
    {
      name: 'children',
      componentProps: { title: 'Children' },
      itemFields: [{ name: 'name', component: 'Input', label: 'Name', required: true }],
    },
  ],
  steps: [
    { title: 'Client', fields: ['email', 'kind', 'inn'] },
    { title: 'Order', fields: ['price', 'qty', 'total', 'sameEmail', 'billingEmail', 'children'] },
  ],
  validation: [
    { target: 'email', rules: ['email'] },
    { target: 'inn', rules: ['required'], when: "model.kind === 'company'" },
    { target: 'qty', rules: ['min(1)', 'max(100)'] },
    {
      target: 'billingEmail',
      rules: [],
      cross: 'values.billingEmail !== values.inn',
      message: 'Must differ from INN',
    },
  ],
  behavior: [
    {
      kind: 'compute',
      target: 'total',
      sources: ['price', 'qty'],
      expr: '(model.price ?? 0) * (model.qty ?? 0)',
    },
    {
      kind: 'copyFrom',
      target: 'billingEmail',
      sources: ['email'],
      expr: 'model.sameEmail === true',
    },
    { kind: 'enableWhen', target: 'inn', sources: ['kind'], expr: "model.kind === 'company'" },
  ],
  visibility: [{ selector: 'billingEmail', condition: 'model.sameEmail === true' }],
  dataSources: [
    {
      name: 'KINDS',
      values: [
        { value: 'person', label: 'Person' },
        { value: 'company', label: 'Company' },
      ],
    },
  ],
};

const json = (value: unknown): string => JSON.stringify(value);

/** Грамматика для кита: имена его полей и, если кит рисует массив, строка про массивы. */
export function buildFormGrammar(catalog: Catalog): string {
  const fields = listComponents(catalog, { role: 'field' }).map((c) => c.name);
  const { validation, behavior } = BUILD_FORM_EXAMPLE;
  const arrays =
    arrayName(catalog) === undefined
      ? ''
      : `\n## arrays — repeated rows\n${json(BUILD_FORM_EXAMPLE.arrays[0])}\n` +
        'Rules of a row: "each":"children", target is the row field.\n';
  return `# build_form intent

One object — fields, layout and rules of a whole form, a step or a block. Compact JSON.
{"fields":[…],"arrays":[…],"steps":[…],"validation":[…],"behavior":[…],"visibility":[…],"dataSources":[…]}

Where it lands: no parent — the whole form, only if the form was empty at the start of the turn
(call again to rebuild it from a corrected intent). parent = a step or section address — appended
there. parent = the wizard — new steps.
Big form: first the steps with empty "fields", then one build_form per step, parent = the step
address from the reply. Rules may name fields built earlier.

## fields
${json(BUILD_FORM_EXAMPLE.fields[0])}
${json(BUILD_FORM_EXAMPLE.fields[1])}
- component: ${fields.join(' ')}.
- A group field has a dotted name: "address.city". Other props go to "componentProps".
${arrays}
## steps — a wizard; omit for a form without steps
${json(BUILD_FORM_EXAMPLE.steps[0])}
Every field and array stands in exactly one step. Sections without a wizard: "layoutRoot"
{"kind":"container","component":"Box","children":["email",{"kind":"container","component":"Section","componentProps":{"title":"Passport"},"children":["series","number"]}]}

## validation
${json(validation[0])}
- rules: required email minLength(n) maxLength(n) min(n) max(n) pattern(/re/).
- Condition: ${json(validation[1])}
- Between fields (true when valid): ${json(validation[3])}

## behavior — expr is TypeScript over model, sources are the fields it reads
${json(behavior[0])}
${json(behavior[1])} — expr: when to copy.
${json(behavior[2])}
Also: disableWhen resetWhen onChange transformValue syncFields revalidateWhen. Check numbers for null.

## visibility and dataSources
${json(BUILD_FORM_EXAMPLE.visibility[0])} — HIDDEN while true; selector is the field name.
${json(BUILD_FORM_EXAMPLE.dataSources[0])}

The build checks the intent, not the task: compare it with the request before you finish.`;
}
