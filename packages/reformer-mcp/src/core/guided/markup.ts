/**
 * Разметка core по умолчанию — её пишет сервер по операции `markup` профиля guided.
 *
 * На core форму рисует JSX потребителя, и сборка оставляет в `index.tsx` заготовку с `return null`.
 * Для малой модели это самый слабый участок: модуль, написанный руками, она наполняла выдуманными
 * API (`createReForm`, `FormModel`, аудит 2026-11). Здесь разметка строится из раскладки intent:
 * поле — `FormField`, контейнер с заголовком — `Section`, массив — `FieldArraySection` со своим
 * компонентом строки, шаг — секция с заголовком шага, внизу — кнопка отправки через
 * `bundle.submission`. Сборка проверяет её типы, как любой файл агента.
 *
 * Шаги рисуются секциями одной страницы: правила шагов и `bundle.flow` работают и так, а
 * пошаговую навигацию (`useFormFlow`) агент дописывает сам, если она нужна.
 *
 * @module reformer-mcp/core/guided/markup
 */

import type { CoreMarkup } from '../generate/builders.js';
import type { ArrayIntent, FormIntent, LayoutNode } from '../generate/form-intent.js';

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

/** Разметка core для формы. `messages` — у формы есть словарь замечаний. */
export function buildCoreMarkup(intent: FormIntent, messages: boolean): CoreMarkup {
  const arrays = new Map(intent.arrays.map((array) => [array.name, array]));
  const used = new Set<string>(['FormField', 'Button']);
  const helpers: string[] = [];

  const render = (node: LayoutNode, pad: string): string[] => {
    switch (node.kind) {
      case 'field':
        return [`${pad}<FormField control={${control('bundle.form', node.ref)}} />`];
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
          `${pad}<FieldArraySection control={${control('bundle.form', array.name)}} itemComponent={${rowComponent(array)}}${extra} />`,
        ];
      }
      case 'text':
        return [`${pad}<p>${jsxText(node.text)}</p>`];
      case 'part':
        return [];
      default: {
        const inner = node.children.flatMap((child) => render(child, `${pad}  `));
        const title = titleOf(node);
        if (title === null) return inner;
        used.add('Section');
        return [`${pad}<Section title=${attr(title)}>`, ...inner, `${pad}</Section>`];
      }
    }
  };

  const body = render(intent.layoutRoot, '        ');
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
  ];

  const form = [
    '      <form',
    '        onSubmit={(event) => {',
    '          event.preventDefault();',
    '          void bundle.submission.submit((values) => console.log(values));',
    '        }}',
    '      >',
    ...body,
    '        <Button type="submit">Submit</Button>',
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
