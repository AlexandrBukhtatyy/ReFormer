/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from 'react';
import { createModel, createForm, type FormModel } from '@reformer/core';
import { FormArray, useFormArray, type FormArrayHandle } from '@reformer/cdk/form-array';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { FormField, Input, InputMask, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type Phone = { kind: string; number: string };

const WRAP: React.CSSProperties = { maxWidth: 480, width: '100%' };

const CARD: React.CSSProperties = {
  border: '1px solid var(--ifm-toc-border-color)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
};

const ROW_HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const MUTED: React.CSSProperties = { color: 'var(--ifm-color-emphasis-600)' };

const ERROR_TEXT: React.CSSProperties = {
  color: 'var(--ifm-color-danger, #d33)',
  fontSize: 13,
  margin: '2px 0 8px',
};

const NATIVE_BTN: React.CSSProperties = {
  cursor: 'pointer',
  border: '1px solid var(--ifm-toc-border-color)',
  borderRadius: 6,
  padding: '4px 10px',
  background: 'transparent',
  font: 'inherit',
};

const ONE_PHONE: Phone[] = [{ kind: 'Мобильный', number: '' }];
const TWO_PHONES: Phone[] = [
  { kind: 'Мобильный', number: '' },
  { kind: 'Рабочий', number: '' },
];
/** Строки «импорта» с одним дубликатом по номеру (для примера дедупа). */
const IMPORT_ROWS: Phone[] = [
  { kind: 'Мобильный', number: '+7 (900) 111-11-11' },
  { kind: 'Рабочий', number: '+7 (495) 222-22-22' },
  { kind: 'Мобильный', number: '+7 (900) 111-11-11' },
];

/**
 * Поднимает M1-форму с массивом телефонов (schema-нода `{ array, item }`).
 * `setup` вызывается один раз после создания формы — для статичных состояний
 * витрины (disabled-массив, array-level ошибка).
 */
function usePhoneForm(initial: Phone[] = ONE_PHONE, setup?: (form: any) => void) {
  return useMemo(() => {
    const model = createModel<{ phones: Phone[] }>({ phones: initial });
    const phoneItem = (item: FormModel<Phone>) => ({
      kind: {
        value: item.$.kind,
        component: Input,
        componentProps: { label: 'Тип', placeholder: 'Мобильный / Рабочий' },
      },
      number: {
        value: item.$.number,
        component: InputMask,
        componentProps: { label: 'Номер', mask: '+7 (999) 999-99-99' },
      },
    });
    const schema = { phones: { array: model.phones, item: phoneItem } } as any;
    const form = createForm<{ phones: Phone[] }>({ model, schema });
    setup?.(form as any);
    return { model, form: form as any };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Полная карточка телефона (заголовок + оба поля + удаление). */
function PhoneCardRow({ control, index, remove }: any) {
  return (
    <div style={CARD}>
      <div style={ROW_HEADER}>
        <strong>Телефон #{index + 1}</strong>
        <Button variant="ghost" size="sm" onClick={remove}>
          Удалить
        </Button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <FormField control={control.kind} />
        <FormField control={control.number} />
      </div>
    </div>
  );
}

/** Базовая headless-сборка массива — переиспользуется для состояний-вариантов. */
function BasicArrayView({ control, showError = false }: { control: any; showError?: boolean }) {
  return (
    <div style={WRAP}>
      <FormArray.Root control={control}>
        <FormArray.Empty>
          <p style={MUTED}>Телефоны не добавлены</p>
        </FormArray.Empty>
        <FormArray.List>
          {({ control: item, index, remove }: any) => (
            <PhoneCardRow control={item} index={index} remove={remove} />
          )}
        </FormArray.List>
        {showError ? <FormArray.Error style={ERROR_TEXT} /> : null}
        <FormArray.AddButton initialValue={{ kind: '', number: '' }}>
          + Добавить телефон
        </FormArray.AddButton>
      </FormArray.Root>
    </div>
  );
}

/** Карточка элемента для FormArraySection (kind + number). */
const PhoneItem = ({ control }: { control: any }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </div>
);

// ─── Variants (структурные формы сборки массива) ───────────────────────────

/**
 * Базовая headless-форма: ручная композиция Root + Empty + List + AddButton,
 * карточка на элемент. Это то, чем FormArray является «по устройству».
 */
function FormArrayHeadlessBase() {
  const { form } = usePhoneForm();
  return <BasicArrayView control={form.phones} />;
}

function SectionWithTitle() {
  const { form } = usePhoneForm(TWO_PHONES);
  return (
    <div style={WRAP}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        showRemoveOnSingle
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function SectionNoTitle() {
  const { form } = usePhoneForm(TWO_PHONES);
  return (
    <div style={WRAP}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        itemLabel="Телефон"
        addButtonLabel="+ Добавить телефон"
        showRemoveOnSingle
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function SectionReorderable() {
  const { form } = usePhoneForm(TWO_PHONES);
  return (
    <div style={WRAP}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        itemLabel="Телефон"
        reorderable
        showRemoveOnSingle
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function SectionMaxItems() {
  const { form } = usePhoneForm(TWO_PHONES);
  return (
    <div style={WRAP}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны (макс. 2)"
        itemLabel="Телефон"
        maxItems={2}
        showRemoveOnSingle
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function SectionRemoveHiddenSingle() {
  const { form } = usePhoneForm(ONE_PHONE);
  return (
    <div style={WRAP}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        itemLabel="Телефон"
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

// ─── Examples (возможности compound-API) ───────────────────────────────────

function FormArrayHeadlessDemo() {
  const { form } = usePhoneForm(ONE_PHONE);
  return (
    <div style={WRAP}>
      <FormArray.Root control={form.phones}>
        <h4 style={{ margin: '0 0 8px' }}>
          Телефоны (<FormArray.Count />)
        </h4>
        <FormArray.Empty>
          <p style={MUTED}>Телефоны не добавлены</p>
        </FormArray.Empty>
        <FormArray.List>
          {({ control }: any) => (
            <div style={CARD}>
              <div style={ROW_HEADER}>
                <strong>
                  Телефон #<FormArray.ItemIndex />
                </strong>
                <FormArray.RemoveButton style={NATIVE_BTN}>Удалить</FormArray.RemoveButton>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <FormField control={control.kind} />
                <FormField control={control.number} />
              </div>
            </div>
          )}
        </FormArray.List>
        <FormArray.AddButton style={NATIVE_BTN} initialValue={{ kind: '', number: '' }}>
          + Добавить телефон
        </FormArray.AddButton>
      </FormArray.Root>
    </div>
  );
}

function UseFormArrayDemo() {
  const { form } = usePhoneForm();
  const { items, add, length } = useFormArray(form.phones);
  return (
    <div style={WRAP}>
      <p style={{ fontSize: 13, color: 'var(--ifm-color-emphasis-700)' }}>
        Всего элементов: {length}
      </p>
      {items.map(({ control, id, remove }: any) => (
        <div key={id} style={{ ...CARD, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FormField control={control.number} />
          </div>
          <Button variant="ghost" size="sm" onClick={remove}>
            ×
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => add({ kind: '', number: '' })}>
        + Добавить
      </Button>
    </div>
  );
}

function FormArrayReorder() {
  const { form } = usePhoneForm(TWO_PHONES);
  return (
    <div style={WRAP}>
      <FormArray.Root control={form.phones}>
        <FormArray.List>
          {({ control, index, remove, moveUp, moveDown, canMoveUp, canMoveDown }: any) => (
            <div style={{ ...CARD, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <FormField control={control.number} />
              </div>
              <Button variant="ghost" size="sm" onClick={moveUp} disabled={!canMoveUp}>
                ↑
              </Button>
              <Button variant="ghost" size="sm" onClick={moveDown} disabled={!canMoveDown}>
                ↓
              </Button>
              <Button variant="ghost" size="sm" onClick={remove}>
                ×
              </Button>
              <span
                style={{
                  alignSelf: 'center',
                  fontSize: 12,
                  color: 'var(--ifm-color-emphasis-600)',
                }}
              >
                #{index + 1}
              </span>
            </div>
          )}
        </FormArray.List>
        <FormArray.AddButton initialValue={{ kind: '', number: '' }}>
          + Добавить
        </FormArray.AddButton>
      </FormArray.Root>
    </div>
  );
}

function FormArrayImperativeDemo() {
  const { form } = usePhoneForm([]);
  const arrayRef = useRef<FormArrayHandle<Phone>>(null);
  return (
    <div style={WRAP}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => arrayRef.current?.add({ kind: 'Мобильный', number: '' })}
        >
          + Мобильный
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => arrayRef.current?.add({ kind: 'Рабочий', number: '' })}
        >
          + Рабочий
        </Button>
        <Button variant="ghost" size="sm" onClick={() => arrayRef.current?.clear()}>
          Очистить
        </Button>
      </div>
      <FormArray.Root ref={arrayRef} control={form.phones}>
        <FormArray.Empty>
          <p style={MUTED}>Пусто — добавьте через тулбар снаружи массива</p>
        </FormArray.Empty>
        <FormArray.List>
          {({ control, index, remove }: any) => (
            <PhoneCardRow control={control} index={index} remove={remove} />
          )}
        </FormArray.List>
      </FormArray.Root>
    </div>
  );
}

function FormArrayImportDemo() {
  const { form } = usePhoneForm([]);
  const arrayRef = useRef<FormArrayHandle<Phone>>(null);
  const importRows = () => {
    const ref = arrayRef.current;
    if (!ref) return;
    // Читаем текущие номера через at(i) → дедуп по номеру.
    const existing = new Set(
      Array.from(
        { length: ref.length },
        (_, i) => (ref.at(i) as any)?.getValue?.()?.number as string | undefined
      )
    );
    for (const row of IMPORT_ROWS) {
      if (existing.has(row.number)) continue;
      existing.add(row.number);
      ref.insert(0, row);
    }
  };
  return (
    <div style={WRAP}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Button variant="outline" size="sm" onClick={importRows}>
          Импортировать из API
        </Button>
        <Button variant="ghost" size="sm" onClick={() => arrayRef.current?.clear()}>
          Очистить
        </Button>
      </div>
      <FormArray.Root ref={arrayRef} control={form.phones}>
        <FormArray.Empty>
          <p style={MUTED}>Нажмите «Импортировать» — дубликаты по номеру пропускаются</p>
        </FormArray.Empty>
        <FormArray.List>
          {({ control, index, remove }: any) => (
            <PhoneCardRow control={control} index={index} remove={remove} />
          )}
        </FormArray.List>
      </FormArray.Root>
    </div>
  );
}

function FormArrayAsChildDemo() {
  const { form } = usePhoneForm(ONE_PHONE);
  return (
    <div style={WRAP}>
      <FormArray.Root control={form.phones}>
        <FormArray.List>
          {({ control, index }: any) => (
            <div style={CARD}>
              <div style={ROW_HEADER}>
                <strong>Телефон #{index + 1}</strong>
                <FormArray.RemoveButton asChild>
                  <Button variant="ghost" size="sm">
                    Удалить
                  </Button>
                </FormArray.RemoveButton>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <FormField control={control.kind} />
                <FormField control={control.number} />
              </div>
            </div>
          )}
        </FormArray.List>
        <FormArray.AddButton asChild initialValue={{ kind: '', number: '' }}>
          <Button variant="outline" size="sm">
            + Добавить телефон
          </Button>
        </FormArray.AddButton>
      </FormArray.Root>
    </div>
  );
}

function FormArrayInitialValueDemo() {
  const { form } = usePhoneForm([]);
  return (
    <div style={WRAP}>
      <FormArray.Root control={form.phones}>
        <FormArray.Empty>
          <p style={MUTED}>Выберите тип телефона для добавления</p>
        </FormArray.Empty>
        <FormArray.List>
          {({ control, index, remove }: any) => (
            <PhoneCardRow control={control} index={index} remove={remove} />
          )}
        </FormArray.List>
        <div style={{ display: 'flex', gap: 8 }}>
          <FormArray.AddButton style={NATIVE_BTN} initialValue={{ kind: 'Мобильный', number: '' }}>
            + Мобильный
          </FormArray.AddButton>
          <FormArray.AddButton style={NATIVE_BTN} initialValue={{ kind: 'Рабочий', number: '' }}>
            + Рабочий
          </FormArray.AddButton>
        </div>
      </FormArray.Root>
    </div>
  );
}

function FormArrayCountRenderDemo() {
  const { form } = usePhoneForm(ONE_PHONE);
  return (
    <div style={WRAP}>
      <FormArray.Root control={form.phones}>
        <h4 style={{ margin: '0 0 8px' }}>
          <FormArray.Count
            render={(n: number) => (n === 0 ? 'Нет телефонов' : `Указано телефонов: ${n}`)}
          />
        </h4>
        <FormArray.List>
          {({ control, index, remove }: any) => (
            <PhoneCardRow control={control} index={index} remove={remove} />
          )}
        </FormArray.List>
        <FormArray.AddButton style={NATIVE_BTN} initialValue={{ kind: '', number: '' }}>
          + Добавить телефон
        </FormArray.AddButton>
      </FormArray.Root>
    </div>
  );
}

function FormArrayItemIndexDemo() {
  const { form } = usePhoneForm(TWO_PHONES);
  return (
    <div style={WRAP}>
      <FormArray.Root control={form.phones}>
        <FormArray.List>
          {({ control }: any) => (
            <div style={CARD}>
              <div style={ROW_HEADER}>
                <strong>
                  Позиция <FormArray.ItemIndex render={(i: number) => i} /> (0-based)
                </strong>
                <FormArray.RemoveButton asChild>
                  <Button variant="ghost" size="sm">
                    ×
                  </Button>
                </FormArray.RemoveButton>
              </div>
              <FormField control={control.number} />
            </div>
          )}
        </FormArray.List>
        <FormArray.AddButton style={NATIVE_BTN} initialValue={{ kind: '', number: '' }}>
          + Добавить
        </FormArray.AddButton>
      </FormArray.Root>
    </div>
  );
}

function FormArrayErrorDemo() {
  const { form } = usePhoneForm([], (f) =>
    f.phones.setErrors([
      { code: 'minItems', message: 'Добавьте хотя бы один телефон' },
      { code: 'required', message: 'Контактный телефон обязателен' },
    ])
  );
  return (
    <div style={WRAP}>
      <FormArray.Root control={form.phones}>
        <FormArray.Empty>
          <p style={MUTED}>Список телефонов пуст</p>
        </FormArray.Empty>
        <FormArray.List>
          {({ control, index, remove }: any) => (
            <PhoneCardRow control={control} index={index} remove={remove} />
          )}
        </FormArray.List>
        <FormArray.Error
          multi
          style={ERROR_TEXT}
          render={(err: any) => <span>• {err.message}</span>}
        />
        <FormArray.AddButton style={NATIVE_BTN} initialValue={{ kind: '', number: '' }}>
          + Добавить телефон
        </FormArray.AddButton>
      </FormArray.Root>
    </div>
  );
}

function FormArraySectionFullDemo() {
  const { form } = usePhoneForm([]);
  return (
    <div style={WRAP}>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Телефоны"
        itemLabel="Телефон"
        addButtonLabel="+ Добавить телефон"
        removeButtonLabel="Убрать"
        emptyMessage="Нажмите «Добавить телефон», чтобы указать контакт"
        emptyMessageHint="Можно указать несколько номеров"
        showRemoveOnSingle
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

function FormArrayHasItemsDemo() {
  const { form } = usePhoneForm(ONE_PHONE);
  const [hasItems, setHasItems] = useState(false);
  return (
    <div style={WRAP}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input type="checkbox" checked={hasItems} onChange={(e) => setHasItems(e.target.checked)} />
        У меня есть дополнительные телефоны
      </label>
      <FormArraySection
        control={form.phones}
        itemComponent={PhoneItem}
        title="Дополнительные телефоны"
        itemLabel="Телефон"
        addButtonLabel="+ Добавить телефон"
        emptyMessage="Список пуст"
        hasItems={hasItems}
        showRemoveOnSingle
        initialValue={{ kind: '', number: '' }}
      />
    </div>
  );
}

export const formArrayDocConfig: ComponentDocConfig = {
  name: 'FormArray',
  importFrom: '@reformer/cdk/form-array',
  description:
    'Headless compound-компонент для динамических массивов. Variants — структурные ФОРМЫ сборки ' +
    'массива: базовая ручная headless-композиция (Root + List + AddButton) и пресеты FormArraySection ' +
    '(с заголовком / без заголовка / с перестановкой). Состояния (пусто / заполнено / disabled / invalid) ' +
    'и возможности (render-props, hook, imperative ref, asChild, ограничения, кастомный render) — в Examples.',
  variants: [
    {
      id: 'headless',
      title: 'Headless-сборка (базовая форма)',
      description:
        'Ручная композиция из под-компонентов: Root + Empty + List (карточка на элемент) + AddButton. ' +
        'Разметку и стили пишете сами — это то, чем FormArray является структурно.',
      hint: 'howBuilt: ручная композиция из под-компонентов',
      render: FormArrayHeadlessBase,
      code: `<FormArray.Root control={form.phones}>
  <FormArray.Empty>
    <p>Телефоны не добавлены</p>
  </FormArray.Empty>
  <FormArray.List>
    {({ control, index, remove }) => (
      <div>
        <strong>Телефон #{index + 1}</strong>
        <FormField control={control.kind} />
        <FormField control={control.number} />
        <Button onClick={remove}>Удалить</Button>
      </div>
    )}
  </FormArray.List>
  <FormArray.AddButton initialValue={{ kind: '', number: '' }}>
    + Добавить телефон
  </FormArray.AddButton>
</FormArray.Root>`,
    },
    {
      id: 'section-title',
      title: 'Секция с заголовком (FormArraySection)',
      description:
        'Styled-пресет: title задан → заголовок секции и кнопка добавления в шапке (header-layout).',
      hint: 'howBuilt: props высокоуровневого FormArraySection',
      render: SectionWithTitle,
      code: `<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  initialValue={{ kind: '', number: '' }}
/>`,
    },
    {
      id: 'section-no-title',
      title: 'Секция без заголовка (footer-add)',
      description:
        'Styled-пресет: title не задан → кнопка добавления рендерится ссылкой-футером внизу (footer-layout).',
      hint: 'howBuilt: props высокоуровневого FormArraySection',
      render: SectionNoTitle,
      code: `<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  itemLabel="Телефон"
  addButtonLabel="+ Добавить телефон"
  initialValue={{ kind: '', number: '' }}
/>`,
    },
    {
      id: 'section-reorderable',
      title: 'Секция с перестановкой (↑/↓)',
      description:
        'Styled-пресет: reorderable=true → на каждой карточке кнопки ↑/↓ (reorder-layout, элементы можно менять местами).',
      hint: 'howBuilt: props высокоуровневого FormArraySection',
      render: SectionReorderable,
      code: `<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  itemLabel="Телефон"
  reorderable
  initialValue={{ kind: '', number: '' }}
/>`,
    },
  ],
  examples: [
    {
      id: 'all-parts',
      title: 'Все части compound-API',
      description:
        'Собрать из полного набора под-компонентов: Root + Count + Empty + List + ItemIndex + RemoveButton + AddButton.',
      render: FormArrayHeadlessDemo,
      code: `<FormArray.Root control={form.phones}>
  <h4>Телефоны (<FormArray.Count />)</h4>

  <FormArray.Empty><p>Телефоны не добавлены</p></FormArray.Empty>

  <FormArray.List>
    {({ control }) => (
      <div>
        <strong>Телефон #<FormArray.ItemIndex /></strong>
        <FormArray.RemoveButton>Удалить</FormArray.RemoveButton>
        <FormField control={control.kind} />
        <FormField control={control.number} />
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton initialValue={{ kind: '', number: '' }}>
    + Добавить телефон
  </FormArray.AddButton>
</FormArray.Root>`,
    },
    {
      id: 'hook',
      title: 'Хук useFormArray',
      description:
        'items / add / clear / insert / move / swap / length / isEmpty без compound-компонентов; T выводится из control.',
      render: UseFormArrayDemo,
      code: `import { useFormArray } from '@reformer/cdk/form-array';

const { items, add, length } = useFormArray(form.phones);

<>
  <p>Всего: {length}</p>
  {items.map(({ control, id, remove }) => (
    <div key={id}>
      <FormField control={control.number} />
      <button onClick={remove}>×</button>
    </div>
  ))}
  <button onClick={() => add({ kind: '', number: '' })}>+ Добавить</button>
</>`,
    },
    {
      id: 'reorder',
      title: 'Переупорядочивание через render-props',
      description:
        'moveUp / moveDown / canMoveUp / canMoveDown прямо в render-prop; move сохраняет состояние элементов.',
      render: FormArrayReorder,
      code: `<FormArray.List>
  {({ control, remove, moveUp, moveDown, canMoveUp, canMoveDown }) => (
    <div>
      <FormField control={control.number} />
      <button onClick={moveUp} disabled={!canMoveUp}>↑</button>
      <button onClick={moveDown} disabled={!canMoveDown}>↓</button>
      <button onClick={remove}>×</button>
    </div>
  )}
</FormArray.List>`,
    },
    {
      id: 'imperative-ref',
      title: 'Имперо-управление через ref',
      description:
        'Тулбар вне дерева массива вызывает arrayRef.current.add / clear через FormArrayHandle.',
      render: FormArrayImperativeDemo,
      code: `import { useRef } from 'react';
import { FormArray, type FormArrayHandle } from '@reformer/cdk/form-array';

const arrayRef = useRef<FormArrayHandle<Phone>>(null);

<div className="toolbar">
  <button onClick={() => arrayRef.current?.add({ kind: 'Мобильный', number: '' })}>+ Мобильный</button>
  <button onClick={() => arrayRef.current?.clear()}>Очистить</button>
</div>

<FormArray.Root ref={arrayRef} control={form.phones}>
  <FormArray.List>{(item) => <PhoneCard {...item} />}</FormArray.List>
</FormArray.Root>`,
    },
    {
      id: 'import-dedup',
      title: 'Импорт из API: insert + at (дедуп)',
      description:
        'Программное наполнение массива с пропуском дубликатов: at(i) читает значения, insert(0, row) добавляет уникальные.',
      render: FormArrayImportDemo,
      code: `const arrayRef = useRef<FormArrayHandle<Phone>>(null);

function importRows(rows: Phone[]) {
  const ref = arrayRef.current;
  if (!ref) return;
  const existing = new Set(
    Array.from({ length: ref.length }, (_, i) => ref.at(i)?.getValue().number)
  );
  for (const row of rows) {
    if (existing.has(row.number)) continue; // дубликат
    existing.add(row.number);
    ref.insert(0, row);
  }
}`,
    },
    {
      id: 'as-child',
      title: 'Своя кнопка через asChild',
      description:
        'asChild (Slot) на AddButton / RemoveButton: рендерится ваш компонент, props (onClick/disabled) мержатся.',
      render: FormArrayAsChildDemo,
      code: `<FormArray.RemoveButton asChild>
  <Button variant="ghost" size="sm">Удалить</Button>
</FormArray.RemoveButton>

<FormArray.AddButton asChild initialValue={{ kind: '', number: '' }}>
  <Button variant="outline" size="sm">+ Добавить телефон</Button>
</FormArray.AddButton>`,
    },
    {
      id: 'initial-value',
      title: 'Типизированный initialValue',
      description:
        'Задать форму добавляемого элемента type-safe — несколько кнопок с разными seed-значениями.',
      render: FormArrayInitialValueDemo,
      code: `<FormArray.AddButton<Phone> initialValue={{ kind: 'Мобильный', number: '' }}>
  + Мобильный
</FormArray.AddButton>

<FormArray.AddButton<Phone> initialValue={{ kind: 'Рабочий', number: '' }}>
  + Рабочий
</FormArray.AddButton>`,
    },
    {
      id: 'count-render',
      title: 'Кастомный счётчик (Count.render)',
      description: 'render получает число элементов — плюрализация / условный текст.',
      render: FormArrayCountRenderDemo,
      code: `<FormArray.Count
  render={(n) => (n === 0 ? 'Нет телефонов' : \`Указано телефонов: \${n}\`)}
/>`,
    },
    {
      id: 'item-index-render',
      title: 'Кастомная нумерация (ItemIndex.render)',
      description: 'По умолчанию 1-based; render получает 0-based index — любой формат позиции.',
      render: FormArrayItemIndexDemo,
      code: `// по умолчанию: <FormArray.ItemIndex /> → 1, 2, 3…
<FormArray.ItemIndex render={(index) => index} />        {/* 0-based */}
<FormArray.ItemIndex render={(i) => \`Позиция: \${i + 1}\`} />`,
    },
    {
      id: 'array-error',
      title: 'Ошибки массива (FormArray.Error)',
      description:
        'default — первая ошибка; multi — все; render — кастомный рендер на каждую ошибку.',
      render: FormArrayErrorDemo,
      code: `// первая ошибка
<FormArray.Error className="text-red-600" />

// все ошибки
<FormArray.Error multi className="text-red-600" />

// кастомный рендер на каждую
<FormArray.Error render={(err) => <p>• {err.message}</p>} />`,
    },
    {
      id: 'max-items',
      title: 'Ограничение количества (maxItems)',
      description:
        'maxItems задаёт верхний предел массива: при достижении лимита кнопка добавления скрывается.',
      render: SectionMaxItems,
      code: `<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны (макс. 2)"
  maxItems={2}
  initialValue={{ kind: '', number: '' }}
/>`,
    },
    {
      id: 'remove-on-single',
      title: 'Политика удаления на единственном (showRemoveOnSingle)',
      description:
        'По умолчанию при одном элементе «Удалить» скрыт (защита от пустого массива); showRemoveOnSingle оставляет кнопку всегда.',
      render: SectionRemoveHiddenSingle,
      code: `// default: при одном элементе «Удалить» скрыт
<FormArraySection control={form.phones} itemComponent={PhoneItem} title="Телефоны" />

// показывать «Удалить» даже на единственном элементе:
<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  showRemoveOnSingle
/>`,
    },
    {
      id: 'styled-section',
      title: 'Готовая styled-секция (FormArraySection)',
      description:
        'ui-kit-обёртка поверх headless CDK: title, метки, тексты кнопок и empty-сообщение одной декларацией.',
      render: FormArraySectionFullDemo,
      code: `import { FormArraySection } from '@reformer/ui-kit/form-array';

const PhoneItem: FC<{ control: FormProxy<Phone> }> = ({ control }) => (
  <>
    <FormField control={control.kind} />
    <FormField control={control.number} />
  </>
);

<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Телефоны"
  itemLabel="Телефон"
  addButtonLabel="+ Добавить телефон"
  emptyMessage="Нажмите «Добавить телефон», чтобы указать контакт"
  initialValue={{ kind: '', number: '' }}
/>`,
    },
    {
      id: 'has-items',
      title: 'Условная секция через hasItems',
      description:
        'Section hasItems привязан к чекбоксу («У меня есть…»): false скрывает секцию целиком.',
      render: FormArrayHasItemsDemo,
      code: `const [hasItems, setHasItems] = useState(false);

<label>
  <input type="checkbox" checked={hasItems} onChange={(e) => setHasItems(e.target.checked)} />
  У меня есть дополнительные телефоны
</label>

<FormArraySection
  control={form.phones}
  itemComponent={PhoneItem}
  title="Дополнительные телефоны"
  hasItems={hasItems}
  initialValue={{ kind: '', number: '' }}
/>`,
    },
  ],
  props: [
    {
      name: 'FormArray.Root',
      type: 'control: ArrayNode<T> | ModelArrayNode<T>; ref?: FormArrayHandle<T>',
      description:
        'Провайдер контекста массива. Через ref даёт имперо-API (add/clear/insert/removeAt/move/swap/at/length/isEmpty).',
    },
    {
      name: 'FormArray.List',
      type: 'children: (item) => ReactNode; as?; className?',
      description:
        'Итерация по элементам (render-props: control, index, id, remove, moveUp/moveDown, canMoveUp/canMoveDown).',
    },
    {
      name: 'FormArray.AddButton',
      type: 'initialValue?: Partial<T>; asChild?: boolean',
      description:
        'Добавляет новый элемент в конец. Авто-disabled при disabled-массиве. asChild → свой компонент.',
    },
    {
      name: 'FormArray.RemoveButton',
      type: 'asChild?: boolean',
      description:
        'Удаляет текущий элемент (внутри List). Авто-disabled при disabled-массиве. asChild → свой компонент.',
    },
    {
      name: 'FormArray.Empty',
      type: 'children: ReactNode',
      description: 'Показывается, когда массив пуст (length = 0).',
    },
    {
      name: 'FormArray.Count',
      type: 'render?: (count) => ReactNode',
      description: 'Отображает число элементов; render — кастомный вывод (плюрализация).',
    },
    {
      name: 'FormArray.ItemIndex',
      type: 'render?: (index) => ReactNode',
      description:
        'Номер элемента (внутри List). По умолчанию 1-based; render получает 0-based index.',
    },
    {
      name: 'FormArray.Error',
      type: 'multi?: boolean; render?: (err, i) => ReactNode; asChild?: boolean',
      description:
        'Array-level ошибки (minItems и т.п.) из control.errors. default — первая, multi — все.',
    },
    {
      name: 'useFormArray(control)',
      type: '→ { items, add, clear, insert, removeAt, move, swap, at, length, isEmpty, errors, valid, invalid }',
      description: 'Хук для полностью кастомной раскладки; T выводится из control.',
    },
    {
      name: 'FormArraySection (ui-kit)',
      type: 'title? / itemLabel? / reorderable? / maxItems? / showRemoveOnSingle? / hasItems? / emptyMessage? …',
      description:
        'Готовая styled-обёртка поверх headless CDK: настройки раскладки и текстов секции.',
    },
  ],
};
