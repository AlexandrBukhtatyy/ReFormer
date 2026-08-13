import { describe, expect, it } from 'vitest';
import {
  componentNames,
  describeComponent,
  listComponents,
  renderComponentDetail,
  renderComponentList,
} from './catalog-digest';

describe('listComponents', () => {
  it('каталог непустой и все имена уникальны', () => {
    const names = componentNames();
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });

  it('фильтр по роли оставляет только её', () => {
    const fields = listComponents({ role: 'field' });
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((c) => c.role === 'field')).toBe(true);
  });

  it('query ищет регистронезависимо и сужает выборку', () => {
    const all = listComponents();
    const target = all[0].name;
    const found = listComponents({ query: target.toLowerCase() });
    expect(found.map((c) => c.name)).toContain(target);
    expect(found.length).toBeLessThanOrEqual(all.length);
  });

  it('несуществующий query → пусто, и это объясняется словами', () => {
    const found = listComponents({ query: 'нет-такого-компонента-zzz' });
    expect(found).toEqual([]);
    expect(renderComponentList(found, 500)).toContain('нет');
  });

  it('части compound-ов скрыты из общего списка, но находятся по query', () => {
    expect(listComponents().map((c) => c.name)).not.toContain('TabsList');
    expect(listComponents({ query: 'tabs' }).map((c) => c.name)).toContain('TabsList');
  });

  it('в бюджет ответа попадают поля, а не только контейнеры и части', () => {
    // Ровно то, на чём ход агента терял смысл: из 202 записей кита 91 — части compound'ов, и в
    // 1500 символов не помещалось НИ ОДНОГО поля. Модель, спросившая «что есть», видела
    // AccordionTrigger и CardFooter, но не Input и не Select — и собирала форму из контейнеров.
    // Сверка идёт по «Имя (field)», а не по подстроке: `Input` живёт внутри `InputGroupInput`, и
    // проверка на вхождение имени проходила бы даже там, где ни одного поля в ответе нет.
    const text = renderComponentList(listComponents(), 1500);
    const fields = listComponents({ role: 'field' }).map((c) => `${c.name} (field)`);
    expect(fields.filter((label) => text.includes(label)).length).toBeGreaterThan(0);
  });
});

describe('describeComponent', () => {
  it('неизвестное имя → undefined', () => {
    expect(describeComponent('TextInput')).toBeUndefined();
  });

  it('известное имя → роль и свойства', () => {
    const name = listComponents({ role: 'field' })[0].name;
    const detail = describeComponent(name);
    expect(detail).toBeDefined();
    expect(detail?.role).toBe('field');
    // Ключи свойств — то, ради чего инструмент существует: они не должны выдумываться моделью.
    expect(detail?.props.every((p) => typeof p.key === 'string' && p.key.length > 0)).toBe(true);
  });

  it('часть compound знает свой корень, корень — свои части', () => {
    expect(describeComponent('TabsTrigger')?.compoundParent).toBe('Tabs');
    expect(describeComponent('Tabs')?.parts).toContain('TabsTrigger');
  });

  it('состав будущей вставки виден заранее — суффиксами адресов', () => {
    // Пока состава не было, Wizard описывался одним className, а Tabs молчал про свои части: узнать
    // о готовом TabsList модель могла только постфактум и успевала создать второй.
    const tabs = describeComponent('Tabs');
    expect(tabs?.skeleton).toContain('TabsList');
    expect(tabs?.skeleton).toContain('/children/0/children/0');
    // Адрес — суффикс к адресу нового узла, а не путь в текущей форме.
    expect(tabs?.skeleton).not.toContain('/root');

    expect(describeComponent('Wizard')?.skeleton).toContain('/componentProps/steps/0');
    expect(describeComponent('Wizard')?.skeleton).toContain('Step');
  });

  it('одиночный компонент состава не заводит', () => {
    expect(describeComponent(listComponents({ role: 'field' })[0].name)?.skeleton).toBeUndefined();
  });

  it('текст описания несёт структуру, а не только свойства', () => {
    const text = renderComponentDetail(describeComponent('Wizard')!, 1500);
    expect(text).toContain('Step');
    expect(text).toContain('componentProps/steps');
  });
});

describe('рендер в текст', () => {
  it('список укладывается в бюджет и сообщает об обрезке', () => {
    const text = renderComponentList(listComponents(), 300);
    expect(text.length).toBeLessThanOrEqual(300);
    // Каталог заведомо шире 300 символов — значит обрезка обязана быть объявлена.
    expect(text).toContain('query');
  });

  it('бюджет соблюдается на рабочих ширинах', () => {
    for (const budget of [200, 500, 1000, 5000]) {
      expect(renderComponentList(listComponents(), budget).length).toBeLessThanOrEqual(budget);
    }
  });

  it('ниже минимальной ширины сохраняются одна запись и признак обрезки, а не пустота', () => {
    // Бюджет меньше «категория + один компонент + уведомление» физически недостижим. Из двух
    // зол — превысить бюджет или отдать неполный список без признака неполноты — выбрано первое:
    // молча обрезанный список модель приняла бы за исчерпывающий.
    const text = renderComponentList(listComponents(), 20);
    expect(text).toContain('query');
    expect(text.split('\n')[0].length).toBeGreaterThan(0);
  });

  it('описание компонента без свойств не притворяется пустым', () => {
    const text = renderComponentDetail({ name: 'X', role: 'container', props: [] }, 500);
    expect(text).toContain('Настраиваемых свойств нет');
  });
});
