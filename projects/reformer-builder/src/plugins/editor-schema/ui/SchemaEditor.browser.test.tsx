/**
 * Тело редактора схемы: что переживает перерисовку.
 *
 * Файл написан по следам дефекта, из-за которого исходник схемы нельзя было править вовсе:
 * композиция отдавала тело редактора кода обёрткой, создававшей компонент заново на каждой
 * отрисовке. React сравнивает тип элемента по ссылке, поэтому любая перерисовка родителя —
 * клик, пришедшая диагностика, смена локали — размонтировала Monaco и монтировала заново,
 * теряя курсор и набранное.
 *
 * Корень был в композиции (`app/boot`), и предпосылку охраняет её собственный тест. Здесь
 * проверяется вторая половина цепочки: сам редактор схемы, получив стабильное тело, обязан
 * его не пересоздавать — ни при правке модели, ни при смене выделения.
 *
 * Монтирование считается двойником вместо Monaco: настоящий редактор поднимает движок
 * на несколько мегабайт, а проверяемое свойство — про идентичность типа элемента, и оно
 * от содержимого тела не зависит.
 *
 * @module plugins/editor-schema/ui/SchemaEditor.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactElement } from 'react';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import type { ResourceId } from '@/sdk';
import { renderReact } from '@/testing/render';
import type { CommandAccess } from '../editing/commands';
import { indexNodes } from '../model/node-index';
import { setPropOp } from '../model/ops';
import { createSessionRegistry } from '../session/sessions';
import { createFakeSchemaHost } from '../testing';
import { createSchemaViewStore } from '../session/view-mode';
import { SchemaEditor } from './SchemaEditor';

const DOCUMENT = 'fake:form.json' as ResourceId;

const NO_COMMANDS: CommandAccess = { has: () => false, run: () => undefined };

describe('режим исходника', () => {
  it('правка модели не перемонтирует тело редактора кода', async () => {
    let mounts = 0;
    /** Двойник тела Monaco: считает монтирования и больше ничего не делает. */
    function TextEditor({ documentId }: { documentId: ResourceId }): ReactElement {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <div data-testid="code-body">{documentId}</div>;
    }

    const host = {
      ...createFakeSchemaHost({
        documentId: DOCUMENT,
        text: JSON.stringify(sampleSchema(), null, 2),
      }),
      TextEditor,
    };
    const registry = createSessionRegistry({ host });
    const views = createSchemaViewStore({ settings: null, hasTextEditor: () => true });
    views.set(DOCUMENT, 'code');

    const rendered = renderReact(
      <SchemaEditor
        host={host}
        registry={registry}
        documentId={DOCUMENT}
        commands={NO_COMMANDS}
        views={views}
      />
    );

    try {
      await vi.waitFor(() => {
        expect(mounts).toBe(1);
      });

      const session = registry.get(DOCUMENT);
      const target = indexNodes(session?.get().model ?? sampleSchema()).idAt(['root']);
      expect(target).toBeDefined();
      for (let index = 0; index < 5; index += 1) {
        session?.apply(setPropOp(target as string, 'className', `bg-white p-${index}`));
      }

      // Пять правок — по-прежнему одно монтирование. Иначе каждое нажатие клавиши в исходнике
      // роняло бы позицию курсора: именно так дефект и выглядел.
      await vi.waitFor(() => {
        expect(document.querySelector('[data-testid="code-body"]')).not.toBeNull();
      });
      expect(mounts).toBe(1);
    } finally {
      rendered.unmount();
    }
  });
});
