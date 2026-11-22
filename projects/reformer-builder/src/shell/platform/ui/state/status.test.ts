import { describe, expect, it } from 'vitest';

import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import {
  createStaticWorkspaceStatusSource,
  describeWorkspaceStatus,
  localeIndicator,
  NO_WORKSPACE_STATUS,
  type WorkspaceStatusSnapshot,
} from './status';

function snapshot(patch: Partial<WorkspaceStatusSnapshot> = {}): WorkspaceStatusSnapshot {
  return { hasWorkspace: true, dirtyCount: 0, externallyChangedCount: 0, ...patch };
}

const ids = (indicators: readonly { id: string }[]): readonly string[] =>
  indicators.map((indicator) => indicator.id);

describe('describeWorkspaceStatus', () => {
  it('до открытия источника говорит именно это, а не «всё сохранено»', () => {
    // Оболочка рисуется раньше восстановления рабочей области. «Всё сохранено» здесь было бы
    // утверждением о том, чего никто не проверял.
    expect(ids(describeWorkspaceStatus(NO_WORKSPACE_STATUS))).toEqual(['workspace.none']);
  });

  it('пустая рабочая область — «всё сохранено»', () => {
    expect(ids(describeWorkspaceStatus(snapshot()))).toEqual(['workspace.saved']);
  });

  it('несохранённые изменения показываются со счётчиком', () => {
    const [indicator] = describeWorkspaceStatus(snapshot({ dirtyCount: 3 }));
    expect(indicator).toEqual({
      id: 'workspace.dirty',
      messageKey: 'shell.status.workspace.dirty',
      params: { count: 3 },
      tone: 'warning',
    });
  });

  it('«изменён снаружи» идёт перед несохранёнными и кричит громче', () => {
    // Внешнее изменение сообщает, что сохранение сейчас не пройдёт; несохранённые правки —
    // что оно ещё не запускалось. Скрывать первое за вторым значит узнать о конфликте
    // в момент сохранения, то есть тогда, ради чего строка и заведена.
    const indicators = describeWorkspaceStatus(
      snapshot({ dirtyCount: 2, externallyChangedCount: 1 })
    );
    expect(ids(indicators)).toEqual(['workspace.external', 'workspace.dirty']);
    expect(indicators[0].tone).toBe('danger');
  });

  it('«всё сохранено» не показывается рядом с предупреждением', () => {
    expect(ids(describeWorkspaceStatus(snapshot({ dirtyCount: 1 })))).toEqual(['workspace.dirty']);
  });

  it('битый счётчик не превращается в «−1 файл»', () => {
    // Отрицательное и NaN означают ошибку у поставщика итога, а не состояние рабочей области.
    expect(ids(describeWorkspaceStatus(snapshot({ dirtyCount: -5 })))).toEqual(['workspace.saved']);
    expect(ids(describeWorkspaceStatus(snapshot({ dirtyCount: Number.NaN })))).toEqual([
      'workspace.saved',
    ]);
    const [indicator] = describeWorkspaceStatus(snapshot({ dirtyCount: 2.7 }));
    expect(indicator.params).toEqual({ count: 2 });
  });
});

describe('localeIndicator', () => {
  it('показывает активную локаль', () => {
    expect(localeIndicator('ru')).toEqual({
      id: 'locale',
      messageKey: 'shell.status.locale',
      params: { locale: 'RU' },
      tone: 'default',
    });
  });
});

describe('createStaticWorkspaceStatusSource', () => {
  it('отдаёт ту же ссылку — этого требует useSyncExternalStore', () => {
    const source = createStaticWorkspaceStatusSource(snapshot({ dirtyCount: 1 }));
    expect(source.get()).toBe(source.get());
    expect(source.get().dirtyCount).toBe(1);
  });

  it('подписка настоящая и снимается', () => {
    const source = createStaticWorkspaceStatusSource();
    const subscription = source.subscribe(() => undefined);
    expect(() => {
      subscription.dispose();
      subscription.dispose();
    }).not.toThrow();
  });
});

describe('ключи строки состояния', () => {
  it('все объявленные сообщения есть в словаре', async () => {
    // Промах ключа виден маркером ⟦…⟧ только тому, кто открыл эту панель. Здесь он виден CI.
    const i18n = createI18nService({ dev: true });
    await i18n.setLocale('ru');

    const indicators = [
      ...describeWorkspaceStatus(NO_WORKSPACE_STATUS),
      ...describeWorkspaceStatus(snapshot({ dirtyCount: 2, externallyChangedCount: 1 })),
      ...describeWorkspaceStatus(snapshot()),
      localeIndicator('ru'),
    ];
    for (const indicator of indicators) {
      expect(i18n.t(indicator.messageKey, indicator.params)).not.toContain('⟦');
    }
  });
});
