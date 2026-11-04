/**
 * План вставки `build_form`: документ формата 2, собранный MCP из intent (`buildSchemaLayout`), в
 * именах активного кита.
 *
 * Документ MCP пишется для библиотечной сборки: визард — `FormWizard`, шаг — `Step`, строка массива
 * — именованная часть из `$html(div)`, у полей корня — производные `testId`. Билдер хранит то же
 * дерево иначе: визард и шаг — записи каталога кита, строка массива — `item.$template` самого узла
 * массива. Здесь только перевод имён и формы; узлы строит фабрика каталога через `insert_node`
 * (`./index`), второго механизма создания узлов нет.
 *
 * @module plugins/reformer/ai/tools/build-form/plan
 */

import type { SchemaDocNode, SchemaDocument } from '@reformer/mcp/intent';
import { arrayName, wizardNames, type Catalog } from '../../model/catalog-digest';

/** Узел плана: то, что примет `insert_node`, плюс содержимое, которое ляжет следующими вызовами. */
export interface PlanNode {
  /** Имя компонента в каталоге кита. */
  readonly component: string;
  /** Путь модели, голый: `applicant.email`. */
  readonly model?: string;
  readonly props?: Readonly<Record<string, unknown>>;
  /** Дети: шаги визарда, поля шага или секции. */
  readonly children: readonly PlanNode[];
  /** Поля строки массива — встают в `item.$template` узла массива, а не в `children`. */
  readonly rows: readonly PlanNode[];
  /** Селектор узла в intent — по нему правило видимости находит свою цель. */
  readonly selector?: string;
}

/** Свойства, которые MCP выводит сам и которые билдеру не нужны: `testId` ставит генерация. */
const DERIVED_PROPS = new Set(['testId']);

const OPERATOR = /^\$(component|html|model|part)\((.*)\)$/;

/** Операнд оператора нужного вида: `$model(a.b)` → `a.b`; другой вид или не оператор — `undefined`. */
function operand(value: unknown, kind: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = OPERATOR.exec(value);
  return match?.[1] === kind ? match[2] : undefined;
}

/**
 * План документа либо отказ.
 *
 * Подформы (`kind: "part"`) не поддержаны: часть живёт в `parts` документа, а не под корнем, и
 * собрать её фабрикой каталога через `insert_node` нельзя. Модели предлагается обойтись полями
 * групп и вынести общую разметку `extract_part` уже после сборки.
 */
export function planOf(document: SchemaDocument, catalog: Catalog): PlanNode | { error: string } {
  const wizard = wizardNames(catalog);
  const array = arrayName(catalog);
  let error: string | null = null;

  const componentOf = (node: SchemaDocNode): string => {
    if (node.item !== undefined) return array ?? operand(node.component, 'component') ?? 'Array';
    const name = operand(node.component, 'component');
    if (name === undefined) return 'Box'; // `$html(div)` и узел без компонента — контейнер кита
    if (name === 'FormWizard') return wizard?.wizard ?? name;
    if (name === 'Step') return wizard?.step ?? name;
    return name;
  };

  const convert = (node: SchemaDocNode): PlanNode => {
    if (node.part !== undefined && node.item === undefined) {
      error ??=
        `Parts ("kind":"part") are not supported by build_form: give the group fields dotted ` +
        `names (address.city) and share the markup with extract_part after the build.`;
    }
    const row = operand(node.item, 'part');
    const rows = row === undefined ? [] : (document.parts?.[row]?.children ?? []);
    const props = Object.fromEntries(
      Object.entries(node.componentProps ?? {}).filter(([key]) => !DERIVED_PROPS.has(key))
    );
    // Вычисляемое поле MCP блокирует ключом узла; у `insert_node` тот же ключ — `_disabled`.
    if (node.disabled === true) props._disabled = true;
    const model = operand(node.model, 'model');
    return {
      component: componentOf(node),
      ...(model === undefined ? {} : { model }),
      ...(Object.keys(props).length > 0 ? { props } : {}),
      children: (node.children ?? []).map(convert),
      rows: rows.map(convert),
      ...(node.selector === undefined ? {} : { selector: node.selector }),
    };
  };

  const root = convert(document.root);
  return error === null ? root : { error };
}
