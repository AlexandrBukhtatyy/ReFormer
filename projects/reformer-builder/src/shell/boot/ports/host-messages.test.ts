/**
 * Словарь оболочки на чтение: перевод кода находки словарём того, кто код завёл.
 *
 * Служба локализации настоящая — проверяется именно маршрут: код без владельца идёт в словарь
 * оболочки под приставкой `errors.`, код с владельцем — в словарь плагина-владельца.
 *
 * @module shell/boot/ports/host-messages.test
 */

import { describe, expect, it } from 'vitest';
import { pluginDiagnosticCode, pluginMessageKey } from '@reformer/builder-plugin-api/internal';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createHostMessagesService } from './host-messages';

async function harness() {
  const i18n = createI18nService({
    dev: false,
    loadHostMessages: () =>
      Promise.resolve({
        'errors.schema.unknown-component': 'Компонента «{name}» нет в ките',
        'quickfix.remove': 'Убрать',
      }),
  });
  await i18n.setLocale('ru');
  i18n.forPlugin('acme.rjsf').contribute('ru', {
    'errors.rjsf.bad-type': 'Тип «{type}» не знаком',
    'quickfix.rename': 'Исправить имя «{name}»',
  });
  return { i18n, messages: createHostMessagesService(i18n) };
}

describe('перевод кода находки', () => {
  it('код без владельца переводит словарь оболочки — под приставкой errors', async () => {
    const { messages } = await harness();

    expect(messages.diagnosticMessage('schema.unknown-component', { name: 'Inpit' })).toBe(
      'Компонента «Inpit» нет в ките'
    );
  });

  it('код с владельцем переводит словарь плагина-владельца, а не оболочки', async () => {
    // Плагин, принёсший свой формат, в словарь оболочки не пишет, и оболочка его ошибок
    // не знает. Тот, кто находку показывает, передаёт код как есть.
    const { messages } = await harness();

    expect(
      messages.diagnosticMessage(pluginDiagnosticCode('acme.rjsf', 'rjsf.bad-type'), {
        type: 'strng',
      })
    ).toBe('Тип «strng» не знаком');
  });

  it('готовый ключ переводится без приставки: у заголовка исправления кода нет', async () => {
    const { messages } = await harness();

    expect(messages.t('quickfix.remove')).toBe('Убрать');
  });

  it('ключ с владельцем переводит словарь владельца: подпись исправления едет с плагином', async () => {
    // Подписи быстрых исправлений лежали в словаре оболочки — вместе с текстами находок форм.
    // Теперь они у плагина, который исправление завёл; показывающий (панель проблем, канвас)
    // передаёт ключ как получил, и о владельце не знает.
    const { messages } = await harness();

    expect(messages.t(pluginMessageKey('acme.rjsf', 'quickfix.rename'), { name: 'titel' })).toBe(
      'Исправить имя «titel»'
    );
    // Тот же ключ без владельца в словаре оболочки не находится — путаницы словарей нет.
    expect(messages.t('quickfix.rename')).not.toBe('Исправить имя «{name}»');
  });

  it('локаль и её смена — те же, что у корня: реактивный перевод строится над службой', async () => {
    const { i18n, messages } = await harness();
    let changed = 0;
    const subscription = messages.onDidChangeLocale(() => (changed += 1));

    expect(messages.locale).toBe('ru');
    await i18n.setLocale('en');

    expect(messages.locale).toBe('en');
    expect(changed).toBe(1);
    subscription.dispose();
  });
});
