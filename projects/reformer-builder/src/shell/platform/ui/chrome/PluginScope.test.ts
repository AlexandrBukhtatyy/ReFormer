/**
 * Контейнер скоупа проверяется разметкой, а не вычисленным стилем.
 *
 * Окружение node-прогона — `node`, DOM в нём нет, и каскад проверить нечем. Но вопрос, ради
 * которого компонент заведён, каскада и не требует: атрибут либо оказался в разметке, либо нет,
 * а селектор из `plugin/styles` либо совпадает с этой разметкой строкой, либо расходится с ней.
 * Ровно это здесь и проверяется — `renderToStaticMarkup` даёт разметку без браузера.
 *
 * Файл `.ts` и без JSX намеренно: `include` node-прогона — `src/**\/*.test.ts`, и тест на `.tsx`
 * не попал бы в него вовсе (см. шапку `vitest.browser.config.ts`). `createElement` вместо JSX —
 * плата за это, и она невелика: дерево здесь из двух узлов.
 *
 * Чего здесь НЕТ: проверки, что `display: contents` действительно не создаёт бокса. Это
 * вычисленный стиль, ему место в браузерном прогоне; здесь класс проверяется строкой — чтобы
 * его нельзя было потерять молча.
 *
 * @module shell/platform/ui/chrome/PluginScope.test
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PLUGIN_SCOPE_ATTRIBUTE, pluginScopeSelector } from '@/shell/platform/plugin/styles';
import { PluginScope } from './PluginScope';

/** Тело вклада теста — узнаваемое и бессодержательное: проверяется обёртка, а не оно. */
const BODY = '<span>тело вклада</span>';

function markupOf(pluginId: string): string {
  // `children` — в объекте свойств, а не третьим аргументом: у обёртки они обязательны,
  // и перегрузка `createElement` с отдельными детьми такого типа не принимает.
  return renderToStaticMarkup(
    createElement(PluginScope, { pluginId, children: createElement('span', null, 'тело вклада') })
  );
}

/**
 * Имя атрибута НЕ подставляется из константы: иначе проверка сверяла бы константу с собой.
 *
 * Регулярное выражение ловит любой `data-*` в открывающем теге — их там ровно один, — и дальше
 * селектор собирается из того, что нашлось. Поэтому расходится ли разметка с `pluginScopeSelector`
 * именем атрибута, значением или отсутствием того и другого, тест падает одинаково.
 */
const DATA_ATTRIBUTE = /\s(data-[a-z0-9-]+)="([^"]*)"/;

/** Селектор, собранный ИЗ РАЗМЕТКИ. `null` — атрибута в ней нет. */
function scopeFromMarkup(markup: string): string | null {
  const found = DATA_ATTRIBUTE.exec(markup);
  return found === null ? null : `[${found[1]}="${found[2]}"]`;
}

describe('PluginScope', () => {
  it('ставит атрибут владельца на контейнер вокруг тела вклада', () => {
    const markup = markupOf('files');

    expect(markup).toContain(`${PLUGIN_SCOPE_ATTRIBUTE}="files"`);
    // Тело именно ВНУТРИ контейнера: предок снаружи поддерева ничего бы не ограничивал.
    expect(markup).toMatch(new RegExp(`^<div [^>]*>${BODY}</div>$`));
  });

  it('точка в идентификаторе не ломает разметку', () => {
    // Тот самый случай, из-за которого контейнер — атрибут, а не класс: `.rb-plugin-acme.forms`
    // разбирался бы как два класса. У атрибута значение — строка, и точка в ней ничего не значит.
    const markup = markupOf('acme.forms');

    expect(markup).toContain(`${PLUGIN_SCOPE_ATTRIBUTE}="acme.forms"`);
    expect(markup).toContain(BODY);
  });

  it('селектор из plugin/styles совпадает с тем, что в разметке', () => {
    // Это и есть шов: `preparePluginStyles` переписывает КАЖДОЕ правило под этот селектор,
    // и разойдись он с разметкой хоть одним знаком — CSS плагина не применится ни к чему.
    expect(scopeFromMarkup(markupOf('files'))).toBe(pluginScopeSelector('files'));
    expect(scopeFromMarkup(markupOf('acme.forms'))).toBe(pluginScopeSelector('acme.forms'));
  });

  it('контейнер не создаёт бокса', () => {
    // Строкой, а не вычисленным стилем (см. шапку). Потеряй обёртка этот класс — она стала бы
    // флекс-элементом вместо тела вклада, и панель схлопнулась бы по содержимому.
    expect(markupOf('files')).toContain('class="contents"');
  });
});
