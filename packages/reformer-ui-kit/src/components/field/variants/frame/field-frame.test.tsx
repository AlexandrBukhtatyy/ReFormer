import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FieldFrame, type FieldFrameProps } from '@/components/field';

const render = (props: FieldFrameProps) => renderToStaticMarkup(<FieldFrame {...props} />);

describe('FieldFrame — рамка поля без узла формы', () => {
  it('подпись связана с контролом, обязательность отмечена', () => {
    const html = render({
      id: 'email',
      label: 'Email',
      required: true,
      children: <input id="email" />,
    });
    expect(html).toMatch(/<label[^>]*for="email"[^>]*>Email<span aria-hidden="true"> \*<\/span>/);
    expect(html).toContain('<input id="email"/>');
  });

  it('контрол, подписывающий себя сам, второй подписи не получает', () => {
    const html = render({ label: 'Согласен', inlineLabel: true, children: <span>чекбокс</span> });
    expect(html).not.toContain('<label');
    expect(html).toContain('чекбокс');
  });

  it('описание и ошибки — под контролом; одинаковые сообщения не дублируются', () => {
    const html = render({
      label: 'Имя',
      description: 'Как в паспорте',
      errors: ['Обязательное поле', 'Обязательное поле'],
      children: <input />,
    });
    expect(html).toContain('data-slot="field-description"');
    expect(html).toContain('Как в паспорте');
    expect(html).toMatch(/data-invalid="true"/);
    expect(html.match(/Обязательное поле/g)).toHaveLength(1);
  });

  it('несколько разных ошибок — списком', () => {
    const html = render({ errors: ['Слишком коротко', 'Только цифры'], children: <input /> });
    expect(html).toContain('<li>Слишком коротко</li><li>Только цифры</li>');
  });

  it('без ошибок рамка не помечена невалидной и блока ошибок нет', () => {
    const html = render({ label: 'Имя', errors: [], children: <input /> });
    expect(html).not.toContain('data-invalid');
    expect(html).not.toContain('field-error');
  });

  it('className доходит до корня — по нему билдер находит узел кликом', () => {
    const html = render({ className: 'rbnode-abc12345', children: <input /> });
    expect(html).toMatch(/^<div[^>]*data-slot="field"[^>]*class="[^"]*rbnode-abc12345/);
  });

  it('скрытое поле не рисуется вовсе', () => {
    expect(render({ label: 'Имя', hidden: true, children: <input /> })).toBe('');
  });
});
