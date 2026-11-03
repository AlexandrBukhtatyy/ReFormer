/**
 * Свойства компонентов ui-kit: props-схемы кита и проверка `componentProps` в intent по ним.
 *
 * Схемы — `defaultPropSchemas` из `@reformer/ui-kit/meta`, собранные из тех же `*.props.ts`, что и
 * `component-catalog.json`. Кит — опциональный peer сервера, поэтому модуль грузится лениво, а без
 * него проверка пропускается.
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
import { UI_KIT_FIELD_EXPORTS } from './ui-kit-components.js';

/** Props-схема компонента в форме JSON Schema: здесь нужны только имена свойств и строгость. */
export type PropsSchema = Record<string, unknown>;

/**
 * Форма модуля `@reformer/ui-kit/meta` (React-free): карта дефолтных props-схем + слияние с
 * контрактом обёртки поля.
 */
interface UiKitMetaMod {
  defaultPropSchemas?: Record<string, PropsSchema>;
  mergeFieldPropsSchema?: (schema: PropsSchema) => PropsSchema;
}

export interface UiKitPropSchemas {
  /** Схема дефолтного варианта по registry-имени. */
  defaults: Readonly<Record<string, PropsSchema>>;
  /**
   * Схема варианта вместе с пропсами обёртки (`label`, `required`, `testId`, …): поле рисуется
   * внутри `FormField`, и без слияния эти ключи считались бы чужими.
   */
  mergeField: (schema: PropsSchema) => PropsSchema;
}

/** Загрузить props-схемы кита. Нет пакета или он не собран → `undefined`. */
export async function loadUiKitPropSchemas(): Promise<UiKitPropSchemas | undefined> {
  try {
    const meta = (await import('@reformer/ui-kit/meta')) as UiKitMetaMod;
    const defaults = meta.defaultPropSchemas;
    if (!defaults || typeof defaults !== 'object' || Object.keys(defaults).length === 0) {
      return undefined;
    }
    const merge = meta.mergeFieldPropsSchema;
    return { defaults, mergeField: typeof merge === 'function' ? merge : (schema) => schema };
  } catch {
    return undefined;
  }
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
  const sites: PropsSite[] = intent.fields.map((f) => fieldSite(f, `поле «${f.name}»`));
  for (const array of intent.arrays) {
    sites.push({
      at: `массив «${array.name}»`,
      component: array.component ?? 'FieldArray',
      props: array.componentProps,
    });
    for (const f of array.itemFields) {
      sites.push(fieldSite(f, `поле «${f.name}» массива «${array.name}»`));
    }
  }
  const walk = (node: LayoutNode): void => {
    if (node.kind === 'step') node.children.forEach(walk);
    if (node.kind !== 'container') return;
    // Корень визарда рисует `FormWizard`, а `$html(...)` — тег: схемы кита к ним не относятся.
    if (!isWizardContainer(node) && !node.htmlTag) {
      sites.push({
        at: `контейнер «${node.selector ?? node.component}»`,
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
 * законен. Компонент без схемы в ките (свой, `FieldArray`) пропускается.
 *
 * @returns По строке на место с чужими ключами: что не так и какие свойства у компонента есть.
 */
export function checkComponentProps(intent: FormIntent, kit: UiKitPropSchemas): string[] {
  const notes: string[] = [];
  for (const site of collectSites(intent)) {
    if (!site.props) continue;
    const own = kit.defaults[site.component];
    if (!own || own.additionalProperties !== false) continue;
    const schema = UI_KIT_FIELD_EXPORTS[site.component] ? kit.mergeField(own) : own;
    const known = Object.keys((schema.properties as Record<string, unknown> | undefined) ?? {});
    const unknown = Object.keys(site.props).filter(
      (key) => !known.includes(key) && !DOM_ATTRIBUTE.test(key)
    );
    if (unknown.length === 0) continue;
    const names = unknown.map((key) => `«${key}»`).join(', ');
    notes.push(
      `${site.at}: у ${site.component} нет ${unknown.length === 1 ? 'свойства' : 'свойств'} ` +
        `${names} в componentProps. Есть: ${known.join(', ')}.`
    );
  }
  return notes;
}
