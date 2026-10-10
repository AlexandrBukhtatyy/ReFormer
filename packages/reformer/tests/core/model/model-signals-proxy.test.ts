/**
 * Дерево `model.$` — контейнерные узлы и резолв пути (`src/model/model-signals-proxy.ts`).
 *
 * Контейнер (группа, массив, корень) — делегат `ReadonlySignal` агрегированного значения плюс
 * доступ к детям. Здесь закреплены краевые стороны этого контракта, которых не касаются тесты
 * формы: приведение контейнера к примитиву и JSON, дескрипторы и перечисление ключей, символьные
 * ключи, тексты ошибок записи, распознавание контейнера и `signalAt` на неудачных путях.
 */

import { describe, expect, it } from 'vitest';
import { createModel, isModelContainerSignal } from '../../../src/model/index';
import { isModelArraySignal } from '../../../src/model/model-signals-proxy';

interface Address {
  city: string;
  zip: string;
}
interface CoBorrower {
  name: string;
  address: Address;
}
interface Shape {
  name: string;
  address: Address;
  coBorrowers: CoBorrower[];
  tags: string[];
}

const createShape = () =>
  createModel<Shape>({
    name: 'Анна',
    address: { city: 'Казань', zip: '420000' },
    coBorrowers: [{ name: 'Борис', address: { city: 'Москва', zip: '101000' } }],
    tags: ['a', 'b'],
  });

/** Доступ к произвольному ключу узла — для проверок вне объявленного типа. */
const loose = (node: unknown) => node as Record<PropertyKey, unknown>;

describe('model-signals-proxy — приведение контейнера к примитиву и JSON', () => {
  it('группа: valueOf и toJSON отдают агрегат, toString — его строку', () => {
    const address = createShape().$.address;

    expect(address.valueOf()).toEqual({ city: 'Казань', zip: '420000' });
    expect(address.toJSON()).toEqual({ city: 'Казань', zip: '420000' });
    expect(address.toString()).toBe('[object Object]');
    expect(`${address}`).toBe('[object Object]');
  });

  it('JSON.stringify(model.$) — значение модели целиком, вложенные узлы сериализуются сами', () => {
    const model = createShape();

    expect(JSON.parse(JSON.stringify(model.$))).toEqual(model.get());
    expect(JSON.stringify({ where: model.$.address, tags: model.$.tags })).toBe(
      '{"where":{"city":"Казань","zip":"420000"},"tags":["a","b"]}'
    );
  });

  it('агрегат читается свежим после правки поля', () => {
    const model = createShape();

    model.address.city = 'Самара';

    expect(model.$.address.valueOf()).toEqual({ city: 'Самара', zip: '420000' });
    expect(JSON.stringify(model.$.address)).toBe('{"city":"Самара","zip":"420000"}');
  });

  it('агрегат — кэш computed: правка прочитанного значения видна в .value до следующего изменения', () => {
    // поведение под вопросом [ReFormer-ix06]: модель правка не трогает (`get()` прежний), но
    // `.value` ручки отдаёт тот же объект кэша — до следующего изменения массива ручка расходится
    // с моделью.
    const model = createShape();

    model.$.tags.value.push('c');
    expect(model.get().tags).toEqual(['a', 'b']);
    expect(model.$.tags.value).toEqual(['a', 'b', 'c']);

    model.tags.push('d');
    expect(model.$.tags.value).toEqual(['a', 'b', 'd']);
  });

  it('массив: valueOf отдаёт значение массива, а не сам узел [ReFormer-dgww]', () => {
    const model = createShape();

    expect(model.$.tags.valueOf()).toEqual(['a', 'b']);
  });

  it('массив: строка — элементы через запятую, а не [object Object] [ReFormer-dgww]', () => {
    const model = createShape();

    expect([String(model.$.tags), `${model.$.tags}`]).toEqual(['a,b', 'a,b']);
  });
});

describe('model-signals-proxy — ключи и дескрипторы', () => {
  it('дескриптор группы: поле перечислимо и настраиваемо, у прочих ключей дескриптора нет', () => {
    const address = createShape().$.address;

    expect(Object.getOwnPropertyDescriptor(address, 'city')).toMatchObject({
      enumerable: true,
      configurable: true,
    });
    for (const key of ['value', 'peek', '__path', '__kind', 'street']) {
      expect(Object.getOwnPropertyDescriptor(address, key)).toBeUndefined();
    }
    expect(Object.getOwnPropertyDescriptor(address, Symbol.iterator)).toBeUndefined();
  });

  it('Object.entries и spread группы — сигналы полей', () => {
    const model = createShape();
    const spread = { ...model.$.address };

    expect(Object.entries(model.$.address)).toEqual([
      ['city', model.$.address.city],
      ['zip', model.$.address.zip],
    ]);
    expect(Object.keys(spread)).toEqual(['city', 'zip']);
    expect(spread.city).toBe(model.$.address.city);
  });

  it('массив: индекс перечислим, length — геттер, у прочих ключей дескриптора нет', () => {
    const tags = createShape().$.tags;

    expect(Object.getOwnPropertyDescriptor(tags, '0')).toMatchObject({
      enumerable: true,
      configurable: true,
    });
    expect(typeof Object.getOwnPropertyDescriptor(tags, 'length')?.get).toBe('function');
    for (const key of ['2', 'value', 'peek', '__kind']) {
      expect(Object.getOwnPropertyDescriptor(tags, key)).toBeUndefined();
    }
  });

  it('Object.keys массива — только length', () => {
    // поведение под вопросом [ReFormer-ix06]: индекс отдаёт перечислимый дескриптор и виден через `in`, но в
    // ownKeys его нет — `Object.keys(model.$.tags)` не похож ни на массив, ни на группу.
    expect(Object.keys(createShape().$.tags)).toEqual(['length']);
  });

  it('in: поля и существующие индексы видны, свойства сигнала и служебные ключи — нет', () => {
    const model = createShape();

    expect('city' in model.$.address).toBe(true);
    expect('value' in model.$.address).toBe(false);
    expect('__kind' in model.$.address).toBe(false);
    expect('0' in model.$.tags).toBe(true);
    expect('2' in model.$.tags).toBe(false);
    expect('length' in model.$.tags).toBe(true);
    expect('peek' in model.$.tags).toBe(false);
  });

  it('символьные ключи: читаются с делегата сигнала (там их нет), через in не видны', () => {
    const model = createShape();

    expect(loose(model.$.address)[Symbol.toPrimitive]).toBeUndefined();
    expect(loose(model.$)[Symbol.iterator]).toBeUndefined();
    expect(loose(model.$.tags)[Symbol.iterator]).toBeUndefined();
    expect(Symbol.iterator in model.$.address).toBe(false);
    expect(Symbol.iterator in model.$.tags).toBe(false);
  });

  it('служебные ключи: путь и вид узла', () => {
    const model = createShape();

    expect(loose(model.$).__path).toBe('');
    expect(loose(model.$).__kind).toBe('group');
    expect(loose(model.$.coBorrowers[0].address).__path).toBe('coBorrowers.0.address');
    expect(loose(model.$.tags).__kind).toBe('array');
    expect(loose(model.$.name).__kind).toBeUndefined();
  });
});

describe('model-signals-proxy — запись в контейнер', () => {
  it('корень называет себя model.$', () => {
    const model = createShape();

    expect(() => {
      loose(model.$).extra = 1;
    }).toThrow(/^\[@reformer\/core\] model\.\$: запись в «extra» узла-группы невозможна/);
  });

  it('length массива не пишется: ошибка подсказывает замену целиком через .value', () => {
    const model = createShape();

    expect(() => {
      loose(model.$.tags).length = 0;
    }).toThrow(/model\.\$\.tags: запись в «length» узла-массива невозможна.*через \.value/s);
    expect(model.get().tags).toEqual(['a', 'b']);
  });

  it('символьный ключ — та же ошибка с именем символа', () => {
    const model = createShape();

    expect(() => {
      loose(model.$.address)[Symbol('метка')] = 1;
    }).toThrow(/запись в «Symbol\(метка\)» узла-группы невозможна/);
  });
});

describe('model-signals-proxy — распознавание контейнера', () => {
  it('null, undefined и примитивы — не контейнеры', () => {
    for (const value of [null, undefined, 0, '', 'group', true, Symbol('array'), 1n]) {
      expect(isModelContainerSignal(value)).toBe(false);
      expect(isModelArraySignal(value)).toBe(false);
    }
  });

  it('контейнеры — корень, группа и массив; лист, фасад и снимок — нет', () => {
    const model = createShape();

    for (const container of [model.$, model.$.address, model.$.coBorrowers[0], model.$.tags]) {
      expect(isModelContainerSignal(container)).toBe(true);
    }
    for (const other of [model.$.name, model.$.tags[0], model, model.address, model.get()]) {
      expect(isModelContainerSignal(other)).toBe(false);
    }
    expect(isModelArraySignal(model.$.tags)).toBe(true);
    expect(isModelArraySignal(model.$.address)).toBe(false);
  });

  it('признак — служебный ключ __kind: объект с ним проходит проверку', () => {
    expect(isModelContainerSignal({ __kind: 'group' })).toBe(true);
    expect(isModelContainerSignal({ __kind: 'array' })).toBe(true);
    expect(isModelContainerSignal({ __kind: 'leaf' })).toBe(false);
  });
});

describe('model-signals-proxy — signalAt на неудачных и глубоких путях', () => {
  it('пустой путь — undefined', () => {
    expect(createShape().signalAt('')).toBeUndefined();
  });

  it('путь сквозь лист — undefined', () => {
    const model = createShape();

    expect(model.signalAt('name.length')).toBeUndefined();
    expect(model.signalAt('address.city.0')).toBeUndefined();
    expect(model.signalAt('tags.0.x')).toBeUndefined();
  });

  it('неизвестный ключ — undefined: в конце пути и в середине', () => {
    const model = createShape();

    expect(model.signalAt('address.street')).toBeUndefined();
    expect(model.signalAt('passport.number')).toBeUndefined();
    expect(model.signalAt('address..city')).toBeUndefined();
  });

  it('индекс за концом и нечисловой сегмент на массиве — undefined', () => {
    const model = createShape();

    expect(model.signalAt('coBorrowers.5.name')).toBeUndefined();
    expect(model.signalAt('coBorrowers.first.name')).toBeUndefined();
    expect(model.signalAt('tags.2')).toBeUndefined();
  });

  it('путь в лист строки массива — его сигнал', () => {
    const model = createShape();
    const city = model.signalAt('coBorrowers.0.address.city');

    expect(city).toBe(model.$.coBorrowers[0].address.city);
    expect(city?.__path).toBe('coBorrowers.0.address.city');
    expect(city?.value).toBe('Москва');
  });

  it('путь к группе строки — undefined, к массиву — его ручка', () => {
    const model = createShape();

    expect(model.signalAt('coBorrowers.0')).toBeUndefined();
    expect(model.signalAt('coBorrowers.0.address')).toBeUndefined();
    expect(model.signalAt('coBorrowers')).toBe(model.$.coBorrowers);
  });

  it('после вставки строки индекс в пути ведёт к элементу на новом месте', () => {
    const model = createShape();
    const boris = model.signalAt('coBorrowers.0.name');

    model.coBorrowers.insertAt(0, { name: 'Вера', address: { city: '', zip: '' } });

    expect(model.signalAt('coBorrowers.0.name')?.value).toBe('Вера');
    expect(model.signalAt('coBorrowers.1.name')).toBe(boris);
    expect(boris?.__path).toBe('coBorrowers.1.name');
  });

  it('на под-модели путь относительный', () => {
    const model = createShape();
    const row = model.coBorrowers.at(0);

    expect(row.signalAt('address.zip')).toBe(model.$.coBorrowers[0].address.zip);
    expect(row.signalAt('coBorrowers.0.name')).toBeUndefined();
  });
});
