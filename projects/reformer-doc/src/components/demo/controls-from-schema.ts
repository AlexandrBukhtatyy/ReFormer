import type { ApiControl } from './types';
import type { PropsSchema, PropWidget } from '@reformer/ui-kit/meta';

/**
 * Строит `ApiControl[]` (таб API) из props-схемы варианта — единый источник вместо ручного `controls[]`.
 * Стандартные ключи JSON Schema (`description`/`default`/`enum`/`minimum`/`maximum`/`multipleOf`) +
 * `x-doc` (`group`/`type`/`kind`) + `x-runtimeProps` (seam: value/onChange/onBlur/disabled — идут первыми).
 *
 * Обычно вызывается как `controlsFromPropsSchema(mergeFieldPropsSchema(<variant>PropsSchema), { omit })`.
 * `omit` — props, задаваемые `baseComponentProps` (иначе проп без `default` попадёт в initialValues как
 * undefined и перетрёт их — ApiExplorer).
 */

const GROUP_ORDER = ['Control', 'Options', 'Textfield', 'Behavior', 'State'];

export interface ControlsFromSchemaOptions {
  omit?: string[];
}

/** Виджет из JSON-типа/enum, когда `x-doc.kind` не задан. */
function inferKind(schema: PropsSchema): PropWidget {
  if (schema.enum) return 'enum';
  const t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (t === 'boolean') return 'boolean';
  if (t === 'number' || t === 'integer') return 'number';
  if (t === 'string') return 'text';
  return 'readonly';
}

function buildControl(
  prop: string,
  type: string,
  group: string | undefined,
  description: string | undefined,
  kind: PropWidget,
  schema?: PropsSchema
): ApiControl {
  const head = { prop, type, description, group } as const;
  const def = schema?.default;
  switch (kind) {
    case 'boolean':
      return { ...head, kind, default: Boolean(def) };
    case 'text':
      return { ...head, kind, default: def == null ? '' : String(def) };
    case 'number': {
      const num = schema ?? {};
      return {
        ...head,
        kind,
        default: def == null ? 0 : Number(def),
        ...(typeof num.minimum === 'number' ? { min: num.minimum } : {}),
        ...(typeof num.maximum === 'number' ? { max: num.maximum } : {}),
        ...(typeof num.multipleOf === 'number' ? { step: num.multipleOf } : {}),
      };
    }
    case 'enum': {
      const options = (schema?.enum ?? []).map(String);
      return { ...head, kind, options, default: def == null ? (options[0] ?? '') : String(def) };
    }
    case 'readonly':
    default:
      return { ...head, kind: 'readonly', ...(def == null ? {} : { default: String(def) }) };
  }
}

export function controlsFromPropsSchema(
  schema: PropsSchema,
  options: ControlsFromSchemaOptions = {}
): ApiControl[] {
  const omit = new Set(options.omit ?? []);
  const controls: ApiControl[] = [];

  // 1. x-runtimeProps первыми (seam: Control-группа value/onChange/onBlur/disabled).
  const runtime = schema['x-runtimeProps'] ?? {};
  for (const [prop, doc] of Object.entries(runtime)) {
    if (omit.has(prop)) continue;
    const kind = doc.kind ?? 'readonly';
    controls.push(
      buildControl(prop, doc.type, doc.group, doc.description, kind, {
        default: doc.default,
      } as PropsSchema)
    );
  }

  // 2. properties (контракт componentProps: враппер + вариант).
  const properties = schema.properties ?? {};
  for (const [prop, p] of Object.entries(properties)) {
    if (omit.has(prop)) continue;
    const xdoc = p['x-doc'];
    if (!xdoc) continue; // без x-doc — не выносим в панель (внутренние/структурные поля)
    const kind = xdoc.kind ?? inferKind(p);
    controls.push(buildControl(prop, xdoc.type, xdoc.group, p.description, kind, p));
  }

  // 3. Стабильная сортировка по GROUP_ORDER (ApiExplorer группирует по первому появлению).
  return controls
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const ga = GROUP_ORDER.indexOf(a.c.group ?? '');
      const gb = GROUP_ORDER.indexOf(b.c.group ?? '');
      const oa = ga === -1 ? GROUP_ORDER.length : ga;
      const ob = gb === -1 ? GROUP_ORDER.length : gb;
      return oa - ob || a.i - b.i; // внутри группы — порядок появления
    })
    .map(({ c }) => c);
}
