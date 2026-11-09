// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from './index';

/** Состояние провайдера в разметке — чтобы проверять его без desktop-CSS. */
function StateProbe({ testId }: { testId: string }) {
  const { state } = useSidebar();
  return <span data-testid={testId}>{state}</span>;
}

const DESKTOP_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
}

function clearSidebarCookie() {
  document.cookie = 'sidebar_state=; path=/; max-age=0';
}

function pressCtrlB(target: Element | Window = window) {
  act(() => {
    fireEvent.keyDown(target, { key: 'b', ctrlKey: true, bubbles: true });
  });
}

beforeEach(() => {
  setViewportWidth(1280);
  clearSidebarCookie();
});

afterEach(() => {
  cleanup();
  clearSidebarCookie();
  setViewportWidth(DESKTOP_WIDTH);
});

describe('SidebarProvider (DOM): cookie sidebar_state', () => {
  it('восстанавливает сохранённое состояние поверх defaultOpen', () => {
    document.cookie = 'sidebar_state=false; path=/';
    render(
      <SidebarProvider defaultOpen>
        <StateProbe testId="state" />
      </SidebarProvider>
    );
    expect(screen.getByTestId('state').textContent).toBe('collapsed');
  });

  it('без cookie действует defaultOpen; переключение пишет cookie', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <StateProbe testId="state" />
        <SidebarTrigger />
      </SidebarProvider>
    );
    expect(screen.getByTestId('state').textContent).toBe('collapsed');
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.getByTestId('state').textContent).toBe('expanded');
    expect(document.cookie).toContain('sidebar_state=true');
  });

  it('в управляемом режиме cookie не перебивает open', () => {
    document.cookie = 'sidebar_state=false; path=/';
    render(
      <SidebarProvider open>
        <StateProbe testId="state" />
      </SidebarProvider>
    );
    expect(screen.getByTestId('state').textContent).toBe('expanded');
  });
});

describe('SidebarProvider (DOM): Ctrl/Cmd+B', () => {
  it('переключает панель, но не перехватывается в поле ввода и редакторе', () => {
    render(
      <SidebarProvider>
        <StateProbe testId="state" />
        <input aria-label="Поиск" />
        <div contentEditable suppressContentEditableWarning data-testid="editor">
          текст
        </div>
      </SidebarProvider>
    );
    const state = screen.getByTestId('state');
    pressCtrlB(screen.getByLabelText('Поиск'));
    pressCtrlB(screen.getByTestId('editor'));
    expect(state.textContent).toBe('expanded');

    pressCtrlB(document.body);
    expect(state.textContent).toBe('collapsed');
  });

  it('несколько провайдеров: одно нажатие переключает одну и ту же панель', () => {
    render(
      <>
        <SidebarProvider>
          <StateProbe testId="first" />
        </SidebarProvider>
        <SidebarProvider>
          <StateProbe testId="second" />
        </SidebarProvider>
      </>
    );
    pressCtrlB(document.body);
    expect(screen.getByTestId('first').textContent).toBe('collapsed');
    expect(screen.getByTestId('second').textContent).toBe('expanded');

    // Переключение не меняет очередь слушателей: снова отвечает тот же провайдер.
    pressCtrlB(document.body);
    expect(screen.getByTestId('first').textContent).toBe('expanded');
    expect(screen.getByTestId('second').textContent).toBe('expanded');
  });
});

describe('Sidebar (DOM): узкий экран', () => {
  it('className/style/data-*/aria-* доходят до панели в Sheet; триггер — aria-expanded', () => {
    setViewportWidth(500);
    render(
      <SidebarProvider>
        <Sidebar
          className="my-sidebar"
          style={{ color: 'red' }}
          data-testid="app-sidebar"
          aria-label="Навигация"
        >
          <a href="#a">Пункт</a>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    );
    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => {
      trigger.click();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const panel = screen.getByTestId('app-sidebar');
    expect(panel.getAttribute('data-mobile')).toBe('true');
    expect(panel.className).toContain('my-sidebar');
    expect(panel.className).toContain('bg-sidebar');
    expect(panel.getAttribute('aria-label')).toBe('Навигация');
    expect(panel.style.color).toBe('red');
    // aria-controls триггера указывает внутрь открытой панели.
    const controlled = document.getElementById(trigger.getAttribute('aria-controls')!);
    expect(controlled).not.toBeNull();
    expect(panel.contains(controlled)).toBe(true);
  });
});
