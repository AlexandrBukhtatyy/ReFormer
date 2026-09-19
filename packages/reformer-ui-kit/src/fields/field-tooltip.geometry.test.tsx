import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { CheckboxWithLabel } from '@/components/checkbox';
import { Combobox, ComboboxMulti } from '@/components/combobox';
import { DatePicker } from '@/components/date-picker';
import { FileUploadInput } from '@/components/file-upload';
import { InputPassword } from '@/components/input-password';
import { NativeSelectWithOptions } from '@/components/native-select';
import { RadioGroupOptions } from '@/components/radio-group';
import { SelectAsync, SelectMulti } from '@/components/select';
import { SwitchWithLabel } from '@/components/switch';
import { Bound } from '@/test-utils/bound';

/**
 * Порядок в правой зоне поля, слева направо: [крестик очистки] → [(i)] → [родные элементы контрола].
 * SSR не знает координат, поэтому проверяем порядок в разметке и классы позиции/резерва; реальные
 * bounding box сверяет e2e (`field-tooltips.spec.ts`).
 */

const OPTIONS = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
];
const TIP = 'Подсказка';

/** Позиции подстрок в разметке — по возрастанию. */
function expectOrder(html: string, ...needles: string[]) {
  const positions = needles.map((n) => html.indexOf(n));
  expect(
    positions.every((p) => p >= 0),
    `не найдено: ${needles.join(' | ')}`
  ).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

describe('Select (async): кластер [крестик][(i)] левее шеврона', () => {
  it('значение + clearable + tooltip: крестик раньше иконки, резерв на две иконки', () => {
    const html = renderToStaticMarkup(
      <Bound component={SelectAsync} value="a" options={OPTIONS} clearable tooltip={TIP} />
    );
    expectOrder(html, 'data-slot="select-trailing"', 'Clear selection', 'data-slot="info-hint"');
    expect(html).toContain('*:data-[slot=select-value]:mr-12');
  });

  it('только tooltip: резерв на одну иконку; только крестик — тоже одна', () => {
    expect(
      renderToStaticMarkup(
        <Bound component={SelectAsync} value={null} options={OPTIONS} tooltip={TIP} />
      )
    ).toContain('*:data-[slot=select-value]:mr-6');
    const clearOnly = renderToStaticMarkup(
      <Bound component={SelectAsync} value="a" options={OPTIONS} clearable />
    );
    expect(clearOnly).toContain('*:data-[slot=select-value]:mr-6');
    expect(clearOnly).not.toContain('info-hint');
  });

  it('шеврон остаётся у края: триггер больше не получает pr-9, кластера без иконок нет', () => {
    const html = renderToStaticMarkup(
      <Bound component={SelectAsync} value={null} options={OPTIONS} />
    );
    expect(html).not.toContain('select-trailing');
    expect(html).not.toMatch(/data-slot="select-trigger"[^>]*\bpr-9\b/);
  });
});

describe.each([
  ['Combobox', Combobox, 'a'],
  ['ComboboxMulti', ComboboxMulti, ['a']],
  ['SelectMulti', SelectMulti, ['a']],
] as const)('%s: резерв — margin шеврона (pr-* на Button мёртв)', (_name, Field, value) => {
  it('крестик раньше иконки, шеврон отодвинут на две иконки', () => {
    const html = renderToStaticMarkup(
      <Field value={value as never} options={OPTIONS} clearable tooltip={TIP} />
    );
    expectOrder(html, 'data-slot="select-trailing"', 'Clear selection', 'data-slot="info-hint"');
    expect(html).toContain('ml-14');
    expect(html).not.toContain('pr-14');
  });

  it('без иконок шеврон на штатном ml-2', () => {
    const html = renderToStaticMarkup(<Field value={null as never} options={OPTIONS} />);
    expect(html).toContain('ml-2');
    expect(html).not.toContain('select-trailing');
  });
});

describe('InputPassword: (i) левее глаза', () => {
  const field = (props: Record<string, unknown>) =>
    renderToStaticMarkup(<Bound component={InputPassword} {...props} />);

  it('глаз виден: иконка на слот левее, резерв на две', () => {
    const html = field({ value: 'secret', tooltip: TIP });
    expect(html).toMatch(/data-slot="info-hint"[^>]*class="[^"]*right-9/);
    expect(html).toMatch(/<input[^>]*class="[^"]*pr-15/);
    expectOrder(html, 'data-slot="info-hint"', 'data-slot="input-password-toggle"');
  });

  it('глаза нет (пусто): иконка у края, резерв на одну', () => {
    const html = field({ value: null, tooltip: TIP });
    expect(html).toMatch(/data-slot="info-hint"[^>]*class="[^"]*right-3/);
    expect(html).toMatch(/<input[^>]*class="[^"]*pr-9/);
  });

  it('без tooltip резерв прежний (pr-10 под глаз)', () => {
    expect(field({ value: 'secret' })).toMatch(/<input[^>]*class="[^"]*pr-10/);
  });
});

describe('выключенное поле: свои кнопки гаснут, подсказка остаётся рабочей', () => {
  it('глаз пароля disabled и не реагирует на наведение; иконка-подсказка не disabled', () => {
    const html = renderToStaticMarkup(
      <Bound component={InputPassword} value="secret" disabled tooltip={TIP} />
    );
    const eye = html.match(/<button[^>]*data-slot="input-password-toggle"[^>]*>/)?.[0] ?? '';
    expect(eye).toContain('disabled=""');
    expect(eye).toContain('disabled:pointer-events-none');
    // Подсказка нужна и у заблокированного поля — по значению в нём хочется получить пояснение.
    const hint = html.match(/<button[^>]*data-slot="info-hint"[^>]*>/)?.[0] ?? '';
    expect(hint).not.toContain('disabled=""');
  });

  it('крестик очистки у выключенного Select/Combobox не рендерится, подсказка остаётся', () => {
    for (const html of [
      renderToStaticMarkup(
        <Bound
          component={SelectAsync}
          value="a"
          options={OPTIONS}
          clearable
          disabled
          tooltip={TIP}
        />
      ),
      renderToStaticMarkup(
        <Bound component={Combobox} value="a" options={OPTIONS} clearable disabled tooltip={TIP} />
      ),
    ]) {
      expect(html).not.toContain('Clear selection');
      expect(html).toContain('data-slot="info-hint"');
    }
  });

  it('RadioGroup: подпись варианта гаснет вместе с radio (peer-disabled)', () => {
    const html = renderToStaticMarkup(
      <Bound component={RadioGroupOptions} value={null} options={OPTIONS} disabled />
    );
    const radio = html.match(/<button[^>]*role="radio"[^>]*>/)?.[0] ?? '';
    expect(radio).toContain('disabled=""');
    expect(radio).toMatch(/class="([^"]* )?peer( [^"]*)?"/);
    expect(html).toMatch(/<label[^>]*class="[^"]*peer-disabled:opacity-50/);
  });

  it('скрепка FileUpload input не реагирует на наведение в disabled', () => {
    const html = renderToStaticMarkup(<Bound component={FileUploadInput} value={null} disabled />);
    const clip = html.match(/<button[^>]*aria-label="Выбрать файлы"[^>]*>/)?.[0] ?? '';
    expect(clip).toContain('disabled=""');
    expect(clip).toContain('disabled:pointer-events-none');
  });
});

describe('inside-декораторы', () => {
  it('NativeSelect: обёртка w-fit, иконка левее шеврона, резерв pr-16', () => {
    const html = renderToStaticMarkup(
      <Bound component={NativeSelectWithOptions} value={null} options={OPTIONS} tooltip={TIP} />
    );
    expect(html).toMatch(/^<div data-slot="field-tooltip" class="relative w-fit">/);
    expect(html).toMatch(/<select[^>]*class="[^"]*pr-16/);
    expect(html).toMatch(/data-slot="info-hint"[^>]*class="[^"]*right-10/);
  });

  it('DatePicker: резерв через has-[>svg]: (обычный pr-* на Button мёртв)', () => {
    const html = renderToStaticMarkup(<Bound component={DatePicker} value={null} tooltip={TIP} />);
    expect(html).toContain('has-[&gt;svg]:pr-9');
  });

  it('FileUpload input: кластер [крестик][(i)][скрепка], резерв pr-23', () => {
    const html = renderToStaticMarkup(
      <Bound component={FileUploadInput} value={null} tooltip={TIP} />
    );
    expectOrder(html, 'data-slot="info-hint"', 'aria-label="Выбрать файлы"');
    expect(html).toContain('pr-23');
    expect(renderToStaticMarkup(<Bound component={FileUploadInput} value={null} />)).toContain(
      'pr-16'
    );
  });
});

describe('иконка после текста и СНАРУЖИ <label>', () => {
  it('Checkbox: клик по иконке не должен переключать чекбокс', () => {
    const html = renderToStaticMarkup(
      <Bound component={CheckboxWithLabel} value={false} label="Согласен" tooltip={TIP} />
    );
    expectOrder(html, 'Согласен', '</label>', 'data-slot="info-hint"');
  });

  it('Switch: иконка после подписи', () => {
    const html = renderToStaticMarkup(
      <Bound component={SwitchWithLabel} value={false} label="Включить" tooltip={TIP} />
    );
    expectOrder(html, 'Включить', '</label>', 'data-slot="info-hint"');
  });

  it('RadioGroup: подсказка у варианта — после его подписи, описание на самом radio', () => {
    const html = renderToStaticMarkup(
      <Bound
        component={RadioGroupOptions}
        value={null}
        data-testid="input-plan"
        options={[
          { value: 'basic', label: 'Базовый', tooltip: 'До 3 пользователей' },
          { value: 'pro', label: 'Профи' },
        ]}
      />
    );
    expect(html.match(/data-slot="info-hint"/g)).toHaveLength(1);
    expectOrder(html, 'Базовый', '</label>', 'data-testid="input-plan-basic-tooltip"', 'Профи');
    expect(html).toContain('aria-label="Подсказка: Базовый"');
    expect(html).toContain('aria-describedby="input-plan-basic-tooltip"');
    expect(html).toContain(
      '<span id="input-plan-basic-tooltip" hidden="">До 3 пользователей</span>'
    );
  });
});
