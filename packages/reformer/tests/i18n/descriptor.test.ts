import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { signal } from '@preact/signals-core';
import {
  defineMessages,
  isMessageDescriptor,
  MESSAGE_DESCRIPTOR,
  msg,
} from '../../src/i18n/descriptor';
import { resolveLocalized } from '../../src/i18n/resolve-localized';
import { createI18n } from '../../src/i18n/translator';
import { createModel } from '../../src/model/index';
import { createForm } from '../../src/form/create-form';

const ru = createI18n({
  code: 'ru',
  messages: {
    'profile.email.label': 'Почта',
    'profile.attempts': '{count, plural, one{# попытка} few{# попытки} other{# попыток}}',
    'opt.a': 'Вариант А',
    'opt.b': 'Вариант Б',
  },
});

describe('msg', () => {
  it('создаёт замороженный описатель с брендом', () => {
    const descriptor = msg('profile.email.label');

    expect(isMessageDescriptor(descriptor)).toBe(true);
    expect(descriptor.key).toBe('profile.email.label');
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(descriptor[MESSAGE_DESCRIPTOR]).toBe(true);
  });

  it('без values и defaultMessage не заводит пустых полей', () => {
    expect(Object.keys(msg('a'))).toEqual(['key']);
    expect(Object.keys(msg('a', { n: 1 }, 'A'))).toEqual(['key', 'values', 'defaultMessage']);
  });

  it('не похож на узел схемы: ключей value, array, item, component у него нет', () => {
    const descriptor = msg('a', { n: 1 }, 'A') as unknown as Record<string, unknown>;

    for (const key of ['value', 'array', 'item', 'component']) {
      expect(key in descriptor).toBe(false);
    }
  });

  it('бренд узнаётся через границу копий модуля (Symbol.for)', () => {
    const foreign = { [Symbol.for('reformer.i18n.message')]: true, key: 'a' };

    expect(isMessageDescriptor(foreign)).toBe(true);
  });
});

describe('isMessageDescriptor', () => {
  it('отвергает всё остальное', () => {
    for (const value of [null, undefined, 'a', 1, {}, [], { key: 'a' }, () => {}]) {
      expect(isMessageDescriptor(value)).toBe(false);
    }
  });
});

describe('defineMessages', () => {
  const appEn = { 'profile.title': 'Profile', 'profile.items': '{count} items' };
  const { msg: typed } = defineMessages(appEn);

  it('подставляет английский текст как defaultMessage', () => {
    expect(typed('profile.title')).toMatchObject({
      key: 'profile.title',
      defaultMessage: 'Profile',
    });
    expect(typed('profile.items', { count: 2 }).values).toEqual({ count: 2 });
  });

  it('опечатка в ключе — ошибка компиляции', () => {
    // @ts-expect-error ключа нет в словаре
    typed('profile.tittle');
  });

  it('без локали показывается английский текст, а не ключ', () => {
    const en = createI18n({ code: 'en', messages: {} });

    expect(resolveLocalized(typed('profile.items', { count: 3 }), en)).toBe('3 items');
  });
});

describe('resolveLocalized', () => {
  it('раскрывает описатель по локали', () => {
    expect(resolveLocalized(msg('profile.email.label'), ru)).toBe('Почта');
    expect(resolveLocalized(msg('profile.attempts', { count: 3 }), ru)).toBe('3 попытки');
  });

  it('строки и прочие значения возвращает как есть', () => {
    for (const value of ['текст', 5, true, null, undefined]) {
      expect(resolveLocalized(value, ru)).toBe(value);
    }
  });

  it('обходит пропсы: вложенные объекты и массивы опций', () => {
    const props = {
      label: msg('profile.email.label'),
      placeholder: 'user@example.com',
      options: [
        { value: 'a', label: msg('opt.a') },
        { value: 'b', label: msg('opt.b') },
      ],
      steps: [{ id: 's1', componentProps: { title: msg('profile.email.label') } }],
    };

    expect(resolveLocalized(props, ru)).toEqual({
      label: 'Почта',
      placeholder: 'user@example.com',
      options: [
        { value: 'a', label: 'Вариант А' },
        { value: 'b', label: 'Вариант Б' },
      ],
      steps: [{ id: 's1', componentProps: { title: 'Почта' } }],
    });
  });

  it('исходные пропсы не меняет', () => {
    const descriptor = msg('opt.a');
    const props = { options: [{ label: descriptor }] };

    resolveLocalized(props, ru);

    expect(props.options[0]!.label).toBe(descriptor);
  });

  it('поддерево без описателей сохраняет ссылку', () => {
    const options = [{ value: 'a', label: 'А' }];
    const style = { color: 'red' };
    const props = { label: msg('profile.email.label'), options, style };

    const resolved = resolveLocalized(props, ru);

    expect(resolved).not.toBe(props);
    expect(resolved.options).toBe(options);
    expect(resolved.style).toBe(style);
    // Раскрывать нечего — возвращается тот же объект.
    const plain = { label: 'Почта', options };
    expect(resolveLocalized(plain, ru)).toBe(plain);
  });

  it('один массив в двух пропсах раскрывается оба раза', () => {
    const shared = [{ label: msg('opt.a') }];

    const resolved = resolveLocalized({ first: shared, second: shared }, ru);

    expect(resolved.first).toEqual([{ label: 'Вариант А' }]);
    expect(resolved.second).toEqual([{ label: 'Вариант А' }]);
  });

  it('цикл в пропсах не зацикливает обход', () => {
    const node: Record<string, unknown> = { label: msg('opt.a') };
    node.self = node;

    const resolved = resolveLocalized(node, ru) as Record<string, unknown>;

    expect(resolved.label).toBe('Вариант А');
  });

  it('значение-сигнал в подстановке читается на месте', () => {
    const attempts = signal(1);
    const descriptor = msg('profile.attempts', { count: attempts });

    expect(resolveLocalized(descriptor, ru)).toBe('1 попытка');
    attempts.value = 5;
    expect(resolveLocalized(descriptor, ru)).toBe('5 попыток');
  });

  it('не заходит в сигналы, React-элементы, функции и экземпляры классов', () => {
    class Node {
      label = msg('opt.a');
    }
    const model = createModel({ tags: ['x'], profile: { name: '' } });
    const props = {
      value: signal('x'),
      arrayHandle: model.$.tags,
      groupHandle: model.$.profile,
      element: createElement('i', { title: msg('opt.a') }),
      render: () => msg('opt.a'),
      node: new Node(),
      date: new Date(0),
    };

    expect(resolveLocalized(props, ru)).toBe(props);
  });

  it('createForm не принимает описатель в componentProps за узел схемы', () => {
    const model = createModel({ email: '' });
    const form = createForm<{ email: string }>({
      model,
      schema: {
        email: {
          value: model.$.email,
          component: () => null,
          componentProps: {
            label: msg('profile.email.label'),
            options: [{ value: 'a', label: msg('opt.a') }],
          },
        },
      } as never,
    });
    const props = (
      form as unknown as { email: { componentProps: { value: Record<string, unknown> } } }
    ).email.componentProps.value;

    // Описатель доехал до ноды как есть — и раскрывается уже по активной локали.
    expect(isMessageDescriptor(props.label)).toBe(true);
    expect(resolveLocalized(props, ru)).toMatchObject({
      label: 'Почта',
      options: [{ value: 'a', label: 'Вариант А' }],
    });
  });
});
