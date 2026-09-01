/**
 * Палитра команд в настоящем браузере.
 *
 * Файл существует потому, что у [CommandPalette.tsx](CommandPalette.tsx) в шапке записаны семь
 * утверждений, ни одно из которых не обосновано ничем, кроме чтения чужих исходников: стрелки
 * доходят до `cmdk`; изоляция событий переживает портал; фокус возвращается туда, откуда позвали;
 * пустое состояние показывается; переопределения геометрии (`h-auto`, `max-h-[60vh]`) нужны;
 * Radix проставляет атрибуты окна; тёмная тема достаёт до портала. Правила отбора и слияния
 * проверяет [palette.test.ts](palette.test.ts) — здесь только то, чего без DOM не видно.
 *
 * @module host/ui/CommandPalette.browser.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { ReactElement } from 'react';
import {
  createCommandRegistry,
  type CommandContribution,
} from '@/shell/platform/primitives/command';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { renderReact } from '@/testing/render';
import { CommandPalette, PALETTE_OPEN_COMMAND_ID } from './CommandPalette';
import { PaletteItemsPoint, type PaletteItemProvider } from './palette';
import { createWhenContextStore, useFocusTracking } from './when-context-store';

const MESSAGES: Readonly<Record<string, string>> = {
  'shell.palette.label': 'Палитра команд',
  'shell.palette.input.label': 'Поиск команды',
  'shell.palette.placeholder': 'Название команды или файла…',
  'shell.palette.empty': 'Ничего не найдено',
  'shell.palette.open.title': 'Открыть палитру',
  'test.alpha.title': 'Альфа команда',
  'test.beta.title': 'Бета команда',
  'test.canvas.title': 'Команда канваса',
};

interface Fixture {
  readonly commands: ReturnType<typeof createCommandRegistry>;
  readonly store: ReturnType<typeof createWhenContextStore>;
  /** Открывает палитру той же дверью, что оболочка, — командой, и ждёт появления окна. */
  readonly open: () => Promise<void>;
  readonly unmount: () => void;
}

interface MountOptions {
  readonly commands?: readonly CommandContribution[];
  readonly providers?: readonly PaletteItemProvider[];
  /** Готовый реестр — для теста, которому нужны два монтажа подряд на одном реестре. */
  readonly registry?: ReturnType<typeof createCommandRegistry>;
  /** Отслеживать реальный фокус документа: нужно ровно тем тестам, что проверяют снимок. */
  readonly trackFocus?: boolean;
  readonly before?: () => void;
}

function Harness({
  commands,
  extensions,
  store,
  i18n,
  trackFocus,
}: {
  commands: ReturnType<typeof createCommandRegistry>;
  extensions: ReturnType<typeof createExtensionRegistry>;
  store: ReturnType<typeof createWhenContextStore>;
  i18n: ReturnType<typeof createI18nService>;
  trackFocus: boolean;
}): ReactElement {
  useFocusTracking(store, trackFocus);
  return (
    <>
      <div data-focus-zone="canvas" tabIndex={-1} data-testid="canvas">
        поверхность
      </div>
      <button type="button" data-testid="starter">
        откуда позвали
      </button>
      <CommandPalette
        commands={commands}
        extensions={extensions}
        whenContext={store}
        i18n={i18n}
        // Явный модификатор, а не определение по платформе: подпись сочетания участвует
        // в проверке разметки, и она не должна зависеть от того, на чём идёт прогон.
        modifier="ctrl"
      />
    </>
  );
}

async function mountPalette(options: MountOptions = {}): Promise<Fixture> {
  const commands = options.registry ?? createCommandRegistry();
  const extensions = createExtensionRegistry();
  const store = createWhenContextStore();
  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(MESSAGES),
    dev: true,
  });
  await i18n.setLocale('ru');
  for (const command of options.commands ?? []) commands.register(command);
  const plugin = extensions.forPlugin('test');
  for (const provider of options.providers ?? []) plugin.contribute(PaletteItemsPoint, provider);

  const mount = renderReact(
    <Harness
      commands={commands}
      extensions={extensions}
      store={store}
      i18n={i18n}
      trackFocus={options.trackFocus === true}
    />
  );

  // Команда открытия регистрируется эффектом: до его исполнения открывать нечем.
  await vi.waitFor(() => {
    expect(commands.get(PALETTE_OPEN_COMMAND_ID)).toBeDefined();
  });

  return {
    commands,
    store,
    unmount: mount.unmount,
    open: async () => {
      options.before?.();
      await commands.execute(PALETTE_OPEN_COMMAND_ID);
      await expect.element(page.getByRole('dialog')).toBeVisible();
    },
  };
}

function command(patch: Partial<CommandContribution> & { id: string }): CommandContribution {
  return { titleKey: `${patch.id}.title`, run: () => undefined, ...patch };
}

const ALPHA = command({ id: 'test.alpha', keybinding: 'mod+shift+a' });
const BETA = command({ id: 'test.beta' });

/** Слушатель глобального слоя — тот же узел и та же фаза, что у `installKeybindings`. */
let globalKeys: ReturnType<typeof vi.fn<(event: KeyboardEvent) => void>>;

beforeEach(() => {
  globalKeys = vi.fn<(event: KeyboardEvent) => void>();
  document.addEventListener('keydown', globalKeys);
});

afterEach(() => {
  document.removeEventListener('keydown', globalKeys);
});

describe('окно и атрибуты', () => {
  it('окно скрывает остальное дерево от программы чтения и не обещает описания', async () => {
    const fixture = await mountPalette({ commands: [ALPHA] });
    await fixture.open();

    const dialog = page.getByRole('dialog').element();
    // Radix НЕ ставит `aria-modal` — он прячет соседей окна. Это строже: `aria-modal`
    // соседей не убирает, и программа чтения обходит их «виртуальным курсором».
    const outside = Array.from(document.body.children).filter(
      (node) => node.contains(dialog) === false
    );
    expect(outside.length).toBeGreaterThan(0);
    for (const node of outside) expect(node.getAttribute('aria-hidden')).toBe('true');
    // `aria-describedby={undefined}` в коде — не косметика: Radix иначе ставит ссылку
    // на несуществующий узел, и программа чтения объявляет пустое описание.
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    // Заголовок нужен программе чтения и не нужен глазу.
    const title = dialog.querySelector<HTMLElement>('.sr-only');
    expect(title?.textContent).toBe('Палитра команд');
    // `offsetHeight`, а не `getBoundingClientRect`: у окна на входе идёт `zoom-in-95`,
    // и прямоугольник зависел бы от того, доиграла ли анимация.
    expect(title?.offsetHeight).toBeLessThanOrEqual(1);
  });

  it('фокус заперт внутри окна: Tab не уходит в интерфейс за ним', async () => {
    // Именно этого раньше не было: окно объявляло `aria-modal`, а Tab уводил наружу.
    const fixture = await mountPalette({ commands: [ALPHA, BETA] });
    await fixture.open();
    const dialog = page.getByRole('dialog').element();

    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

describe('клавиатура', () => {
  it('стрелка вниз двигает выделение — событие дошло до cmdk', async () => {
    const fixture = await mountPalette({ commands: [ALPHA, BETA] });
    await fixture.open();

    const options = page.getByRole('option');
    await expect.element(options.nth(0)).toHaveAttribute('data-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(options.nth(1)).toHaveAttribute('data-selected', 'true');
    await expect.element(options.nth(0)).toHaveAttribute('data-selected', 'false');
  });

  it('навигационные клавиши не доходят до глобального слоя — портал изоляции не мешает', async () => {
    // Окно кита рисуется в `document.body`, то есть вне корня оболочки. Утверждение шапки —
    // что `stopPropagation()` синтетического события останавливает и нативное, поэтому
    // до слушателя на `document` клавиша не доходит. Проверяется только так.
    const fixture = await mountPalette({ commands: [ALPHA, BETA] });
    await fixture.open();
    globalKeys.mockClear();

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{End}');
    expect(globalKeys).not.toHaveBeenCalled();
  });

  it('Escape закрывает палитру и тоже не доходит до глобального слоя', async () => {
    const fixture = await mountPalette({ commands: [ALPHA] });
    await fixture.open();
    globalKeys.mockClear();

    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    expect(globalKeys).not.toHaveBeenCalled();
  });

  it('Enter запускает выделенный пункт и закрывает палитру', async () => {
    const run = vi.fn();
    const fixture = await mountPalette({ commands: [command({ id: 'test.alpha', run })] });
    await fixture.open();
    globalKeys.mockClear();

    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    expect(globalKeys).not.toHaveBeenCalled();
  });
});

describe('фокус', () => {
  it('возвращает фокус туда, откуда палитру позвали', async () => {
    const fixture = await mountPalette({
      commands: [ALPHA],
      before: () => {
        document.querySelector<HTMLElement>('[data-testid="starter"]')?.focus();
      },
    });
    const starter = document.querySelector<HTMLElement>('[data-testid="starter"]');
    await fixture.open();
    // Пока палитра открыта, фокус у неё — иначе ввод шёл бы мимо.
    expect(starter?.contains(document.activeElement)).toBe(false);

    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(starter);
    });
  });

  it('снимок контекста берётся ДО того, как палитра забирает фокус', async () => {
    // Главное решение файла: иначе команда с условием «фокус на канвасе» исчезала бы
    // ровно в тот момент, когда её собрались вызвать, — палитра меняла бы ответ самим
    // фактом своего открытия.
    const fixture = await mountPalette({
      trackFocus: true,
      commands: [command({ id: 'test.canvas', enabled: (ctx) => ctx.focus === 'canvas' })],
      before: () => {
        document.querySelector<HTMLElement>('[data-testid="canvas"]')?.focus();
      },
    });
    await vi.waitFor(() => {
      expect(fixture.store.get().focus).toBe('none');
    });
    await fixture.open();

    // Фокус уже в поле ввода палитры — то есть `editable`…
    await vi.waitFor(() => {
      expect(fixture.store.get().focus).toBe('editable');
    });
    // …а команда канваса всё равно в списке, потому что считалась по снимку.
    await expect.element(page.getByRole('option', { name: 'Команда канваса' })).toBeVisible();
  });
});

describe('содержимое списка', () => {
  it('показывает пустое состояние, когда не нашлось ничего', async () => {
    const fixture = await mountPalette({ commands: [ALPHA, BETA] });
    await fixture.open();

    await userEvent.fill(page.getByRole('combobox'), 'щщщ');
    await expect.element(page.getByText('Ничего не найдено')).toBeVisible();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
  });

  it('подпись команды рисуется клавишами, а пояснение динамического пункта — текстом', async () => {
    // Различить их по самой строке нельзя: различает тот, кто её сделал. Ветка живёт
    // только в разметке, и до сих пор её ничто не проверяло.
    const fixture = await mountPalette({
      commands: [ALPHA],
      providers: [
        {
          id: 'files',
          provide: () => [
            { id: 'file:form.json', title: 'form.json', detail: 'src/forms', run: () => undefined },
          ],
        },
      ],
    });
    await fixture.open();

    const withKeys = page.getByRole('option', { name: /Альфа команда/ }).element();
    const keys = (): string[] =>
      Array.from(withKeys.querySelectorAll<HTMLElement>('kbd[data-slot="kbd"]')).map(
        (node) => node.textContent ?? ''
      );
    await vi.waitFor(() => {
      expect(keys().length).toBeGreaterThan(0);
    });
    expect(keys()).toEqual(['Ctrl', 'Shift', 'A']);

    const dynamic = await vi.waitFor(() => {
      const node = document.querySelector<HTMLElement>(
        '[role="option"][data-value="file:form.json"]'
      );
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    expect(dynamic.querySelectorAll('kbd').length).toBe(0);
    expect(dynamic.textContent).toContain('src/forms');
  });
});

describe('геометрия', () => {
  it('список виден и не схлопнут: `h-auto` вместо `h-full` кита', async () => {
    // Утверждение из кода: процент от неопределённой высоты родителя дал бы нулевую высоту.
    const fixture = await mountPalette({ commands: [ALPHA, BETA] });
    await fixture.open();

    // Высоты берутся из раскладки (`offsetHeight`), а не из прямоугольника: анимация входа
    // масштабирует окно, и прямоугольник зависел бы от момента замера.
    const list = document.querySelector<HTMLElement>('[data-slot="command-list"]');
    expect(list).not.toBeNull();
    expect(list?.offsetHeight).toBeGreaterThan(20);
    const root = document.querySelector<HTMLElement>('[data-slot="command"]');
    expect(root?.offsetHeight).toBeGreaterThan(20);
  });

  it('предел высоты списка — 60vh, а не 300px кита', async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      command({ id: `test.many.${String(index)}`, titleKey: 'test.beta.title' })
    );
    const fixture = await mountPalette({ commands: many });
    await fixture.open();

    const list = await vi.waitFor(() => {
      const node = document.querySelector<HTMLElement>('[data-slot="command-list"]');
      expect(node?.scrollHeight ?? 0).toBeGreaterThan(node?.clientHeight ?? 0);
      return node as HTMLElement;
    });
    const limit = window.innerHeight * 0.6;
    expect(list.clientHeight).toBeLessThanOrEqual(Math.ceil(limit) + 1);
    // Ограничение кита (300px) должно быть перебито: иначе список короче, чем задумано.
    expect(list.clientHeight).toBeGreaterThan(300);
  });

  it('окно сдвинуто к верху экрана, а не по центру', async () => {
    const fixture = await mountPalette({ commands: [ALPHA] });
    await fixture.open();

    // Вычисленный `top`, а не прямоугольник: `translate-y-0` и анимация входа сдвигают
    // второй, но не первый, а проверяется здесь именно переопределение `top-[50%]` кита.
    const dialog = page.getByRole('dialog').element();
    const top = Number.parseFloat(getComputedStyle(dialog).top);
    expect(Math.abs(top - window.innerHeight * 0.12)).toBeLessThan(2);
  });
});

describe('тема', () => {
  it('тёмная тема достаёт до окна, хотя оно в портале вне корня оболочки', async () => {
    // Вариант кита объявлен как `&:is(.dark *, [data-theme='dark'] *)`. Портал уходит
    // в `document.body`; работает это только потому, что класс стоит на `<html>`.
    const light = await mountPalette({ commands: [ALPHA] });
    await light.open();
    const lightBg = getComputedStyle(page.getByRole('dialog').element()).backgroundColor;
    light.unmount();

    document.documentElement.classList.add('dark');
    const dark = await mountPalette({ commands: [ALPHA] });
    await dark.open();
    const darkBg = getComputedStyle(page.getByRole('dialog').element()).backgroundColor;

    expect(darkBg).not.toBe(lightBg);
    expect(luminanceOf(darkBg)).toBeLessThan(luminanceOf(lightBg));
  });
});

/**
 * Грубая светлота цвета — нужна только для сравнения «темнее / светлее».
 *
 * Цвет разбирается канвасом, а не разбором строки: токены кита объявлены в `oklch`, и
 * Chrome возвращает вычисленный цвет в том же пространстве, а не в `rgb()`.
 */
function luminanceOf(color: string): number {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('канвас не дал контекста');
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return r * 0.299 + g * 0.587 + b * 0.114;
}

describe('жизненный цикл', () => {
  it('размонтирование снимает команду открытия — вторая палитра встаёт на то же место', async () => {
    // Регистрация живёт вместе с компонентом. Не сработает `dispose` — второй монтаж
    // упрётся в занятый идентификатор, и палитру станет нечем открыть: `run` останется
    // от размонтированного дерева и не покажет ничего.
    const registry = createCommandRegistry();
    const first = await mountPalette({ registry, commands: [ALPHA] });
    first.unmount();
    await vi.waitFor(() => {
      expect(registry.get(PALETTE_OPEN_COMMAND_ID)).toBeUndefined();
    });

    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    try {
      // Тот же реестр: занятый идентификатор был бы виден только здесь.
      const second = await mountPalette({ registry });
      await second.open();
      await expect.element(page.getByRole('option', { name: 'Альфа команда' })).toBeVisible();
    } finally {
      spy.mockRestore();
    }
    expect(errors).toEqual([]);
  });
});
