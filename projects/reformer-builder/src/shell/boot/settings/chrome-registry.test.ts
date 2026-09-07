/**
 * Реестр компонентов формы настроек плагина.
 *
 * Проверяется граница: что схеме плагина доступно, что происходит с недоступным, и что
 * конвертер не упрётся в имя источника, которого никто не объявлял.
 *
 * @module shell/boot/settings/chrome-registry.test
 */

import { describe, expect, it } from 'vitest';
import { FIELD_WRAPPER, type JsonFormSchema } from '@reformer/renderer-json';
import { buildChromeRegistry, CHROME_COMPONENT_NAMES } from './chrome-registry';

/** Минимальная схема с одним полем заданного компонента. */
const schemaWith = (component: string, extra: Record<string, unknown> = {}): JsonFormSchema =>
  ({
    version: '1.0',
    root: {
      $nodeId: 'root',
      component: '$html(div)',
      children: [
        {
          $nodeId: 'field',
          component: `$component(${component})`,
          value: '$model(x)',
          componentProps: { label: 'Поле', ...extra },
        },
      ],
    },
  }) as unknown as JsonFormSchema;

describe('словарь компонентов настроек', () => {
  it('закрыт и объявлен: девять имён, те же, что в каталоге кита', () => {
    // Список — часть контракта точки расширения: автор плагина пишет схему по нему.
    expect(CHROME_COMPONENT_NAMES).toEqual([
      'Box',
      'Checkbox',
      'FormField',
      'Input',
      'RadioGroup',
      'Section',
      'Select',
      'Switch',
      'Textarea',
    ]);
  });

  it('враппер поля зарегистрирован служебным именем', () => {
    // Без него поля рисуются голыми — без подписи, подсказки и ошибки, — и притом молча.
    expect(buildChromeRegistry(schemaWith('Input')).has(FIELD_WRAPPER)).toBe(true);
  });

  it('имя вне словаря не роняет форму, а получает заметную заглушку', () => {
    // Схема приходит из проекта пользователя; «рисуем всё, что назвали» означало бы
    // произвольный компонент оболочки под управлением чужой схемы.
    const registry = buildChromeRegistry(schemaWith('DataGrid'));

    expect(registry.has('DataGrid')).toBe(true);
    expect(registry.get('DataGrid')).toBeDefined();
  });

  it('источник, названный схемой, объявлен пустым, а не пропущен', () => {
    // Конвертер бросает на неизвестном имени: одна ссылка `$dataSource` роняла бы всю форму.
    const registry = buildChromeRegistry(schemaWith('Select', { options: '$dataSource(cities)' }));

    expect(registry.getDataSource('cities')).toEqual([]);
  });
});
