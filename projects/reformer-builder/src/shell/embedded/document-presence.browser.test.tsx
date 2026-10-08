/**
 * Присутствие билдера в чужом документе — в настоящем DOM.
 *
 * Главное утверждение одно, и оно про приложение-хозяина: закрыл билдер — страница выглядит так,
 * как до него. Стили сняты, класс темы возвращён к тому, что стояло на корне ДО билдера.
 *
 * @module shell/embedded/document-presence.browser.test
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createDocumentPresence, STYLES_ATTRIBUTE } from './document-presence';

const builderStyles = (): HTMLStyleElement | null =>
  document.head.querySelector<HTMLStyleElement>(`style[${STYLES_ATTRIBUTE}]`);

const root = document.documentElement;

afterEach(() => {
  builderStyles()?.remove();
  root.classList.remove('dark');
});

describe('стили билдера в документе приложения', () => {
  it('до подключения их нет вовсе: приложение не платит за закрытый билдер', () => {
    createDocumentPresence({ styles: 'body { outline: 1px solid red }' });

    expect(builderStyles()).toBeNull();
  });

  it('подключаются последними в head и действуют, пока билдер открыт', () => {
    const presence = createDocumentPresence({
      styles: 'body { outline: 3px solid rgb(255, 0, 0) }',
    });

    presence.attach();

    expect(builderStyles()).toBe(document.head.lastElementChild);
    expect(getComputedStyle(document.body).outlineWidth).toBe('3px');
    presence.detach();
  });

  it('снимаются при закрытии — страница выглядит как до билдера', () => {
    const presence = createDocumentPresence({
      styles: 'body { outline: 3px solid rgb(255, 0, 0) }',
    });
    const before = getComputedStyle(document.body).outlineWidth;

    presence.attach();
    presence.detach();

    expect(builderStyles()).toBeNull();
    expect(getComputedStyle(document.body).outlineWidth).toBe(before);
  });

  it('повторное подключение не плодит элементы', () => {
    const presence = createDocumentPresence({ styles: 'body {}' });

    presence.attach();
    presence.attach();

    expect(document.head.querySelectorAll(`style[${STYLES_ATTRIBUTE}]`)).toHaveLength(1);
    presence.detach();
  });
});

describe('класс темы на корне документа приложения', () => {
  it('пока билдер закрыт, служба темы корень не трогает', () => {
    const presence = createDocumentPresence({ styles: '' });

    presence.themeRoot.classList.add('dark');

    expect(root.classList.contains('dark')).toBe(false);
  });

  it('выбранная при закрытом билдере тема действует с момента открытия', () => {
    const presence = createDocumentPresence({ styles: '' });
    presence.themeRoot.classList.add('dark');

    presence.attach();

    expect(root.classList.contains('dark')).toBe(true);
    presence.detach();
  });

  it('смена темы при открытом билдере применяется сразу', () => {
    const presence = createDocumentPresence({ styles: '' });
    presence.attach();

    presence.themeRoot.classList.add('dark');
    expect(root.classList.contains('dark')).toBe(true);
    presence.themeRoot.classList.remove('dark');
    expect(root.classList.contains('dark')).toBe(false);

    presence.detach();
  });

  it('закрытие возвращает светлую страницу светлой', () => {
    const presence = createDocumentPresence({ styles: '' });
    presence.themeRoot.classList.add('dark');

    presence.attach();
    presence.detach();

    expect(root.classList.contains('dark')).toBe(false);
  });

  it('закрытие возвращает тёмной странице её тёмную тему, даже если билдер был светлым', () => {
    root.classList.add('dark');
    const presence = createDocumentPresence({ styles: '' });
    presence.themeRoot.classList.remove('dark');

    presence.attach();
    expect(root.classList.contains('dark')).toBe(false);
    presence.detach();

    expect(root.classList.contains('dark')).toBe(true);
  });
});
