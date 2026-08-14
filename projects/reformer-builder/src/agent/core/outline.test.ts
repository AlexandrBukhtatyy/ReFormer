import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptySchema } from '../../model';
import { sampleSchema } from '../../model/__fixtures__/sample-schema';
import { buildOutline, renderOutline } from './outline';
import { componentOf, isResolved, resolveRef } from './node-ref';

describe('buildOutline', () => {
  it('обходит неоднородную вложенность: steps, children и item.$template', () => {
    const entries = buildOutline(sampleSchema());
    expect(entries.map((e) => [e.ref, e.component, e.slot])).toEqual([
      ['/root', 'RendererFormWizard', undefined],
      ['/root/componentProps/steps/0', 'Step', 'steps'],
      ['/root/componentProps/steps/0/children/0', 'Select', 'children'],
      ['/root/componentProps/steps/0/children/1', 'Input', 'children'],
      ['/root/componentProps/steps/1', 'Step', 'steps'],
      ['/root/componentProps/steps/1/children/0', 'FormArray', 'children'],
      ['/root/componentProps/steps/1/children/0/item/$template', 'Box', 'template'],
      ['/root/componentProps/steps/1/children/0/item/$template/children/0', 'Select', 'children'],
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
    const select = entries.find((e) => e.ref.endsWith('/steps/0/children/0'));
    expect(select).toMatchObject({
      kind: 'field',
      model: 'loanType',
      label: 'Тип кредита',
      depth: 2,
    });
  });

  it('required отмечается', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            value: '$model(email)',
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
});

describe('renderOutline', () => {
  it('строка узла несёт адрес, компонент, модель и подпись', () => {
    const text = renderOutline(buildOutline(sampleSchema()), 4000);
    expect(text).toContain(
      '/root/componentProps/steps/0/children/0 · Select · model=loanType · «Тип кредита»'
    );
  });

  it('при нехватке бюджета обрезает ОСОЗНАННО, сообщая о пропущенных узлах', () => {
    const text = renderOutline(buildOutline(sampleSchema()), 120);
    expect(text).toContain('call get_form_node');
    expect(text.split('\n').length).toBeLessThan(8);
  });

  it('пустой список объясняется словами', () => {
    expect(renderOutline([], 100)).toContain('The form is empty');
  });

  it('при нехватке бюджета жертвует полями, а не структурой', () => {
    // Ровно тот случай, на котором ход сгорел вживую: мастер с полным первым шагом, а модель
    // просят дописать поля во второй и третий. Обрезка «по порядку» оставляла поля первого шага и
    // отбрасывала сами шаги — модель не находила их адресов, не могла подтвердить, что они есть,
    // и весь ход сомневалась вместо работы.
    const steps = [0, 1, 2].map((s) => `/root/componentProps/steps/${s}`);
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
