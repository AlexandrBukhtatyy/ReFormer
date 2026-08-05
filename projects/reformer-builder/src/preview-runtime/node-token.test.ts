import { describe, expect, it } from 'vitest';
import {
  decodeNodeToken,
  encodeNodeToken,
  tokenFromClassName,
  NODE_CLASS_PREFIX,
} from './node-token';
import type { JsonPath } from '../model';

const roundTrip = (path: JsonPath) => decodeNodeToken(encodeNodeToken(path));

describe('encodeNodeToken / decodeNodeToken', () => {
  it('round-trip типичных путей', () => {
    const paths: JsonPath[] = [
      ['root'],
      ['root', 'children', 0],
      ['root', 'children', 2, 'children', 10],
      ['root', 'componentProps', 'steps', 1, 'children', 2],
      ['root', 'item', '$template'],
      ['root', 'children', 0, 'wrapper'],
    ];
    for (const p of paths) expect(roundTrip(p)).toEqual(p);
  });

  it('индексы декодируются числами, ключи — строками', () => {
    const decoded = roundTrip(['root', 'children', 3]);
    expect(decoded).toEqual(['root', 'children', 3]);
    expect(typeof decoded![2]).toBe('number');
    expect(typeof decoded![1]).toBe('string');
  });

  it('вложенность не схлопывается: children/10 ≠ children/1/0', () => {
    expect(encodeNodeToken(['root', 'children', 10])).not.toBe(
      encodeNodeToken(['root', 'children', 1, 0])
    );
  });

  it('токен — валидный CSS-ident', () => {
    const token = encodeNodeToken(['root', 'item', '$template', 'children', 0]);
    expect(token).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
    expect(token.startsWith(NODE_CLASS_PREFIX)).toBe(true);
  });

  it('строковый сегмент из одних цифр не путается с индексом', () => {
    expect(roundTrip(['root', '12'])).toEqual(['root', '12']);
  });

  it('не-токен отвергается', () => {
    expect(decodeNodeToken('space-y-4')).toBeNull();
    expect(decodeNodeToken(NODE_CLASS_PREFIX)).toBeNull();
    expect(decodeNodeToken(`${NODE_CLASS_PREFIX}root____children`)).toBeNull();
  });
});

describe('tokenFromClassName', () => {
  it('находит токен среди прочих классов', () => {
    const token = encodeNodeToken(['root', 'children', 1]);
    expect(tokenFromClassName(`space-y-4 ${token} mt-2`)).toBe(token);
    expect(tokenFromClassName(`${token}`)).toBe(token);
    expect(tokenFromClassName(`mt-2 ${token}`)).toBe(token);
  });

  it('без токена — null; служебный rb-empty токеном не считается', () => {
    expect(tokenFromClassName('space-y-4 mt-2')).toBeNull();
    expect(tokenFromClassName('rb-empty space-y-4')).toBeNull();
  });
});
