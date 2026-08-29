import { describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry } from '../primitives/extension-point';
import { makeResourceId, type ResourceRef } from '../primitives/resource';
import { createI18nService } from '../services/i18n/i18n';
import { createEditorProbe } from '../workspace/model/provider';
import { createLazyEditorProbe } from './editors';
import {
  ResourceDecorationPoint,
  decorationTooltip,
  mergeDecorations,
  observeDecorations,
  type DecorationEntry,
  type ResourceDecorationContribution,
} from './decorations';

function ref(path: string, mediaType = 'application/json'): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType,
  };
}

function entriesOf(
  items: readonly {
    plugin?: string;
    decoration: ResourceDecorationContribution;
    order?: number;
  }[]
): readonly DecorationEntry[] {
  const root = createExtensionRegistry();
  for (const item of items) {
    root
      .forPlugin(item.plugin ?? 'test')
      .contribute(ResourceDecorationPoint, item.decoration, { order: item.order });
  }
  return root.get(ResourceDecorationPoint);
}

const SCHEMA = ref('forms/credit/schema.json');
const PROBE = createEditorProbe('{}');

describe('точка расширения декораций', () => {
  it('у Host она пуста: заполнить её может только вклад плагина', () => {
    // Проверяется не «мы забыли внести», а свойство устройства: у корневого реестра
    // метода `contribute` нет вовсе, поэтому «декорация от Host» невыразима.
    const root = createExtensionRegistry();
    expect(root.get(ResourceDecorationPoint)).toEqual([]);
    expect('contribute' in root).toBe(false);
  });

  it('фиктивный вклад работает: пометка доходит до дерева', () => {
    const entries = entriesOf([
      {
        plugin: 'schema',
        decoration: {
          id: 'form-schema',
          decorate: (candidate) =>
            candidate.name.endsWith('schema.json') ? { badge: 'S', tone: 'accent' } : null,
        },
      },
    ]);

    expect(mergeDecorations(entries, SCHEMA, PROBE)).toEqual({
      badge: 'S',
      icon: undefined,
      tooltipKey: undefined,
      tooltipPluginId: undefined,
      tone: 'accent',
    });
    expect(mergeDecorations(entries, ref('package.json'), PROBE)).toBeNull();
  });
});

describe('mergeDecorations', () => {
  it('без вкладов и без высказавшихся — `null`', () => {
    expect(mergeDecorations([], SCHEMA, PROBE)).toBeNull();
    expect(
      mergeDecorations(
        entriesOf([{ decoration: { id: 'quiet', decorate: () => null } }]),
        SCHEMA,
        PROBE
      )
    ).toBeNull();
  });

  it('пустая пометка неотличима от её отсутствия', () => {
    const entries = entriesOf([{ decoration: { id: 'empty', decorate: () => ({}) } }]);
    expect(mergeDecorations(entries, SCHEMA, PROBE)).toBeNull();
  });

  it('значок, иконку и подсказку берёт первый, кто их задал', () => {
    const first: ResourceDecorationContribution = {
      id: 'kind',
      decorate: () => ({ badge: 'S', tooltipKey: 'kind.schema' }),
    };
    const second: ResourceDecorationContribution = {
      id: 'git',
      decorate: () => ({ badge: 'M', tooltipKey: 'git.modified' }),
    };
    const entries = entriesOf([
      { decoration: second, order: 10 },
      { decoration: first, order: -10 },
    ]);

    const merged = mergeDecorations(entries, SCHEMA, PROBE);
    expect(merged?.badge).toBe('S');
    expect(merged?.tooltipKey).toBe('kind.schema');
  });

  it('поля добираются у разных вкладов, а не берутся у одного', () => {
    const entries = entriesOf([
      { decoration: { id: 'kind', decorate: () => ({ badge: 'S' }) }, order: 0 },
      { decoration: { id: 'errors', decorate: () => ({ tooltipKey: 'errors.two' }) }, order: 1 },
    ]);

    expect(mergeDecorations(entries, SCHEMA, PROBE)).toEqual({
      badge: 'S',
      icon: undefined,
      tooltipKey: 'errors.two',
      tooltipPluginId: 'test',
      tone: undefined,
    });
  });

  it('подсказка помнит, чей словарь её разрешает', async () => {
    const entries = entriesOf([
      { plugin: 'schema', decoration: { id: 'kind', decorate: () => ({ tooltipKey: 'kind' }) } },
    ]);
    const i18n = createI18nService({ loadHostMessages: () => Promise.resolve({}), dev: false });
    await i18n.setLocale('ru');
    i18n.forPlugin('schema').contribute('ru', { kind: 'Схема формы' });
    // Тот же ключ в словаре другого плагина — другое сообщение; выбор делает происхождение вклада.
    i18n.forPlugin('other').contribute('ru', { kind: 'Что-то другое' });

    const merged = mergeDecorations(entries, SCHEMA, PROBE);
    expect(merged?.tooltipPluginId).toBe('schema');
    expect(merged === null ? null : decorationTooltip(i18n, merged)).toBe('Схема формы');
  });

  it('без подсказки разрешать нечего', () => {
    const entries = entriesOf([{ decoration: { id: 'kind', decorate: () => ({ badge: 'S' }) } }]);
    const merged = mergeDecorations(entries, SCHEMA, PROBE);
    const i18n = createI18nService();
    expect(merged === null ? null : decorationTooltip(i18n, merged)).toBeNull();
  });

  it('тон побеждает самый строгий, кем бы он ни был объявлен', () => {
    // Ровно тот случай, ради которого правило для тона отличается: пометка «это схема формы»
    // не имеет права закрыть собой ошибку валидации.
    const entries = entriesOf([
      { decoration: { id: 'kind', decorate: () => ({ badge: 'S', tone: 'accent' }) }, order: -10 },
      { decoration: { id: 'errors', decorate: () => ({ tone: 'danger' }) }, order: 10 },
    ]);

    const merged = mergeDecorations(entries, SCHEMA, PROBE);
    expect(merged?.tone).toBe('danger');
    expect(merged?.badge).toBe('S');
  });

  it('менее строгий тон не понижает уже выбранный', () => {
    const entries = entriesOf([
      { decoration: { id: 'errors', decorate: () => ({ tone: 'danger' }) }, order: -10 },
      { decoration: { id: 'kind', decorate: () => ({ tone: 'default' }) }, order: 10 },
    ]);

    expect(mergeDecorations(entries, SCHEMA, PROBE)?.tone).toBe('danger');
  });

  it('упавший вклад пропускается, остальные высказываются', () => {
    const entries = entriesOf([
      {
        decoration: {
          id: 'broken',
          decorate: () => {
            throw new Error('плагин сломан');
          },
        },
        order: -10,
      },
      { decoration: { id: 'ok', decorate: () => ({ badge: 'S' }) }, order: 10 },
    ]);
    const onError = vi.fn();

    expect(mergeDecorations(entries, SCHEMA, PROBE, onError)?.badge).toBe('S');
    expect(onError).toHaveBeenCalledOnce();
  });

  it('ленивая проба не читает содержимое ради строки дерева', () => {
    const read = vi.fn(() => Promise.resolve('{}'));
    const entries = entriesOf([
      { decoration: { id: 'by-name', decorate: (candidate) => ({ badge: candidate.name[0] }) } },
    ]);

    mergeDecorations(entries, SCHEMA, createLazyEditorProbe(read));

    expect(read).not.toHaveBeenCalled();
  });
});

describe('подсказка с параметрами', () => {
  it('счётчик подставляется при показе, а не вклеивается вкладом в строку', () => {
    const i18n = createI18nService();
    i18n
      .forPlugin('files')
      .contribute('en', { 'tree.problems': '{count, plural, one{# problem} other{# problems}}' });
    const entries = entriesOf([
      {
        plugin: 'files',
        decoration: {
          id: 'diagnostics',
          decorate: () => ({
            badge: '3',
            tone: 'danger',
            tooltipKey: 'tree.problems',
            tooltipParams: { count: 3 },
          }),
        },
      },
    ]);

    const merged = mergeDecorations(entries, SCHEMA, PROBE);

    expect(merged).not.toBeNull();
    expect(decorationTooltip(i18n, merged!)).toBe('3 problems');
  });

  it('параметры едут вместе со СВОИМ ключом: чужие не подставляются', () => {
    const entries = entriesOf([
      {
        plugin: 'schema',
        order: 1,
        decoration: { id: 'kind', decorate: () => ({ tooltipKey: 'kind.schema' }) },
      },
      {
        plugin: 'files',
        order: 2,
        decoration: {
          id: 'diagnostics',
          decorate: () => ({ tooltipKey: 'tree.problems', tooltipParams: { count: 3 } }),
        },
      },
    ]);

    const merged = mergeDecorations(entries, SCHEMA, PROBE);

    // Ключ взял первый вклад — значит и параметров у слияния нет: подставлять чужие в чужой
    // ключ значило бы показать «3» там, где про счёт речи не шло.
    expect(merged?.tooltipKey).toBe('kind.schema');
    expect(merged?.tooltipParams).toBeUndefined();
  });
});

describe('вклад сообщает, что его пометка изменилась', () => {
  it('подписывает всех, кто это умеет, и пропускает тех, кто не умеет', () => {
    let captured: unknown = null;
    const observe = vi.fn((cb: () => void) => {
      captured = cb;
      return { dispose: () => undefined };
    });
    const entries = entriesOf([
      { plugin: 'schema', decoration: { id: 'kind', decorate: () => null } },
      {
        plugin: 'files',
        decoration: { id: 'diagnostics', decorate: () => null, onDidChange: observe },
      },
    ]);
    const onChange = vi.fn();

    observeDecorations(entries, onChange);

    expect(observe).toHaveBeenCalledOnce();
    // Вклад получает ИМЕННО тот обработчик, что дало дерево: обёртка вокруг него означала
    // бы, что снять подписку и снять обработчик — разные вещи.
    expect(captured).toBe(onChange);
  });

  it('dispose снимает подписки и терпит повторный вызов', () => {
    const dispose = vi.fn();
    const entries = entriesOf([
      {
        plugin: 'files',
        decoration: { id: 'diagnostics', decorate: () => null, onDidChange: () => ({ dispose }) },
      },
    ]);

    const subscription = observeDecorations(entries, () => undefined);
    subscription.dispose();
    subscription.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it('упавшая подписка не мешает остальным: дерево живёт и со сломанным плагином', () => {
    const good = vi.fn(() => ({ dispose: () => undefined }));
    const entries = entriesOf([
      {
        plugin: 'broken',
        decoration: {
          id: 'boom',
          decorate: () => null,
          onDidChange: () => {
            throw new Error('нет');
          },
        },
      },
      { plugin: 'files', decoration: { id: 'ok', decorate: () => null, onDidChange: good } },
    ]);
    const onError = vi.fn();

    observeDecorations(entries, () => undefined, onError);

    expect(onError).toHaveBeenCalledOnce();
    expect(good).toHaveBeenCalledOnce();
  });
});
