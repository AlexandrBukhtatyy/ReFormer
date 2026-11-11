/**
 * Свойства компонентов ui-kit: props-схемы кита и проверка `componentProps` в intent по ним.
 *
 * Схемы — `propsSchema` записей `component-catalog.json` кита, того же каталога, из которого
 * генератор берёт имена и подпути компонентов. Раньше схемы читались отдельно из
 * `@reformer/ui-kit/meta` — от модуля сервера, а не от проекта, и там строгих схем было в пять раз
 * меньше (60 против 334): два источника расходились (ReFormer-zjqy). Схемы полей в каталоге уже
 * слиты с пропсами обёртки (`label`, `required`, `testId`, …).
 *
 * Зачем проверка в `form_build`. Грамматика intent показывает свойства только на примерах, а
 * выписать их для всех компонентов — раздуть ответ, который агент читает на каждой форме. Поэтому
 * список свойств агент получает тогда, когда ошибся: незнакомый ключ — предупреждение с тем, что у
 * компонента есть. Ошибкой это не делается: компоненты кита передают незнакомые свойства в DOM.
 *
 * @module reformer-mcp/core/generate/ui-kit-props
 */

import type { FieldIntent, FormIntent, LayoutNode } from './form-intent.js';
import { isWizardContainer } from './schema-emit.js';
import type { UiKitComponents } from './ui-kit-components.js';

/** Props-схема компонента в форме JSON Schema: здесь нужны только имена свойств и строгость. */
export type PropsSchema = Record<string, unknown>;

export interface UiKitPropSchemas {
  /** Схема компонента по registry-имени; у полей — вместе с пропсами обёртки. */
  defaults: Readonly<Record<string, PropsSchema>>;
}

/** Props-схемы из каталога кита. Каталога нет или в нём нет схем — `undefined`. */
export function uiKitPropsFromCatalog(json: unknown): UiKitPropSchemas | undefined {
  const components = (json as { components?: unknown } | null)?.components;
  if (!Array.isArray(components)) return undefined;
  const defaults: Record<string, PropsSchema> = {};
  for (const record of components) {
    const name = (record as { name?: unknown } | null)?.name;
    const schema = (record as { propsSchema?: unknown } | null)?.propsSchema;
    if (typeof name !== 'string' || typeof schema !== 'object' || schema === null) continue;
    defaults[name] = schema as PropsSchema;
  }
  return Object.keys(defaults).length > 0 ? { defaults } : undefined;
}

/** Атрибуты DOM, которые компонент передаёт дальше: их нет в схеме, и это не опечатка. */
const DOM_ATTRIBUTE = /^(data|aria)-/;

/** Место в intent, где стоят `componentProps`. */
interface PropsSite {
  /** Как назвать место в предупреждении: «поле «price»». */
  at: string;
  component: string;
  props: Record<string, unknown> | undefined;
}

function fieldSite(field: FieldIntent, at: string): PropsSite {
  return { at, component: field.component, props: field.componentProps };
}

/** Все `componentProps` intent: поля, массивы, строки массивов и контейнеры раскладки. */
function collectSites(intent: FormIntent): PropsSite[] {
  const sites: PropsSite[] = intent.fields.map((f) => fieldSite(f, `the field «${f.name}»`));
  for (const array of intent.arrays) {
    sites.push({
      at: `the array «${array.name}»`,
      component: array.component ?? 'FieldArray',
      props: array.componentProps,
    });
    for (const f of array.itemFields) {
      sites.push(fieldSite(f, `the field «${f.name}» of the array «${array.name}»`));
    }
  }
  const walk = (node: LayoutNode): void => {
    if (node.kind === 'step') node.children.forEach(walk);
    if (node.kind !== 'container') return;
    // Корень визарда рисует `FormWizard`, а `$html(...)` — тег: схемы кита к ним не относятся.
    if (!isWizardContainer(node) && !node.htmlTag) {
      sites.push({
        at: `the container «${node.selector ?? node.component}»`,
        component: node.component,
        props: node.componentProps,
      });
    }
    node.children.forEach(walk);
  };
  walk(intent.layoutRoot);
  for (const part of Object.values(intent.parts ?? {})) walk(part);
  return sites;
}

/**
 * Ключи `componentProps`, которых нет в props-схеме компонента.
 *
 * Проверяются только строгие схемы (`additionalProperties: false`) — у остальных незнакомый ключ
 * законен. Компонент без схемы в ките (свой, `FieldArray`) пропускается. Без каталога кита не
 * проверяется ничего: не отличить поле (его схема сливается с пропсами обёртки) от контейнера, и
 * `label` поля стал бы ложным замечанием.
 *
 * @param details - Куда за типами и значениями пропсов компонента: строка в конце замечания.
 * @returns По строке на место с чужими ключами: что не так и какие свойства у компонента есть.
 */
export function checkComponentProps(
  intent: FormIntent,
  kit: UiKitPropSchemas,
  components: UiKitComponents,
  details?: (component: string) => string
): string[] {
  const notes: string[] = [];
  if (!components.found) return notes;
  for (const site of collectSites(intent)) {
    if (!site.props) continue;
    const schema = kit.defaults[site.component];
    if (!schema || schema.additionalProperties !== false) continue;
    const known = Object.keys((schema.properties as Record<string, unknown> | undefined) ?? {});
    const unknown = Object.keys(site.props).filter(
      (key) => !known.includes(key) && !DOM_ATTRIBUTE.test(key)
    );
    if (unknown.length === 0) continue;
    const names = unknown.map((key) => `«${key}»`).join(', ');
    notes.push(
      `${site.at}: ${site.component} has no ${unknown.length === 1 ? 'prop' : 'props'} ` +
        `${names} in componentProps — they would go to the DOM. It has: ${known.join(', ')}.` +
        (details ? ` ${details(site.component)}` : '')
    );
  }
  return notes;
}
