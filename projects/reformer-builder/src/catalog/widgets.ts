/**
 * Дайджест `propsSchema` → модель инспектора (спека §8: «поля из props-схемы, виджет по `x-doc.kind`»).
 * Чистые view-функции: `x-runtimeProps` не читаются (скрыты в инспекторе, §5), виджет берётся из
 * `x-doc.kind` либо выводится из `enum`/`type`, границы/дефолт/подсказка — из стандартных ключей
 * JSON Schema, секции — из `x-doc.group`.
 *
 * @module reformer-builder/catalog/widgets
 */

import type { PropsSchema, PropWidget } from '@reformer/ui-kit/meta';
import type { InspectorGroup, InspectorProp, PropGroup } from './types';

/** Порядок секций инспектора. */
const GROUP_ORDER: PropGroup[] = ['Control', 'Options', 'Textfield', 'Behavior', 'State'];

/** Пропы `propsSchema` → плоский список для инспектора (без `x-runtimeProps`). */
export function toInspectorProps(schema: PropsSchema): InspectorProp[] {
  const properties = (schema.properties ?? {}) as Record<string, PropsSchema>;
  const out: InspectorProp[] = [];
  for (const [key, prop] of Object.entries(properties)) {
    const doc = prop['x-doc'];
    out.push({
      key,
      label: humanize(key),
      // className → builder-редактор Tailwind; Options-группа → редактор DataSource/инлайн-опций
      // (поверх x-doc.kind:'readonly' из ui-kit); иначе виджет по kind/типу.
      widget:
        key === 'className'
          ? 'className'
          : doc?.group === 'Options'
            ? 'dataSource'
            : (doc?.kind ?? inferWidget(prop)),
      group: doc?.group ?? 'Control',
      description: typeof prop.description === 'string' ? prop.description : undefined,
      default: prop.default,
      options: Array.isArray(prop.enum) ? (prop.enum as Array<string | number>) : undefined,
      min: typeof prop.minimum === 'number' ? prop.minimum : undefined,
      max: typeof prop.maximum === 'number' ? prop.maximum : undefined,
      step: typeof prop.multipleOf === 'number' ? prop.multipleOf : undefined,
    });
  }
  return out;
}

/** Сгруппировать пропы по секциям инспектора (в порядке {@link GROUP_ORDER}). */
export function groupInspectorProps(props: InspectorProp[]): InspectorGroup[] {
  const byGroup = new Map<PropGroup, InspectorProp[]>();
  for (const p of props) {
    const list = byGroup.get(p.group) ?? [];
    list.push(p);
    byGroup.set(p.group, list);
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    props: byGroup.get(g)!,
  }));
}

/** Пропы `propsSchema`, сразу сгруппированные для инспектора. */
export function inspectorGroups(schema: PropsSchema): InspectorGroup[] {
  return groupInspectorProps(toInspectorProps(schema));
}

/** Виджет по типу пропа, когда `x-doc.kind` не задан. */
function inferWidget(prop: PropsSchema): PropWidget {
  if (Array.isArray(prop.enum)) return 'enum';
  const type = prop.type;
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'integer') return 'number';
  return 'text';
}

/** `camelCase`/`snake` → «Title Case» подпись. */
function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
