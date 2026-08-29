/**
 * Быстрые исправления в панели проблем — в настоящем браузере.
 *
 * Панель — то место, где исправление видно ВСЕГДА: на канвасе находка ложится только на узел,
 * а здесь показаны и те, что адресованы файлом целиком (осиротевшее правило). Проверяется
 * в браузере ровно то, что без него невыразимо:
 *
 * - **кнопка внутри кликабельной строки.** Щелчок по исправлению не должен становиться
 *   переходом к файлу: человек чинит находку, а не уходит с разбираемого списка. Это
 *   свойство всплытия события в настоящем DOM;
 * - **исчезновение кнопки на перерисовке.** Отбор по реестру команд идёт при каждой сборке
 *   списка, потому что плагин, владеющий командой, могли выключить между публикацией находки
 *   и этим кадром;
 * - **разметка кита.** Кнопка — `@reformer/ui-kit`, и то, что она умещается в строку рядом
 *   с меткой узла, видно только в браузере с настоящим каскадом.
 *
 * @module plugins/files/ProblemsPanel.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useMemo, useState, type ReactElement } from 'react';
import type { Diagnostic, DiagnosticsService, Disposable, ResourceId } from '@/sdk';
import { renderReact } from '@/testing/render';
import type { CommandAccess } from './diagnostics';
import type { FilesHost } from './host';
import { ProblemsPanel } from './ProblemsPanel';

const RESOURCE = 'fs:forms/credit/schema.json';

const FIX = {
  titleKey: 'quickfix.remove-orphan-rule',
  commandId: 'rules.remove',
  args: { resource: RESOURCE, list: 'validation', index: 0 },
};

const FINDING: Diagnostic = {
  source: 'validator.schema',
  severity: 'warning',
  code: 'rules.validation-target-missing',
  params: { target: 'loanAmount' },
  target: { kind: 'resource' },
  fixes: [FIX],
};

interface Call {
  readonly commandId: string;
  readonly args: unknown;
}

/**
 * Двойник службы диагностик: вторая реализация контракта, как и в `./plugin.test`.
 *
 * Прямая цена границы слоёв — `plugins/**` не видит `@/host`, настоящую службу в тест
 * не взять. Здесь достаточно ответов на три вопроса, которые задаёт панель.
 */
function fakeDiagnostics(items: readonly Diagnostic[]): DiagnosticsService {
  return {
    publish: () => undefined,
    get: (resource: ResourceId) => (resource === RESOURCE ? items : []),
    resources: () => [RESOURCE],
    onDidChange: (): Disposable => ({ dispose: () => undefined }),
  };
}

function fakeHost(openResource: (id: ResourceId) => void): FilesHost {
  return {
    ResourceTreePanel: () => null,
    useTranslate: () => (key: string) => key,
    useDiagnosticMessage: () => (code: string) => `⟨${code}⟩`,
    useQuickFixTitle: () => (key: string) =>
      key === FIX.titleKey ? 'Убрать осиротевшее правило' : key,
    canOpenProject: () => true,
    hasProject: () => true,
    openProject: () => Promise.resolve(true),
    save: () => Promise.resolve(true),
    saveAll: () => Promise.resolve(true),
    activeResource: () => RESOURCE,
    openResource,
    isDirty: () => false,
    documentOf: () => null,
    writeText: () => Promise.resolve(),
    isTextual: () => true,
    // Операции, дерево и корень — то, чем пользуются команды дерева; двойник отвечает
    // «проекта нет», и этого хватает всем тестам, которые про них не спрашивают.
    resources: () => null,
    treeSelection: () => [],
    treeRoot: () => null,
  };
}

function Harness({ calls, opened }: { calls: Call[]; opened: ResourceId[] }): ReactElement {
  const [registered, setRegistered] = useState(true);
  const commands = useMemo<CommandAccess>(
    () => ({
      has: () => registered,
      run: (commandId, args) => {
        calls.push({ commandId, args });
      },
    }),
    [registered, calls]
  );
  const host = useMemo(
    () =>
      fakeHost((id) => {
        opened.push(id);
      }),
    [opened]
  );

  return (
    <div>
      <button
        type="button"
        data-testid="unregister"
        onClick={() => {
          setRegistered(false);
        }}
      >
        выключить владельца команды
      </button>
      <div style={{ width: 520, height: 240 }}>
        <ProblemsPanel host={host} diagnostics={fakeDiagnostics([FINDING])} commands={commands} />
      </div>
    </div>
  );
}

async function mount() {
  const calls: Call[] = [];
  const opened: ResourceId[] = [];
  const mounted = renderReact(<Harness calls={calls} opened={opened} />);
  await vi.waitFor(() => {
    if (mounted.container.querySelector('[role="listitem"]') === null) {
      throw new Error('строки ещё не отрисованы');
    }
  });
  return { calls, opened, unmount: mounted.unmount };
}

function fixButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-fix="${FIX.commandId}"]`);
}

describe('исправление в строке панели проблем', () => {
  it('кнопка подписана словарём Host, а не ключом', async () => {
    const fixture = await mount();

    await expect.poll(() => fixButton()?.textContent).toBe('Убрать осиротевшее правило');
    fixture.unmount();
  });

  it('щелчок зовёт команду с аргументами и НЕ уводит к файлу', async () => {
    const fixture = await mount();

    await userEvent.click(fixButton()!);

    await expect.poll(() => fixture.calls).toEqual([{ commandId: FIX.commandId, args: FIX.args }]);
    expect(fixture.opened).toEqual([]);
    fixture.unmount();
  });

  it('щелчок по самой строке по-прежнему открывает файл', async () => {
    const fixture = await mount();

    await userEvent.click(document.querySelector<HTMLElement>('[role="listitem"]')!);

    await expect.poll(() => fixture.opened).toEqual([RESOURCE]);
    expect(fixture.calls).toEqual([]);
    fixture.unmount();
  });

  it('владельца команды выключили — кнопка исчезает, а строка остаётся', async () => {
    const fixture = await mount();
    expect(fixButton()).not.toBeNull();

    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="unregister"]')!);

    await expect.poll(fixButton).toBeNull();
    expect(document.querySelector('[role="listitem"]')).not.toBeNull();
    fixture.unmount();
  });
});
