/**
 * Эмиттер `renderer.behavior.ts` — рантайм-обвязка формы: submit на реальный селектор плюс
 * правила render-слоя из сайдкара.
 *
 * Файл целиком билдерский. MCP-шный `buildRenderBehaviorTs` печатает `const formRenderBehavior`
 * и умеет только `hideWhen`, а здесь нужна фабрика `createJsonRenderBehavior(form, model,
 * options)` — её импортирует сгенерированный `index.tsx`, и submit без `form`/`model` не собрать.
 *
 * Секции, на которые правила НЕ заданы, получают закомментированный `hideWhen` с реальным
 * селектором: это подсказка «вот адрес, впиши условие», а не мусор. Секции с правилом подсказку
 * не получают — она стала бы дублем работающей строки.
 *
 * @module reformer-builder/lib/codegen/emit/render-behavior
 */

import type { RenderRuleIntent } from '../../form-model/rules';
import type { EmitContext } from '../context';

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
  const parts = Object.entries(props).map(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('$expr(') && value.endsWith(')')) {
      return `${propKey(key)}: ${value.slice('$expr('.length, -1)}`;
    }
    return `${propKey(key)}: ${JSON.stringify(value)}`;
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
      const head = rule.async === true ? 'async (...args: unknown[])' : '(...args: unknown[])';
      // `void args` обязателен: сгенерированный модуль собирается с `noUnusedParameters`,
      // и обработчик, не использующий аргументы, стал бы ошибкой компиляции у пользователя.
      return [
        `    onComponentEvent(${node}, '${rule.event}', ${head} => {`,
        '      void args;',
        ...rule.body.split('\n').map((line) => `      ${line}`),
        '    });',
      ].join('\n');
    }
    case 'patchProps':
      return `    ${node}.patchProps(${propsLiteral(rule.props)});`;
  }
}

export function emitRenderBehavior(ctx: EmitContext): string {
  const { names, selectors } = ctx;
  const renderRules = ctx.rules.render;
  const ruleLines = renderRules.map(renderRuleLine).join('\n');
  const hidden = new Set(
    renderRules.filter((rule) => rule.kind === 'hideWhen').map((rule) => rule.selector)
  );

  const scaffold = selectors.sections
    .filter((section) => !hidden.has(section.selector))
    .map(
      (section) =>
        `    // hideWhen(schema.node('${section.selector}'), () => /* TODO: условие для «${section.label}» */ false);`
    )
    .join('\n');

  // Визард отправляет форму сам (`onSubmit` с последнего шага) и требует инъекции `form`:
  // рендерер отдаёт форму пропом только вложенным узлам, а визард — корень схемы.
  const isWizard = selectors.submitEvent === 'onSubmit';
  const target = isWizard ? 'wizard' : 'submit';
  // Импорт `onInit` только там, где он нужен: сгенерированный модуль собирается с
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

  const rulesBlock =
    ruleLines === ''
      ? ''
      : `\n    // Правила render-слоя (из правил формы — правьте здесь или в панели правил):\n${ruleLines}\n`;
  const scaffoldBlock =
    scaffold === ''
      ? ''
      : `\n    // Условная видимость секций — раскомментируйте и впишите условие:\n${scaffold}\n`;

  return `// renderer.behavior.ts — рантайм-обвязка (submit, условная видимость, события узлов).

import { ${imports}, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation } from './validation';
import { submitForm } from './api';
import type { ${names.TypeName} } from './types';

export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };

export function createJsonRenderBehavior(
  form: FormProxy<${names.TypeName}>,
  model: FormModel<${names.TypeName}>,
  options: RenderBehaviorOptions = {}
): RenderBehaviorFn<${names.TypeName}> {
  const { onResult } = options;
  return (schema) => {
    void form; // используется в условиях hideWhen (form.<поле>.value.value)
${hidden.size > 0 ? '' : '    void hideWhen;\n'}
    const ${target} = schema.node('${selectors.submitSelector}');
${injectForm}
    onComponentEvent(${target}, '${selectors.submitEvent}', async () => {
      // \`touch: true\` обязателен: киты показывают ошибку только у ТРОНУТОГО поля
      // (\`invalid && (touched || dirty)\`). Без него неудачная отправка выглядела бы так,
      // будто кнопка не работает: форма не отправлена, а почему — нигде не сказано.
      if (!(await validateModel(model, formValidation, { touch: true }))) {
        onResult?.('Проверьте заполнение формы', false);
        return;
      }
      const res = await submitForm(model.get());
      onResult?.(res.success ? 'Форма отправлена' : res.error, res.success);
    });
${rulesBlock}${scaffoldBlock}  };
}
`;
}
