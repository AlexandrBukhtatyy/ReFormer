/**
 * Тема RJSF из кита: виджеты — поля кита, шаблоны — его рамка поля, контейнер и кнопка.
 *
 * Сопоставление по умолчанию ({@link DEFAULT_WIDGET_CANDIDATES}) опирается на общие имена записей
 * каталога — поэтому тему получает любой кит без строчки кода под RJSF. Кит, у которого имена
 * другие или роли распределены иначе, уточняет сопоставление блоком `kit.renderers.rjsf`.
 *
 * Каждое поле кита — ещё и виджет под своим именем: `"ui:widget": "Switch"` в `uiSchema` рисует
 * переключатель кита, даже если флажком по умолчанию стал `Checkbox`.
 *
 * Чего в ките не нашлось, остаётся стандартным RJSF — форма рисуется всегда, а расхождения
 * перечислены в `problems`.
 *
 * @module @reformer/rjsf-kit-theme/theme
 */

import type { ComponentType } from 'react';
import type { ThemeProps } from '@rjsf/core';
import type { KitFieldFrameProps, KitThemeInput, KitThemeProblem, KitThemeRecord } from './types';
import { createFieldTemplate, createObjectTemplate, createSubmitButton } from './templates';
import {
  DEFAULT_WIDGET_CANDIDATES,
  isComponent,
  isInlineLabel,
  kitWidget,
  type KitWidgetCandidate,
} from './widgets';

type AnyComponent = ComponentType<Record<string, unknown>>;
type Widgets = NonNullable<ThemeProps['widgets']>;
type Widget = Widgets[string];

export interface KitTheme {
  /** Тема для `withTheme` из `@rjsf/core`. Кита нет — пустая, то есть стандартная тема RJSF. */
  readonly theme: ThemeProps;
  /** Поля кита, доступные виджетами под своими именами (`"ui:widget": "Switch"`). */
  readonly componentWidgets: readonly string[];
  /** Что осталось стандартным RJSF и почему. */
  readonly problems: readonly KitThemeProblem[];
}

/** Шаблон объекта и кнопка отправки по умолчанию — общие имена записей китов. */
const DEFAULT_OBJECT = 'Box';
const DEFAULT_SUBMIT = 'Button';

interface Resolved {
  readonly component: AnyComponent;
  readonly record: KitThemeRecord | undefined;
}

/** Контрол принимает варианты выбора — по схеме пропсов записи; схемы нет — не известно. */
function acceptsOptions(record: KitThemeRecord | undefined): boolean | undefined {
  const properties = record?.propsSchema?.properties;
  return typeof properties === 'object' && properties !== null
    ? 'options' in properties
    : undefined;
}

/**
 * Собирает тему RJSF из кита.
 *
 * @example
 * ```tsx
 * import { withTheme } from '@rjsf/core';
 * import validator from '@rjsf/validator-ajv8';
 * import * as kit from '@reformer/ui-kit';
 * import catalog from '@reformer/ui-kit/component-catalog.json';
 *
 * const { theme } = createKitTheme({
 *   namespace: kit,
 *   components: catalog.components,
 *   slots: catalog.kit.infra,
 *   ...catalog.kit.renderers?.rjsf,
 * });
 * const Form = withTheme(theme);
 * <Form schema={schema} validator={validator} />;
 * ```
 */
export function createKitTheme(input: KitThemeInput): KitTheme {
  const { namespace, components } = input;
  if (Object.keys(namespace).length === 0) {
    return { theme: {}, componentWidgets: [], problems: [] };
  }
  const problems: KitThemeProblem[] = [];
  const records = new Map(components.map((record) => [record.name, record]));

  /** Имя записи каталога или экспорта → компонент кита. */
  const resolve = (name: string): Resolved | undefined => {
    const record = records.get(name);
    const value = namespace[record?.exportName ?? name] ?? namespace[name];
    return isComponent(value) ? { component: value, record } : undefined;
  };
  /** Компонент, который кит назвал явно: не нашёлся — это расхождение, а не умолчание. */
  const resolveNamed = (target: string, name: string | undefined): Resolved | undefined => {
    if (name === undefined) return undefined;
    const found = resolve(name);
    if (found === undefined) problems.push({ code: 'component-missing', target, component: name });
    return found;
  };

  const widgets: Record<string, Widget> = {};
  const inlineWidgets = new Set<string>();
  /** Виджеты ролей без постоянных пропсов — их переиспользуют виджеты под именем записи. */
  const plainSlots: { component: AnyComponent; widget: Widget; slot: string }[] = [];

  for (const [slot, candidates] of Object.entries(DEFAULT_WIDGET_CANDIDATES)) {
    const named = resolveNamed(slot, input.widgets?.[slot]);
    let chosen: (Resolved & { props?: KitWidgetCandidate['props'] }) | undefined = named;
    for (const candidate of named === undefined ? candidates : []) {
      const found = resolve(candidate.component);
      if (found !== undefined && found.record?.role !== 'container') {
        chosen = { ...found, props: candidate.props };
        break;
      }
    }
    if (chosen === undefined) {
      problems.push({ code: 'widget-default', widget: slot });
      continue;
    }
    const widget = kitWidget(chosen.component, {
      name: chosen.record?.name ?? slot,
      slot,
      acceptsOptions: acceptsOptions(chosen.record),
      props: chosen.props,
    });
    widgets[slot] = widget;
    if (isInlineLabel(chosen.component)) inlineWidgets.add(slot);
    if (chosen.props === undefined) plainSlots.push({ component: chosen.component, widget, slot });
  }

  // Уточнения кита сверх ролей по умолчанию (`FileWidget`, свои виджеты) — как есть.
  for (const [slot, name] of Object.entries(input.widgets ?? {})) {
    if (slot in DEFAULT_WIDGET_CANDIDATES) continue;
    const found = resolveNamed(slot, name);
    if (found === undefined) continue;
    widgets[slot] = kitWidget(found.component, {
      name,
      slot,
      acceptsOptions: acceptsOptions(found.record),
    });
    if (isInlineLabel(found.component)) inlineWidgets.add(slot);
  }

  const componentWidgets: string[] = [];
  for (const record of components) {
    if (record.role !== 'field' || record.name in widgets) continue;
    const found = resolve(record.name);
    if (found === undefined) {
      problems.push({ code: 'component-missing', target: record.name, component: record.name });
      continue;
    }
    // Поле, уже ставшее виджетом роли, — тот же виджет: и мост, и перевод значения те же.
    const same = plainSlots.find((entry) => entry.component === found.component);
    widgets[record.name] =
      same?.widget ??
      kitWidget(found.component, {
        name: record.name,
        acceptsOptions: acceptsOptions(record),
      });
    if (isInlineLabel(found.component)) inlineWidgets.add(record.name);
    componentWidgets.push(record.name);
  }

  const frameName = input.templates?.field ?? input.slots?.fieldFrame;
  const frame = resolveNamed('field', frameName);
  if (frame === undefined) problems.push({ code: 'template-default', template: 'field' });

  const container =
    input.templates?.object !== undefined
      ? resolveNamed('object', input.templates.object)
      : resolve(DEFAULT_OBJECT);
  if (container === undefined) problems.push({ code: 'template-default', template: 'object' });

  const button =
    input.templates?.submit !== undefined
      ? resolveNamed('submit', input.templates.submit)
      : resolve(DEFAULT_SUBMIT);
  if (button === undefined) problems.push({ code: 'template-default', template: 'submit' });

  const theme: ThemeProps = {
    widgets,
    templates: {
      FieldTemplate: createFieldTemplate(
        frame?.component as ComponentType<KitFieldFrameProps> | undefined,
        inlineWidgets
      ),
      ...(container !== undefined
        ? { ObjectFieldTemplate: createObjectTemplate(container.component) }
        : {}),
      ...(button !== undefined
        ? { ButtonTemplates: { SubmitButton: createSubmitButton(button.component) } }
        : {}),
    },
  };
  return { theme, componentWidgets, problems };
}
