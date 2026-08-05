/**
 * Guard от двойного рантайма.
 *
 * Главное здесь — тест с ДВУМЯ физическими копиями. Без него guard остался бы недоказанным кодом:
 * обычные юнит-тесты дубля не создают (vitest резолвит один инстанс), а именно дубль и есть
 * единственный сценарий, ради которого guard написан.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  stampRuntime,
  checkRuntime,
  reportRuntime,
  setRuntimeStrict,
  resetRuntimeGuard,
} from './realm';

beforeEach(() => resetRuntimeGuard());

describe('guard — обнаружение дубля', () => {
  it('одна копия — ok', () => {
    stampRuntime('@reformer/core', { token: 1 });
    const r = checkRuntime();
    expect(r.ok).toBe(true);
    expect(r.observed).toEqual([{ pkg: '@reformer/core', copies: 1 }]);
  });

  it('ДВЕ физические копии ядра → дубль обнаружен', () => {
    // Именно так выглядит реальная авария: два независимо собранных бандла загрузили ядро,
    // каждый штампанул СВОЙ объект-токен. Версии при этом могут совпадать.
    const copyA = Object.freeze({ runtime: 'reformer-core', v: 1 });
    const copyB = Object.freeze({ runtime: 'reformer-core', v: 1 }); // тот же вид, другой объект
    stampRuntime('@reformer/core', copyA);
    stampRuntime('@reformer/core', copyB);

    const r = checkRuntime();
    expect(r.ok).toBe(false);
    expect(r.duplicates.map((d) => d.pkg)).toEqual(['@reformer/core']);
    expect(r.duplicates[0].copies).toBe(2);
  });

  it('повторный штамп ТОГО ЖЕ объекта дублем не считается', () => {
    // Один бандл может инициализироваться дважды (HMR, StrictMode) — это не авария.
    const token = {};
    stampRuntime('@reformer/core', token);
    stampRuntime('@reformer/core', token);
    expect(checkRuntime().ok).toBe(true);
  });

  it('сравниваются объекты, а не версии: две копии ОДНОЙ версии — тоже дубль', () => {
    stampRuntime('@preact/signals-core', class Signal {});
    stampRuntime('@preact/signals-core', class Signal {});
    expect(checkRuntime().duplicates).toHaveLength(1);
  });

  it('разные пакеты не смешиваются', () => {
    stampRuntime('@reformer/core', {});
    stampRuntime('@preact/signals-core', {});
    expect(checkRuntime().ok).toBe(true);
    expect(checkRuntime().observed).toHaveLength(2);
  });

  it('примитив в качестве штампа отвергается', () => {
    // Строка или число совпали бы у разных копий по значению — дубль остался бы невидимым,
    // то есть guard молча перестал бы работать.
    expect(() => stampRuntime('@reformer/core', '6.0.0')).toThrow(/примитив/);
    expect(() => stampRuntime('@reformer/core', 42)).toThrow(/примитив/);
  });
});

describe('guard — реакция на дубль', () => {
  it("по умолчанию 'report': не бросает, а сообщает", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stampRuntime('@reformer/core', {});
    stampRuntime('@reformer/core', {});
    const seen: string[] = [];

    expect(() => reportRuntime((d) => seen.push(d.pkg))).not.toThrow();
    expect(seen).toEqual(['@reformer/core']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('strict: true бросает на ВТОРОЙ копии', () => {
    setRuntimeStrict(true);
    stampRuntime('@reformer/core', {});
    expect(() => stampRuntime('@reformer/core', {})).toThrow(/2 копии/);
  });

  it('сообщение объясняет последствия, а не только факт', () => {
    stampRuntime('@reformer/core', {});
    stampRuntime('@reformer/core', {});
    const msg = checkRuntime().duplicates[0].message;
    expect(msg).toMatch(/instanceof Signal/);
    expect(msg).toMatch(/enableWhen/);
    expect(msg).toMatch(/МОЛЧА/);
    expect(msg).toMatch(/Module Federation|import map|externals/); // что делать
  });
});

describe('guard — общий realm', () => {
  it('состояние лежит в globalThis под Symbol.for — видно другой копии модуля', () => {
    // Symbol.for живёт в cross-realm registry: это единственный ключ, совпадающий у двух
    // независимо собранных копий guard'а. Модульный синглтон здесь бесполезен — у каждой
    // копии он был бы свой, и дубль остался бы незамеченным.
    stampRuntime('@reformer/core', {});
    const slot = (globalThis as unknown as Record<symbol, { runtimes: Map<string, Set<unknown>> }>)[
      Symbol.for('reformer.runtime.v1')
    ];
    expect(slot.runtimes.get('@reformer/core')?.size).toBe(1);

    // Имитация второй копии guard'а: пишет в тот же слот по тому же ключу.
    slot.runtimes.get('@reformer/core')!.add({});
    expect(checkRuntime().ok).toBe(false);
  });

  it('observed отличает «дублей нет» от «никто не штамповался»', () => {
    // Пустой observed означает, что guard просто не подключили — это НЕ то же самое,
    // что подтверждённое отсутствие дублей.
    expect(checkRuntime()).toEqual({ ok: true, duplicates: [], observed: [] });
  });
});

describe('guard — ноль зависимостей от окружения', () => {
  it('не обращается ни к process, ни к import.meta.env', async () => {
    // process.env в голом ESM и web-components даёт ReferenceError, а import.meta.env
    // вырезается при сборке пакета — ни на то ни на другое опираться нельзя.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./realm.ts', import.meta.url), 'utf8')
    );
    const code = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/process\s*\./);
    expect(code).not.toMatch(/import\.meta\.env/);
  });
});
