/**
 * Разметка core по умолчанию — её пишет сервер по операции `markup` профиля guided.
 *
 * На core форму рисует JSX потребителя, и сборка оставляет в `index.tsx` заготовку с `return null`.
 * Для малой модели это самый слабый участок: модуль, написанный руками, она наполняла выдуманными
 * API (`createReForm`, `FormModel`, аудит 2026-11). Здесь разметка строится из раскладки intent:
 * поле — `FormField`, контейнер с заголовком — `Section`, массив — `FieldArraySection` со своим
 * компонентом строки, подформа — поля части под своей группой, шаг — секция с заголовком шага.
 * Кнопка отправки (через `bundle.submission`) — на месте узла кнопки раскладки, а без него внизу
 * формы; подпись — из intent, иначе из задания. Отправку делает функция `api.ts` из `operators`
 * (правка `submit`), без неё значения уходят в консоль. Сборка проверяет типы разметки, как любой
 * файл агента.
 *
 * Шаги рисуются секциями одной страницы: правила шагов и `bundle.flow` работают и так, а
 * пошаговую навигацию (`useFormFlow`) агент дописывает сам, если она нужна.
 *
 * @module reformer-mcp/core/guided/markup
 */

import {
  buildAssemblyTsx,
  buildMessagesTs,
  submitHandlerOf,
  type CoreMarkup,
} from '../generate/builders.js';
import type { ArrayIntent, FormIntent, LayoutNode } from '../generate/form-intent.js';
import { namedSubmitLabel } from '../generate/submit.js';

/** Метка разметки сервера: файл без неё правили руками, и `markup` его не перепишет. */
export const MARKUP_MARK = '// Markup written by form_edit {"op":"markup"}.';

const jsxText = (value: string): string => value.replace(/[{}<>]/g, (ch) => `{'${ch}'}`);
const attr = (value: string): string => JSON.stringify(value);
const control = (base: string, path: string): string => `${base}.${path.split('.').join('.')}`;

/** Имя компонента строки массива: `contacts` → `ContactsRow`. */
const rowComponent = (array: ArrayIntent): string =>
  `${array.name.charAt(0).toUpperCase()}${array.name.slice(1)}Row`;

function titleOf(node: LayoutNode): string | null {
  if (node.kind === 'step') return node.title;
  if (node.kind === 'container') {
    const title = node.componentProps?.title;
    return typeof title === 'string' ? title : null;
  }
  return null;
}

/**
 * Подпись кнопки отправки: названная в задании («кнопка «Зарегистрироваться»»), иначе на языке
 * задания. «Submit» в русской форме модель на core правила руками и ломала типы разметки
 * (батч 20261114T215823Z-1be3, registration-create).
 */
export function submitLabelOf(task: string | undefined): string {
  return taskSubmitLabel(task) ?? (task && /[а-яё]/i.test(task) ? 'Отправить' : 'Submit');
}

/**
 * Подпись кнопки, которую задание называет («кнопка «Зарегистрироваться»»); в правке — новая, после
 * «переименуй в». Задание кнопки не называет — `null`.
 */
export function taskSubmitLabel(task: string | undefined): string | null {
  if (!task) return null;
  // Правка: «Кнопку «Зарегистрироваться» переименуй в «Создать аккаунт»» — подпись после «в».
  const renamed =
    /(?:кнопк[а-яё]*|button)\s*[«"“][^»"”\n]{1,40}[»"”][^.\n]{0,40}?(?:переимен[а-яё]*|замени[а-яё]*|rename|change)[^.\n«"“]{0,20}?\s(?:в|на|to)\s+[«"“]([^»"”\n]{1,40})[»"”]/i.exec(
      task
    )?.[1];
  // «Rename the button "Register" to "Sign up"» — глагол раньше кнопки.
  const verbFirst =
    /(?:переимен[а-яё]*|замени[а-яё]*|rename|change)[^.\n]{0,20}?(?:кнопк[а-яё]*|button)\s*[«"“][^»"”\n]{1,40}[»"”]\s+(?:в|на|to)\s+[«"“]([^»"”\n]{1,40})[»"”]/i.exec(
      task
    )?.[1];
  // «кнопка мастера «Оформить заказ»», «кнопку отправки «…»» — общая с разбором спеки.
  const named = (renamed ?? verbFirst)?.trim();
  return named ? named : namedSubmitLabel(task);
}

/** Кнопка отправки в раскладке: `Button` с селектором `submit` или `type: "submit"`. */
export function isSubmitNode(node: LayoutNode): boolean {
  return (
    node.kind === 'container' &&
    node.component === 'Button' &&
    (node.selector === 'submit' || node.componentProps?.type === 'submit')
  );
}

const textOf = (node: LayoutNode): string =>
  'children' in node
    ? node.children
        .map((child) => (child.kind === 'text' ? child.text : ''))
        .join('')
        .trim()
    : '';

function findLayout(node: LayoutNode, test: (node: LayoutNode) => boolean): LayoutNode | null {
  if (test(node)) return node;
  for (const child of 'children' in node ? node.children : []) {
    const found = findLayout(child, test);
    if (found) return found;
  }
  return null;
}

/**
 * Подпись кнопки отправки в intent: текст узла кнопки или `submitLabel` мастера. Кнопки в intent нет
 * — `null`.
 */
export function formSubmitLabel(intent: FormIntent): string | null {
  const wizard = findLayout(
    intent.layoutRoot,
    (node) => node.kind === 'container' && node.component === 'FormWizard'
  );
  if (wizard?.kind === 'container') {
    const label = wizard.componentProps?.submitLabel;
    return typeof label === 'string' && label.trim() ? label.trim() : null;
  }
  const button = findLayout(intent.layoutRoot, isSubmitNode);
  const label = button ? textOf(button) : '';
  return label || null;
}

/**
 * Разметка core для формы. `messages` — у формы есть словарь замечаний. `submitLabel` — подпись
 * кнопки, когда её нет в intent (узел кнопки или `submitLabel` мастера).
 */
export function buildCoreMarkup(
  intent: FormIntent,
  messages: boolean,
  submitLabel = 'Submit'
): CoreMarkup {
  const arrays = new Map(intent.arrays.map((array) => [array.name, array]));
  const used = new Set<string>(['FormField', 'Button']);
  const helpers: string[] = [];
  const label = formSubmitLabel(intent) ?? submitLabel;
  // Функция отправки из `api.ts`: на core правил узлов нет, её зовёт сама разметка.
  const handler = submitHandlerOf(intent);
  let submitDrawn = false;

  // `base` — группа, к которой подключена часть: листья части названы относительно неё.
  const render = (node: LayoutNode, pad: string, base: string): string[] => {
    switch (node.kind) {
      case 'field':
        return [`${pad}<FormField control={${control(base, node.ref)}} />`];
      case 'array': {
        const array = arrays.get(node.ref);
        if (!array) return [];
        used.add('FieldArraySection');
        const props = array.componentProps ?? {};
        const extra = ['title', 'addButtonLabel', 'itemLabel']
          .filter((key) => typeof props[key] === 'string')
          .map((key) => ` ${key}=${attr(String(props[key]))}`)
          .join('');
        return [
          `${pad}<FieldArraySection control={${control(base, array.name)}} itemComponent={${rowComponent(array)}}${extra} />`,
        ];
      }
      case 'text':
        return [`${pad}<p>${jsxText(node.text)}</p>`];
      case 'part': {
        // Подформа — те же поля под своей группой: адрес доставки и адрес для счёта — одна часть.
        const part = intent.parts?.[node.part];
        return part ? render(part, pad, control(base, node.ref)) : [];
      }
      default: {
        // Кнопка раскладки: отправка — внутри <form>, первая же кнопка отправки занимает её место.
        if (node.kind === 'container' && node.component === 'Button') {
          const submit = isSubmitNode(node) && !submitDrawn;
          if (submit) submitDrawn = true;
          return [
            `${pad}<Button type=${submit ? '"submit"' : '"button"'}>${jsxText(submit ? label : textOf(node))}</Button>`,
          ];
        }
        const inner = node.children.flatMap((child) => render(child, `${pad}  `, base));
        const title = titleOf(node);
        if (title === null) return inner;
        used.add('Section');
        return [`${pad}<Section title=${attr(title)}>`, ...inner, `${pad}</Section>`];
      }
    }
  };

  const body = render(intent.layoutRoot, '        ', 'bundle.form');
  for (const array of intent.arrays) {
    helpers.push(
      `function ${rowComponent(array)}({ control }: { control: FormGroup<${array.itemInterfaceName}> }) {`,
      '  return (',
      '    <>',
      ...array.itemFields.map((field) => `      <FormField control={control.${field.name}} />`),
      '    </>',
      '  );',
      '}'
    );
  }

  const kit = [...used].sort();
  const itemTypes = intent.arrays.map((array) => array.itemInterfaceName);
  const imports = [
    `import { ${kit.join(', ')} } from '@reformer/ui-kit';`,
    ...(intent.arrays.length > 0
      ? [
          "import type { FormGroup } from '@reformer/core';",
          `import type { ${itemTypes.join(', ')} } from './model';`,
        ]
      : []),
    ...(messages
      ? [
          "import { ValidationMessagesProvider } from '@reformer/cdk';",
          "import { formMessages } from './form.messages';",
        ]
      : []),
    ...(handler ? [`import { ${handler} } from './api';`] : []),
  ];

  const form = [
    '      <form',
    '        onSubmit={(event) => {',
    '          event.preventDefault();',
    `          void bundle.submission.submit(${handler ?? '(values) => console.log(values)'});`,
    '        }}',
    '      >',
    ...body,
    ...(submitDrawn ? [] : [`        <Button type="submit">${jsxText(label)}</Button>`]),
    '      </form>',
  ];
  const wrapped = messages
    ? [
        '    <ValidationMessagesProvider messages={formMessages}>',
        ...form.map((line) => `  ${line}`),
        '    </ValidationMessagesProvider>',
      ]
    : form.map((line) => line.slice(2));
  return {
    imports,
    helpers: [MARKUP_MARK, ...helpers],
    body: ['  return (', ...wrapped, '  );'],
  };
}

/**
 * `index.tsx` формы на core с разметкой сервера — тот же файл пишет `form_edit` по операции `markup`.
 * Стенд кладёт его в затравку правки на core: затравка, нарисованная `FormRenderer`, валила гейт
 * стека у агента, который `index.tsx` и не трогал (ReFormer-mhsh.6).
 *
 * @param task - задание: подпись кнопки, если её нет в intent
 */
export function coreAssembly(intent: FormIntent, task?: string): string {
  const messages = buildMessagesTs(intent).content !== null;
  return buildAssemblyTsx(intent, buildCoreMarkup(intent, messages, submitLabelOf(task)));
}
