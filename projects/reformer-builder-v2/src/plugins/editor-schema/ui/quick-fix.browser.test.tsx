/**
 * Быстрые исправления на канвасе — в настоящем браузере.
 *
 * Механика «код находки плюс команда исправления» полгода не работала ни одним концом:
 * команд не регистрировал никто, а `Diagnostic.fixes` не читал ни один потребитель. Здесь
 * проверяется второй конец — тот, что рисует, — и проверяется он в браузере по трём причинам:
 *
 * - **кнопка внутри строки, которая сама кликабельна.** Щелчок по исправлению не должен
 *   становиться щелчком по строке (то есть менять выделение). Это свойство всплытия события
 *   в настоящем DOM, и в чистой функции его нет;
 * - **исчезновение кнопки.** Отбор идёт на КАЖДОЙ отрисовке: плагин, владеющий командой,
 *   могли выключить между публикацией находки и этим кадром. Проверяется это перерисовкой,
 *   а не вызовом функции;
 * - **связь с реестром команд.** Исправление называет команду строкой и передаёт ей
 *   аргументы; здесь видно, что до реестра доехали и то и другое.
 *
 * @module plugins/editor-schema/ui/quick-fix.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useMemo, useState, type ReactElement } from 'react';
import type { Diagnostic } from '@/sdk';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { renderReact } from '@/testing/render';
import type { CommandAccess } from '../commands';
import { indexNodes } from '../node-index';
import { createSessionRegistry, type SessionRegistry } from '../sessions';
import { createFakeSchemaHost } from '../testing';
import { Canvas } from './Canvas';
import { useActiveSession, useSessionState } from './useSession';

const DOCUMENT = 'fake:form.json';
const FIELD = ['root', 'componentProps', 'steps', 0, 'children', 1] as const;

const FIX = {
  titleKey: 'quickfix.replace-component',
  commandId: 'schema.set-component',
  args: { resource: DOCUMENT, nodeId: '', name: 'Input' },
};

interface Call {
  readonly commandId: string;
  readonly args: unknown;
}

/**
 * Канвас над сеансом с находкой, у которой есть исправление.
 *
 * Переключатель «команда есть / команды нет» — состояние компонента: исчезновение кнопки
 * обязано случиться от ПЕРЕРИСОВКИ, ровно как в приложении, где плагин выключают на ходу.
 */
function Harness({
  registry,
  problems,
  calls,
}: {
  registry: SessionRegistry;
  problems: readonly Diagnostic[];
  calls: Call[];
}): ReactElement {
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
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  if (session === null || state === null) return <div>сеанса нет</div>;

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
      <div style={{ width: 420 }}>
        <Canvas
          session={session}
          state={state}
          t={(key) => key}
          commands={commands}
          problems={problems}
          message={(code) => code}
          fixTitle={(key) => (key === FIX.titleKey ? 'Подставить ближайшее имя' : key)}
        />
      </div>
    </div>
  );
}

async function mount() {
  const host = createFakeSchemaHost({ documentId: DOCUMENT, text: JSON.stringify(sampleSchema()) });
  const registry = createSessionRegistry({ host });
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');

  const nodeId = indexNodes(session.get().model).idAt(FIELD);
  if (nodeId === undefined) throw new Error('нет адреса поля');

  const fix = { ...FIX, args: { ...FIX.args, nodeId } };
  const problems: readonly Diagnostic[] = [
    {
      source: 'validator.schema',
      severity: 'error',
      code: 'schema.unknown-component',
      params: { name: 'Inpt', suggestion: 'Input' },
      target: { kind: 'node', nodeId },
      fixes: [fix],
    },
  ];

  const calls: Call[] = [];
  const mounted = renderReact(<Harness registry={registry} problems={problems} calls={calls} />);
  await vi.waitFor(() => {
    if (mounted.container.querySelector('[data-node-id]') === null) {
      throw new Error('дерево ещё не отрисовано');
    }
  });

  return { session, nodeId, fix, calls, unmount: mounted.unmount };
}

function fixButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-fix="${FIX.commandId}"]`);
}

describe('исправление на строке узла', () => {
  it('кнопка появляется у узла с находкой и подписана словарём Host', async () => {
    const fixture = await mount();

    await expect
      .poll(() => fixButton()?.getAttribute('aria-label'))
      .toBe('Подставить ближайшее имя');
    fixture.unmount();
  });

  it('щелчок зовёт команду вместе с аргументами исправления', async () => {
    const fixture = await mount();

    await userEvent.click(fixButton()!);

    await expect
      .poll(() => fixture.calls)
      .toEqual([{ commandId: FIX.commandId, args: fixture.fix.args }]);
    fixture.unmount();
  });

  it('щелчок по кнопке не выделяет узел: починка не уводит курсор', async () => {
    const fixture = await mount();

    await userEvent.click(fixButton()!);

    await expect.poll(() => fixture.calls.length).toBe(1);
    expect(fixture.session.get().selection).toEqual([]);
    fixture.unmount();
  });

  it('владельца команды выключили — кнопка исчезает, а не отказывает при нажатии', async () => {
    const fixture = await mount();
    expect(fixButton()).not.toBeNull();

    await userEvent.click(document.querySelector<HTMLElement>('[data-testid="unregister"]')!);

    await expect.poll(fixButton).toBeNull();
    expect(fixture.calls).toEqual([]);
    fixture.unmount();
  });
});
