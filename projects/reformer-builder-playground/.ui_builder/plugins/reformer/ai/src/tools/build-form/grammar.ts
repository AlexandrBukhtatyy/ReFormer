/**
 * Грамматика intent `build_form` — её отдаёт вызов без `intent`.
 *
 * Текст — профиль `document` грамматики сервиса ReFormer (`intent_grammar`, `../../service`): тот
 * же словарь, что у `form_build` MCP, без таргета, разметки JSX, начальных значений и кода модуля,
 * которых документ билдера не держит. Своё здесь только то, что знает билдер: куда ляжет собранное
 * и как собирается большой визард.
 *
 * @module plugins/reformer/ai/tools/build-form/grammar
 */

import { arrayName, type Catalog } from '../../model/catalog-digest';

/**
 * Наибольший визард одним intent. Крупнее — по шагам: форму на 82 поля локальная модель писала
 * одним ответом 32 минуты и ещё 16 — сам вызов, и всё это время ход молчал (замер 2026-11-03,
 * qwen3.8:27b). Визард до шести шагов и сорока полей — обычная анкета, и сборка по шагам стоила бы
 * ей лишних ходов.
 */
export const WIZARD_MAX_STEPS = 6;
export const WIZARD_MAX_FIELDS = 40;

/** Первый вызов большого визарда — одни шаги; поля приходят следующими вызовами в адрес шага. */
export const BUILD_FORM_STEPS_EXAMPLE = { steps: [{ title: 'Client' }, { title: 'Order' }] };

/** Текст без раздела `## <name>` — до следующего раздела. */
function withoutSection(text: string, name: string): string {
  return text.replace(new RegExp(`\\n## ${name}\\b[\\s\\S]*?(?=\\n## )`), '');
}

/**
 * Грамматика для кита: профиль документа от сервиса и то, куда ляжет собранное. Кит без компонента
 * массива раздела о массивах не получает: грамматика, предлагающая то, чего кит не нарисует, хуже
 * молчащей.
 *
 * @param document - Грамматика сервиса для этого кита (`FormCompiler.grammar`).
 */
export function buildFormGrammar(catalog: Catalog, document: string): string {
  const text = arrayName(catalog) === undefined ? withoutSection(document, 'arrays') : document;
  return `${text}
## Where it lands
No parent — the whole form, only if it was empty at the start of the turn; call again to rebuild. parent — a step or section address: appended there; the wizard: new steps.
A wizard over ${WIZARD_MAX_STEPS} steps or ${WIZARD_MAX_FIELDS} fields: first ${JSON.stringify(BUILD_FORM_STEPS_EXAMPLE)}, then one build_form per step, parent = its address.
`;
}
