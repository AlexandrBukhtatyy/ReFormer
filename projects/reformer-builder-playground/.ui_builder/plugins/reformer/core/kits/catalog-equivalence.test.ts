/**
 * Снапшот эквивалентности каталога — страховка от тихого дрейфа сборки.
 *
 * В v1 он появился как страховка перевода потребителей на дескриптор: таблицы билдера переехали в
 * `kits/legacy-reformer-ui-kit` ДАННЫМИ, потребители (`known-components`, `render-policy`,
 * `make-node`, `node-kind`, `codegen`) переключались на чтение из дескриптора, и любое расхождение
 * должно было всплыть здесь, а не в превью.
 *
 * В v2 у него та же роль на другом переезде: `make-node` и `node-kind` берут листья/композиции
 * ПАРАМЕТРОМ вместо `getActiveDescriptor()`, а сборка каталога стала чистой функцией. Снимок
 * перенесён из v1 БЕЗ пересъёмки — именно это и делает его проверкой: если состав, категории или
 * узел-по-умолчанию хоть где-то поехали, здесь будет diff.
 *
 * Пересъёмка (осознанная) — при удалении `*Field`-версий ui-kit: у field-записей `exportName`
 * стал реальным компонентом (`Checkbox` → `CheckboxWithLabel`, `Select` → `SelectAsync`, у `Input`
 * и др. — без `exportName`), варианты стали записями (`InputNumber`, `InputSuggest`,
 * `FileUploadDropzone`, `FileUploadInput`; 209 → 213), у `Input` ушли числовые пропсы, у
 * `FileUpload*` — `variant`.
 *
 * Пересъёмка (осознанная) — при переносе контракта кита в SDK («киты — платформа»): таблицы
 * «неявного кита» билдера ушли, и ui-kit объявил о себе всё сам. Разошлись ровно 7 строк — у
 * записей, которых нет в главном входе кита (`Carousel`, `Chart`, `Command`, `Drawer`,
 * `MessageScroller`, `Resizable`, `Sidebar`), появился настоящий подпуть; категории, узлы
 * по умолчанию, состав и запреты превью не сдвинулись.
 *
 * Пересъёмка (осознанная) — когда подпуть стал значить только «откуда импортируется символ», а
 * каталог кита начал выводить его из факта, а не из таблицы. Разошлись 28 строк и только в двух
 * колонках: 26 записей, чьих символов нет в главном входе кита (поля `Calendar`, `Combobox*`,
 * `DatePicker`, `InputOTP`, `Table` с частями, части `Carousel`, `MessageScroller`, `Resizable`),
 * получили подпуть, а `Chart` и `Resizable` — ещё и имя экспорта (`ChartContainer`,
 * `ResizablePanelGroup`): под именами этих записей кит ничего не экспортирует. Состав, категории,
 * отпечатки пропсов и узлы по умолчанию не сдвинулись; список подпутей вырос с 7 до 33 имён.
 *
 * Снимок берётся с ФАКТИЧЕСКИ поставляемого каталога (`@reformer/ui-kit/catalog` + синтетика
 * билдера), поэтому покрывает и категории, и восстановленный `makeNode`, и порядок записей.
 */
import { describe, expect, it } from 'vitest';
import { builtinCatalog, BUILTIN_CATALOG } from '../catalog/__fixtures__/builtin-catalog';
import { composeCatalogJson } from '../catalog/contract';
import { LEAF_COMPONENT_NAMES } from './defaults';

/** Стабильная сериализация JSON с сортировкой ключей — иначе снимок «дрожит» от порядка полей. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))
      );
    }
    return v;
  });
}

/** FNV-1a: короткий отпечаток propsSchema — класть схемы целиком в снимок нечитаемо. */
function digest(value: unknown): string {
  const s = canonical(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Одна строка на запись: всё, от чего зависит палитра, инспектор и дроп. */
function fingerprint(): string[] {
  return builtinCatalog().entries.map((e) =>
    [
      e.name,
      e.role,
      e.category ?? '',
      e.variantGroup ?? '',
      e.variant ?? '',
      e.compoundParent ?? '',
      e.exportName ?? '',
      e.subpath ?? '',
      digest(e.propsSchema),
      canonical(e.makeNode()),
    ].join('|')
  );
}

describe('каталог: отпечаток не меняется', () => {
  it('состав, категории и makeNode каждой записи', () => {
    expect(fingerprint()).toMatchSnapshot();
  });

  it('размер каталога зафиксирован (сдвиг = кит изменился, а не рефактор)', () => {
    expect(builtinCatalog().entries.length).toMatchSnapshot();
  });
});

describe('встроенный кит объявляет себя сам', () => {
  const d = builtinCatalog().descriptor;

  it('блок kit несёт всё, что билдер раньше достраивал «неявным китом»', () => {
    // Раньше из блока kit каталог нёс ТОЛЬКО стили, а личность, инфраструктуру, адаптеры, категории
    // и прослойки билдер брал из своих таблиц про @reformer/ui-kit. Таблиц больше нет: чужой кит,
    // не назвавший себя, не должен притворяться встроенным.
    const json = composeCatalogJson(BUILTIN_CATALOG);
    expect(Object.keys(json.kit ?? {}).sort()).toEqual(
      ['adapters', 'codegen', 'id', 'infra', 'label', 'package', 'palette', 'styles'].sort()
    );
    expect(Object.keys(json.kit!.styles!).sort()).toEqual([
      'classGroupsByRole',
      'classNames',
      'mode',
    ]);
    expect(d.id).toBe('reformer-ui-kit');
    expect(d.label).toBe('ReFormer UI Kit');
    expect(d.package).toBe('@reformer/ui-kit');
    // Версию кит не называет: в этом репозитории версии в package.json недостоверны.
    expect(d.version).toBe('workspace');
    expect(d.styles.mode).toBe('tokens');
  });

  it('полям кит разрешил только отступы, контейнерам — весь словарь', () => {
    expect(d.styles.classNames.map((g) => g.id)).toContain('spacing');
    // Поле: расположение в форме править можно, вид — нет.
    expect(d.classGroupPolicy.get('Input')).toEqual(new Set(['spacing']));
    // Контейнер и синтетика билдера ограничений не получают.
    expect(d.classGroupPolicy.has('Box')).toBe(false);
    expect(d.classGroupPolicy.has('$html(div)')).toBe(false);
  });

  it('дескриптор воспроизводит прежние таблицы билдера', () => {
    // Категории покрывает отпечаток записей выше; здесь — то, чего в нём нет.
    expect(d.palette.categoryByName.Input).toBe('Поля ввода');
    // Контракт 3.0: визард по протоколу — адаптер есть, прослоек нет [ReFormer-qxdk].
    expect(d.adapters.wizard).toEqual({ symbol: 'FormWizard' });
    expect(d.codegen.needsShim.size).toBe(0);
    // Запасные листья стека совпадают с тем, что кит объявляет о себе: без дескриптора стек
    // ведёт себя так же, как со встроенным китом.
    expect([...d.leafComponents].sort()).toEqual([...LEAF_COMPONENT_NAMES].sort());
    expect(d.infra).toEqual({
      fieldWrapper: 'FormField',
      asyncBoundary: 'AsyncBoundary',
      list: 'List',
      fieldFrame: 'FieldFrame',
    });
    expect(d.adapters).toEqual({ wizard: { symbol: 'FormWizard' }, step: null });
    expect(d.codegen.importSpecifier).toBe('@reformer/ui-kit');
  });

  it('запрет живого рендера и подпуть — два РАЗНЫХ множества', () => {
    // Те же два списка, что жили в render-policy, но разного смысла: previewPolicy — запрет,
    // короткое замыкание ДО резолва; подпуть — только адрес импорта, заглушкой он запись не
    // делает (рисовать ли её вживую, решает пространство имён кита).
    const limited = [...d.previewPolicy.entries()]
      .filter(([, p]) => p.mode === 'limited')
      .map(([name]) => name)
      .sort();
    const subpaths = [...d.subpaths.keys()].sort();
    expect({ limited, subpaths }).toMatchSnapshot();
    // Пересекаются они у встроенного кита в одной записи: `Drawer` — оверлей (корень без
    // триггера рисует пустоту), и его символ лежит за подпутём. Запись вправе объявить и запрет,
    // и подпуть: запрет решает, рисовать ли вживую, подпуть — откуда импортировать.
    expect(limited.filter((n) => subpaths.includes(n))).toEqual(['Drawer']);
    // Прежняя сводка подпутей заполняется теми же именами — её читатели не ломаются.
    expect([...d.unresolvedReason.keys()].sort()).toEqual(subpaths);
  });

  it('подпуть объявлен каждой записи, чьего символа нет в главном входе кита', () => {
    // Поля, ради которых подпуть перестал означать «не резолвится»: в главный вход они не входят
    // из-за тяжёлых зависимостей, и импорт из главного входа у пользователя не собирался.
    expect(d.subpaths.get('Combobox')).toBe('combobox');
    expect(d.subpaths.get('ComboboxMulti')).toBe('combobox');
    expect(d.subpaths.get('ComboboxTree')).toBe('combobox');
    expect(d.subpaths.get('ComboboxTreeMulti')).toBe('combobox');
    expect(d.subpaths.get('DatePicker')).toBe('date-picker');
    expect(d.subpaths.get('Calendar')).toBe('calendar');
    expect(d.subpaths.get('InputOTP')).toBe('input-otp');
    // Части составного компонента называют подпуть сами — наследования от корня нет.
    expect(d.subpaths.get('Table')).toBe('table');
    expect(d.subpaths.get('TableRow')).toBe('table');
    expect(d.subpaths.get('CarouselItem')).toBe('carousel');
    // Записи главного входа подпути не объявляют.
    for (const name of ['Input', 'Select', 'SelectMulti', 'Box', 'Button', 'FormWizard']) {
      expect(d.subpaths.has(name), name).toBe(false);
    }
  });
});
