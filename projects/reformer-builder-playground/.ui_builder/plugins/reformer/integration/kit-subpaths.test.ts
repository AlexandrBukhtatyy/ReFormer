/**
 * Подпуть записи каталога встречается с пространством имён встроенного кита.
 *
 * Подпуть значит одно — откуда импортируется символ записи. Рисовать ли компонент вживую, решает
 * не он, а факт: есть ли символ в пространстве имён активного кита. Каталог встроенного кита
 * объявляет подпуть каждой записи, которой нет в главном входе пакета, а его пространство имён
 * (`plugins/forms/kits`) собрано из главного входа и ПОЛЕЙ с подпутей. Политика превью
 * (`plugins/reformer/render`) обязана развести их по факту: комбобокс и выбор даты — живые,
 * карусель и таблица — подписанные заглушки. Каталог, пространство имён и политика живут в трёх
 * разных местах, и встретиться они могут только здесь.
 *
 * @module shell/boot/integration/kit-subpaths.test
 */

import { describe, expect, it } from 'vitest';
import { exportNameFor, type KitNamespace } from '@reformer/builder-plugin-api';
import { loadBuiltinNamespace } from '../../forms/kits/src/builtin';
import { builtinCatalog } from '../core/testing';
import { classifyEntry } from '../render/src/runtime/policy';

const BUILT = builtinCatalog();

/** Записи палитры, объявившие подпуть, и то, что о них решила политика превью. */
function decisions(namespace: KitNamespace) {
  return BUILT.entries
    .filter((entry) => BUILT.descriptor.subpaths.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      role: entry.role,
      subpath: BUILT.descriptor.subpaths.get(entry.name) ?? '',
      inNamespace: namespace[exportNameFor(entry)] !== undefined,
      decision: classifyEntry(entry, namespace, BUILT.descriptor),
    }));
}

// Свой запас времени: пространство имён кита — импорт всего кита с подпутями, на холодном кеше
// трансформаций он занимает секунды.
describe('подпуть записи и пространство имён встроенного кита', { timeout: 30_000 }, () => {
  it('поле за подпутём рисуется вживую: его символ в пространстве имён есть', async () => {
    const all = decisions(await loadBuiltinNamespace());
    const fields = all.filter((item) => item.role === 'field');

    // Поля, ради которых подпуть перестал означать заглушку.
    expect(fields.map((item) => item.name).sort()).toEqual(
      [
        'Calendar',
        'Combobox',
        'ComboboxMulti',
        'ComboboxTree',
        'ComboboxTreeMulti',
        'DatePicker',
        'InputOTP',
      ].sort()
    );
    for (const field of fields) {
      expect(field.inNamespace, field.name).toBe(true);
      expect(field.decision.policy, field.name).toBe('live');
    }
  });

  it('живой или заглушка — по факту наличия символа, а не по подпутю', async () => {
    const all = decisions(await loadBuiltinNamespace());

    expect(all.length).toBeGreaterThan(20);
    for (const item of all) {
      // Одно и то же свойство «объявлен подпуть» — у обеих половин; различает их только факт.
      expect(item.decision.policy, item.name).toBe(item.inNamespace ? 'live' : 'limited');
    }
    // Обе половины непусты — иначе проверка выше ничего не различала бы.
    expect(all.some((item) => item.inNamespace)).toBe(true);
    expect(all.some((item) => !item.inNamespace)).toBe(true);
  });

  it('заглушка называет подпуть, который превью не загрузило', async () => {
    const byName = new Map(
      decisions(await loadBuiltinNamespace()).map((item) => [item.name, item.decision])
    );

    // Карусель, таблица и график форме не нужны — пространство имён их подпути не грузит.
    expect(byName.get('Carousel')).toEqual({
      policy: 'limited',
      reason: 'лежит в @reformer/ui-kit/carousel — этот подпуть в превью не загружен',
    });
    expect(byName.get('Table')).toEqual({
      policy: 'limited',
      reason: 'лежит в @reformer/ui-kit/table — этот подпуть в превью не загружен',
    });
    // Часть составного компонента объясняется своим подпутём — тем же, что у корня.
    expect(byName.get('CarouselItem')).toEqual(byName.get('Carousel'));
    // Корень графика лежит под другим именем экспорта, но адрес тот же.
    expect(byName.get('Chart')).toEqual({
      policy: 'limited',
      reason: 'лежит в @reformer/ui-kit/chart — этот подпуть в превью не загружен',
    });
  });

  it('без пространства имён (кит ещё не доехал) заглушкой становится и поле', () => {
    const all = decisions({});
    for (const item of all) expect(item.decision.policy, item.name).toBe('limited');
  });
});
