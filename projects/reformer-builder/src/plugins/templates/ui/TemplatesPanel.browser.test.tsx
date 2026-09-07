/**
 * Панель шаблонов — в настоящем браузере.
 *
 * Проверяется то, ради чего панель переделана под вид первой версии, и ровно то, что вне
 * браузера невыразимо:
 *
 * - **сворачивание раздела.** Строки исчезают из DOM по щелчку в заголовок — это состояние
 *   панели, а не стиль, и проверяется наличием узлов;
 * - **контекстное меню.** Radix открывает его на СОБЫТИЕ `contextmenu` и рисует в портале;
 *   ни того, ни другого в node-прогоне нет вовсе;
 * - **состав меню зависит от хранилища.** У встроенного шаблона нет ни переименования, ни
 *   удаления, потому что встроенное хранилище не умеет ни того, ни другого — а не потому,
 *   что вид называется «builtin»;
 * - **щелчок ведёт к созданию формы.** Строка обязана отвечать делом, а не только
 *   подсветкой;
 * - **каталог формы выбирают в окне.** Раньше он молча брался у активной вкладки, и положить
 *   форму в другое место было нечем;
 * - **имя формы с кириллицей ПРИНИМАЕТСЯ.** Правило первой версии («латиница, цифры, дефис»)
 *   здесь было бы регрессом: подстановка транслитерирует, и запрет отрезал бы законные имена.
 *
 * @module plugins/templates/ui/TemplatesPanel.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { ReactElement } from 'react';
import type { ResourceId } from '@/sdk';
import { TooltipProvider } from '@reformer/ui-kit/tooltip';
import { renderReact } from '@/testing/render';
import type { FormTemplate, TemplateStore } from '../contract';
import type { TemplatesHost } from '../host';
import { createTemplatesRefresh, type TemplatesRefresh } from '../content/refresh';
import { createFakeTemplatesHost, type FakeTemplatesHost } from '../testing';
import { TemplatesActions } from './TemplatesActions';
import { TemplatesPanel } from './TemplatesPanel';

const ACTIVE = 'project/forms/old.json' as ResourceId;

const BUILTIN: FormTemplate = {
  id: 'simple',
  name: 'Простая форма',
  source: 'builtin',
  files: [
    { path: 'schema.json', content: '{"version":"1.0"}' },
    { path: 'model.ts', content: '// __formName__' },
  ],
  requires: { 'model.ts': ['schema.json'] },
};

const PROJECT: FormTemplate = {
  id: 'credit',
  name: 'Кредитная заявка',
  source: 'project',
  files: [{ path: 'schema.json', content: '{"version":"1.0"}' }],
};

/** Встроенное хранилище: только чтение — ни записи, ни удаления. */
const builtinStore: TemplateStore = {
  source: 'builtin',
  available: () => true,
  list: async () => [BUILTIN],
};

/** Проектное хранилище: умеет переименовать и удалить, а список берёт из живого массива. */
function projectStore(
  removed: string[],
  renamed: FormTemplate[],
  items: FormTemplate[]
): TemplateStore {
  return {
    source: 'project',
    available: () => true,
    list: async () => [...items],
    update: async (template) => {
      renamed.push(template);
    },
    remove: async (id) => {
      removed.push(id);
    },
  };
}

interface Fixture {
  readonly host: FakeTemplatesHost;
  readonly removed: string[];
  readonly renamed: FormTemplate[];
  /** Что отдаёт проектное хранилище: тест правит его, чтобы проверить перечитывание. */
  readonly project: FormTemplate[];
  unmount(): void;
}

/**
 * Двойник дока: действия в шапке и тело панели — два поддерева, как в оболочке.
 *
 * Собран так намеренно: связь между кнопкой и списком идёт не через общего родителя,
 * а через повод перечитать, и тест обязан проверять её на той же раскладке, что в `Shell`.
 * `TooltipProvider` тоже приходит снаружи — его даёт шапка дока, а не вклад.
 */
function Harness({
  host,
  stores,
  refresh,
}: {
  host: TemplatesHost;
  stores: TemplateStore[];
  refresh: TemplatesRefresh;
}): ReactElement {
  return (
    <div style={{ width: 320, height: 420 }}>
      <TooltipProvider>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <TemplatesActions host={host} refresh={refresh} />
        </div>
      </TooltipProvider>
      <TemplatesPanel host={host} stores={() => stores} refresh={refresh} />
    </div>
  );
}

async function mount(): Promise<Fixture> {
  const removed: string[] = [];
  const renamed: FormTemplate[] = [];
  const project = [PROJECT];
  const host = createFakeTemplatesHost({
    files: { [ACTIVE]: '{}', 'project/pages/index.tsx': '', 'project/lib/util.ts': '' },
  });
  // Активная вкладка — то, рядом с чем создаётся форма; двойник по умолчанию её не имеет.
  const withDocument: FakeTemplatesHost = { ...host, useActiveDocument: () => ACTIVE };
  const mounted = renderReact(
    <Harness
      host={withDocument}
      stores={[builtinStore, projectStore(removed, renamed, project)]}
      refresh={createTemplatesRefresh()}
    />
  );
  await vi.waitFor(() => {
    if (row('builtin', 'simple') === null) throw new Error('строки ещё не отрисованы');
  });
  return { host: withDocument, removed, renamed, project, unmount: mounted.unmount };
}

function row(source: string, id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="template-row-${source}-${id}"]`);
}

function group(source: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-testid="template-group-${source}"]`)!;
}

function menuItems(): string[] {
  return [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
    (item.textContent ?? '').trim()
  );
}

async function openMenu(source: string, id: string): Promise<void> {
  await userEvent.click(row(source, id)!, { button: 'right' });
  await vi.waitFor(() => {
    if (menuItems().length === 0) throw new Error('меню ещё не открылось');
  });
}

async function clickMenuItem(title: string): Promise<void> {
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (node) => (node.textContent ?? '').trim() === title
  );
  await userEvent.click(item!);
}

describe('панель шаблонов', () => {
  it('разделы показывают счётчик, а щелчок по заголовку сворачивает строки', async () => {
    const fixture = await mount();

    expect(group('builtin').textContent).toContain('group.builtin');
    expect(group('builtin').textContent).toContain('1');

    await userEvent.click(group('builtin'));

    await expect.poll(() => row('builtin', 'simple')).toBeNull();
    // Соседний раздел остаётся раскрытым: сворачивание — состояние РАЗДЕЛА, а не панели.
    expect(row('project', 'credit')).not.toBeNull();
    fixture.unmount();
  });

  it('кнопка шапки перечитывает список, хотя живёт в другом поддереве', async () => {
    const fixture = await mount();
    expect(row('project', 'extra')).toBeNull();

    // Источник пополнился мимо панели — ровно тот случай, ради которого кнопка есть.
    fixture.project.push({ ...PROJECT, id: 'extra', name: 'Появился снаружи' });
    const button = document.querySelector<HTMLElement>('[data-testid="button-refresh"]')!;
    // Подпись ушла в подсказку, но имя у кнопки осталось — иначе её нечем назвать вслух.
    expect(button.getAttribute('aria-label')).toBe('action.refresh');

    await userEvent.click(button);

    await expect.poll(() => row('project', 'extra')).not.toBeNull();
    fixture.unmount();
  });

  it('у встроенного шаблона в меню только создание формы', async () => {
    const fixture = await mount();

    await openMenu('builtin', 'simple');

    expect(menuItems()).toEqual(['menu.generate']);
    fixture.unmount();
  });

  it('у проектного шаблона в меню есть переименование и удаление', async () => {
    const fixture = await mount();

    await openMenu('project', 'credit');

    expect(menuItems()).toEqual(['menu.generate', 'menu.rename', 'action.remove']);
    fixture.unmount();
  });

  it('удаление подтверждается диалогом и доходит до хранилища', async () => {
    const fixture = await mount();

    await openMenu('project', 'credit');
    await clickMenuItem('action.remove');
    await vi.waitFor(() => {
      if (document.querySelector('[data-testid="button-remove"]') === null) {
        throw new Error('диалог ещё не открылся');
      }
    });
    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="button-remove"]')!);

    await expect.poll(() => fixture.removed).toEqual(['credit']);
    fixture.unmount();
  });

  it('щелчок открывает создание формы, и кириллица в имени принимается', async () => {
    const fixture = await mount();

    await userEvent.click(row('builtin', 'simple')!);
    await vi.waitFor(() => {
      if (document.querySelector('[data-testid="input-formName"]') === null) {
        throw new Error('диалог ещё не открылся');
      }
    });

    const submit = (): HTMLButtonElement =>
      document.querySelector<HTMLButtonElement>('[data-testid="button-generate"]')!;
    expect(submit().disabled).toBe(true);

    await userEvent.fill(
      document.querySelector<HTMLElement>('[data-testid="input-formName"]')!,
      'Профиль пользователя'
    );

    await expect.poll(() => submit().disabled).toBe(false);

    await userEvent.click(submit());

    // Форма ложится рядом с активной вкладкой — каталогом с введённым именем.
    const dir = 'project/forms/Профиль пользователя';
    await expect
      .poll(() => [...fixture.host.files.keys()].filter((path) => path.startsWith(dir)))
      .toEqual([`${dir}/schema.json`, `${dir}/model.ts`]);
    // Плейсхолдер заменён: кириллица дошла до содержимого транслитерацией, а не осталась
    // токеном — ровно тот случай, который правило первой версии запрещало вводить.
    expect(fixture.host.files.get(`${dir}/model.ts`)).not.toContain('__formName__');
    fixture.unmount();
  });

  it('имя без букв и цифр не даёт создать форму', async () => {
    const fixture = await mount();

    await userEvent.click(row('builtin', 'simple')!);
    await vi.waitFor(() => {
      if (document.querySelector('[data-testid="input-formName"]') === null) {
        throw new Error('диалог ещё не открылся');
      }
    });
    await userEvent.fill(
      document.querySelector<HTMLElement>('[data-testid="input-formName"]')!,
      '---'
    );

    await expect
      .poll(
        () => document.querySelector<HTMLButtonElement>('[data-testid="button-generate"]')!.disabled
      )
      .toBe(true);
    expect(document.body.textContent).toContain('form.name.invalid');
    fixture.unmount();
  });
});

describe('выбор каталога формы', () => {
  it('поле предлагает каталоги проекта, а не только место активной вкладки', async () => {
    const fixture = await mount();

    await userEvent.click(row('builtin', 'simple')!);
    await vi.waitFor(() => {
      if (document.querySelector('[data-testid="select-folder"]') === null) {
        throw new Error('поле каталога ещё не отрисовано');
      }
    });

    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="select-folder"]')!);

    const options = [...document.querySelectorAll('[role="option"]')].map((option) =>
      (option.textContent ?? '').trim()
    );
    // Корень и каталоги проекта — обход берёт их из источника, а не из одного лишь пути
    // открытого файла.
    expect(options).toContain('dialog.generate.folder.root');
    expect(options).toContain('pages');
    fixture.unmount();
  });

  it('форма создаётся в ВЫБРАННОМ каталоге', async () => {
    const fixture = await mount();

    await userEvent.click(row('builtin', 'simple')!);
    await vi.waitFor(() => {
      if (document.querySelector('[data-testid="select-folder"]') === null) {
        throw new Error('поле каталога ещё не отрисовано');
      }
    });
    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="select-folder"]')!);
    const pages = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (option) => (option.textContent ?? '').trim() === 'pages'
    );
    await userEvent.click(pages!);

    await userEvent.fill(
      document.querySelector<HTMLElement>('[data-testid="input-formName"]')!,
      'credit'
    );
    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="button-generate"]')!);

    await expect
      .poll(() => [...fixture.host.files.keys()].filter((path) => path.includes('/credit/')))
      .toEqual(['project/pages/credit/schema.json', 'project/pages/credit/model.ts']);
    fixture.unmount();
  });
});
