/**
 * Отражение выделения между канвасом и второй стороной — в настоящем браузере.
 *
 * Файл существует потому, что отражение — тот случай, где обычный тест почти ничего
 * не доказывает, а ошибка видна мгновенно. Проверяемое здесь не выражается в `node`:
 *
 * - **настоящие коммиты React.** Обе стороны читают канал через `useSyncExternalStore`,
 *   и «выделение доехало» означает не «значение записалось», а «вторая панель перерисовалась
 *   и показала его». Нестабильный снимок роняет React с «The result of getSnapshot should
 *   be cached» — здесь это видно, в чистой функции нет;
 * - **вечный круг.** Две стороны, отражающие выделение друг друга, — ровно та конструкция,
 *   которая крутится бесконечно, если защита от эха обойдена. Уведомление рассылается
 *   синхронно, поэтому цикл проявляется переполнением стека на первом же щелчке, а не
 *   зависанием у пользователя;
 * - **щелчок мышью**, а не вызов метода: выделение на канвасе рождается из события, и путь
 *   «событие → состояние → канал → чужая перерисовка» проходится целиком.
 *
 * ## Почему вторая сторона здесь своя, а не панель превью
 *
 * `src/plugins` не импортируют друг друга — правило проверяется линтером, — поэтому поднять
 * здесь настоящее превью нельзя. Двойник ведёт себя как оно: читает канал подпиской, пишет
 * в него по щелчку. Его половина проверена у себя (`plugins/preview/sessions.test`),
 * а сквозная проверка на НАСТОЯЩЕЙ службе вместе с обоими плагинами — работа композиции
 * (`src/app`), которой этот файл не заменяет.
 *
 * @module plugins/editor-schema/ui/selection-mirror.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { useCallback, useSyncExternalStore, type ReactElement } from 'react';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { renderReact } from '@/testing/render';
import type { CommandAccess } from '../editing/commands';
import { indexNodes } from '../model/node-index';
import { createSessionRegistry, type SessionRegistry } from '../session/sessions';
import {
  createFakeSchemaHost,
  createFakeSelectionChannel,
  type FakeSelectionChannel,
} from '../testing';
import { Canvas } from './Canvas';
import { useActiveSession, useSessionState } from './useSession';

const DOCUMENT = 'fake:form.json';
const FIELD_0 = ['root', 'componentProps', 'steps', 0, 'children', 0] as const;
const FIELD_1 = ['root', 'componentProps', 'steps', 0, 'children', 1] as const;

const NO_COMMANDS: CommandAccess = { has: () => false, run: () => undefined };

/**
 * Вторая сторона канала — то, чем для канваса является панель превью.
 *
 * Читает канал подпиской (иначе чужой щелчок до неё не дойдёт) и пишет в него по своему
 * щелчку. Снимок обязан быть стабильным по ссылке — канал это и гарантирует.
 */
function Mirror({
  channel,
  resource,
  pick,
}: {
  channel: FakeSelectionChannel;
  resource: string;
  pick: readonly string[];
}): ReactElement {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = channel.onDidChange((changed) => {
        if (changed === resource) onStoreChange();
      });
      return () => {
        subscription.dispose();
      };
    },
    [channel, resource]
  );
  const snapshot = useCallback(() => channel.get(resource), [channel, resource]);
  const selection = useSyncExternalStore(subscribe, snapshot, snapshot);

  return (
    <div>
      <span data-testid="mirror-selection">{selection.join(',')}</span>
      {pick.map((id) => (
        <button
          key={id}
          type="button"
          data-testid={`mirror-pick-${id}`}
          onClick={() => {
            channel.set(resource, [id]);
          }}
        >
          выбрать {id}
        </button>
      ))}
    </div>
  );
}

function Harness({
  registry,
  channel,
  pick,
}: {
  registry: SessionRegistry;
  channel: FakeSelectionChannel;
  pick: readonly string[];
}): ReactElement {
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  if (session === null || state === null) return <div>сеанса нет</div>;
  return (
    <div className="flex">
      <div style={{ width: 420 }}>
        <Canvas session={session} state={state} t={(key) => key} commands={NO_COMMANDS} />
      </div>
      <Mirror channel={channel} resource={DOCUMENT} pick={pick} />
    </div>
  );
}

async function mount() {
  const host = createFakeSchemaHost({ documentId: DOCUMENT, text: JSON.stringify(sampleSchema()) });
  const registry = createSessionRegistry({ host });
  const channel = createFakeSelectionChannel();
  registry.connectSelection(channel);
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');

  const index = indexNodes(session.get().model);
  const idAt = (path: readonly (string | number)[]): string => {
    const id = index.idAt(path);
    if (id === undefined) throw new Error(`нет адреса по пути ${path.join('/')}`);
    return id;
  };

  const mounted = renderReact(
    <Harness registry={registry} channel={channel} pick={[idAt(FIELD_0), idAt(FIELD_1)]} />
  );
  await vi.waitFor(() => {
    if (mounted.container.querySelector('[data-node-id]') === null) {
      throw new Error('дерево ещё не отрисовано');
    }
  });

  return { channel, session, idAt, unmount: mounted.unmount };
}

function row(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
  if (element === null) throw new Error(`строки ${id} нет на экране`);
  return element;
}

function pickButton(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-testid="mirror-pick-${id}"]`);
  if (element === null) throw new Error(`кнопки выбора ${id} нет на экране`);
  return element;
}

function mirrorText(): string {
  return document.querySelector<HTMLElement>('[data-testid="mirror-selection"]')?.textContent ?? '';
}

describe('отражение выделения', () => {
  it('щелчок по строке канваса доезжает до второй стороны', async () => {
    const fixture = await mount();
    const field = fixture.idAt(FIELD_1);

    await userEvent.click(row(field));

    await expect.poll(mirrorText).toBe(field);
    fixture.unmount();
  });

  it('щелчок на второй стороне переезжает на канвас', async () => {
    const fixture = await mount();
    const field = fixture.idAt(FIELD_0);

    await userEvent.click(pickButton(field));

    await expect.poll(() => row(field).getAttribute('aria-selected')).toBe('true');
    expect(fixture.session.get().selection).toEqual([field]);
    fixture.unmount();
  });

  it('круг не замыкается: один щелчок — одно уведомление канала', async () => {
    const fixture = await mount();
    const first = fixture.idAt(FIELD_0);
    const second = fixture.idAt(FIELD_1);

    await userEvent.click(row(first));
    await expect.poll(mirrorText).toBe(first);
    const afterFirst = fixture.channel.notifications();

    await userEvent.click(row(second));
    await expect.poll(mirrorText).toBe(second);

    // Ровно одно на щелчок. Больше означало бы, что стороны отражают друг друга по кругу,
    // а не гасят совпадающее по содержимому значение.
    expect(fixture.channel.notifications()).toBe(afterFirst + 1);
    fixture.unmount();
  });

  it('обе стороны остаются живыми после десятка щелчков туда-обратно', async () => {
    const fixture = await mount();
    const first = fixture.idAt(FIELD_0);
    const second = fixture.idAt(FIELD_1);
    const before = fixture.channel.notifications();

    // Если бы отражение зацикливалось, первый же щелчок уронил бы страницу переполнением
    // стека: уведомление рассылается синхронно, как у настоящей службы.
    for (let round = 0; round < 5; round += 1) {
      await userEvent.click(row(first));
      await expect.poll(mirrorText).toBe(first);
      await userEvent.click(pickButton(second));
      await expect.poll(() => row(second).getAttribute('aria-selected')).toBe('true');
    }

    expect(fixture.channel.notifications()).toBe(before + 10);
    expect(fixture.session.get().selection).toEqual([second]);
    fixture.unmount();
  });
});
