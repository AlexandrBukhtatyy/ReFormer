/**
 * Эмиттер `renderer.behavior.ts` (user-owned) — submit на реальный selector плюс правила
 * render-слоя из сайдкара (`FormRules.render`).
 *
 * Файл целиком билдерский: MCP-шный `buildRenderBehaviorTs` печатает `const formRenderBehavior` и
 * умеет только `hideWhen`, а здесь нужна фабрика `createJsonRenderBehavior(form, model, options)` —
 * её импортирует сгенерированный `index.tsx`, и submit без `form`/`model` не собрать.
 *
 * Секции, на которые правила НЕ заданы, по-прежнему получают закомментированный `hideWhen` с
 * реальным узлом: это подсказка «вот адрес, впиши условие», а не мусор. Секции с правилом
 * подсказку не получают — она стала бы дублем работающей строки.
 *
 * @module reformer-builder/codegen/emit-behavior
 */

import type { FormRules, RenderRuleIntent } from '../model/rules';
import type { SelectorInfo } from './assign-selectors';
import type { Names } from './naming';

/** Ключ объектного литерала: идентификатор — как есть, всё прочее — строкой. */
function propKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * Литерал пропсов для `patchProps`.
 *
 * `$expr(...)` вставляется ВЫРАЖЕНИЕМ, всё остальное — JSON. Без этого различия нельзя отличить
 * строку `"form.total.value.value"` от намерения подставить это значение, и правило, которое
 * выглядит правильно, молча кладёт в проп текст вместо числа.
 */
function propsLiteral(props: Record<string, unknown>): string {
  const parts = Object.entries(props).map(([k, v]) => {
    if (typeof v === 'string' && v.startsWith('$expr(') && v.endsWith(')')) {
      return `${propKey(k)}: ${v.slice('$expr('.length, -1)}`;
    }
    return `${propKey(k)}: ${JSON.stringify(v)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

/** Одна строка тела render-поведения. */
function renderRuleLine(rule: RenderRuleIntent): string {
  const node = `schema.node('${rule.selector}')`;
  switch (rule.kind) {
    case 'hideWhen':
      return `    hideWhen(${node}, () => ${rule.condition});`;
    case 'onEvent': {
      const head = rule.async ? 'async (...args: unknown[])' : '(...args: unknown[])';
      // `void args` обязателен: каталог собирается с `noUnusedParameters`, и обработчик, не
      // использующий аргументы, стал бы ошибкой компиляции у пользователя.
      return [
        `    onComponentEvent(${node}, '${rule.event}', ${head} => {`,
        '      void args;',
        ...rule.body.split('\n').map((l) => `      ${l}`),
        '    });',
      ].join('\n');
    }
    case 'patchProps':
      return `    ${node}.patchProps(${propsLiteral(rule.props)});`;
  }
}

export function emitBehavior(n: Names, sel: SelectorInfo, rules?: FormRules): string {
  const renderRules = rules?.render ?? [];
  const ruleLines = renderRules.map(renderRuleLine).join('\n');
  const hidden = new Set(renderRules.filter((r) => r.kind === 'hideWhen').map((r) => r.selector));
  const usesHideWhen = hidden.size > 0;

  // Подсказка только там, где правила нет: рядом с работающей строкой она читалась бы как
  // «одно из двух лишнее».
  const scaffold = sel.sections
    .filter((s) => !hidden.has(s.selector))
    .map(
      (s) =>
        `    // hideWhen(schema.node('${s.selector}'), () => /* TODO: условие для «${s.label}» */ false);`
    )
    .join('\n');

  // Визард отправляет форму сам (`onSubmit` с последнего шага) и требует инъекции `form`: рендерер
  // отдаёт форму пропом только вложенным узлам, а визард — корень схемы. Без этого ui-kit
  // `FormWizard` читает `form.submitting` у `undefined` и роняет первый же рендер.
  const isWizard = sel.submitEvent === 'onSubmit';
  const target = isWizard ? 'wizard' : 'submit';
  // Импорт `onInit` только там, где он нужен: экспортированный каталог собирается с
  // `noUnusedLocals`, и лишний импорт стал бы ошибкой компиляции у пользователя.
  const imports = ['hideWhen', 'onComponentEvent', ...(isWizard ? ['onInit'] : [])]
    .sort()
    .join(', ');
  const injectForm = isWizard
    ? `
    // Визард — self-managed компонент: форму ему передаём явно.
    onInit(${target}, () => ${target}.patchProps({ form }));
`
    : '';

  const rulesBlock = ruleLines
    ? `\n    // Правила render-слоя (из правил формы — правьте здесь или в панели «Схемы формы»):\n${ruleLines}\n`
    : '';
  const scaffoldBlock = scaffold
    ? `\n    // Условная видимость секций — раскомментируйте и впишите условие:\n${scaffold}\n`
    : '';

  return `// renderer.behavior.ts — рантайм-обвязка (submit, условная видимость, события узлов).

import { ${imports}, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation } from './validation';
import { submitForm } from './api';
import type { ${n.TypeName} } from './types';

export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };

export function createJsonRenderBehavior(
  form: FormProxy<${n.TypeName}>,
  model: FormModel<${n.TypeName}>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<${n.TypeName}> {
  const { onResult } = options;
  return (schema) => {
    void form; // используется в условиях hideWhen (form.<поле>.value.value)
${usesHideWhen ? '' : '    void hideWhen;\n'}
    const ${target} = schema.node('${sel.submitSelector}');
${injectForm}
    onComponentEvent(${target}, '${sel.submitEvent}', async () => {
      if (!(await validateModel(model, formValidation))) return;
      const res = await submitForm(model.get());
      onResult?.(res.success ? 'Форма отправлена' : res.error, res.success);
    });
${rulesBlock}${scaffoldBlock}  };
}
`;
}
