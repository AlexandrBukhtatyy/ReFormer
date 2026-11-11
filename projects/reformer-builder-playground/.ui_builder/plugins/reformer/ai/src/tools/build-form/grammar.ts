/**
 * Грамматика intent `build_form` — её отдаёт вызов без `intent`.
 *
 * Текст — профиль `document` грамматики MCP (`intentGrammar`): тот же словарь, что у `form_build`,
 * без таргета, разметки JSX, начальных значений и кода модуля, которых документ билдера не держит.
 * Раньше грамматика была своя — без `computeFrom`, `exclusiveFlag` и `aggregateInto`, со своим
 * словарём ошибок — и расходилась с MCP (аудит 2026-11, D3). Своё здесь только то, что знает
 * билдер: куда ляжет собранное и как собирается большой визард.
 *
 * Образец грамматики — `DOCUMENT_GRAMMAR_EXAMPLE` MCP, и тест собирает его настоящим `build_form` на
 * ките: текст-образец без такой проверки уже подводил (план mcp-misty-graham, фаза 0).
 *
 * @module plugins/reformer/ai/tools/build-form/grammar
 */

import {
  intentGrammar,
  NO_CORE_OPERATORS,
  uiKitFromCatalog,
  uiKitPropsFromCatalog,
  type FormCatalogs,
} from '@reformer/mcp/intent';
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

/**
 * Справочники судьи и грамматики из каталога кита: компоненты и их props-схемы — из одного
 * каталога, как у `form_build`. Индекса ядра у билдера нет: правила по именам не сверяются, а
 * грамматика называет ходовые.
 */
export function catalogsOf(catalog: Catalog): FormCatalogs {
  const json = { components: catalog };
  return {
    uiKit: uiKitFromCatalog(json),
    uiKitProps: uiKitPropsFromCatalog(json),
    core: NO_CORE_OPERATORS,
  };
}

/** Текст без раздела `## <name>` — до следующего раздела. */
function withoutSection(text: string, name: string): string {
  return text.replace(new RegExp(`\\n## ${name}\\b[\\s\\S]*?(?=\\n## )`), '');
}

/**
 * Грамматика для кита: профиль документа MCP и то, куда ляжет собранное. Кит без компонента массива
 * раздела о массивах не получает: грамматика, предлагающая то, чего кит не нарисует, хуже молчащей.
 */
export function buildFormGrammar(catalog: Catalog): string {
  const document = intentGrammar(catalogsOf(catalog), { profile: 'document' });
  const text = arrayName(catalog) === undefined ? withoutSection(document, 'arrays') : document;
  return `${text}
## Where it lands
No parent — the whole form, only if it was empty at the start of the turn; call again to rebuild. parent — a step or section address: appended there; the wizard: new steps.
A wizard over ${WIZARD_MAX_STEPS} steps or ${WIZARD_MAX_FIELDS} fields: first ${JSON.stringify(BUILD_FORM_STEPS_EXAMPLE)}, then one build_form per step, parent = its address.
`;
}
