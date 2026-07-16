import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  CommandDialog,
  CommandEmpty,
} from './index';

// Command = cmdk wrapper (не form-control). cmdk рендерит в SSR обычные <div>/<input> с
// cmdk-* атрибутами — статику можно тестировать. CommandDialog кладёт контент в Dialog Portal
// (в SSR отсутствует), но sr-only DialogHeader (заголовок/описание) — вне портала, доступен.

describe('Command (base, cmdk wrapper)', () => {
  it('Command root несёт data-slot="command" и cmdk-root', () => {
    const html = renderToStaticMarkup(<Command />);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="command"');
    expect(html).toContain('cmdk-root');
  });

  it('Command мёржит className (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Command className="bg-red-500" />);
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('bg-popover');
  });

  it('CommandInput рендерит wrapper с SearchIcon и cmdk-input', () => {
    const html = renderToStaticMarkup(
      <Command>
        <CommandInput placeholder="Поиск…" />
      </Command>
    );
    expect(html).toContain('data-slot="command-input-wrapper"');
    expect(html).toContain('data-slot="command-input"');
    // lucide SearchIcon — <svg> внутри враппера
    expect(html).toContain('<svg');
    expect(html).toContain('placeholder="Поиск…"');
  });

  it('CommandList несёт data-slot="command-list" и cmdk-list', () => {
    const html = renderToStaticMarkup(
      <Command>
        <CommandList>
          <CommandItem>Пункт</CommandItem>
        </CommandList>
      </Command>
    );
    expect(html).toContain('data-slot="command-list"');
    expect(html).toContain('cmdk-list');
  });

  it('CommandGroup рендерит heading (cmdk-group-heading)', () => {
    const html = renderToStaticMarkup(
      <Command>
        <CommandList>
          <CommandGroup heading="Действия">
            <CommandItem>Открыть</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    expect(html).toContain('data-slot="command-group"');
    expect(html).toContain('cmdk-group');
    expect(html).toContain('Действия');
  });

  it('CommandSeparator несёт data-slot="command-separator"', () => {
    const html = renderToStaticMarkup(
      <Command>
        <CommandList>
          <CommandSeparator />
        </CommandList>
      </Command>
    );
    expect(html).toContain('data-slot="command-separator"');
  });

  it('CommandEmpty несёт data-slot="command-empty"', () => {
    const html = renderToStaticMarkup(
      <Command>
        <CommandList>
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        </CommandList>
      </Command>
    );
    expect(html).toContain('data-slot="command-empty"');
    expect(html).toContain('Ничего не найдено');
  });

  it('CommandShortcut — self-contained span со своим data-slot', () => {
    const html = renderToStaticMarkup(<CommandShortcut>⌘K</CommandShortcut>);
    expect(html).toMatch(/^<span/);
    expect(html).toContain('data-slot="command-shortcut"');
    expect(html).toContain('text-muted-foreground');
    expect(html).toContain('⌘K');
  });

  it('CommandShortcut мёржит className (caller wins)', () => {
    const html = renderToStaticMarkup(
      <CommandShortcut className="text-red-500">X</CommandShortcut>
    );
    expect(html).toContain('text-red-500');
    expect(html).not.toContain('text-muted-foreground');
  });

  it('CommandItem прокидывает произвольные props (напр. data-testid)', () => {
    const html = renderToStaticMarkup(
      <Command>
        <CommandList>
          <CommandItem data-testid="cmd-item-x">Пункт</CommandItem>
        </CommandList>
      </Command>
    );
    expect(html).toContain('data-slot="command-item"');
    expect(html).toContain('data-testid="cmd-item-x"');
  });

  it('CommandDialog: контент в Dialog Portal (в SSR отсутствует), но sr-only заголовок доступен', () => {
    const html = renderToStaticMarkup(
      <CommandDialog title="Палитра" description="Поиск команд">
        <CommandInput placeholder="Введите команду…" />
        <CommandList>
          <CommandItem>Файл</CommandItem>
        </CommandList>
      </CommandDialog>
    );
    // DialogHeader вне портала → sr-only заголовок/описание рендерятся
    expect(html).toContain('Палитра');
    expect(html).toContain('Поиск команд');
    // DialogContent (с Command и его input) — в Portal, в SSR отсутствует
    expect(html).not.toContain('data-slot="command-input"');
    expect(html).not.toContain('data-slot="command-content"');
  });
});
