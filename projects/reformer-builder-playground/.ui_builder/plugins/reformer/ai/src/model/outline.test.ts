import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptySchema } from '../../../core/form-model';
import { sampleSchema } from '../../../core/testing';
import { buildOutline, renderOutline } from './outline';
import { componentOf, isResolved, resolveRef } from './node-ref';

describe('buildOutline', () => {
  it('обходит неоднородную вложенность: steps, children и item.$template', () => {
    const entries = buildOutline(sampleSchema());
    expect(entries.map((e) => [e.ref, e.component, e.slot])).toEqual([
      ['/root', 'RendererFormWizard', undefined],
      ['/root/children/0', 'Step', 'steps'],
      ['/root/children/0/children/0', 'Select', 'children'],
      ['/root/children/0/children/1', 'InputNumber', 'children'],
      ['/root/children/1', 'Step', 'steps'],
      ['/root/children/1/children/0', 'FieldArray', 'children'],
      ['/root/children/1/children/0/item/$template', 'Box', 'template'],
      ['/root/children/1/children/0/item/$template/children/0', 'Select', 'children'],
    ]);
  });

  it('каждый адрес дайджеста резолвится обратно в тот же узел', () => {
    const schema = sampleSchema();
    for (const entry of buildOutline(schema)) {
      const found = resolveRef(schema, entry.ref);
      expect(isResolved(found), `не резолвится: ${entry.ref}`).toBe(true);
      if (isResolved(found)) expect(componentOf(found.node)).toBe(entry.component);
    }
  });

  it('модель, подпись и глубина попадают в строку', () => {
    const entries = buildOutline(sampleSchema());
    const select = entries.find((e) => e.ref === '/root/children/0/children/0');
    expect(select).toMatchObject({
      kind: 'field',
      model: 'loanType',
      label: 'Тип кредита',
      depth: 2,
    });
  });

  it('required отмечается', () => {
    const schema = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            model: '$model(email)',
            component: '$component(Input)',
            componentProps: { label: 'Email', required: true },
          },
        ],
      },
    } as unknown as JsonFormSchema;
    expect(buildOutline(schema)[1].required).toBe(true);
  });

  it('пустая форма — один корневой узел; схема без корня — пусто', () => {
    expect(buildOutline(emptySchema())).toHaveLength(1);
    expect(buildOutline({} as JsonFormSchema)).toEqual([]);
  });

  it('шаги визарда — слот steps, хотя лежат в children, как дети секции', () => {
    // По адресу слот шагов от слота детей не отличить: оба кончаются на `children`. Вид слота —
    // единственное, по чему инструменты знают, что в визард кладут шаги, а не поля.
    const entries = buildOutline(sampleSchema());
    const step = entries.find((e) => e.ref === '/root/children/0');
    const field = entries.find((e) => e.ref === '/root/children/0/children/0');
    expect(step?.slot).toBe('steps');
    expect(field?.slot).toBe('children');
  });

  it('визард без children карту не роняет', () => {
    const schema = {
      format: 2,
      root: { component: '$component(Wizard)' },
    } as unknown as JsonFormSchema;
    expect(buildOutline(schema).map((e) => [e.ref, e.component])).toEqual([['/root', 'Wizard']]);
  });

  it('подформа и массив с шаблоном-частью — листья с именем части; разметка части — своим блоком', () => {
    const entries = buildOutline(withParts());
    expect(entries.map((e) => [e.ref, e.kind, e.component, e.model, e.part])).toEqual([
      ['/root', 'container', 'Box', undefined, undefined],
      ['/root/children/0', 'part', undefined, 'registrationAddress', 'address'],
      ['/root/children/1', 'array', 'FieldArray', 'previousAddresses', 'address'],
      // Разметка части идёт после дерева корня, адресом в `parts`: её правят те же инструменты.
      ['/parts/address', 'container', 'Box', undefined, undefined],
      ['/parts/address/children/0', 'field', 'Input', 'city', undefined],
    ]);
    expect(entries.find((e) => e.ref === '/parts/address')?.partDef).toBe('address');
    const text = renderOutline(entries, 4000);
    expect(text).toContain('part «address»: /parts/address · Box');
    expect(text).toContain('/root/children/0 · (part) · model=registrationAddress · part=address');
  });
});

/** Форма с подформой и с массивом, чей шаблон строки — именованная часть документа. */
function withParts(): JsonFormSchema {
  return {
    format: 2,
    parts: {
      address: {
        component: '$component(Box)',
        children: [{ model: '$model(city)', component: '$component(Input)' }],
      },
    },
    root: {
      component: '$component(Box)',
      children: [
        { model: '$model(registrationAddress)', part: '$part(address)' },
        { model: '$model(previousAddresses)', item: '$part(address)' },
      ],
    },
  } as unknown as JsonFormSchema;
}

describe('renderOutline', () => {
  it('строка узла несёт адрес, компонент, модель и подпись', () => {
    const text = renderOutline(buildOutline(sampleSchema()), 4000);
    expect(text).toContain('/root/children/0/children/0 · Select · model=loanType · «Тип кредита»');
  });

  it('при нехватке бюджета обрезает ОСОЗНАННО, сообщая о пропущенных узлах', () => {
    const text = renderOutline(buildOutline(sampleSchema()), 120);
    expect(text).toContain('call get_form_node');
    expect(text.split('\n').length).toBeLessThan(8);
  });

  it('пустой список объясняется словами', () => {
    expect(renderOutline([], 100)).toContain('The form is empty');
  });

  it('подформа печатается своим видом и привязкой, а под нажимом бюджета не сворачивается в поля', () => {
    expect(renderOutline(buildOutline(withParts()), 4000)).toContain(
      '/root/children/0 · (part) · model=registrationAddress'
    );

    // Тесный бюджет сворачивает поля в счётчик. Подформа — не поле: за её строкой стоит группа
    // модели, и счётчик «N полей» о ней бы соврал.
    const schema = withParts();
    const children = (schema.root as { children: unknown[] }).children;
    children.unshift(
      ...Array.from({ length: 10 }, (_, i) => ({
        model: `$model(field${i})`,
        component: '$component(Input)',
        componentProps: { label: `Поле ${i}` },
      }))
    );
    const tight = renderOutline(buildOutline(schema), 250);
    expect(tight).toContain('10 field(s) here');
    expect(tight).toContain('/root/children/10 · (part) · model=registrationAddress');
  });

  it('при нехватке бюджета жертвует полями, а не структурой', () => {
    // Ровно тот случай, на котором ход сгорел вживую: мастер с полным первым шагом, а модель
    // просят дописать поля во второй и третий. Обрезка «по порядку» оставляла поля первого шага и
    // отбрасывала сами шаги — модель не находила их адресов, не могла подтвердить, что они есть,
    // и весь ход сомневалась вместо работы.
    const steps = [0, 1, 2].map((s) => `/root/children/${s}`);
    const entries = [
      { ref: '/root', depth: 0, kind: 'container' as const, component: 'Wizard' },
      ...steps.flatMap((step, s) => [
        { ref: step, depth: 1, kind: 'container' as const, component: 'Step' },
        // Первый шаг набит полями, остальные пусты — как в живой форме.
        ...(s === 0
          ? Array.from({ length: 40 }, (_, i) => ({
              ref: `${step}/children/${i}`,
              depth: 2,
              kind: 'field' as const,
              component: 'Input',
              model: `user.f${i}`,
              label: `Поле ${i}`,
            }))
          : []),
      ]),
    ];

    const text = renderOutline(entries, 600);

    // Адреса ВСЕХ шагов на месте — без них задача «допиши во второй шаг» неразрешима.
    for (const step of steps) expect(text).toContain(step);
    // Поля свёрнуты в счётчик, а не выброшены молча.
    expect(text).toContain('40 field(s) here');
    expect(text.length).toBeLessThanOrEqual(600);
  });

  it('форма, которая влезает целиком, показывается целиком', () => {
    // Сворачивание — аварийный режим: пока бюджета хватает, модель должна видеть каждое поле.
    const text = renderOutline(buildOutline(sampleSchema()), 4000);
    expect(text).not.toContain('field(s) here');
    expect(text).toContain('model=loanType');
  });
});
